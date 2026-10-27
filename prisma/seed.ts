import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType, PrismaClient } from "@prisma/client";
import { DEFAULT_CITY_PROFILES } from "../lib/permissions/cityProfiles";
import { WELCOME_POINTS } from "../lib/points/valuation";

const prisma = new PrismaClient();
const ifEmpty = process.argv.includes("--if-empty");

async function paper(name: string, body: string) {
  const key = `seed-${name}.txt`;
  await mkdir(path.join(process.cwd(), "storage"), { recursive: true });
  await writeFile(path.join(process.cwd(), "storage", key), body);
  return key;
}

async function main() {
  if (ifEmpty && (await prisma.user.count()) > 0) {
    console.log("Seed skipped. Members are already at the desk.");
    return;
  }

  await prisma.claimPhoto.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.reportPhoto.deleteMany();
  await prisma.conditionReport.deleteMany();
  await prisma.message.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.pointEntry.deleteMany();
  await prisma.stay.deleteMany();
  await prisma.homeDocument.deleteMany();
  await prisma.homePhoto.deleteMany();
  await prisma.coOwner.deleteMany();
  await prisma.home.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.cityProfile.deleteMany();
  await prisma.user.deleteMany();

  for (const profile of DEFAULT_CITY_PROFILES) {
    await prisma.cityProfile.create({
      data: {
        ...profile,
        apartmentRequires: profile.apartmentRequires as DocumentType[],
        houseRequires: profile.houseRequires as DocumentType[],
      },
    });
  }

  const ida = await prisma.user.create({
    data: {
      email: "ida@aangan.test",
      name: "Ida Krishnan",
      isAdmin: true,
      phone: "9800000001",
    },
  });
  const meera = await prisma.user.create({
    data: {
      email: "meera@aangan.test",
      name: "Meera Shah",
      phone: "9800000002",
      residency: "INDIAN_RESIDENT",
      identityStatus: "VERIFIED",
      maskedId: "AB••••4F",
      idType: "PAN",
      vendorRef: "kyc_meera_seed",
      consentAt: new Date(),
      welcomeGranted: true,
    },
  });
  const arjun = await prisma.user.create({
    data: {
      email: "arjun@aangan.test",
      name: "Arjun Menon",
      phone: "9800000003",
      residency: "INDIAN_RESIDENT",
      identityStatus: "VERIFIED",
      maskedId: "CD••••9K",
      idType: "PAN",
      vendorRef: "kyc_arjun_seed",
      consentAt: new Date(),
      welcomeGranted: true,
    },
  });
  const leela = await prisma.user.create({
    data: {
      email: "leela@aangan.test",
      name: "Leela Iyer",
      phone: "9800000004",
      residency: "NRI",
      identityStatus: "VERIFIED",
      maskedId: "P•••••18",
      idType: "Passport",
      vendorRef: "kyc_leela_seed",
      consentAt: new Date(),
      caretakerName: "Ramesh",
      caretakerPhone: "9800000099",
    },
  });

  const rules =
    "No events. No extra guests. No commercial shoots. No smoking indoors. Quiet hours 10pm to 7am.";

  async function fileHome(
    ownerId: string,
    home: {
      name: string;
      city: string;
      neighbourhood: string;
      address: string;
      description: string;
      bedrooms: number;
      nightlyPoints: number;
      status: "LIVE" | "SUBMITTED";
      handover?: "OWNER" | "CARETAKER";
      caretakerName?: string;
      caretakerPhone?: string;
    },
  ) {
    const created = await prisma.home.create({
      data: {
        ownerId,
        name: home.name,
        kind: "APARTMENT",
        city: home.city,
        neighbourhood: home.neighbourhood,
        address: home.address,
        description: home.description,
        bedrooms: home.bedrooms,
        bathrooms: Math.max(1, home.bedrooms - 1),
        occupancyCap: home.bedrooms + 2,
        houseRules: rules,
        excludedAreas: "The locked cupboard in the bedroom.",
        keyCount: 2,
        handover: home.handover ?? "OWNER",
        caretakerName: home.caretakerName,
        caretakerPhone: home.caretakerPhone,
        nightlyPoints: home.nightlyPoints,
        status: home.status,
        authority: "OWNER",
        soleOwner: true,
        hasAssociation: true,
        nameMatch: home.status === "LIVE",
        addressMatch: home.status === "LIVE",
        titleChecked: home.status === "LIVE",
        coOwnerChecked: home.status === "LIVE",
        permissionsChecked: home.status === "LIVE",
        submittedAt: new Date(),
        listedAt: home.status === "LIVE" ? new Date() : null,
      },
    });
    const types: DocumentType[] = [
      "SALE_DEED",
      "TAX_OR_ELECTRICITY",
      "POSSESSION_DECLARATION",
      "SOCIETY_MAINTENANCE",
      "SOCIETY_NOC",
    ];
    for (const type of types) {
      const key = await paper(
        `${created.id}-${type}`,
        `${type} for ${home.name}, ${home.address}. Preview paper, not a real deed.`,
      );
      await prisma.homeDocument.create({
        data: {
          homeId: created.id,
          type,
          fileName: `${type.toLowerCase()}.txt`,
          storageKey: key,
          status: home.status === "LIVE" ? "APPROVED" : "UPLOADED",
          validUntil: type === "SOCIETY_NOC" ? new Date("2027-12-31T00:00:00.000Z") : null,
        },
      });
    }
    return created;
  }

  await fileHome(meera.id, {
    name: "The Prabhat Road flat",
    city: "Pune",
    neighbourhood: "Prabhat Road",
    address: "14 Prabhat Road, Pune 411004",
    description:
      "A third-floor flat with a west-facing verandah, a dining table that seats six, and a cupboard that stays locked. The society gate closes the visitor book at night.",
    bedrooms: 3,
    nightlyPoints: 140,
    status: "LIVE",
  });
  await fileHome(arjun.id, {
    name: "A one-bedroom in Defence Colony",
    city: "Delhi",
    neighbourhood: "Defence Colony",
    address: "C-22 Defence Colony, New Delhi 110024",
    description:
      "A quiet one-bedroom above a bakery lane. One desk, one good reading lamp, and a society that wants guest names before sundown.",
    bedrooms: 1,
    nightlyPoints: 96,
    status: "LIVE",
  });
  await fileHome(leela.id, {
    name: "The Indiranagar flat",
    city: "Bengaluru",
    neighbourhood: "Indiranagar",
    address: "48 12th Main, Indiranagar, Bengaluru 560038",
    description:
      "Leela lives abroad. Ramesh, the caretaker, meets guests at the society desk with both keys. The study is excluded.",
    bedrooms: 2,
    nightlyPoints: 132,
    status: "SUBMITTED",
    handover: "CARETAKER",
    caretakerName: "Ramesh",
    caretakerPhone: "9800000099",
  });

  for (const member of [meera, arjun]) {
    await prisma.pointEntry.create({
      data: {
        userId: member.id,
        bucket: "available",
        delta: WELCOME_POINTS,
        memo: "Welcome grant, after the home was listed",
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: ida.id,
      action: "seed",
      subjectType: "desk",
      subjectId: "preview",
      note: "Preview members and three homes placed on the desk.",
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
