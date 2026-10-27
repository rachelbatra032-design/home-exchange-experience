import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap" style={{ padding: "4rem 0" }}>
      <p className="kicker">Missing</p>
      <h1>That page is not on the desk.</h1>
      <p>
        <Link href="/homes">Back to the homes.</Link>
      </p>
    </main>
  );
}
