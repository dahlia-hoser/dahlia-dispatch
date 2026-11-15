import { signIn } from './actions';

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; wrong?: string }> }) {
  const { next, wrong } = await searchParams;
  const ready = !!process.env.ADMIN_PASSWORD;
  return (
    <>
      <h1 style={{ fontSize: 32 }}>Owner sign-in</h1>
      {!ready ? (
        <p className="note-box">
          The owner password isn’t set up yet. On Vercel, add <b>ADMIN_PASSWORD</b> under Settings → Environment Variables, then redeploy.
        </p>
      ) : (
        <form className="form" action={signIn}>
          <input type="hidden" name="next" value={next ?? '/admin'} />
          {wrong && <p className="bad">That password didn’t match. Try again.</p>}
          <label>
            Owner password
            <input type="password" name="password" autoComplete="current-password" required autoFocus />
          </label>
          <div><button className="btn" type="submit">Sign in</button></div>
          <p className="note">This keeps the review list and edit pages to you. Your phone remembers it for 90 days.</p>
        </form>
      )}
    </>
  );
}
