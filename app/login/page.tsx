import { requestCode, verifyCode } from "@/lib/actions/auth";
import { prisma } from "@/lib/db";
import { Notice } from "@/components/notice";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; sent?: string; needName?: string; error?: string }>;
}) {
  const params = await searchParams;
  const email = params.email ?? "";
  let preview = "";
  if (process.env.NODE_ENV !== "production" && params.sent && email) {
    const row = await prisma.otpCode.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });
    preview = row?.code ?? "";
  }

  return (
    <main className="wrap" style={{ padding: "2.5rem 0 4rem", maxWidth: "40rem" }}>
      <p className="kicker">The desk</p>
      <h1>Come in with your email.</h1>
      <Notice error={params.error} />
      {params.needName ? (
        <p>We have not met. Add the name on your papers, then ask for a code.</p>
      ) : null}
      <form className="stack" action={requestCode}>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" required defaultValue={email} />
        </label>
        <label className="field">
          <span>Name, if this is your first time</span>
          <input name="name" autoComplete="name" />
        </label>
        <button className="btn" type="submit">
          Send a code
        </button>
      </form>

      {params.sent ? (
        <form className="stack" action={verifyCode} style={{ marginTop: "2rem" }}>
          <input type="hidden" name="email" value={email} />
          <p>
            In this preview the code is written here. A live desk would send it by email.
          </p>
          {preview ? <p className="points-figure">{preview}</p> : null}
          <label className="field">
            <span>Code</span>
            <input name="code" inputMode="numeric" required />
          </label>
          <button className="btn" type="submit">
            Enter
          </button>
        </form>
      ) : null}

      <aside className="slip" style={{ marginTop: "2.5rem" }}>
        <p className="kicker">Already at the desk</p>
        <p>ida@aangan.test reads the papers.</p>
        <p>meera@aangan.test has a listed flat in Pune.</p>
        <p>arjun@aangan.test has points, and a listed flat in Delhi.</p>
        <p>leela@aangan.test, an NRI, has a Bengaluru flat waiting to be read.</p>
      </aside>
    </main>
  );
}
