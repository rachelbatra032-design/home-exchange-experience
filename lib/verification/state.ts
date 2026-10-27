export type Checklist = {
  nameMatch: boolean;
  addressMatch: boolean;
  titleChecked: boolean;
  coOwnerChecked: boolean;
  permissionsChecked: boolean;
};

export type DocRecord = {
  type: string;
  status: string;
  validUntil: Date | null;
};

export type LiveInput = {
  identityVerified: boolean;
  cityEnabled: boolean;
  checklist: Checklist;
  authority: "OWNER" | "POA";
  soleOwner: boolean;
  poaCoversCoOwners: boolean;
  coOwners: { signedAt: Date | null }[];
  permissionTypes: string[];
  documents: DocRecord[];
  falseDocuments: boolean;
  now: Date;
};

function approved(documents: DocRecord[], type: string, now: Date): boolean {
  return documents.some((document) => {
    if (document.type !== type || document.status !== "APPROVED") return false;
    if (document.validUntil && document.validUntil.getTime() < now.getTime()) return false;
    return true;
  });
}

export function coOwnersSatisfied(input: Pick<
  LiveInput,
  "authority" | "soleOwner" | "poaCoversCoOwners" | "coOwners"
>): boolean {
  if (input.authority === "POA" && input.poaCoversCoOwners) return true;
  if (input.coOwners.length === 0 && input.soleOwner) return true;
  return input.coOwners.length > 0 && input.coOwners.every((owner) => owner.signedAt);
}

export function canGoLive(input: LiveInput): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.falseDocuments) {
    reasons.push("These papers were marked false. The home stays off the list.");
  }
  if (!input.identityVerified) {
    reasons.push("The owner’s identity is still unread.");
  }
  if (!input.cityEnabled) {
    reasons.push("This city is closed until counsel writes the local rule.");
  }
  if (!input.checklist.nameMatch) reasons.push("The reviewer has not ticked the name.");
  if (!input.checklist.addressMatch) reasons.push("The reviewer has not ticked the address.");
  if (!input.checklist.titleChecked) reasons.push("The reviewer has not ticked the title.");
  if (!input.checklist.coOwnerChecked) reasons.push("The reviewer has not ticked the co-owners.");
  if (!input.checklist.permissionsChecked) {
    reasons.push("The reviewer has not ticked the permissions.");
  }

  const titleType = input.authority === "POA" ? "POA" : "SALE_DEED";
  if (!approved(input.documents, titleType, input.now)) {
    reasons.push(
      input.authority === "POA"
        ? "A registered power of attorney still needs approval."
        : "The sale deed still needs approval.",
    );
  }
  if (!approved(input.documents, "TAX_OR_ELECTRICITY", input.now)) {
    reasons.push("A property-tax receipt or electricity bill still needs approval.");
  }
  if (!approved(input.documents, "POSSESSION_DECLARATION", input.now)) {
    reasons.push("The possession declaration still needs approval.");
  }
  if (!coOwnersSatisfied(input)) {
    reasons.push("Every co-owner still has to sign, unless a registered power of attorney covers them.");
  }
  for (const type of input.permissionTypes) {
    if (!approved(input.documents, type, input.now)) {
      reasons.push(`${labelFor(type)} is missing, rejected, or out of date.`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export function labelFor(type: string): string {
  const labels: Record<string, string> = {
    SALE_DEED: "Sale deed",
    POA: "Registered power of attorney",
    TAX_OR_ELECTRICITY: "Property tax or electricity bill",
    SOCIETY_MAINTENANCE: "Society maintenance receipt",
    SOCIETY_NOC: "Society or association letter",
    POSSESSION_DECLARATION: "Possession declaration",
    ASSOCIATION_DECLARATION: "Declaration that no association bars the stay",
    BANK_NOC: "Lender’s letter",
  };
  return labels[type] ?? type;
}
