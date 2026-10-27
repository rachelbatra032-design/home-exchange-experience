export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    REQUESTED: "Asked",
    ACCEPTED: "Accepted",
    AWAITING_PAYMENT: "To confirm",
    CONFIRMED: "Confirmed",
    CHECKED_IN: "In the house",
    CHECKED_OUT: "Checked out",
    COMPLETED: "Closed",
    CANCELLED: "Cancelled",
    ENDED_EARLY: "Ended",
    DRAFT: "Draft",
    SUBMITTED: "With the desk",
    IN_REVIEW: "Being read",
    CHANGES_REQUESTED: "Sent back",
    LIVE: "Listed",
    SUSPENDED: "Taken down",
    VERIFIED: "Verified",
    UNVERIFIED: "Unread",
    REJECTED: "Refused",
  };
  return labels[status] ?? status;
}

export function stampTone(status: string): "ok" | "wait" | "stop" {
  if (["LIVE", "CONFIRMED", "CHECKED_IN", "COMPLETED", "VERIFIED", "APPROVED"].includes(status)) {
    return "ok";
  }
  if (["CANCELLED", "SUSPENDED", "REJECTED", "ENDED_EARLY"].includes(status)) return "stop";
  return "wait";
}
