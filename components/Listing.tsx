import type { Group, Row } from '../lib/catalogue';
import { FavButton } from './Fav';
import { bloomColours } from '../lib/bloom';
import { money, gettingIt } from '../lib/catalogue';
import { text, fill } from '../site-text';
import { isBulk, normalize, packSize, varietyNameFromTitle } from '../lib/names';
import { LeafDot } from './Leaf';

export function StatusChip({ r }: { r: Pick<Row, 'avail' | 'label'> }) {
  return <span className={`chip ${r.avail}`}>{r.label}</span>;
}

export function ListingRow({ r, groupName }: { r: Row; groupName: string }) {
  // Only say "Listed as" when the farm really uses a different name, not just extra shop words.
  const different = normalize(varietyNameFromTitle(r.listing.title)) !== normalize(groupName);
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
        {gettingIt(r.farm) && <span className="ship">{gettingIt(r.farm)}</span>}
        <a className="morefarm" href={`/?farm=${encodeURIComponent(r.farm.code)}`} title={fill(text.farmAllTitle, { farm: r.farm.name })}>{text.moreFromFarm}</a>
      </div>
      <span className="price">
        {money(r.listing.price_cents)}
        {packSize(r.listing.title) > 1 && r.listing.price_cents != null && (
          <span className="each">{fill(text.packEach, { price: money(Math.round(r.listing.price_cents / packSize(r.listing.title))) })}</span>
        )}
      </span>
      <span className="inline">
        <StatusChip r={r} />
        {r.isNew && <span className="chip new">{text.newBadge}</span>}
        {packSize(r.listing.title) > 1 && <span className="chip packtag">{fill(text.packBadge, { n: packSize(r.listing.title) })}</span>}
        {packSize(r.listing.title) === 1 && isBulk(r.listing.title) && <span className="chip packtag">{text.bulkBadge}</span>}
      </span>
      <a className="shop" href={r.listing.url ?? r.farm.site ?? '#'} target="_blank" rel="noopener noreferrer">{text.visitShop} ↗</a>
    </article>
  );
}

export function GroupCard({ g, limit }: { g: Group; limit?: number }) {
  const v = g.variety;
  const colours = [v?.colour1, v?.colour2].filter(Boolean).join(' / ');
  const metaParts = [v?.form, colours].filter(Boolean) as string[];
  const bloom = bloomColours(v?.colour1, v?.colour2);
  return (
    <section
      className={bloom.length ? 'group has-bloom' : 'group'}
      style={bloom.length ? ({ '--b1': bloom[0], '--b2': bloom[1] ?? bloom[0] } as React.CSSProperties) : undefined}
    >
      <div className="group-head">
        <h3>{v ? <a href={`/v/${v.slug}`}>{g.name}</a> : g.name}</h3>
        {v && <FavButton slug={v.slug} name={g.name} />}
        {metaParts.length > 0 && (
          <span className="meta meta-row">
            {metaParts.map((m, i) => (
              <span key={m} className="meta-row">
                {i > 0 && <LeafDot />}
                {m === colours && bloom.map((b, j) => <span key={j} className="swatch" style={{ background: b }} aria-hidden="true" />)}
                {m}
              </span>
            ))}
          </span>
        )}
        {g.aka.length > 0 && <span className="meta">{text.alsoSoldAs}: {g.aka.join(', ')}</span>}
        <Badges g={g} />
      </div>
      {(limit ? g.rows.slice(0, limit) : g.rows).map((r) => <ListingRow key={r.listing.id} r={r} groupName={g.name} />)}
      {limit && g.rows.length > limit && (
        // Rows are already in order: in stock first, then cheapest.
        <details className="more-rows">
          <summary>
            <span className="when-closed">{fill(text.showMoreRows, { n: g.rows.length - limit })}</span>
            <span className="when-open">{text.showFewerRows}</span>
          </summary>
          {g.rows.slice(limit).map((r) => <ListingRow key={r.listing.id} r={r} groupName={g.name} />)}
        </details>
      )}
    </section>
  );
}

export function Badges({ g }: { g: Group }) {
  if (!g.newIntro && !g.canadian) return null;
  return (
    <span className="inline" style={{ gap: 6 }}>
      {g.newIntro && <span className="chip intro">{fill(text.badgeNewIntro, { year: g.variety?.intro_year ?? '' })}</span>}
      {g.canadian && <span className="chip canada">{text.badgeCanadian}</span>}
    </span>
  );
}
