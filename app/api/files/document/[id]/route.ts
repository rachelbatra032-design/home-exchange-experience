import { inlineFile } from "@/lib/files";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  const { id } = await context.params;
  const document = await prisma.homeDocument.findUnique({
    where: { id },
    include: { home: true },
  });
  if (!document) return new Response("Not found", { status: 404 });
  if (!user || (user.id !== document.home.ownerId && !user.isAdmin)) {
    return new Response("The paper is not yours to open.", { status: 403 });
  }
  return inlineFile(document.storageKey, document.fileName);
}
