"use server";

import { redirect } from "next/navigation";
import { prisma } from "../db";
import { daysUntil, nightsBetween, parseDay } from "../format";
import { cancellationSplit, depositRupees, membershipBreakdown } from "../points/valuation";
import { holdPoints, releaseHeld, settleHeldToHost } from "../points/ledger";
import { answerWindowOpen, appliedAmount, claimWindowOpen } from "../protection/claims";
import { requireUser } from "../session";
import { saveUpload } from "../storage";
import { datesClash, refundDeposit } from "../stays";

function fail(stayId: string, message: string): never {
  redirect(`/stays/${stayId}?error=${encodeURIComponent(message)}`);
}

async function partyStay(userId: string, stayId: string) {
  const stay = await prisma.stay.findUnique({
    where: { id: stayId },
    include: { home: true, guest: true, host: true, claims: true },
  });
  if (!stay || (stay.guestId !== userId && stay.hostId !== userId)) {
    redirect("/inbox?error=" + encodeURIComponent("That stay is not yours."));
  }
  return { stay, isGuest: stay.guestId === userId, isHost: stay.hostId === userId };
}

export async function requestStay(formData: FormData) {
  const user = await requireUser();
  const homeId = String(formData.get("homeId"));
  const home = await prisma.home.findUnique({ where: { id: homeId }, include: { owner: true } });
  if (!home || home.status !== "LIVE") {
    redirect(`/homes/${homeId}?error=${encodeURIComponent("This home is not open.")}`);
  }
  if (home.ownerId === user.id) {
    redirect(`/homes/${homeId}?error=${encodeURIComponent("You cannot ask to stay in your own home.")}`);
  }
  if (user.identityStatus !== "VERIFIED") {
    redirect("/verify?error=" + encodeURIComponent("The desk still needs to see your papers."));
  }
  const start = parseDay(String(formData.get("start") ?? ""));
  const end = parseDay(String(formData.get("end") ?? ""));
  if (!start || !end) {
    redirect(`/homes/${homeId}?error=${encodeURIComponent("Choose both dates.")}`);
  }
  const nights = nightsBetween(start, end);
  const today = new Date();
  if (nights < 1 || daysUntil(start, today) < 1) {
    redirect(`/homes/${homeId}?error=${encodeURIComponent("The stay has to be at least one night, and it has to start tomorrow or later.")}`);
  }
  const names = String(formData.get("guestNames") ?? "")
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.length < 1 || names.length > home.occupancyCap) {
    redirect(`/homes/${homeId}?error=${encodeURIComponent(`Name between 1 and ${home.occupancyCap} people, one on each line.`)}`);
  }
  if (await datesClash(home.id, start, end)) {
    redirect(`/homes/${homeId}?error=${encodeURIComponent("Those dates are already held.")}`);
  }
  const stay = await prisma.stay.create({
    data: {
      homeId: home.id,
      hostId: home.ownerId,
      guestId: user.id,
      startDate: start,
      endDate: end,
      nights,
      nightlyPoints: home.nightlyPoints,
      points: home.nightlyPoints * nights,
      guestNames: names.join("\n"),
      vehicle: String(formData.get("vehicle") ?? "").trim() || null,
      idType: user.idType || "PAN",
      status: "REQUESTED",
      depositRupees: depositRupees(home.bedrooms),
    },
  });
  redirect(`/stays/${stay.id}`);
}

export async function acceptStay(formData: FormData) {
  const user = await requireUser();
  const stayId = String(formData.get("stayId"));
  const { stay, isHost } = await partyStay(user.id, stayId);
  if (!isHost || stay.status !== "REQUESTED") fail(stayId, "This request is not waiting on you.");
  if (await datesClash(stay.homeId, stay.startDate, stay.endDate, stay.id)) {
    fail(stayId, "Those dates were taken by another stay.");
  }
  await prisma.stay.update({ where: { id: stayId }, data: { status: "ACCEPTED" } });
  redirect(`/stays/${stayId}?note=Accepted.%20Sign%20the%20licence.`);
}

export async function signStay(formData: FormData) {
  const user = await requireUser();
  const stayId = String(formData.get("stayId"));
  const { stay, isGuest, isHost } = await partyStay(user.id, stayId);
  if (stay.status !== "ACCEPTED" && stay.status !== "AWAITING_PAYMENT") {
    fail(stayId, "The licence is not open for a signature.");
  }
  const signedName = String(formData.get("signedName") ?? "").trim();
  if (signedName.toLowerCase() !== user.name.toLowerCase()) {
    fail(stayId, "Sign with the name on your papers.");
  }
  const data: {
    hostSignedAt?: Date;
    hostSignedName?: string;
    guestSignedAt?: Date;
    guestSignedName?: string;
    rulesAcceptedAt?: Date;
    status?: "AWAITING_PAYMENT";
  } = {};
  if (isHost) {
    data.hostSignedAt = new Date();
    data.hostSignedName = signedName;
  }
  if (isGuest) {
    if (formData.get("rules") !== "on") fail(stayId, "Accept the house rules and the society conditions.");
    data.guestSignedAt = new Date();
    data.guestSignedName = signedName;
    data.rulesAcceptedAt = new Date();
  }
  const hostSigned = isHost ? data.hostSignedAt : stay.hostSignedAt;
  const guestSigned = isGuest ? data.guestSignedAt : stay.guestSignedAt;
  if (hostSigned && guestSigned) data.status = "AWAITING_PAYMENT";
  await prisma.stay.update({ where: { id: stayId }, data });
  redirect(`/stays/${stayId}?note=Your%20name%20is%20on%20the%20licence.`);
}

export async function confirmStay(formData: FormData) {
  const user = await requireUser();
  const stayId = String(formData.get("stayId"));
  try {
    await prisma.$transaction(async (tx) => {
      const stay = await tx.stay.findUnique({
        where: { id: stayId },
        include: { guest: true },
      });
      if (!stay || stay.guestId !== user.id) throw new Error("Only the guest confirms the stay.");
      if (stay.status !== "AWAITING_PAYMENT" || !stay.hostSignedAt || !stay.guestSignedAt) {
        throw new Error("Both names have to be on the licence first.");
      }
      const now = new Date();
      if (!stay.guest.membershipUntil || stay.guest.membershipUntil < now) {
        const bill = membershipBreakdown();
        const until = new Date(now);
        until.setUTCFullYear(until.getUTCFullYear() + 1);
        await tx.payment.create({
          data: {
            userId: stay.guestId,
            stayId,
            kind: "MEMBERSHIP",
            amountPaise: bill.total * 100,
            gstPaise: bill.gst * 100,
            note: `A year at the desk. ${bill.base} rupees plus GST of ${bill.gst}.`,
          },
        });
        await tx.user.update({
          where: { id: stay.guestId },
          data: { membershipUntil: until },
        });
      }
      await holdPoints(tx, { guestId: stay.guestId, stayId, points: stay.points });
      await tx.payment.create({
        data: {
          userId: stay.guestId,
          stayId,
          kind: "DEPOSIT",
          amountPaise: stay.depositRupees * 100,
          note: "Refundable damage deposit, recorded for the aggregator to hold and return.",
        },
      });
      await tx.stay.update({
        where: { id: stayId },
        data: { status: "CONFIRMED", pointsState: "HELD", depositState: "HELD" },
      });
    });
  } catch (error) {
    fail(stayId, error instanceof Error ? error.message : "The stay could not be confirmed.");
  }
  redirect(`/stays/${stayId}?note=The%20points%20are%20held%20and%20the%20deposit%20is%20recorded.`);
}

export async function cancelStay(formData: FormData) {
  const user = await requireUser();
  const stayId = String(formData.get("stayId"));
  const { stay, isHost } = await partyStay(user.id, stayId);
  if (stay.checkInAt || stay.status === "CHECKED_IN" || stay.status === "CHECKED_OUT") {
    fail(stayId, "The stay has started. End it from the docket if you must.");
  }
  if (stay.status === "CANCELLED" || stay.status === "COMPLETED") {
    fail(stayId, "This stay is already closed.");
  }
  await prisma.$transaction(async (tx) => {
    const current = await tx.stay.findUniqueOrThrow({ where: { id: stayId } });
    if (current.pointsState === "HELD") {
      const split = isHost
        ? {
            toHost: 0,
            toGuest: current.points,
            reason: "The host cancelled. The points return to the guest.",
          }
        : cancellationSplit(
            current.nights,
            current.nightlyPoints,
            daysUntil(current.startDate, new Date()),
          );
      await releaseHeld(tx, {
        guestId: current.guestId,
        hostId: current.hostId,
        stayId,
        toGuest: split.toGuest,
        toHost: split.toHost,
        memo: split.reason,
      });
    }
    if (current.depositState === "HELD") {
      await refundDeposit(tx, current, "Damage deposit returned because the stay was cancelled before check-in.");
    }
    await tx.stay.update({
      where: { id: stayId },
      data: {
        status: "CANCELLED",
        pointsState: current.pointsState === "NONE" ? "NONE" : "RELEASED",
        cancelledAt: new Date(),
        cancelReason: isHost ? "Host cancelled." : "Guest cancelled.",
      },
    });
  });
  redirect(`/stays/${stayId}?note=The%20stay%20is%20cancelled.`);
}

export async function reportNoShow(formData: FormData) {
  const user = await requireUser();
  const stayId = String(formData.get("stayId"));
  const kind = String(formData.get("kind"));
  const { stay, isGuest, isHost } = await partyStay(user.id, stayId);
  if (stay.status !== "CONFIRMED" || stay.pointsState !== "HELD") {
    fail(stayId, "A no-show can be filed only before the points move.");
  }
  if (daysUntil(stay.startDate, new Date()) > 0) {
    fail(stayId, "Wait until the start date.");
  }
  await prisma.$transaction(async (tx) => {
    const current = await tx.stay.findUniqueOrThrow({ where: { id: stayId } });
    if (kind === "host" && isGuest) {
      await releaseHeld(tx, {
        guestId: current.guestId,
        hostId: current.hostId,
        stayId,
        toGuest: current.points,
        toHost: 0,
        memo: "The host did not hand over the keys. The points return to the guest.",
      });
      if (current.depositState === "HELD") {
        await refundDeposit(tx, current, "Damage deposit returned. The keys were not handed over.");
      }
      await tx.stay.update({
        where: { id: stayId },
        data: {
          status: "CANCELLED",
          pointsState: "RELEASED",
          cancelledAt: new Date(),
          cancelReason: "Host did not hand over the keys.",
        },
      });
      return;
    }
    if (kind === "guest" && isHost) {
      await releaseHeld(tx, {
        guestId: current.guestId,
        hostId: current.hostId,
        stayId,
        toGuest: 0,
        toHost: current.points,
        memo: "The guest did not arrive. The hold stays with the host.",
      });
      if (current.depositState === "HELD") {
        await refundDeposit(tx, current, "Damage deposit returned. The guest did not stay.");
      }
      await tx.stay.update({
        where: { id: stayId },
        data: {
          status: "CANCELLED",
          pointsState: "RELEASED",
          cancelledAt: new Date(),
          cancelReason: "Guest did not arrive.",
        },
      });
      return;
    }
    throw new Error("You cannot file that no-show.");
  });
  redirect(`/stays/${stayId}?note=The%20no-show%20is%20on%20the%20file.`);
}

async function savePhotos(formData: FormData) {
  const files = formData.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length < 1) throw new Error("Add a photograph of the rooms.");
  const saved = [];
  for (const file of files) saved.push(await saveUpload(file));
  return saved;
}

export async function fileReport(formData: FormData) {
  const user = await requireUser();
  const stayId = String(formData.get("stayId"));
  const kind = String(formData.get("kind"));
  const { stay } = await partyStay(user.id, stayId);
  if (kind !== "CHECKIN" && kind !== "CHECKOUT") fail(stayId, "Say whether this is arrival or departure.");
  if (kind === "CHECKIN" && stay.status !== "CONFIRMED" && stay.status !== "CHECKED_IN") {
    fail(stayId, "Check in only after the stay is confirmed.");
  }
  if (kind === "CHECKOUT" && stay.status !== "CHECKED_IN" && stay.status !== "CHECKED_OUT") {
    fail(stayId, "Check out after arrival is on the file.");
  }
  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length < 10) fail(stayId, "Write what you saw, room by room.");
  let photos: { key: string; fileName: string }[];
  try {
    photos = await savePhotos(formData);
  } catch (error) {
    fail(stayId, error instanceof Error ? error.message : "The photographs did not save.");
  }
  await prisma.$transaction(async (tx) => {
    const report = await tx.conditionReport.create({
      data: { stayId, kind, authorId: user.id, notes },
    });
    await tx.reportPhoto.createMany({
      data: photos.map((photo) => ({
        reportId: report.id,
        storageKey: photo.key,
        fileName: photo.fileName,
      })),
    });
    if (kind === "CHECKIN") {
      const current = await tx.stay.findUniqueOrThrow({ where: { id: stayId } });
      if (current.pointsState === "HELD") {
        await settleHeldToHost(tx, {
          guestId: current.guestId,
          hostId: current.hostId,
          stayId,
          points: current.points,
          memo: "Settled at check-in.",
        });
      }
      if (current.status === "CONFIRMED") {
        await tx.stay.update({
          where: { id: stayId },
          data: { status: "CHECKED_IN", checkInAt: new Date(), pointsState: "SETTLED" },
        });
      }
    }
    if (kind === "CHECKOUT" && stay.status === "CHECKED_IN") {
      await tx.stay.update({
        where: { id: stayId },
        data: { status: "CHECKED_OUT", checkOutAt: new Date() },
      });
    }
  });
  redirect(`/stays/${stayId}?note=The%20condition%20report%20is%20on%20the%20file.`);
}

export async function openClaim(formData: FormData) {
  const user = await requireUser();
  const stayId = String(formData.get("stayId"));
  const { stay, isHost } = await partyStay(user.id, stayId);
  if (!isHost) fail(stayId, "The host opens a damage claim.");
  if (!stay.checkOutAt || (stay.status !== "CHECKED_OUT" && stay.status !== "ENDED_EARLY")) {
    fail(stayId, "A claim opens after checkout.");
  }
  if (!claimWindowOpen(stay.checkOutAt, new Date())) fail(stayId, "The 72 hour window has closed.");
  if (stay.claims.some((claim) => claim.status !== "RESOLVED")) {
    fail(stayId, "There is already an open claim.");
  }
  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();
  if (!Number.isInteger(amount) || amount < 1) fail(stayId, "Name the rupees you are claiming.");
  if (description.length < 10) fail(stayId, "Say what was damaged.");
  let photos: { key: string; fileName: string }[];
  try {
    photos = await savePhotos(formData);
  } catch (error) {
    fail(stayId, error instanceof Error ? error.message : "Add photographs.");
  }
  await prisma.$transaction(async (tx) => {
    const claim = await tx.claim.create({
      data: {
        stayId,
        openerId: user.id,
        description,
        amountRupees: amount,
      },
    });
    await tx.claimPhoto.createMany({
      data: photos.map((photo) => ({
        claimId: claim.id,
        storageKey: photo.key,
        fileName: photo.fileName,
      })),
    });
  });
  redirect(`/stays/${stayId}?note=The%20claim%20is%20open.%20The%20guest%20has%2048%20hours%20to%20answer.`);
}

async function resolveClaim(stayId: string, claimId: string, applied: number, note: string) {
  await prisma.$transaction(async (tx) => {
    const stay = await tx.stay.findUniqueOrThrow({ where: { id: stayId } });
    const take = appliedAmount(applied, stay.depositRupees);
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
          note: "The rest of the damage deposit, returned.",
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
        depositState: take === 0 ? "REFUNDED" : take < stay.depositRupees ? "PARTIALLY_APPLIED" : "APPLIED",
        depositAppliedRupees: take,
        status: "COMPLETED",
      },
    });
  });
}

export async function answerClaim(formData: FormData) {
  const user = await requireUser();
  const stayId = String(formData.get("stayId"));
  const { stay, isGuest } = await partyStay(user.id, stayId);
  if (!isGuest) fail(stayId, "The guest answers the claim.");
  const claim = stay.claims.find((item) => item.status === "OPEN");
  if (!claim) fail(stayId, "There is no open claim.");
  const agree = formData.get("agree") === "yes";
  const response = String(formData.get("response") ?? "").trim();
  if (agree) {
    await prisma.claim.update({
      where: { id: claim.id },
      data: { response: response || "Agreed.", answeredAt: new Date(), status: "ANSWERED" },
    });
    await resolveClaim(stayId, claim.id, claim.amountRupees, "The guest agreed to the claim.");
    redirect(`/stays/${stayId}?note=The%20claim%20is%20settled.`);
  }
  if (response.length < 5) fail(stayId, "Write why you dispute it.");
  await prisma.claim.update({
    where: { id: claim.id },
    data: { response, answeredAt: new Date(), status: "ANSWERED" },
  });
  redirect(`/stays/${stayId}?note=The%20dispute%20is%20with%20the%20desk.`);
}

export async function applyUnansweredClaim(formData: FormData) {
  const user = await requireUser();
  const stayId = String(formData.get("stayId"));
  const { stay, isHost } = await partyStay(user.id, stayId);
  if (!isHost) fail(stayId, "Only the host can close an unanswered claim.");
  const claim = stay.claims.find((item) => item.status === "OPEN");
  if (!claim) fail(stayId, "There is no unanswered claim.");
  if (answerWindowOpen(claim.createdAt, new Date())) {
    fail(stayId, "The guest still has time to answer.");
  }
  await resolveClaim(
    stayId,
    claim.id,
    claim.amountRupees,
    "The guest did not answer within 48 hours. The host’s photographs stand.",
  );
  redirect(`/stays/${stayId}?note=The%20unanswered%20claim%20is%20applied%20up%20to%20the%20deposit.`);
}

export async function endStayEarly(formData: FormData) {
  const user = await requireUser();
  const stayId = String(formData.get("stayId"));
  const { stay, isHost } = await partyStay(user.id, stayId);
  if (!isHost || stay.status !== "CHECKED_IN") fail(stayId, "A host can end a stay only after check-in.");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10) fail(stayId, "Write the breach. The guest has 24 hours to leave.");
  await prisma.stay.update({
    where: { id: stayId },
    data: {
      status: "ENDED_EARLY",
      checkOutAt: new Date(),
      cancelReason: reason,
    },
  });
  redirect(`/stays/${stayId}?note=The%20licence%20is%20ended.%20The%20guest%20should%20leave%20within%2024%20hours.`);
}

export async function recordIntimation(formData: FormData) {
  const user = await requireUser();
  const stayId = String(formData.get("stayId"));
  const { isHost } = await partyStay(user.id, stayId);
  if (!isHost) fail(stayId, "The host files the intimation.");
  await prisma.stay.update({
    where: { id: stayId },
    data: { hostIntimationAt: new Date() },
  });
  redirect(`/stays/${stayId}?note=You%20recorded%20that%20the%20pack%20was%20filed.`);
}

export async function sendMessage(formData: FormData) {
  const user = await requireUser();
  const stayId = String(formData.get("stayId"));
  await partyStay(user.id, stayId);
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 1 || body.length > 2000) fail(stayId, "Write a shorter note.");
  await prisma.message.create({ data: { stayId, senderId: user.id, body } });
  redirect(`/stays/${stayId}`);
}
