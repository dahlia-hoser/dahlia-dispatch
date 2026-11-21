// Search results as tiles: colour band, name, farms and price, best availability. Tap for the dahlia's page.
import type { Group } from '../lib/catalogue';
import { money } from '../lib/catalogue';
import { bloomColours } from '../lib/bloom';
import { isSingle } from '../lib/plan';
import { FavButton } from './Fav';
import { StatusChip } from './Listing';
import { text, fill } from '../site-text';

const RANK = { in: 0, soon: 1, list: 2, out: 3 } as const;

export function Tile({ g }: { g: Group }) {
  const v = g.variety;
  const bloom = bloomColours(v?.colour1, v?.colour2);
  const band = bloom.length === 2 ? `linear-gradient(90deg, ${bloom[0]} 50%, ${bloom[1]} 50%)` : bloom[0] ?? 'var(--line)';
  const best = [...g.rows].sort((a, b) => RANK[a.avail] - RANK[b.avail])[0];
  const farms = new Set(g.rows.map((r) => r.farm.id)).size;
  // Price of one tuber: singles first, so a 5-pack doesn't look like the price.
  const singles = g.rows.filter(isSingle).map((r) => r.listing.price_cents).filter((c): c is number => c != null);
  const all = g.rows.map((r) => r.listing.price_cents).filter((c): c is number => c != null);
  const prices = singles.length ? singles : all;
  const price = !prices.length ? text.tilePriceTba : Math.min(...prices) === Math.max(...prices) ? money(prices[0]) : fill(text.tileFrom, { price: money(Math.min(...prices)) });
  const href = v ? `/v/${v.slug}` : best?.listing.url ?? best?.farm.site ?? '#';
  const external = !v;
  return (
    <article className="tile">
      <span className="tile-band" style={{ background: band }} aria-hidden="true" />
      {v && <FavButton slug={v.slug} name={g.name} />}
      <a className="tile-link" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        <h3>{g.name}</h3>
        <span className="tile-meta">{[v?.form, [v?.colour1, v?.colour2].filter(Boolean).join(' / ')].filter(Boolean).join(' · ') || ' '}</span>
        <span className="tile-farms">{fill(farms === 1 ? text.tileFarmsOne : text.tileFarms, { n: farms })} · {price}</span>
        <span className="tile-chips">
          {best && <StatusChip r={best} />}
          {g.canadian && <span className="chip canada" title={text.badgeCanadian}>🍁</span>}
          {g.newIntro && <span className="chip intro">{text.tileNew}</span>}
        </span>
      </a>
    </article>
  );
}
