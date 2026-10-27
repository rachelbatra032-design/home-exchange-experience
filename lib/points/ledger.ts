import type { Prisma } from "@prisma/client";
import { WELCOME_POINTS, balances } from "./valuation";

type Tx = Prisma.TransactionClient;

export async function balanceOf(tx: Tx, userId: string) {
  const entries = await tx.pointEntry.findMany({
    where: { userId },
    select: { bucket: true, delta: true },
  });
  return balances(entries);
}

async function write(
  tx: Tx,
  input: { userId: string; stayId?: string; bucket: string; delta: number; memo: string },
) {
  await tx.pointEntry.create({
    data: {
      userId: input.userId,
      stayId: input.stayId,
      bucket: input.bucket,
      delta: input.delta,
      memo: input.memo,
    },
  });
}

export async function grantWelcome(tx: Tx, userId: string) {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.welcomeGranted || user.welcomeForfeited) return false;
  await write(tx, {
    userId,
    bucket: "available",
    delta: WELCOME_POINTS,
    memo: "Welcome grant, after the home was listed",
  });
  await tx.user.update({ where: { id: userId }, data: { welcomeGranted: true } });
  return true;
}

export async function forfeitWelcome(tx: Tx, userId: string, stayId?: string) {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.welcomeGranted || user.welcomeForfeited) return false;
  await write(tx, {
    userId,
    stayId,
    bucket: "available",
    delta: -WELCOME_POINTS,
    memo: "Welcome grant forfeited: the home was removed for false papers",
  });
  await tx.user.update({
    where: { id: userId },
    data: { welcomeForfeited: true },
  });
  return true;
}

export async function holdPoints(
  tx: Tx,
  input: { guestId: string; stayId: string; points: number },
) {
  const balance = await balanceOf(tx, input.guestId);
  if (balance.available < input.points) {
    throw new Error(
      `This stay needs ${input.points} points. ${balance.available} are free to use.`,
    );
  }
  await write(tx, {
    userId: input.guestId,
    stayId: input.stayId,
    bucket: "available",
    delta: -input.points,
    memo: "Held for a stay",
  });
  await write(tx, {
    userId: input.guestId,
    stayId: input.stayId,
    bucket: "held",
    delta: input.points,
    memo: "Held for a stay",
  });
}

export async function settleHeldToHost(
  tx: Tx,
  input: { guestId: string; hostId: string; stayId: string; points: number; memo: string },
) {
  await write(tx, {
    userId: input.guestId,
    stayId: input.stayId,
    bucket: "held",
    delta: -input.points,
    memo: input.memo,
  });
  await write(tx, {
    userId: input.hostId,
    stayId: input.stayId,
    bucket: "available",
    delta: input.points,
    memo: input.memo,
  });
}

export async function releaseHeld(
  tx: Tx,
  input: {
    guestId: string;
    hostId: string;
    stayId: string;
    toGuest: number;
    toHost: number;
    memo: string;
  },
) {
  const total = input.toGuest + input.toHost;
  await write(tx, {
    userId: input.guestId,
    stayId: input.stayId,
    bucket: "held",
    delta: -total,
    memo: input.memo,
  });
  if (input.toGuest) {
    await write(tx, {
      userId: input.guestId,
      stayId: input.stayId,
      bucket: "available",
      delta: input.toGuest,
      memo: input.memo,
    });
  }
  if (input.toHost) {
    await write(tx, {
      userId: input.hostId,
      stayId: input.stayId,
      bucket: "available",
      delta: input.toHost,
      memo: input.memo,
    });
  }
}
