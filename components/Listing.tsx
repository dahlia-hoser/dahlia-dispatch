import type { Group, Row } from '../lib/catalogue';
import { money } from '../lib/catalogue';
import { text, fill } from '../site-text';
import { normalize } from '../lib/names';

export function StatusChip({ r }: { r: Pick<Row, 'avail' | 'label'> }) {
  return <span className={`chip ${r.avail}`}>{r.label}</span>;
}

export function ListingRow({ r, groupName }: { r: Row; groupName: string }) {
  const different = normalize(r.listing.title) !== normalize(groupName);
  return (
    <article className="row">
      <div className="who">
        <b>{r.farm.name}</b>
        <span>
          {r.farm.place}
          {different && <> · {fill(text.listedAs, { name: r.listing.title })}</>}
          {r.listing.kind === 'cutting' && <> · {text.cutting}</>}
          {r.listing.kind === 'plant' && <> · {text.pottedPlant}</>}
        </span>
      </div>
      <span className="price">{money(r.listing.price_cents)}</span>
      <span className="inline">
        <StatusChip r={r} />
        {r.isNew && <span className="chip new">{text.newBadge}</span>}
      </span>
      <a className="shop" href={r.listing.url ?? r.farm.site ?? '#'} target="_blank" rel="noopener noreferrer">{text.visitShop} ↗</a>
    </article>
  );
}

export function GroupCard({ g }: { g: Group }) {
  const v = g.variety;
  const colours = [v?.colour1, v?.colour2].filter(Boolean).join(' / ');
  const meta = [v?.form, colours].filter(Boolean).join(' · ');
  return (
    <section className="group">
      <div className="group-head">
        <h3>{v ? <a href={`/v/${v.slug}`}>{g.name}</a> : g.name}</h3>
        {meta && <span className="meta">{meta}</span>}
        {g.aka.length > 0 && <span className="meta">{text.alsoSoldAs}: {g.aka.join(', ')}</span>}
      </div>
      {g.rows.map((r) => <ListingRow key={r.listing.id} r={r} groupName={g.name} />)}
    </section>
  );
}
