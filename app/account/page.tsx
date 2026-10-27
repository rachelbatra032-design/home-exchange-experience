import Link from "next/link";
import { Desk } from "@/components/desk";
import { Stamp } from "@/components/stamp";
import { prisma } from "@/lib/db";
import { formatWhen, points } from "@/lib/format";
import { balances } from "@/lib/points/valuation";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const entries = await prisma.pointEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const balance = balances(entries);
  const active = user.membershipUntil && user.membershipUntil > new Date();
  return (
    <Desk>
      <p className="kicker">Points</p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <h1>{user.name}</h1>
        <Stamp status={user.identityStatus} />
      </div>
      <p className="points-figure">{points(balance.available)}</p>
      <p className="note">{points(balance.held)} held for a stay that has not settled.</p>
      <p>
        Membership{" "}
        {active && user.membershipUntil
          ? `runs until ${formatWhen(user.membershipUntil)}.`
          : "is not active."}{" "}
        <Link href="/membership">The year at the desk.</Link>
      </p>
      {entries.length === 0 ? (
        <p>The ledger is empty. Points arrive when a home is listed, and when you host.</p>
      ) : (
        <table className="ledger">
          <thead>
            <tr>
              <th>When</th>
              <th>Where</th>
              <th>Change</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatWhen(entry.createdAt)}</td>
                <td>{entry.bucket}</td>
                <td>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</td>
                <td>{entry.memo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="note">Points are not rupees. A damage deposit, when there is one, is kept apart from this ledger.</p>
    </Desk>
  );
}
