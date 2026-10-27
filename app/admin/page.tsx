import Link from "next/link";
import { Stamp } from "@/components/stamp";
import { prisma } from "@/lib/db";
import { Notice } from "@/components/notice";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const homes = await prisma.home.findMany({
    where: { status: { in: ["SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED"] } },
    include: { owner: true },
    orderBy: { submittedAt: "asc" },
  });
  const disputes = await prisma.claim.findMany({
    where: { status: "ANSWERED" },
    include: { stay: { include: { home: true } } },
  });
  return (
    <main className="wrap" style={{ padding: "2rem 0 4rem" }}>
      <p className="kicker">The desk</p>
      <h1>Papers waiting.</h1>
      <Notice note={query.note} />
      <p>
        <Link href="/admin/cities">City rules</Link>
      </p>
      {homes.length === 0 ? <p>The queue is clear.</p> : null}
      {homes.map((home) => (
        <Link key={home.id} href={`/admin/homes/${home.id}`} className="home-row">
          <span>
            <span className="kicker">{home.city}</span>
            <br />
            {home.name}
            <br />
            <span className="note">{home.owner.name}</span>
          </span>
          <Stamp status={home.status} />
        </Link>
      ))}
      <h2>Disputed deposits</h2>
      {disputes.length === 0 ? <p>None.</p> : null}
      {disputes.map((claim) => (
        <p key={claim.id}>
          <Link href={`/stays/${claim.stayId}`}>{claim.stay.home.name}</Link>. {claim.response}
        </p>
      ))}
    </main>
  );
}
