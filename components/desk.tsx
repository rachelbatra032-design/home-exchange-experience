import Link from "next/link";

const links = [
  ["/verify", "The people"],
  ["/list", "The papers"],
  ["/inbox", "Letters"],
  ["/account", "Points"],
  ["/membership", "Membership"],
];

export function Desk({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap desk">
      <aside className="contents">
        <p className="kicker">Contents</p>
        {links.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </aside>
      <div>{children}</div>
    </div>
  );
}
