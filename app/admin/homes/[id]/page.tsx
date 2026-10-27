import { notFound } from "next/navigation";
import { Notice } from "@/components/notice";
import { Stamp } from "@/components/stamp";
import {
  listHome,
  removeForFalsePapers,
  requestChanges,
  reviewDocument,
  saveChecklist,
} from "@/lib/actions/admin";
import { prisma } from "@/lib/db";
import { formatDay } from "@/lib/format";
import { liveDecision } from "@/lib/homes";
import { labelFor } from "@/lib/verification/state";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; note?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const home = await prisma.home.findUnique({
    where: { id },
    include: { owner: true, documents: true, coOwners: true },
  });
  if (!home) notFound();
  const decision = await liveDecision(home.id);

  return (
    <main className="wrap" style={{ padding: "2rem 0 4rem" }}>
      <p className="kicker">{home.city}</p>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>{home.name}</h1>
        <Stamp status={home.status} />
      </div>
      <Notice error={query.error} note={query.note} />
      <p>
        {home.owner.name}, identity {home.owner.identityStatus.toLowerCase()}
        {home.owner.maskedId ? `, ${home.owner.maskedId}` : ""}. {home.address}.
      </p>
      <p>
        {home.authority === "POA" ? "Power of attorney." : "Owner."}{" "}
        {home.soleOwner ? "Sole owner declared." : "Co-owners named."}
      </p>
      {home.coOwners.map((row) => (
        <p key={row.id}>
          {row.name}, {row.email}. {row.signedAt ? `Signed ${formatDay(row.signedAt)}.` : "Unsigned."}
        </p>
      ))}

      <h2>Papers</h2>
      {home.documents.map((document) => (
        <form key={document.id} className="stack" action={reviewDocument} style={{ marginBottom: "1rem" }}>
          <input type="hidden" name="homeId" value={home.id} />
          <input type="hidden" name="documentId" value={document.id} />
          <p>
            <a href={`/api/files/document/${document.id}`}>{labelFor(document.type)}</a>
            {" · "}
            {document.status.toLowerCase()}
            {document.validUntil ? ` · until ${formatDay(document.validUntil)}` : ""}
          </p>
          <label className="field">
            <span>Note</span>
            <input name="note" defaultValue={document.note ?? ""} />
          </label>
          <div style={{ display: "flex", gap: "0.8rem" }}>
            <button className="btn" name="status" value="APPROVED" type="submit">
              Approve
            </button>
            <button className="btn secondary" name="status" value="REJECTED" type="submit">
              Send back
            </button>
          </div>
        </form>
      ))}

      <form className="stack slip" action={saveChecklist}>
        <p className="kicker">Checklist</p>
        <input type="hidden" name="homeId" value={home.id} />
        {(
          [
            ["nameMatch", "The name matches the paper", home.nameMatch],
            ["addressMatch", "The address matches the listing", home.addressMatch],
            ["titleChecked", "The title, or the power of attorney, is the right document", home.titleChecked],
            ["coOwnerChecked", "Co-owners have consented, or there is only one owner", home.coOwnerChecked],
            ["permissionsChecked", "The society letter, if one is required, is in date", home.permissionsChecked],
          ] as const
        ).map(([name, label, checked]) => (
          <label className="check" key={name}>
            <input type="checkbox" name={name} defaultChecked={checked} />
            <span>{label}</span>
          </label>
        ))}
        <label className="field">
          <span>Note to the member</span>
          <textarea name="reviewerNote" defaultValue={home.reviewerNote ?? ""} />
        </label>
        <button className="btn secondary" type="submit">
          Save the checklist
        </button>
      </form>

      <div className="stack" style={{ marginTop: "1.5rem" }}>
        {decision.ok ? (
          <form action={listHome}>
            <input type="hidden" name="homeId" value={home.id} />
            <button className="btn" type="submit">
              List this home
            </button>
          </form>
        ) : (
          <ul>
            {decision.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        <form className="stack" action={requestChanges}>
          <input type="hidden" name="homeId" value={home.id} />
          <label className="field">
            <span>What to fix</span>
            <textarea name="reviewerNote" />
          </label>
          <button className="btn secondary" type="submit">
            Send it back
          </button>
        </form>
        <form action={removeForFalsePapers}>
          <input type="hidden" name="homeId" value={home.id} />
          <button className="linkish" type="submit">
            Remove for false papers
          </button>
        </form>
      </div>
    </main>
  );
}
