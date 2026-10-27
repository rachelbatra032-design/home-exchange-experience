"use server";

import type { DocumentType } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { liveDecision } from "../homes";
import { forfeitWelcome, grantWelcome } from "../points/ledger";
import { appliedAmount } from "../protection/claims";
import { requireAdmin } from "../session";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function saveChecklist(formData: FormData) {
  const admin = await requireAdmin();
  const homeId = String(formData.get("homeId"));
  await prisma.home.update({
    where: { id: homeId },
    data: {
      status: "IN_REVIEW",
      nameMatch: formData.get("nameMatch") === "on",
      addressMatch: formData.get("addressMatch") === "on",
      titleChecked: formData.get("titleChecked") === "on",
      coOwnerChecked: formData.get("coOwnerChecked") === "on",
      permissionsChecked: formData.get("permissionsChecked") === "on",
      reviewerNote: String(formData.get("reviewerNote") ?? "").trim() || null,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "home.checklist",
      subjectType: "home",
      subjectId: homeId,
      note: "Checklist saved.",
    },
  });
  redirect(`/admin/homes/${homeId}?note=Checklist%20saved.`);
}

export async function reviewDocument(formData: FormData) {
  await requireAdmin();
  const homeId = String(formData.get("homeId"));
  const documentId = String(formData.get("documentId"));
  const status = String(formData.get("status")) === "APPROVED" ? "APPROVED" : "REJECTED";
  await prisma.homeDocument.update({
    where: { id: documentId },
    data: {
      status,
      note: String(formData.get("note") ?? "").trim() || null,
    },
  });
  redirect(`/admin/homes/${homeId}?note=The%20paper%20is%20marked.`);
}

export async function listHome(formData: FormData) {
  const admin = await requireAdmin();
  const homeId = String(formData.get("homeId"));
  const decision = await liveDecision(homeId);
  if (!decision.ok) fail(`/admin/homes/${homeId}`, decision.reasons.join(" "));
  await prisma.$transaction(async (tx) => {
    const home = await tx.home.update({
      where: { id: homeId },
      data: { status: "LIVE", listedAt: new Date() },
    });
    await grantWelcome(tx, home.ownerId);
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: "home.listed",
        subjectType: "home",
        subjectId: homeId,
        note: "Listed after the checklist and the papers.",
      },
    });
  });
  redirect(`/admin/homes/${homeId}?note=The%20home%20is%20listed.`);
}

export async function requestChanges(formData: FormData) {
  const admin = await requireAdmin();
  const homeId = String(formData.get("homeId"));
  const note = String(formData.get("reviewerNote") ?? "").trim();
  if (note.length < 5) fail(`/admin/homes/${homeId}`, "Tell them what to fix.");
  await prisma.home.update({
    where: { id: homeId },
    data: { status: "CHANGES_REQUESTED", reviewerNote: note },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "home.changes",
      subjectType: "home",
      subjectId: homeId,
      note,
    },
  });
  redirect(`/admin/homes/${homeId}?note=Sent%20back.`);
}

export async function removeForFalsePapers(formData: FormData) {
  const admin = await requireAdmin();
  const homeId = String(formData.get("homeId"));
  await prisma.$transaction(async (tx) => {
    const home = await tx.home.update({
      where: { id: homeId },
      data: { status: "SUSPENDED", falseDocuments: true, reviewerNote: "Removed for false papers." },
    });
    await forfeitWelcome(tx, home.ownerId);
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: "home.false_papers",
        subjectType: "home",
        subjectId: homeId,
        note: "Welcome grant forfeited where it had been given.",
      },
    });
  });
  redirect(`/admin/homes/${homeId}?note=Removed%20for%20false%20papers.`);
}

export async function saveCity(formData: FormData) {
  await requireAdmin();
  const city = String(formData.get("city"));
  const types = formData.getAll("apartmentRequires").map(String) as DocumentType[];
  const house = formData.getAll("houseRequires").map(String) as DocumentType[];
  await prisma.cityProfile.update({
    where: { city },
    data: {
      tier: Number(formData.get("tier")),
      enabled: formData.get("enabled") === "on",
      policeIntimation: formData.get("policeIntimation") === "on",
      counselNote: String(formData.get("counselNote") ?? "").trim(),
      apartmentRequires: types,
      houseRequires: house,
    },
  });
  redirect("/admin/cities?note=The%20city%20rule%20is%20saved.");
}

export async function resolveDisputedClaim(formData: FormData) {
  const admin = await requireAdmin();
  const stayId = String(formData.get("stayId"));
  const claimId = String(formData.get("claimId"));
  const amount = Number(formData.get("amount"));
  const note = String(formData.get("note") ?? "").trim();
  if (!Number.isInteger(amount) || amount < 0) fail(`/stays/${stayId}`, "Enter the rupees to apply.");
  if (note.length < 5) fail(`/stays/${stayId}`, "Write how you decided.");
  await prisma.$transaction(async (tx) => {
    const stay = await tx.stay.findUniqueOrThrow({ where: { id: stayId } });
    const take = appliedAmount(amount, stay.depositRupees);
    const refund = stay.depositRupees - take;
    if (take > 0) {
      await tx.payment.create({
        data: {
          userId: stay.guestId,
          stayId,
          kind: "DEPOSIT_APPLIED",
          amountPaise: take * 100,
          note,
        },
      });
    }
    if (refund > 0) {
      await tx.payment.create({
        data: {
          userId: stay.guestId,
          stayId,
          kind: "DEPOSIT_REFUND",
          amountPaise: refund * 100,
          note: "The rest of the damage deposit, returned by the desk.",
        },
      });
    }
    await tx.claim.update({
      where: { id: claimId },
      data: {
        status: "RESOLVED",
        appliedRupees: take,
        resolutionNote: note,
        resolvedAt: new Date(),
      },
    });
    await tx.stay.update({
      where: { id: stayId },
      data: {
        depositAppliedRupees: take,
        depositState: take === 0 ? "REFUNDED" : take < stay.depositRupees ? "PARTIALLY_APPLIED" : "APPLIED",
        status: "COMPLETED",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: "claim.resolved",
        subjectType: "stay",
        subjectId: stayId,
        note,
      },
    });
  });
  redirect(`/stays/${stayId}?note=The%20desk%20has%20settled%20the%20deposit.`);
}
