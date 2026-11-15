import { db } from '../../lib/db';
import { dateTime } from '../../lib/catalogue';
import type { Farm, SaleEvent } from '../../lib/types';
import { text } from '../../site-text';
import { isAdmin } from '../../lib/is-admin';

export default async function Calendar() {
  const t = db();
  const [farms, sales] = (await Promise.all([t.all('farms'), t.all('sale_events')])) as [Farm[], SaleEvent[]];
  const farm = new Map(farms.map((f) => [f.id, f]));
  const now = Date.now();
  const admin = await isAdmin();

  const openNow = sales.filter((s) => /open now/i.test(s.when_text ?? '') || (s.starts_at && new Date(s.starts_at).getTime() <= now && now - new Date(s.starts_at).getTime() < 120 * 86400000));
  const rest = sales.filter((s) => !openNow.includes(s));
  const upcoming = rest.filter((s) => s.starts_at || !/tba/i.test(s.when_text ?? '')).sort((a, b) => (a.starts_at ?? '9999').localeCompare(b.starts_at ?? '9999'));
  const later = rest.filter((s) => !upcoming.includes(s)).sort((a, b) => (farm.get(a.farm_id)?.name ?? '').localeCompare(farm.get(b.farm_id)?.name ?? ''));

  const Item = ({ s }: { s: SaleEvent }) => {
    const f = farm.get(s.farm_id);
    return (
      <article className="cal-item">
        <div className="cal-when">
          <b>{s.starts_at && new Date(s.starts_at).getTime() > now ? dateTime(s.starts_at) : s.when_text}</b>
          <span>{s.time_text}</span>
        </div>
        <div className="cal-what">
          <b>{f?.name}</b>
          <span>{[f?.place, s.label, s.note].filter(Boolean).join(' · ')}</span>
        </div>
        {s.url && <a className="shop" href={s.url} target="_blank" rel="noopener noreferrer">{text.visitShop} ↗</a>}
      </article>
    );
  };

  return (
    <>
      <section className="hero">
        <h1>{text.calendarTitle}</h1>
        <p>{text.calendarIntro}</p>
      </section>
      {admin && <p className="inline"><a className="btn ghost" href="/admin/sales">{text.editButton}</a></p>}
      {[[text.calendarOpenNow, openNow], [text.calendarComingUp, upcoming], [text.calendarLater, later]].map(([title, list]) =>
        (list as SaleEvent[]).length ? (
          <section className="cal" key={title as string}>
            <h2>{title as string}</h2>
            <div className="cal-list">{(list as SaleEvent[]).map((s) => <Item key={s.id} s={s} />)}</div>
          </section>
        ) : null
      )}
    </>
  );
}
