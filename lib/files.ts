import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { storagePath } from "./storage";

const types: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
};

export async function inlineFile(key: string, fileName: string) {
  const filePath = storagePath(key);
  await access(filePath);
  const stream = createReadStream(filePath);
  const ext = path.extname(fileName || key).toLowerCase();
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": types[ext] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${fileName.replaceAll('"', "")}"`,
    },
  });
}
