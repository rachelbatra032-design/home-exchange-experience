import Link from "next/link";

export default function HomePage() {
  return (
    <main className="wrap">
      <section className="hero">
        <figure>
          <img
            src="/photos/jaisalmer.jpg"
            alt="A carved sandstone courtyard in Jaisalmer, open to the sky"
          />
          <figcaption>
            Courtyard, Jaisalmer. Wikimedia Commons. Member homes are ordinary flats and
            houses. They are checked before anyone stays.
          </figcaption>
        </figure>
        <div className="hero-copy">
          <p className="kicker">A letter, then the keys</p>
          <h1>Your name on the society register, before you unpack.</h1>
          <p className="lede">
            Exchange a home in India for points, not rent. The dates do not have to match.
            A flat is listed only after a person has read the title, the co-owners, and the
            society letter.
          </p>
          <p>
            <Link className="btn" href="/homes">
              Look at the homes
            </Link>
          </p>
        </div>
      </section>

      <section className="facts">
        <p>
          <strong>150</strong>
          welcome points after your home is listed. Enough for a short, plain stay. They
          are not for sale.
        </p>
        <p>
          <strong>72 hours</strong>
          after checkout to open a damage claim, with photographs. Then the deposit goes
          back the way it came.
        </p>
        <p>
          <strong>One letter</strong>
          from the society, in date, before a guest can be confirmed. The pack for the
          gate prints names, not identity numbers.
        </p>
      </section>

      <section className="essay">
        <div>
          <p className="kicker">What the desk reads</p>
          <h2>Four things, in order.</h2>
          <figure>
            <img src="/photos/haveli.jpg" alt="A haveli courtyard with a tree and arched verandahs" />
            <figcaption>Haveli courtyard. Wikimedia Commons. Atmosphere, not a listing.</figcaption>
          </figure>
        </div>
        <ol>
          <li>
            <strong>The people.</strong> A PAN, or a passport and OCI card, checked through a
            vendor. We store the result and a masked number. We do not store Aadhaar.
          </li>
          <li>
            <strong>The papers.</strong> A sale deed or a registered power of attorney, a tax
            receipt or an electricity bill, and a signature from every co-owner.
          </li>
          <li>
            <strong>The society.</strong> A letter that names the flat and has not expired.
            An independent house declares whether an association exists.
          </li>
          <li>
            <strong>The licence.</strong> Both names, signed, before any points are held and
            before the damage deposit is recorded.
          </li>
        </ol>
      </section>
    </main>
  );
}
