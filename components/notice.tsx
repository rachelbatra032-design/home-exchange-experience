export function Notice({ error, note }: { error?: string; note?: string }) {
  if (!error && !note) return null;
  return <p className={error ? "warning" : "note"}>{error || note}</p>;
}
