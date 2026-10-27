"use server";

import { redirect } from "next/navigation";
import { prisma } from "../db";
import { requireUser } from "../session";
import { checkIdentity } from "../verification/identity";

function fail(message: string): never {
  redirect(`/verify?error=${encodeURIComponent(message)}`);
}

export async function submitIdentity(formData: FormData) {
  const user = await requireUser();
  if (!formData.get("consent")) {
    fail("The desk can read these papers only with your consent.");
  }
  const residency = String(formData.get("residency"));
  if (residency !== "INDIAN_RESIDENT" && residency !== "NRI" && residency !== "OCI") {
    fail("Choose how you hold your papers.");
  }
  const result = checkIdentity({
    residency,
    legalName: String(formData.get("legalName") ?? ""),
    pan: String(formData.get("pan") ?? ""),
    passport: String(formData.get("passport") ?? ""),
    oci: String(formData.get("oci") ?? ""),
  });
  if (!result.ok) fail(result.reason);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: String(formData.get("legalName")).trim(),
      phone: String(formData.get("phone") ?? "").trim() || user.phone,
      residency,
      identityStatus: "VERIFIED",
      maskedId: result.maskedId,
      idType: result.idType,
      vendorRef: result.vendorRef,
      consentAt: new Date(),
      caretakerName: String(formData.get("caretakerName") ?? "").trim() || null,
      caretakerPhone: String(formData.get("caretakerPhone") ?? "").trim() || null,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "identity.verified",
      subjectType: "user",
      subjectId: user.id,
      note: `${result.idType} checked. Stored ${result.maskedId}. Vendor ${result.vendorRef}.`,
    },
  });
  redirect("/verify?note=The%20papers%20match.");
}
