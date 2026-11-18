// Home page: what's open now and what's next, from the sale calendar.
import type { Farm, SaleEvent } from '../lib/types';
import { dateTime } from '../lib/catalogue';
import { splitSales } from '../lib/sales';
import { text } from '../site-text';

export function Happening({ sales, farms, now = Date.now() }: { sales: SaleEvent[]; farms: Farm[]; now?: number }) {
  const farm = new Map(farms.map((f) => [f.id, f]));
  const isFarm = (s: SaleEvent) => farm.get(s.farm_id) && farm.get(s.farm_id)!.platform !== 'society';
  const { openNow, upcoming } = splitSales(sales.filter(isFarm), now);
  const open = openNow.slice(0, 3);
  const next = upcoming.slice(0, 3);
  if (!open.length && !next.length) return null;
  const Line = ({ s, when }: { s: SaleEvent; when?: string }) => {
    const f = farm.get(s.farm_id)!;
    const href = s.url ?? f.site;
    return (
      <li>
        {when && <span className="hap-when">{when}</span>}
        <span className="hap-what">
          {href ? <a href={href} target="_blank" rel="noopener noreferrer">{f.name} ↗</a> : f.name}
          {s.label && <span className="note"> · {s.label}</span>}
        </span>
      </li>
    );
  };
  return (
    <section className="happening" aria-label={text.happeningTitle}>
      {open.length > 0 && (
        <>
          <h2>{text.happeningOpen}</h2>
          <ul>{open.map((s) => <Line key={s.id} s={s} />)}</ul>
        </>
      )}
      {next.length > 0 && (
        <>
          <h2>{text.happeningNext}</h2>
          <ul>{next.map((s) => <Line key={s.id} s={s} when={s.starts_at && new Date(s.starts_at).getTime() > now ? dateTime(s.starts_at) : s.when_text ?? ''} />)}</ul>
        </>
      )}
      <a className="hap-all" href="/calendar">{text.happeningAll}</a>
    </section>
  );
}
