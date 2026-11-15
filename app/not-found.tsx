import { text } from '../site-text';

// Shown when a page doesn't exist, like a mistyped address or a variety that's been renamed.
export default function NotFound() {
  return (
    <section className="done" style={{ padding: '24px 0' }}>
      <img src="/all-caught-up.jpg" alt="" />
      <h1 style={{ fontSize: 34 }}>{text.notFoundTitle}</h1>
      <p style={{ maxWidth: 520 }}>{text.notFoundText}</p>
      <div className="inline" style={{ justifyContent: 'center' }}>
        <a className="btn" href="/">{text.notFoundSearch}</a>
        <a className="btn ghost" href="/calendar">{text.navCalendar}</a>
      </div>
    </section>
  );
}
