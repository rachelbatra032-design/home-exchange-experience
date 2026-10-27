import { prisma } from "./db";
import { permissionTypesFor, type ProfileShape } from "./permissions/cityProfiles";
import { canGoLive } from "./verification/state";

export async function profileFor(city: string): Promise<ProfileShape | null> {
  const row = await prisma.cityProfile.findUnique({ where: { city } });
  if (!row) return null;
  return {
    city: row.city,
    tier: row.tier,
    enabled: row.enabled,
    policeIntimation: row.policeIntimation,
    counselNote: row.counselNote,
    apartmentRequires: row.apartmentRequires,
    houseRequires: row.houseRequires,
  };
}

export async function liveDecision(homeId: string) {
  const home = await prisma.home.findUnique({
    where: { id: homeId },
    include: { documents: true, coOwners: true, owner: true },
  });
  if (!home) return { ok: false, reasons: ["This home is not on the desk."] };
  const profile = await profileFor(home.city);
  const permissionTypes = profile
    ? permissionTypesFor(profile, home)
    : ["SOCIETY_NOC"];
  return canGoLive({
    identityVerified: home.owner.identityStatus === "VERIFIED",
    cityEnabled: Boolean(profile?.enabled),
    checklist: {
      nameMatch: home.nameMatch,
      addressMatch: home.addressMatch,
      titleChecked: home.titleChecked,
      coOwnerChecked: home.coOwnerChecked,
      permissionsChecked: home.permissionsChecked,
    },
    authority: home.authority,
    soleOwner: home.soleOwner,
    poaCoversCoOwners: home.poaCoversCoOwners,
    coOwners: home.coOwners,
    permissionTypes,
    documents: home.documents,
    falseDocuments: home.falseDocuments,
    now: new Date(),
  });
}
