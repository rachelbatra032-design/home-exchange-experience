import Link from "next/link";
import { notFound } from "next/navigation";
import { Desk } from "@/components/desk";
import { Notice } from "@/components/notice";
import { Stamp } from "@/components/stamp";
import { resolveDisputedClaim } from "@/lib/actions/admin";
import {
  acceptStay,
  answerClaim,
  applyUnansweredClaim,
  cancelStay,
  confirmStay,
  endStayEarly,
  fileReport,
  openClaim,
  recordIntimation,
  reportNoShow,
  sendMessage,
  signStay,
} from "@/lib/actions/stays";
import { prisma } from "@/lib/db";
import { formatDay, formatWhen, points, rupees } from "@/lib/format";
import { membershipBreakdown } from "@/lib/points/valuation";
import { renderLicence } from "@/lib/protection/licence";
import { answerWindowOpen, claimWindowOpen } from "@/lib/protection/claims";
import { requireUser } from "@/lib/session";
import { progressStay } from "@/lib/stays";

export const dynamic = "force-dynamic";

export default async function StayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; note?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  await progressStay(id);
  const stay = await prisma.stay.findUnique({
    where: { id },
    include: {
      home: true,
      guest: true,
      host: true,
      messages: { include: { sender: true }, orderBy: { createdAt: "asc" } },
      reports: { include: { photos: true, author: true }, orderBy: { createdAt: "asc" } },
      claims: { include: { photos: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!stay || (stay.guestId !== user.id && stay.hostId !== user.id && !user.isAdmin)) {
    notFound();
  }
  const profile = await prisma.cityProfile.findUnique({ where: { city: stay.home.city } });
  const isGuest = stay.guestId === user.id;
  const isHost = stay.hostId === user.id;
  const bill = membershipBreakdown();
  const membershipActive = Boolean(stay.guest.membershipUntil && stay.guest.membershipUntil > new Date());
  const licence = renderLicence({
    homeName: stay.home.name,
    address: stay.home.address,
    neighbourhood: stay.home.neighbourhood,
    city: stay.home.city,
    hostName: stay.host.name,
    guestName: stay.guest.name,
    guestNames: stay.guestNames.replaceAll("\n", ", "),
    start: formatDay(stay.startDate),
    end: formatDay(stay.endDate),
    nights: String(stay.nights),
    handover: stay.home.handover.toLowerCase().replaceAll("_", " "),
    keyCount: String(stay.home.keyCount),
    points: points(stay.points),
    nightly: String(stay.nightlyPoints),
    deposit: rupees(stay.depositRupees),
    excludedAreas: stay.home.excludedAreas,
    houseRules: stay.home.houseRules,
    hostSigned: stay.hostSignedName
      ? `${stay.hostSignedName} on ${formatWhen(stay.hostSignedAt!)}`
      : "not yet",
    guestSigned: stay.guestSignedName
      ? `${stay.guestSignedName} on ${formatWhen(stay.guestSignedAt!)}`
      : "not yet",
  });
  const openClaim = stay.claims.find((claim) => claim.status !== "RESOLVED");
  const canClaim =
    isHost &&
    stay.checkOutAt &&
    (stay.status === "CHECKED_OUT" || stay.status === "ENDED_EARLY") &&
    claimWindowOpen(stay.checkOutAt, new Date()) &&
    !openClaim;

  return (
    <Desk>
      <p className="kicker">
        {stay.home.city} · {formatDay(stay.startDate)} to {formatDay(stay.endDate)}
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start" }}>
        <h1>{stay.home.name}</h1>
        <Stamp status={stay.status} />
      </div>
      <Notice error={query.error} note={query.note} />
      <p>
        Host {stay.host.name}. Guest {stay.guest.name}. People: {stay.guestNames.replaceAll("\n", ", ")}.
      </p>
      {stay.cancelReason ? <p>{stay.cancelReason}</p> : null}

      <div className="split">
        <article className="licence">{licence}</article>
        <aside className="slip stack">
          <p className="points-figure">{points(stay.points)}</p>
          <p>Deposit {rupees(stay.depositRupees)}. {stay.depositState.toLowerCase().replaceAll("_", " ")}.</p>
          <p>Points are {stay.pointsState.toLowerCase()}.</p>
          {["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "COMPLETED", "ENDED_EARLY"].includes(stay.status) ? (
            <Link href={`/stays/${stay.id}/guest-pack`}>Society pack</Link>
          ) : null}

          {isHost && stay.status === "REQUESTED" ? (
            <form action={acceptStay}>
              <input type="hidden" name="stayId" value={stay.id} />
              <button className="btn" type="submit">
                Accept the dates
              </button>
            </form>
          ) : null}

          {stay.status === "ACCEPTED" && ((isHost && !stay.hostSignedAt) || (isGuest && !stay.guestSignedAt)) ? (
            <form className="stack" action={signStay}>
              <input type="hidden" name="stayId" value={stay.id} />
              <p>Sign with the name on your papers.</p>
              {isGuest ? (
                <label className="check">
                  <input type="checkbox" name="rules" required />
                  <span>I accept the house rules and the society conditions.</span>
                </label>
              ) : null}
              <label className="field">
                <span>Signature</span>
                <input name="signedName" required />
              </label>
              <button className="btn" type="submit">
                Sign the licence
              </button>
            </form>
          ) : null}

          {isGuest && stay.status === "AWAITING_PAYMENT" ? (
            <form action={confirmStay}>
              <input type="hidden" name="stayId" value={stay.id} />
              <p>
                {membershipActive
                  ? "Your year at the desk is already paid."
                  : `This confirmation also pays the year: ${rupees(bill.total)}, including GST of ${rupees(bill.gst)}.`}
              </p>
              <p>The deposit is recorded for the aggregator to hold. It is not rent.</p>
              <button className="btn" type="submit">
                Confirm and hold the points
              </button>
            </form>
          ) : null}

          {profile?.policeIntimation && isHost && stay.status === "CONFIRMED" ? (
            <form action={recordIntimation}>
              <input type="hidden" name="stayId" value={stay.id} />
              <p>{profile.counselNote}</p>
              {stay.hostIntimationAt ? (
                <p>You recorded the filing on {formatWhen(stay.hostIntimationAt)}.</p>
              ) : (
                <button className="btn secondary" type="submit">
                  I have filed the pack
                </button>
              )}
            </form>
          ) : null}

          {stay.status === "CONFIRMED" && stay.pointsState === "HELD" ? (
            <form action={reportNoShow}>
              <input type="hidden" name="stayId" value={stay.id} />
              <input type="hidden" name="kind" value={isGuest ? "host" : "guest"} />
              <button className="linkish" type="submit">
                {isGuest ? "The keys were not handed over" : "The guest did not arrive"}
              </button>
            </form>
          ) : null}

          {["REQUESTED", "ACCEPTED", "AWAITING_PAYMENT", "CONFIRMED"].includes(stay.status) &&
          !stay.checkInAt &&
          (isGuest || isHost) ? (
            <form action={cancelStay}>
              <input type="hidden" name="stayId" value={stay.id} />
              <button className="linkish" type="submit">
                Cancel this stay
              </button>
            </form>
          ) : null}
        </aside>
      </div>

      {stay.status === "CONFIRMED" || stay.status === "CHECKED_IN" ? (
        <form className="stack" action={fileReport} style={{ marginTop: "2rem" }}>
          <h2>{stay.status === "CONFIRMED" ? "Arrival" : "Departure"}</h2>
          <input type="hidden" name="stayId" value={stay.id} />
          <input type="hidden" name="kind" value={stay.status === "CONFIRMED" ? "CHECKIN" : "CHECKOUT"} />
          <label className="field">
            <span>What you saw</span>
            <textarea name="notes" required placeholder="Living room, kitchen, the locked cupboard still locked." />
          </label>
          <label className="field">
            <span>Photographs</span>
            <input type="file" name="photos" accept="image/*,.pdf" multiple required />
          </label>
          <button className="btn" type="submit">
            File the report
          </button>
        </form>
      ) : null}

      {stay.reports.length > 0 ? (
        <section>
          <h2>Condition</h2>
          {stay.reports.map((report) => (
            <article key={report.id}>
              <p className="kicker">
                {report.kind === "CHECKIN" ? "Arrival" : "Departure"} · {report.author.name} ·{" "}
                {formatWhen(report.createdAt)}
              </p>
              <p>{report.notes}</p>
              {report.photos.map((photo) => (
                <p key={photo.id}>
                  <a href={`/api/files/report/${photo.id}`}>{photo.fileName}</a>
                </p>
              ))}
            </article>
          ))}
        </section>
      ) : null}

      {isHost && stay.status === "CHECKED_IN" ? (
        <form className="stack" action={endStayEarly}>
          <h2>End the licence</h2>
          <input type="hidden" name="stayId" value={stay.id} />
          <label className="field">
            <span>The breach</span>
            <textarea name="reason" required />
          </label>
          <button className="btn secondary" type="submit">
            End the stay. They leave within 24 hours.
          </button>
        </form>
      ) : null}

      {canClaim ? (
        <form className="stack" action={openClaim}>
          <h2>Damage</h2>
          <input type="hidden" name="stayId" value={stay.id} />
          <label className="field">
            <span>Rupees, up to the deposit</span>
            <input name="amount" type="number" min={1} required />
          </label>
          <label className="field">
            <span>What happened</span>
            <textarea name="description" required />
          </label>
          <input type="file" name="photos" accept="image/*,.pdf" multiple required />
          <button className="btn" type="submit">
            Open a claim
          </button>
        </form>
      ) : null}

      {stay.claims.map((claim) => (
        <article className="slip" key={claim.id} style={{ marginTop: "1rem" }}>
          <p className="kicker">Claim · {claim.status.toLowerCase()}</p>
          <p>
            {rupees(claim.amountRupees)}. {claim.description}
          </p>
          {claim.photos.map((photo) => (
            <p key={photo.id}>
              <a href={`/api/files/claim/${photo.id}`}>{photo.fileName}</a>
            </p>
          ))}
          {claim.response ? <p>Answer: {claim.response}</p> : null}
          {claim.resolutionNote ? <p>{claim.resolutionNote}</p> : null}
          {isGuest && claim.status === "OPEN" ? (
            <form className="stack" action={answerClaim}>
              <input type="hidden" name="stayId" value={stay.id} />
              <label className="field">
                <span>Your answer</span>
                <textarea name="response" />
              </label>
              <button className="btn" name="agree" value="yes" type="submit">
                I agree
              </button>
              <button className="btn secondary" name="agree" value="no" type="submit">
                I dispute this
              </button>
            </form>
          ) : null}
          {isHost && claim.status === "OPEN" && !answerWindowOpen(claim.createdAt, new Date()) ? (
            <form action={applyUnansweredClaim}>
              <input type="hidden" name="stayId" value={stay.id} />
              <button className="btn" type="submit">
                The guest did not answer
              </button>
            </form>
          ) : null}
          {user.isAdmin && claim.status === "ANSWERED" ? (
            <form className="stack" action={resolveDisputedClaim}>
              <input type="hidden" name="stayId" value={stay.id} />
              <input type="hidden" name="claimId" value={claim.id} />
              <label className="field">
                <span>Rupees to take from the deposit</span>
                <input name="amount" type="number" min={0} defaultValue={0} />
              </label>
              <label className="field">
                <span>How you decided</span>
                <textarea name="note" required />
              </label>
              <button className="btn" type="submit">
                Settle the deposit
              </button>
            </form>
          ) : null}
        </article>
      ))}

      <section style={{ marginTop: "2rem" }}>
        <h2>Notes</h2>
        {stay.messages.length === 0 ? <p className="note">No notes yet.</p> : null}
        {stay.messages.map((message) => (
          <p key={message.id}>
            <span className="kicker">
              {message.sender.name} · {formatWhen(message.createdAt)}
            </span>
            <br />
            {message.body}
          </p>
        ))}
        <form className="stack" action={sendMessage}>
          <input type="hidden" name="stayId" value={stay.id} />
          <label className="field">
            <span>A note to the other person</span>
            <textarea name="body" required />
          </label>
          <button className="btn secondary" type="submit">
            Send
          </button>
        </form>
      </section>
    </Desk>
  );
}
