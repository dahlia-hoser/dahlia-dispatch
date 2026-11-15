'use client';
// Shown instead of Vercel's "Application error" page when something goes wrong.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="hero">
      <h1>Something went wrong</h1>
      <p>The site couldn't read the database. <a href="/status">Open the status check</a> to see why.</p>
      <p><button className="btn ghost" onClick={() => reset()}>Try again</button></p>
    </section>
  );
}
