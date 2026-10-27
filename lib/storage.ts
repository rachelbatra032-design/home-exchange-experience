import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "storage");

export async function saveUpload(file: File): Promise<{ key: string; fileName: string }> {
  if (!file || file.size === 0) {
    throw new Error("Choose a file.");
  }
  if (file.size > 8_000_000) {
    throw new Error("That file is larger than 8MB.");
  }
  const ext = path.extname(file.name).slice(0, 8).toLowerCase();
  const allowed = ["", ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".txt"];
  if (!allowed.includes(ext)) {
    throw new Error("Use a PDF or a photograph.");
  }
  const key = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, key), Buffer.from(await file.arrayBuffer()));
  return { key, fileName: file.name || "paper" };
}

export function storagePath(key: string): string {
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) {
    throw new Error("Bad path");
  }
  return resolved;
}
