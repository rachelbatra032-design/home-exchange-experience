import Link from "next/link";
import { Desk } from "@/components/desk";
import { Notice } from "@/components/notice";
import { Stamp } from "@/components/stamp";
import { prisma } from "@/lib/db";
import { formatDay, points } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const stays = await prisma.stay.findMany({
    where: { OR: [{ guestId: user.id }, { hostId: user.id }] },
    include: { home: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <Desk>
      <p className="kicker">Letters</p>
      <h1>Stays in motion.</h1>
      <Notice error={query.error} />
      {stays.length === 0 ? (
        <p>No letters yet. When you ask for a home, or someone asks for yours, it sits here.</p>
      ) : (
        stays.map((stay) => (
          <Link key={stay.id} href={`/stays/${stay.id}`} className="home-row">
            <span>
              <span className="kicker">
                {stay.guestId === user.id ? "You asked" : "They asked"} · {stay.home.city}
              </span>
              <br />
              {stay.home.name}
              <br />
              <span className="note">
                {formatDay(stay.startDate)} to {formatDay(stay.endDate)} · {points(stay.points)}
              </span>
            </span>
            <Stamp status={stay.status} />
          </Link>
        ))
      )}
    </Desk>
  );
}
