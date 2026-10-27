"use server";

import { redirect } from "next/navigation";
import { prisma } from "../db";
import { profileFor } from "../homes";
import { nightlyPoints } from "../points/valuation";
import { requireUser } from "../session";
import { saveUpload } from "../storage";

function fail(homeId: string | null, message: string): never {
  const path = homeId ? `/list/${homeId}` : "/list";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function ownHome(userId: string, homeId: string) {
  const home = await prisma.home.findUnique({ where: { id: homeId } });
  if (!home || home.ownerId !== userId) fail(homeId, "That home is not yours.");
  if (home.status === "LIVE" || home.status === "SUSPENDED") {
    fail(homeId, "A listed home is edited by sending it back to the desk.");
  }
  return home;
}

export async function createHome(formData: FormData) {
  const user = await requireUser();
  if (user.identityStatus !== "VERIFIED") {
    redirect("/verify?error=" + encodeURIComponent("The desk reads your papers before a home."));
  }
  const city = String(formData.get("city") ?? "");
  const profile = await profileFor(city);
  if (!profile || !profile.enabled) {
    fail(null, profile?.counselNote || "That city is not open.");
  }
  const bedrooms = Number(formData.get("bedrooms"));
  const bathrooms = Number(formData.get("bathrooms"));
  const occupancyCap = Number(formData.get("occupancyCap"));
  if (!Number.isInteger(bedrooms) || bedrooms < 1 || bedrooms > 8) fail(null, "Bedrooms need a number from 1 to 8.");
  if (!Number.isInteger(bathrooms) || bathrooms < 1) fail(null, "Add the bathrooms.");
  if (!Number.isInteger(occupancyCap) || occupancyCap < 1) fail(null, "Set how many people may stay.");

  const kind = String(formData.get("kind"));
  if (kind !== "APARTMENT" && kind !== "INDEPENDENT") fail(null, "Say whether this is a flat or a house.");
  const handover = String(formData.get("handover"));
  if (handover !== "OWNER" && handover !== "CARETAKER" && handover !== "SOCIETY_DESK") {
    fail(null, "Say who hands over the keys.");
  }
  const caretakerName = String(formData.get("caretakerName") ?? "").trim();
  const caretakerPhone = String(formData.get("caretakerPhone") ?? "").trim();
  if (handover === "CARETAKER" && (!caretakerName || !caretakerPhone)) {
    fail(null, "A caretaker needs a name and a phone.");
  }
  const authority = String(formData.get("authority")) === "POA" ? "POA" : "OWNER";
  const priced = nightlyPoints({
    bedrooms,
    tier: profile.tier,
    hasAc: formData.get("hasAc") === "on",
    hasParking: formData.get("hasParking") === "on",
    hasPool: formData.get("hasPool") === "on",
    hasWorkspace: formData.get("hasWorkspace") === "on",
  });

  const home = await prisma.home.create({
    data: {
      ownerId: user.id,
      name: String(formData.get("name") ?? "").trim() || "Untitled home",
      kind,
      city,
      neighbourhood: String(formData.get("neighbourhood") ?? "").trim() || city,
      address: String(formData.get("address") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      bedrooms,
      bathrooms,
      occupancyCap,
      hasAc: formData.get("hasAc") === "on",
      hasParking: formData.get("hasParking") === "on",
      hasPool: formData.get("hasPool") === "on",
      hasWorkspace: formData.get("hasWorkspace") === "on",
      houseRules: String(formData.get("houseRules") ?? "").trim(),
      excludedAreas: String(formData.get("excludedAreas") ?? "").trim() || "The locked cupboard.",
      keyCount: Math.max(1, Number(formData.get("keyCount")) || 1),
      handover,
      caretakerName: caretakerName || null,
      caretakerPhone: caretakerPhone || null,
      authority,
      soleOwner: formData.get("soleOwner") === "on",
      poaCoversCoOwners: formData.get("poaCoversCoOwners") === "on",
      hasAssociation: formData.get("hasAssociation") === "on",
      nightlyPoints: priced.total,
      status: "DRAFT",
    },
  });
  if (!home.address || home.description.length < 20 || home.houseRules.length < 10) {
    redirect(`/list/${home.id}?error=${encodeURIComponent("Add the address, a description of at least a few sentences, and the house rules.")}`);
  }
  redirect(`/list/${home.id}`);
}

export async function updateHome(formData: FormData) {
  const user = await requireUser();
  const homeId = String(formData.get("homeId"));
  const home = await ownHome(user.id, homeId);
  const profile = await profileFor(home.city);
  const bedrooms = Number(formData.get("bedrooms"));
  const priced = nightlyPoints({
    bedrooms,
    tier: profile?.tier ?? 1,
    hasAc: formData.get("hasAc") === "on",
    hasParking: formData.get("hasParking") === "on",
    hasPool: formData.get("hasPool") === "on",
    hasWorkspace: formData.get("hasWorkspace") === "on",
  });
  const handover = String(formData.get("handover"));
  const caretakerName = String(formData.get("caretakerName") ?? "").trim();
  const caretakerPhone = String(formData.get("caretakerPhone") ?? "").trim();
  if (handover === "CARETAKER" && (!caretakerName || !caretakerPhone)) {
    fail(homeId, "A caretaker needs a name and a phone.");
  }
  await prisma.home.update({
    where: { id: homeId },
    data: {
      name: String(formData.get("name") ?? "").trim(),
      neighbourhood: String(formData.get("neighbourhood") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      bedrooms,
      bathrooms: Number(formData.get("bathrooms")),
      occupancyCap: Number(formData.get("occupancyCap")),
      hasAc: formData.get("hasAc") === "on",
      hasParking: formData.get("hasParking") === "on",
      hasPool: formData.get("hasPool") === "on",
      hasWorkspace: formData.get("hasWorkspace") === "on",
      houseRules: String(formData.get("houseRules") ?? "").trim(),
      excludedAreas: String(formData.get("excludedAreas") ?? "").trim(),
      keyCount: Math.max(1, Number(formData.get("keyCount")) || 1),
      handover: handover === "CARETAKER" || handover === "SOCIETY_DESK" ? handover : "OWNER",
      caretakerName: caretakerName || null,
      caretakerPhone: caretakerPhone || null,
      authority: String(formData.get("authority")) === "POA" ? "POA" : "OWNER",
      soleOwner: formData.get("soleOwner") === "on",
      poaCoversCoOwners: formData.get("poaCoversCoOwners") === "on",
      hasAssociation: formData.get("hasAssociation") === "on",
      nightlyPoints: priced.total,
    },
  });
  redirect(`/list/${homeId}?note=Saved.`);
}

export async function uploadDocument(formData: FormData) {
  const user = await requireUser();
  const homeId = String(formData.get("homeId"));
  await ownHome(user.id, homeId);
  const type = String(formData.get("type"));
  const allowed = [
    "SALE_DEED",
    "POA",
    "TAX_OR_ELECTRICITY",
    "SOCIETY_MAINTENANCE",
    "SOCIETY_NOC",
    "POSSESSION_DECLARATION",
    "ASSOCIATION_DECLARATION",
    "BANK_NOC",
  ];
  if (!allowed.includes(type)) fail(homeId, "That paper is not one the desk collects.");
  const file = formData.get("file");
  if (!(file instanceof File)) fail(homeId, "Choose a file.");
  let saved: { key: string; fileName: string };
  try {
    saved = await saveUpload(file);
  } catch (error) {
    fail(homeId, error instanceof Error ? error.message : "The file did not save.");
  }
  const until = String(formData.get("validUntil") ?? "");
  await prisma.homeDocument.create({
    data: {
      homeId,
      type: type as "SALE_DEED",
      fileName: saved.fileName,
      storageKey: saved.key,
      validUntil: until ? new Date(`${until}T00:00:00.000Z`) : null,
    },
  });
  redirect(`/list/${homeId}?note=The%20paper%20is%20on%20the%20file.`);
}

export async function addCoOwner(formData: FormData) {
  const user = await requireUser();
  const homeId = String(formData.get("homeId"));
  await ownHome(user.id, homeId);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (name.length < 3 || !email.includes("@")) fail(homeId, "A co-owner needs a name and an email.");
  await prisma.coOwner.create({ data: { homeId, name, email } });
  await prisma.home.update({ where: { id: homeId }, data: { soleOwner: false } });
  redirect(`/list/${homeId}?note=Ask%20them%20to%20sign%20in%20with%20that%20email.`);
}

export async function signCoOwner(formData: FormData) {
  const user = await requireUser();
  const coOwnerId = String(formData.get("coOwnerId"));
  const signedName = String(formData.get("signedName") ?? "").trim();
  const row = await prisma.coOwner.findUnique({ where: { id: coOwnerId } });
  if (!row || row.email !== user.email) {
    redirect("/list?error=" + encodeURIComponent("This consent is for someone else."));
  }
  if (signedName.toLowerCase() !== row.name.toLowerCase()) {
    redirect(`/list/${row.homeId}?error=${encodeURIComponent("Sign with the co-owner’s name as it was written.")}`);
  }
  await prisma.coOwner.update({
    where: { id: coOwnerId },
    data: { signedAt: new Date(), signedName },
  });
  redirect(`/list/${row.homeId}?note=Consent%20is%20on%20the%20file.`);
}

export async function submitHome(formData: FormData) {
  const user = await requireUser();
  const homeId = String(formData.get("homeId"));
  const home = await ownHome(user.id, homeId);
  if (!home.address || home.description.length < 20) {
    fail(homeId, "The address and the description are still thin.");
  }
  const docs = await prisma.homeDocument.count({ where: { homeId } });
  if (docs < 1) fail(homeId, "Put at least the title paper on the file before you send it.");
  await prisma.home.update({
    where: { id: homeId },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  redirect(`/list/${homeId}?note=The%20desk%20has%20it.`);
}

export async function uploadPhoto(formData: FormData) {
  const user = await requireUser();
  const homeId = String(formData.get("homeId"));
  await ownHome(user.id, homeId);
  const file = formData.get("file");
  if (!(file instanceof File)) fail(homeId, "Choose a photograph.");
  let saved: { key: string; fileName: string };
  try {
    saved = await saveUpload(file);
  } catch (error) {
    fail(homeId, error instanceof Error ? error.message : "The photograph did not save.");
  }
  const count = await prisma.homePhoto.count({ where: { homeId } });
  await prisma.homePhoto.create({
    data: {
      homeId,
      path: saved.key,
      caption: String(formData.get("caption") ?? "").trim() || saved.fileName,
      sort: count,
    },
  });
  redirect(`/list/${homeId}?note=Photograph%20added.`);
}
