import Link from "next/link";
import { membershipBreakdown } from "@/lib/points/valuation";
import { rupees } from "@/lib/format";

export default function HowItWorksPage() {
  const bill = membershipBreakdown();
  return (
    <main className="wrap" style={{ padding: "2.5rem 0 4rem" }}>
      <p className="kicker">The docket</p>
      <h1>How a stay actually moves.</h1>
      <div className="split">
        <div>
          <p>
            You list a home you have the right to occupy. Hosting earns points. Staying
            spends them. There is no cash rent between members, and points cannot be bought.
          </p>
          <p>
            Residents of India, NRIs, and OCI cardholders can take part, for homes in India.
            Tenants cannot list. Other foreign visitors are outside this version.
          </p>
          <p>
            A guest’s year at the desk is {rupees(bill.base)}, plus GST of {rupees(bill.gst)}.
            The damage deposit is separate, capped by the size of the home, and it is meant
            to be returned.
          </p>
          <p>
            <Link className="btn" href="/verify">
              Bring your papers
            </Link>
          </p>
        </div>
        <aside className="slip">
          <p className="kicker">If plans change</p>
          <p>More than 14 days before the start, the held points go back to the guest.</p>
          <p>From 3 to 14 days, one night stays with the host.</p>
          <p>Under 3 days, or if the guest does not arrive, the host keeps the hold.</p>
          <p>If the host cancels, or the keys are not there, the guest gets the points back and the deposit is returned.</p>
          <p className="note">
            The writing itself is a draft occupation licence. Counsel still has to settle
            stamp and registration, especially in Maharashtra.
          </p>
        </aside>
      </div>
      <figure style={{ marginTop: "3rem" }}>
        <img
          src="/photos/patwon.jpg"
          alt="Sky seen from the courtyard of Patwon ki Haveli"
          style={{ width: "100%", maxHeight: "460px", objectFit: "cover" }}
        />
        <figcaption className="caption">
          Patwon ki Haveli, Jaisalmer. Wikimedia Commons.
        </figcaption>
      </figure>
    </main>
  );
}
