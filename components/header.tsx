import Link from "next/link";
import { logout } from "@/lib/actions/auth";
import { currentUser } from "@/lib/session";

export async function Header() {
  const user = await currentUser();
  return (
    <header className="wrap mast">
      <Link href="/" className="wordmark">
        Aangan
      </Link>
      <p className="kicker">Home exchange · India</p>
      <nav>
        <Link href="/homes">Homes</Link>
        <Link href="/how-it-works">How a stay works</Link>
        {user ? (
          <>
            <Link href="/list">Your homes</Link>
            <Link href="/inbox">Letters</Link>
            <Link href="/account">Points</Link>
            {user.isAdmin ? <Link href="/admin">Desk</Link> : null}
            <form action={logout}>
              <button className="linkish" type="submit">
                Log out
              </button>
            </form>
          </>
        ) : (
          <Link href="/login">Log in</Link>
        )}
      </nav>
    </header>
  );
}
