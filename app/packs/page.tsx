import { loadPacks } from '../../lib/packs';
import { PackCard } from '../../components/PackCard';
import { Roulette } from '../../components/Roulette';
import { LeafDivider } from '../../components/Leaf';
import { money } from '../../lib/catalogue';
import { isAdmin } from '../../lib/is-admin';
import { text } from '../../site-text';

export default async function Packs() {
  const [{ rainbows, roulette }, admin] = await Promise.all([loadPacks(), isAdmin()]);
  const picks = roulette.map((p) => ({ title: p.listing.title, farm: p.farm.name, price: money(p.listing.price_cents), url: p.listing.url ?? p.farm.site ?? '#', inStock: p.avail === 'in' }));
  return (
    <>
      <section className="hero">
        <h1>{text.packsTitle}</h1>
        <p>{text.packsIntro}</p>
      </section>

      <section className="packs-section">
        <h2>{text.rouletteTitle}</h2>
        <p className="note">{text.rouletteIntro}</p>
        <Roulette picks={picks} />
        <div className="pack-grid">{roulette.map((p) => <PackCard key={p.listing.id} p={p} admin={admin} />)}</div>
      </section>

      <LeafDivider />

      <section className="packs-section">
        <h2>{text.rainbowsTitle}</h2>
        <p className="note">{text.rainbowsIntro}</p>
        {rainbows.length ? (
          <div className="pack-grid">{rainbows.map((p) => <PackCard key={p.listing.id} p={p} admin={admin} />)}</div>
        ) : (
          <p className="note">{text.rainbowsNone}</p>
        )}
      </section>
      <p className="note-box">{text.packsNote}</p>
    </>
  );
}
