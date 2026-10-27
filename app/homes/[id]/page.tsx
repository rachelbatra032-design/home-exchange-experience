import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/notice";
import { Stamp } from "@/components/stamp";
import { requestStay } from "@/lib/actions/stays";
import { prisma } from "@/lib/db";
import { points } from "@/lib/format";
import { nightlyPoints, depositRupees } from "@/lib/points/valuation";
import { rupees } from "@/lib/format";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const home = await prisma.home.findUnique({
    where: { id },
    include: { owner: true, photos: { orderBy: { sort: "asc" } } },
  });
  const user = await currentUser();
  if (!home || (home.status !== "LIVE" && user?.id !== home.ownerId && !user?.isAdmin)) {
    notFound();
  }
  const profile = await prisma.cityProfile.findUnique({ where: { city: home.city } });
  const priced = nightlyPoints({
    bedrooms: home.bedrooms,
    tier: profile?.tier ?? 1,
    hasAc: home.hasAc,
    hasParking: home.hasParking,
    hasPool: home.hasPool,
    hasWorkspace: home.hasWorkspace,
  });

  return (
    <main className="wrap split" style={{ padding: "2rem 0 4rem" }}>
      <article>
        <p className="kicker">
          {home.city} · {home.kind === "APARTMENT" ? "Flat" : "House"}
        </p>
        <h1>{home.name}</h1>
        <p className="points-figure">{points(home.nightlyPoints)} a night</p>
        <p>{home.description}</p>
        <p>
          {home.neighbourhood}. Sleeps {home.occupancyCap}. {home.bedrooms} bedrooms,{" "}
          {home.bathrooms} bathrooms. Keys handed over by{" "}
          {home.handover === "OWNER"
            ? "the owner"
            : home.handover === "CARETAKER"
              ? "the caretaker"
              : "the society desk"}
          .
        </p>
        <h2>House rules</h2>
        <p>{home.houseRules}</p>
        <p>Left shut: {home.excludedAreas}</p>
        <p className="note">The price, written out.</p>
        <ul>
          {priced.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </article>
      <aside className="slip stack">
        <Stamp status={home.status} />
        <p>Damage deposit {rupees(depositRupees(home.bedrooms))}, returned if no claim is open.</p>
        <Notice error={query.error} />
        {!user ? (
          <Link className="btn" href="/login">
            Log in to ask
          </Link>
        ) : user.identityStatus !== "VERIFIED" ? (
          <Link className="btn" href="/verify">
            Your papers come first
          </Link>
        ) : user.id === home.ownerId ? (
          <p>This is your home.</p>
        ) : home.status !== "LIVE" ? (
          <p>This home is not open for a stay.</p>
        ) : (
          <form className="stack" action={requestStay}>
            <input type="hidden" name="homeId" value={home.id} />
            <label className="field">
              <span>Arrive</span>
              <input type="date" name="start" required />
            </label>
            <label className="field">
              <span>Leave</span>
              <input type="date" name="end" required />
            </label>
            <label className="field">
              <span>People, one name on each line</span>
              <textarea name="guestNames" required defaultValue={user.name} />
            </label>
            <label className="field">
              <span>Vehicle, if it will enter the gate</span>
              <input name="vehicle" />
            </label>
            <button className="btn" type="submit">
              Ask for these dates
            </button>
          </form>
        )}
      </aside>
    </main>
  );
}
