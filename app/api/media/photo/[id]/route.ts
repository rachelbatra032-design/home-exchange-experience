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
  const photo = await prisma.homePhoto.findUnique({
    where: { id },
    include: { home: true },
  });
  if (!photo) return new Response("Not found", { status: 404 });
  const open = photo.home.status === "LIVE";
  const allowed = user && (user.id === photo.home.ownerId || user.isAdmin);
  if (!open && !allowed) return new Response("Not listed.", { status: 403 });
  return inlineFile(photo.path, photo.caption);
}
