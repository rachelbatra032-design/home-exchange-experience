import { Desk } from "@/components/desk";
import { Notice } from "@/components/notice";
import { Stamp } from "@/components/stamp";
import { submitIdentity } from "@/lib/actions/identity";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; note?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  return (
    <Desk>
      <p className="kicker">The people</p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <h1>Who you are.</h1>
        <Stamp status={user.identityStatus} />
      </div>
      <Notice error={query.error} note={query.note} />
      {user.identityStatus === "VERIFIED" ? (
        <p>
          The vendor returned {user.idType}, stored as {user.maskedId}. Reference {user.vendorRef}.
          The full number is not kept here.
        </p>
      ) : (
        <p>Consent covers this check only. Aadhaar is not collected.</p>
      )}
      <form className="stack" action={submitIdentity}>
        <label className="field">
          <span>Name on the paper</span>
          <input name="legalName" required defaultValue={user.name} />
        </label>
        <label className="field">
          <span>Phone</span>
          <input name="phone" defaultValue={user.phone ?? ""} />
        </label>
        <label className="field">
          <span>Papers</span>
          <select name="residency" defaultValue={user.residency}>
            <option value="INDIAN_RESIDENT">Resident of India</option>
            <option value="NRI">NRI</option>
            <option value="OCI">OCI cardholder</option>
          </select>
        </label>
        <label className="field">
          <span>PAN, required for residents</span>
          <input name="pan" autoComplete="off" />
        </label>
        <label className="field">
          <span>Passport, for NRI and OCI</span>
          <input name="passport" autoComplete="off" />
        </label>
        <label className="field">
          <span>OCI card number</span>
          <input name="oci" autoComplete="off" />
        </label>
        <div className="two">
          <label className="field">
            <span>Caretaker, if someone else holds the keys</span>
            <input name="caretakerName" defaultValue={user.caretakerName ?? ""} />
          </label>
          <label className="field">
            <span>Caretaker phone</span>
            <input name="caretakerPhone" defaultValue={user.caretakerPhone ?? ""} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" name="consent" required />
          <span>
            I consent to this identity check, and to keeping the result rather than the full
            document.
          </span>
        </label>
        <button className="btn" type="submit">
          Send to the identity desk
        </button>
      </form>
    </Desk>
  );
}
