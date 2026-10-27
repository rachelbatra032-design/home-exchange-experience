import { Notice } from "@/components/notice";
import { saveCity } from "@/lib/actions/admin";
import { prisma } from "@/lib/db";
import { labelFor } from "@/lib/verification/state";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const TYPES = [
  "SOCIETY_NOC",
  "SOCIETY_MAINTENANCE",
  "ASSOCIATION_DECLARATION",
  "TAX_OR_ELECTRICITY",
  "POSSESSION_DECLARATION",
] as const;

export default async function CitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const cities = await prisma.cityProfile.findMany({ orderBy: { city: "asc" } });
  return (
    <main className="wrap" style={{ padding: "2rem 0 4rem" }}>
      <p className="kicker">Permissions</p>
      <h1>City rules.</h1>
      <Notice note={query.note} />
      <p>These are the papers a home must have before it can be booked. Counsel should confirm them before a city is switched on.</p>
      {cities.map((city) => (
        <form key={city.id} className="slip stack" action={saveCity} style={{ marginBottom: "1.5rem" }}>
          <h2>{city.city}</h2>
          <input type="hidden" name="city" value={city.city} />
          <label className="field">
            <span>City rate</span>
            <input name="tier" type="number" step="0.1" defaultValue={city.tier} />
          </label>
          <label className="field">
            <span>Note from counsel</span>
            <textarea name="counselNote" defaultValue={city.counselNote} />
          </label>
          <p className="kicker">Flats</p>
          {TYPES.map((type) => (
            <label className="check" key={`${city.id}-a-${type}`}>
              <input
                type="checkbox"
                name="apartmentRequires"
                value={type}
                defaultChecked={city.apartmentRequires.includes(type)}
              />
              <span>{labelFor(type)}</span>
            </label>
          ))}
          <p className="kicker">Houses</p>
          {TYPES.map((type) => (
            <label className="check" key={`${city.id}-h-${type}`}>
              <input
                type="checkbox"
                name="houseRequires"
                value={type}
                defaultChecked={city.houseRequires.includes(type)}
              />
              <span>{labelFor(type)}</span>
            </label>
          ))}
          <label className="check">
            <input type="checkbox" name="enabled" defaultChecked={city.enabled} />
            <span>Open for listing</span>
          </label>
          <label className="check">
            <input type="checkbox" name="policeIntimation" defaultChecked={city.policeIntimation} />
            <span>Write a police-intimation pack. Do not wait for an acknowledgement.</span>
          </label>
          <button className="btn" type="submit">
            Save {city.city}
          </button>
        </form>
      ))}
    </main>
  );
}
