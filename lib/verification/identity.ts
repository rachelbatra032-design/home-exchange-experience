export type IdentityInput = {
  residency: "INDIAN_RESIDENT" | "NRI" | "OCI";
  legalName: string;
  pan?: string;
  passport?: string;
  oci?: string;
};

export type IdentityResult =
  | { ok: true; vendorRef: string; maskedId: string; idType: string }
  | { ok: false; reason: string };

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function mask(value: string): string {
  if (value.length < 4) return "••••";
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}

export function checkIdentity(input: IdentityInput): IdentityResult {
  const name = input.legalName.trim();
  if (name.length < 3) return { ok: false, reason: "Write the name as it is on the paper." };

  if (input.residency === "INDIAN_RESIDENT") {
    const pan = (input.pan ?? "").trim().toUpperCase();
    if (!PAN.test(pan)) {
      return { ok: false, reason: "The PAN should look like ABCDE1234F." };
    }
    return {
      ok: true,
      vendorRef: `kyc_${pan.slice(0, 3)}_${Date.now().toString(36)}`,
      maskedId: mask(pan),
      idType: "PAN",
    };
  }

  const passport = (input.passport ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(passport)) {
    return { ok: false, reason: "Enter the passport number, without spaces." };
  }
  if (input.residency === "OCI") {
    const oci = (input.oci ?? "").trim().toUpperCase();
    if (oci.length < 6) return { ok: false, reason: "Enter the OCI card number." };
  }
  const pan = (input.pan ?? "").trim().toUpperCase();
  if (pan && !PAN.test(pan)) {
    return { ok: false, reason: "If you add a PAN, it should look like ABCDE1234F." };
  }
  return {
    ok: true,
    vendorRef: `kyc_${passport.slice(0, 3)}_${Date.now().toString(36)}`,
    maskedId: mask(input.residency === "OCI" ? (input.oci ?? passport) : passport),
    idType: input.residency === "OCI" ? "OCI card" : "Passport",
  };
}
