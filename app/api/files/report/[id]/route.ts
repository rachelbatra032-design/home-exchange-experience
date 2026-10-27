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
  const photo = await prisma.reportPhoto.findUnique({
    where: { id },
    include: { report: { include: { stay: true } } },
  });
  if (!photo) return new Response("Not found", { status: 404 });
  const stay = photo.report.stay;
  if (!user || (user.id !== stay.guestId && user.id !== stay.hostId && !user.isAdmin)) {
    return new Response("Not yours.", { status: 403 });
  }
  return inlineFile(photo.storageKey, photo.fileName);
}
