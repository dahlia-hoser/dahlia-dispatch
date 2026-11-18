import { db } from '../../lib/db';
import { dateTime } from '../../lib/catalogue';
import type { Farm, SaleEvent } from '../../lib/types';
import { text } from '../../site-text';
import { isAdmin } from '../../lib/is-admin';
import { LeafDivider } from '../../components/Leaf';
import { splitSales } from '../../lib/sales';

export default async function Calendar({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const t = db();
  const [farms, allSales] = (await Promise.all([t.all('farms'), t.all('sale_events')])) as [Farm[], SaleEvent[]];
  const farm = new Map(farms.map((f) => [f.id, f]));
  const now = Date.now();
  const admin = await isAdmin();
  const isClub = (s: SaleEvent) => farm.get(s.farm_id)?.platform === 'society';
  const sales = allSales.filter((s) => (show === 'clubs' ? isClub(s) : show === 'farms' ? !isClub(s) : true));

  const split = splitSales(sales, now);
  const { openNow, upcoming } = split;
  const later = split.later.sort((a, b) => (farm.get(a.farm_id)?.name ?? '').localeCompare(farm.get(b.farm_id)?.name ?? ''));

  const Item = ({ s }: { s: SaleEvent }) => {
    const f = farm.get(s.farm_id);
    const club = isClub(s);
    return (
      <article className={`cal-item ${club ? 'is-club' : 'is-farm'}`}>
        <div className="cal-when">
          <b>{s.starts_at && new Date(s.starts_at).getTime() > now ? dateTime(s.starts_at) : s.when_text}</b>
          <span>{s.time_text}</span>
        </div>
        <div className="cal-what">
          <span className="inline" style={{ gap: 8 }}>
            <b>{f?.name}</b>
            <span className={`chip ${club ? 'club' : 'farm'}`}>{club ? text.calendarClubChip : text.calendarFarmChip}</span>
          </span>
          <span>{[f?.place, s.label, s.note].filter(Boolean).join(' · ')}</span>
        </div>
        {s.url && <a className="shop" href={s.url} target="_blank" rel="noopener noreferrer">{club ? text.calendarMoreInfo : text.visitShop} ↗</a>}
      </article>
    );
  };

  const tab = (value: string | undefined, label: string) => (
    <a className={`pill${(show ?? '') === (value ?? '') ? ' on' : ''}`} href={value ? `/calendar?show=${value}` : '/calendar'} aria-current={(show ?? '') === (value ?? '') ? 'page' : undefined}>
      {label}
    </a>
  );

  return (
    <>
      <section className="hero">
        <h1>{text.calendarTitle}</h1>
        <p>{text.calendarIntro}</p>
      </section>
      <div className="inline" style={{ justifyContent: 'space-between' }}>
        <nav className="pills" aria-label="Show">
          {tab(undefined, text.calendarShowAll)}
          {tab('farms', text.calendarShowFarms)}
          {tab('clubs', text.calendarShowClubs)}
        </nav>
        {admin && <a className="btn ghost" href="/admin/sales">{text.editButton}</a>}
      </div>
      <p className="note">{text.calendarClubNote}</p>
      <LeafDivider />
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
