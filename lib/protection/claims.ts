const HOUR = 3_600_000;

export function claimWindowOpen(checkOutAt: Date, now: Date): boolean {
  return now.getTime() - checkOutAt.getTime() < 72 * HOUR;
}

export function answerWindowOpen(openedAt: Date, now: Date): boolean {
  return now.getTime() - openedAt.getTime() < 48 * HOUR;
}

export function depositReleaseDue(checkOutAt: Date, now: Date, claimOpen: boolean): boolean {
  if (claimOpen) return false;
  return now.getTime() - checkOutAt.getTime() >= 72 * HOUR;
}

export function pointsAutoSettleDue(start: Date, now: Date): boolean {
  return now.getTime() - start.getTime() >= 24 * HOUR;
}

export function appliedAmount(requested: number, deposit: number): number {
  return Math.max(0, Math.min(requested, deposit));
}
