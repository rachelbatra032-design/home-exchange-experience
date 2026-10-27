import { stampTone, statusLabel } from "@/lib/labels";

export function Stamp({ status }: { status: string }) {
  return <span className={`stamp ${stampTone(status)}`}>{statusLabel(status)}</span>;
}
