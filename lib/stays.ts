import type { Prisma, Stay } from "@prisma/client";
import { prisma } from "./db";
import { depositReleaseDue, pointsAutoSettleDue } from "./protection/claims";
import { settleHeldToHost } from "./points/ledger";

type Tx = Prisma.TransactionClient;

const BLOCKING = ["ACCEPTED", "AWAITING_PAYMENT", "CONFIRMED", "CHECKED_IN"] as const;

export async function datesClash(
  homeId: string,
  start: Date,
  end: Date,
  exceptStayId?: string,
) {
  const clash = await prisma.stay.findFirst({
    where: {
      homeId,
      id: exceptStayId ? { not: exceptStayId } : undefined,
      status: { in: [...BLOCKING] },
      startDate: { lt: end },
      endDate: { gt: start },
    },
  });
  return Boolean(clash);
}

export async function refundDeposit(tx: Tx, stay: Stay, note: string) {
  if (stay.depositState !== "HELD") return;
  const refundRupees = stay.depositRupees - stay.depositAppliedRupees;
  if (refundRupees > 0) {
    await tx.payment.create({
      data: {
        userId: stay.guestId,
        stayId: stay.id,
        kind: "DEPOSIT_REFUND",
        amountPaise: refundRupees * 100,
        note,
      },
    });
  }
  await tx.stay.update({
    where: { id: stay.id },
    data: { depositState: "REFUNDED" },
  });
}

export async function progressStay(stayId: string) {
  await prisma.$transaction(async (tx) => {
    const stay = await tx.stay.findUnique({
      where: { id: stayId },
      include: { claims: true },
    });
    if (!stay) return;
    const now = new Date();
    if (
      stay.status === "CONFIRMED" &&
      stay.pointsState === "HELD" &&
      pointsAutoSettleDue(stay.startDate, now)
    ) {
      await settleHeldToHost(tx, {
        guestId: stay.guestId,
        hostId: stay.hostId,
        stayId: stay.id,
        points: stay.points,
        memo: "Settled 24 hours after the start. Nobody reported a no-show.",
      });
      await tx.stay.update({
        where: { id: stay.id },
        data: { pointsState: "SETTLED" },
      });
    }
    const openClaim = stay.claims.some((claim) => claim.status !== "RESOLVED");
    const finished = stay.status === "CHECKED_OUT" || stay.status === "ENDED_EARLY";
    if (
      finished &&
      stay.depositState === "HELD" &&
      stay.checkOutAt &&
      depositReleaseDue(stay.checkOutAt, now, openClaim)
    ) {
      const current = await tx.stay.findUniqueOrThrow({ where: { id: stay.id } });
      await refundDeposit(
        tx,
        current,
        "Damage deposit returned. The 72 hour window closed with no open claim.",
      );
      await tx.stay.update({
        where: { id: stay.id },
        data: { status: "COMPLETED" },
      });
    }
  });
}
