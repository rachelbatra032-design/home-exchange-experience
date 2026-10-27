import Link from "next/link";
import { prisma } from "@/lib/db";
import { points } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomesPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const { city } = await searchParams;
  const profiles = await prisma.cityProfile.findMany({
    where: { enabled: true },
    orderBy: { city: "asc" },
  });
  const homes = await prisma.home.findMany({
    where: { status: "LIVE", ...(city ? { city } : {}) },
    include: { photos: { orderBy: { sort: "asc" }, take: 1 } },
    orderBy: { listedAt: "desc" },
  });
  const [feature, ...rest] = homes;

  return (
    <main className="wrap" style={{ paddingBottom: "4rem" }}>
      <p className="kicker" style={{ marginTop: "2rem" }}>
        The index
      </p>
      <h1>Homes with the papers read.</h1>
      <nav className="cities">
        <Link href="/homes" aria-current={city ? undefined : "page"}>
          All
        </Link>
        {profiles.map((profile) => (
          <Link
            key={profile.city}
            href={`/homes?city=${encodeURIComponent(profile.city)}`}
            aria-current={city === profile.city ? "page" : undefined}
          >
            {profile.city}
          </Link>
        ))}
      </nav>

      {homes.length === 0 ? (
        <p className="note">No listed home in that city yet.</p>
      ) : (
        <section className="index">
          {feature ? (
            <Link href={`/homes/${feature.id}`} className="plate" style={{ textDecoration: "none" }}>
              <p className="kicker">{feature.city}</p>
              <p className="plate-name">{feature.neighbourhood}</p>
              <p>
                {feature.name}. {points(feature.nightlyPoints)} a night.
              </p>
            </Link>
          ) : null}
          <div>
            {rest.map((home) => (
              <Link key={home.id} href={`/homes/${home.id}`} className="home-row">
                <span>
                  <span className="kicker">{home.city}</span>
                  <br />
                  {home.name}
                  <br />
                  <span className="note">{home.neighbourhood}</span>
                </span>
                <span>{points(home.nightlyPoints)}</span>
              </Link>
            ))}
            {rest.length === 0 && feature ? (
              <p className="note">One home in this index. Open it for the rules and the dates.</p>
            ) : null}
          </div>
        </section>
      )}
    </main>
  );
}
