import assert from "node:assert/strict";
import test from "node:test";
import { canGoLive, type LiveInput } from "./state";

const now = new Date("2026-10-27T00:00:00.000Z");

function ready(): LiveInput {
  return {
    identityVerified: true,
    cityEnabled: true,
    checklist: {
      nameMatch: true,
      addressMatch: true,
      titleChecked: true,
      coOwnerChecked: true,
      permissionsChecked: true,
    },
    authority: "OWNER",
    soleOwner: true,
    poaCoversCoOwners: false,
    coOwners: [],
    permissionTypes: ["SOCIETY_NOC", "SOCIETY_MAINTENANCE"],
    documents: [
      { type: "SALE_DEED", status: "APPROVED", validUntil: null },
      { type: "TAX_OR_ELECTRICITY", status: "APPROVED", validUntil: null },
      { type: "POSSESSION_DECLARATION", status: "APPROVED", validUntil: null },
      {
        type: "SOCIETY_NOC",
        status: "APPROVED",
        validUntil: new Date("2027-10-27T00:00:00.000Z"),
      },
      { type: "SOCIETY_MAINTENANCE", status: "APPROVED", validUntil: null },
    ],
    falseDocuments: false,
    now,
  };
}

test("a complete apartment can be listed", () => {
  assert.equal(canGoLive(ready()).ok, true);
});

test("an expired society letter blocks the listing", () => {
  const input = ready();
  input.documents = input.documents.map((document) =>
    document.type === "SOCIETY_NOC"
      ? { ...document, validUntil: new Date("2026-01-01T00:00:00.000Z") }
      : document,
  );
  const result = canGoLive(input);
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /Society or association letter/);
});

test("an unsigned co-owner blocks the listing", () => {
  const input = ready();
  input.soleOwner = false;
  input.coOwners = [{ signedAt: null }];
  assert.equal(canGoLive(input).ok, false);
});

test("a closed city cannot be listed", () => {
  const input = ready();
  input.cityEnabled = false;
  assert.equal(canGoLive(input).ok, false);
});
