import { notFound } from "next/navigation";
import { Desk } from "@/components/desk";
import { Notice } from "@/components/notice";
import { Stamp } from "@/components/stamp";
import {
  addCoOwner,
  signCoOwner,
  submitHome,
  updateHome,
  uploadDocument,
  uploadPhoto,
} from "@/lib/actions/homes";
import { prisma } from "@/lib/db";
import { formatDay } from "@/lib/format";
import { labelFor } from "@/lib/verification/state";
import { currentUser, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const TYPES = [
  "SALE_DEED",
  "POA",
  "TAX_OR_ELECTRICITY",
  "SOCIETY_MAINTENANCE",
  "SOCIETY_NOC",
  "POSSESSION_DECLARATION",
  "ASSOCIATION_DECLARATION",
  "BANK_NOC",
] as const;

export default async function HomeFilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; note?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const viewer = await currentUser();
  const home = await prisma.home.findUnique({
    where: { id },
    include: { documents: { orderBy: { uploadedAt: "desc" } }, coOwners: true, photos: true },
  });
  if (!home) notFound();
  const isOwner = home.ownerId === user.id;
  const coOwner = home.coOwners.find((row) => row.email === user.email);
  if (!isOwner && !coOwner && !viewer?.isAdmin) notFound();
  const locked = home.status === "LIVE" || home.status === "SUSPENDED" || home.status === "SUBMITTED" || home.status === "IN_REVIEW";

  return (
    <Desk>
      <p className="kicker">
        The people, the papers, the society
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
        <h1>{home.name}</h1>
        <Stamp status={home.status} />
      </div>
      <Notice error={query.error} note={query.note} />
      {home.reviewerNote ? <p>From the desk: {home.reviewerNote}</p> : null}

      {coOwner && !coOwner.signedAt ? (
        <form className="slip stack" action={signCoOwner}>
          <p className="kicker">Co-owner</p>
          <p>Sign as {coOwner.name}. This is consent to let the home be occupied under a licence.</p>
          <input type="hidden" name="coOwnerId" value={coOwner.id} />
          <label className="field">
            <span>Your name, as written above</span>
            <input name="signedName" required />
          </label>
          <button className="btn" type="submit">
            Sign the consent
          </button>
        </form>
      ) : null}

      {isOwner && !locked ? (
        <form className="stack" action={updateHome}>
          <input type="hidden" name="homeId" value={home.id} />
          <label className="field">
            <span>Name</span>
            <input name="name" defaultValue={home.name} />
          </label>
          <label className="field">
            <span>Neighbourhood</span>
            <input name="neighbourhood" defaultValue={home.neighbourhood} />
          </label>
          <label className="field">
            <span>Address</span>
            <input name="address" defaultValue={home.address} />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea name="description" defaultValue={home.description} />
          </label>
          <div className="two">
            <label className="field">
              <span>Bedrooms</span>
              <input name="bedrooms" type="number" defaultValue={home.bedrooms} />
            </label>
            <label className="field">
              <span>Bathrooms</span>
              <input name="bathrooms" type="number" defaultValue={home.bathrooms} />
            </label>
            <label className="field">
              <span>People at most</span>
              <input name="occupancyCap" type="number" defaultValue={home.occupancyCap} />
            </label>
            <label className="field">
              <span>Keys</span>
              <input name="keyCount" type="number" defaultValue={home.keyCount} />
            </label>
          </div>
          <label className="field">
            <span>House rules</span>
            <textarea name="houseRules" defaultValue={home.houseRules} />
          </label>
          <label className="field">
            <span>What stays shut</span>
            <input name="excludedAreas" defaultValue={home.excludedAreas} />
          </label>
          <label className="field">
            <span>Handover</span>
            <select name="handover" defaultValue={home.handover}>
              <option value="OWNER">The owner</option>
              <option value="CARETAKER">A caretaker</option>
              <option value="SOCIETY_DESK">The society desk</option>
            </select>
          </label>
          <div className="two">
            <label className="field">
              <span>Caretaker</span>
              <input name="caretakerName" defaultValue={home.caretakerName ?? ""} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input name="caretakerPhone" defaultValue={home.caretakerPhone ?? ""} />
            </label>
          </div>
          <label className="field">
            <span>Right</span>
            <select name="authority" defaultValue={home.authority}>
              <option value="OWNER">Owner</option>
              <option value="POA">Registered power of attorney</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" name="soleOwner" defaultChecked={home.soleOwner} />
            <span>Only owner</span>
          </label>
          <label className="check">
            <input type="checkbox" name="hasAc" defaultChecked={home.hasAc} />
            <span>Air conditioning</span>
          </label>
          <label className="check">
            <input type="checkbox" name="hasParking" defaultChecked={home.hasParking} />
            <span>Parking</span>
          </label>
          <label className="check">
            <input type="checkbox" name="hasPool" defaultChecked={home.hasPool} />
            <span>Private pool</span>
          </label>
          <label className="check">
            <input type="checkbox" name="hasWorkspace" defaultChecked={home.hasWorkspace} />
            <span>Desk</span>
          </label>
          <label className="check">
            <input type="checkbox" name="hasAssociation" defaultChecked={home.hasAssociation} />
            <span>An association can refuse a stay</span>
          </label>
          <label className="check">
            <input type="checkbox" name="poaCoversCoOwners" defaultChecked={home.poaCoversCoOwners} />
            <span>The power of attorney covers the co-owners</span>
          </label>
          <button className="btn" type="submit">
            Save
          </button>
        </form>
      ) : (
        <p>
          {home.address}. {home.neighbourhood}, {home.city}.
        </p>
      )}

      <h2>Papers</h2>
      {home.documents.length === 0 ? <p>Nothing filed yet.</p> : null}
      {home.documents.map((document) => (
        <p key={document.id}>
          <a href={`/api/files/document/${document.id}`}>{labelFor(document.type)}</a>
          {" · "}
          {document.status.toLowerCase()}
          {document.validUntil ? ` · until ${formatDay(document.validUntil)}` : ""}
          {document.note ? ` · ${document.note}` : ""}
        </p>
      ))}
      {isOwner && !locked ? (
        <form className="stack" action={uploadDocument}>
          <input type="hidden" name="homeId" value={home.id} />
          <label className="field">
            <span>Kind of paper</span>
            <select name="type">
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {labelFor(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Valid until, for a society letter</span>
            <input type="date" name="validUntil" />
          </label>
          <label className="field">
            <span>File</span>
            <input type="file" name="file" required />
          </label>
          <button className="btn secondary" type="submit">
            Add the paper
          </button>
        </form>
      ) : null}

      <h2>Co-owners</h2>
      {home.coOwners.length === 0 ? <p>None named.</p> : null}
      {home.coOwners.map((row) => (
        <p key={row.id}>
          {row.name}, {row.email}. {row.signedAt ? `Signed ${formatDay(row.signedAt)}.` : "Not signed."}
        </p>
      ))}
      {isOwner && !locked ? (
        <form className="stack" action={addCoOwner}>
          <input type="hidden" name="homeId" value={home.id} />
          <div className="two">
            <label className="field">
              <span>Co-owner name</span>
              <input name="name" />
            </label>
            <label className="field">
              <span>Email they will use here</span>
              <input name="email" type="email" />
            </label>
          </div>
          <button className="btn secondary" type="submit">
            Ask them to sign
          </button>
        </form>
      ) : null}

      <h2>Photographs</h2>
      {home.photos.length === 0 ? (
        <p>No photograph yet. The index will set the neighbourhood in type.</p>
      ) : (
        home.photos.map((photo) => (
          <p key={photo.id}>
            <a href={`/api/media/photo/${photo.id}`}>{photo.caption}</a>
          </p>
        ))
      )}
      {isOwner && !locked ? (
        <form className="stack" action={uploadPhoto}>
          <input type="hidden" name="homeId" value={home.id} />
          <label className="field">
            <span>Caption</span>
            <input name="caption" />
          </label>
          <input type="file" name="file" accept="image/*" required />
          <button className="btn secondary" type="submit">
            Add a photograph
          </button>
        </form>
      ) : null}

      {isOwner && !locked ? (
        <form action={submitHome}>
          <input type="hidden" name="homeId" value={home.id} />
          <button className="btn" type="submit">
            Send to the desk
          </button>
        </form>
      ) : null}
    </Desk>
  );
}
