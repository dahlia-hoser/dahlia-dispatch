import type { Pack } from '../lib/packs';
import { money } from '../lib/catalogue';
import { text, fill } from '../site-text';
import { StatusChip } from './Listing';
import { hidePack } from '../app/packs/actions';

const SWATCH: Record<string, string> = {
  White: '#ffffff', Cream: '#f3ead3', Yellow: '#f2d15a', Orange: '#e8893a', Peach: '#f4b896', Pink: '#e889a9',
  Blush: '#f6d3cf', Red: '#c8352f', Burgundy: '#6d1f33', Purple: '#7b4a9a', Lavender: '#c9b6e4', Bicolour: '#e8e0d3',
};

export function PackCard({ p, admin }: { p: Pack; admin: boolean }) {
  return (
    <article className="pack">
      <div className="pack-top">
        <b className="pack-name">{p.listing.title}</b>
        {p.colours.length > 0 && (
          <span className="dots" aria-label={p.colours.join(', ')}>
            {p.colours.map((c) => <span key={c} className="dot" style={{ background: SWATCH[c] }} title={c} />)}
          </span>
        )}
      </div>
      <span className="note">{p.farm.name} · {p.farm.place}</span>
      {p.varieties.length > 0 && (
        <span className="note">
          {text.packInside}:{' '}
          {p.varieties.map((v, i) => <span key={v.slug}>{i > 0 && ', '}<a href={`/v/${v.slug}`}>{v.name}</a></span>)}
        </span>
      )}
      <div className="pack-bottom">
        <span className="price">
          {money(p.listing.price_cents)}
          {p.eachCents != null && <span className="each">{fill(text.packEach, { price: money(p.eachCents) })}</span>}
        </span>
        <span className="inline">
          {p.size > 1 && <span className="chip packtag">{fill(text.packTubers, { n: p.size })}</span>}
          <StatusChip r={p} />
        </span>
        <a className="shop" href={p.listing.url ?? p.farm.site ?? '#'} target="_blank" rel="noopener noreferrer">{text.visitShop} ↗</a>
      </div>
      {admin && (
        <form action={hidePack}>
          <input type="hidden" name="farm_id" value={p.listing.farm_id} />
          <input type="hidden" name="product_key" value={p.listing.product_key} />
          <button className="linkbtn" type="submit">{text.packHide}</button>
        </form>
      )}
    </article>
  );
}
