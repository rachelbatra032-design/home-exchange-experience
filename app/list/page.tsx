import Link from "next/link";
import { Desk } from "@/components/desk";
import { Notice } from "@/components/notice";
import { Stamp } from "@/components/stamp";
import { createHome } from "@/lib/actions/homes";
import { prisma } from "@/lib/db";
import { points } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ListIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const homes = await prisma.home.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const cities = await prisma.cityProfile.findMany({
    where: { enabled: true },
    orderBy: { city: "asc" },
  });
  const consents = await prisma.coOwner.findMany({
    where: { email: user.email, signedAt: null },
  });

  return (
    <Desk>
      <p className="kicker">The papers</p>
      <h1>Your homes.</h1>
      <Notice error={query.error} />
      {consents.length > 0 ? (
        <p>
          You still have to sign as a co-owner.{" "}
          {consents.map((row) => (
            <Link key={row.id} href={`/list/${row.homeId}`}>
              Open {row.name}&rsquo;s consent.{" "}
            </Link>
          ))}
        </p>
      ) : null}
      {homes.length === 0 ? <p>No home on the file yet.</p> : null}
      {homes.map((home) => (
        <Link key={home.id} href={`/list/${home.id}`} className="home-row">
          <span>
            <span className="kicker">{home.city}</span>
            <br />
            {home.name}
          </span>
          <span>
            <Stamp status={home.status} />
            <br />
            {home.nightlyPoints ? points(home.nightlyPoints) : ""}
          </span>
        </Link>
      ))}

      <h2 style={{ marginTop: "2.5rem" }}>List another</h2>
      {user.identityStatus !== "VERIFIED" ? (
        <p>
          <Link href="/verify">The desk reads your papers first.</Link>
        </p>
      ) : (
        <form className="stack" action={createHome}>
          <label className="field">
            <span>Name of the home</span>
            <input name="name" required placeholder="The Koregaon Park flat" />
          </label>
          <div className="two">
            <label className="field">
              <span>City</span>
              <select name="city">
                {cities.map((city) => (
                  <option key={city.city}>{city.city}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Kind</span>
              <select name="kind">
                <option value="APARTMENT">Flat in a society</option>
                <option value="INDEPENDENT">Independent house</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Neighbourhood</span>
            <input name="neighbourhood" required />
          </label>
          <label className="field">
            <span>Address, as on the tax bill</span>
            <input name="address" required />
          </label>
          <label className="field">
            <span>What a guest should know</span>
            <textarea name="description" required />
          </label>
          <div className="two">
            <label className="field">
              <span>Bedrooms</span>
              <input name="bedrooms" type="number" min={1} max={8} defaultValue={2} />
            </label>
            <label className="field">
              <span>Bathrooms</span>
              <input name="bathrooms" type="number" min={1} defaultValue={2} />
            </label>
            <label className="field">
              <span>People at most</span>
              <input name="occupancyCap" type="number" min={1} defaultValue={4} />
            </label>
            <label className="field">
              <span>Keys</span>
              <input name="keyCount" type="number" min={1} defaultValue={2} />
            </label>
          </div>
          <label className="field">
            <span>House rules</span>
            <textarea
              name="houseRules"
              defaultValue="No events. No extra guests. No commercial shoots. No smoking indoors. Quiet hours 10pm to 7am."
            />
          </label>
          <label className="field">
            <span>What stays shut</span>
            <input name="excludedAreas" defaultValue="The locked cupboard in the bedroom." />
          </label>
          <label className="field">
            <span>Keys handed over by</span>
            <select name="handover" defaultValue="OWNER">
              <option value="OWNER">The owner</option>
              <option value="CARETAKER">A caretaker</option>
              <option value="SOCIETY_DESK">The society desk</option>
            </select>
          </label>
          <div className="two">
            <label className="field">
              <span>Caretaker name</span>
              <input name="caretakerName" />
            </label>
            <label className="field">
              <span>Caretaker phone</span>
              <input name="caretakerPhone" />
            </label>
          </div>
          <label className="field">
            <span>Your right</span>
            <select name="authority" defaultValue="OWNER">
              <option value="OWNER">I am an owner</option>
              <option value="POA">I hold a registered power of attorney</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" name="soleOwner" defaultChecked />
            <span>I am the only owner</span>
          </label>
          <label className="check">
            <input type="checkbox" name="hasAc" />
            <span>Air conditioning</span>
          </label>
          <label className="check">
            <input type="checkbox" name="hasParking" />
            <span>Parking</span>
          </label>
          <label className="check">
            <input type="checkbox" name="hasPool" />
            <span>A private pool</span>
          </label>
          <label className="check">
            <input type="checkbox" name="hasWorkspace" />
            <span>A desk for work</span>
          </label>
          <label className="check">
            <input type="checkbox" name="hasAssociation" />
            <span>An association or society can refuse a stay</span>
          </label>
          <label className="check">
            <input type="checkbox" name="poaCoversCoOwners" />
            <span>The power of attorney covers every co-owner</span>
          </label>
          <button className="btn" type="submit">
            Open the file
          </button>
        </form>
      )}
    </Desk>
  );
}
