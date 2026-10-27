import { Desk } from "@/components/desk";
import { prisma } from "@/lib/db";
import { formatWhen, rupees } from "@/lib/format";
import { membershipBreakdown } from "@/lib/points/valuation";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MembershipPage() {
  const user = await requireUser();
  const bill = membershipBreakdown();
  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const active = user.membershipUntil && user.membershipUntil > new Date();
  return (
    <Desk>
      <p className="kicker">Membership</p>
      <h1>A year at the desk.</h1>
      <p>
        {rupees(bill.base)} plus GST of {rupees(bill.gst)}. {rupees(bill.total)} in all. It is
        collected from the guest when a stay is confirmed, and it is not the damage deposit.
      </p>
      <p>
        {active && user.membershipUntil
          ? `Yours runs until ${formatWhen(user.membershipUntil)}.`
          : "Yours is not active yet. It starts when you confirm a stay."}
      </p>
      <p className="note">
        This preview records the payment the way an aggregator would. The rupees are not held in
        Aangan’s own account. A chartered accountant should confirm the invoice for NRI payers
        before launch.
      </p>
      {payments.length === 0 ? <p>No invoice yet.</p> : null}
      {payments.map((payment) => (
        <p key={payment.id}>
          {formatWhen(payment.createdAt)}. {payment.note}{" "}
          {rupees(payment.amountPaise / 100)}
          {payment.gstPaise ? `, of which GST is ${rupees(payment.gstPaise / 100)}.` : "."}
        </p>
      ))}
    </Desk>
  );
}
