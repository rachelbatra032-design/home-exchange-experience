import { readFileSync } from "node:fs";
import path from "node:path";

let cached: string | null = null;

export function licenceTemplate(): string {
  if (cached) return cached;
  cached = readFileSync(
    path.join(process.cwd(), "content/agreements/occupation-licence.md"),
    "utf8",
  );
  return cached;
}

export function renderLicence(fields: Record<string, string>): string {
  return licenceTemplate().replace(/\{\{(\w+)\}\}/g, (_, key: string) => fields[key] ?? "—");
}
