import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDay } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function GuestPackPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const stay = await prisma.stay.findUnique({
    where: { id },
    include: { home: true, host: true, guest: true },
  });
  if (!stay || (stay.guestId !== user.id && stay.hostId !== user.id && !user.isAdmin)) notFound();
  if (["REQUESTED", "ACCEPTED", "AWAITING_PAYMENT", "CANCELLED"].includes(stay.status)) {
    notFound();
  }
  const names = stay.guestNames.split("\n").filter(Boolean);
  const caretaker = stay.home.caretakerName || stay.host.caretakerName;
  const caretakerPhone = stay.home.caretakerPhone || stay.host.caretakerPhone;
  return (
    <main className="wrap" style={{ padding: "2rem 0 4rem", maxWidth: "40rem" }}>
      <p className="kicker">For the gate</p>
      <h1>Guest pack</h1>
      <p>
        {stay.home.name}
        <br />
        {stay.home.address}
        <br />
        {stay.home.neighbourhood}, {stay.home.city}
      </p>
      <p>
        {formatDay(stay.startDate)} to {formatDay(stay.endDate)}. {names.length}{" "}
        {names.length === 1 ? "person" : "people"}.
      </p>
      <p>{names.join(", ")}</p>
      <p>Identity shown as a {stay.idType}. The number is not printed.</p>
      <p>Vehicle: {stay.vehicle || "None declared."}</p>
      <p>Host {stay.host.name}, {stay.host.phone || "no phone on the file"}.</p>
      <p>
        Caretaker {caretaker || "not named"}, {caretakerPhone || "no phone on the file"}.
      </p>
      <p className="note">Hand this to society security. It is not a police acknowledgement.</p>
    </main>
  );
}
