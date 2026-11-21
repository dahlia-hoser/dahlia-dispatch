import { loadPacks } from '../../lib/packs';
import { PackCard } from '../../components/PackCard';
import { LeafDivider } from '../../components/Leaf';
import { isAdmin } from '../../lib/is-admin';
import { text } from '../../site-text';

export const metadata = {
  title: 'Dahlia tuber mixes and mystery packs',
  description: 'Colour mixes and mystery packs of dahlia tubers from Canadian growers.',
};

export default async function Packs() {
  const [{ rainbows, roulette }, admin] = await Promise.all([loadPacks(), isAdmin()]);
  return (
    <>
      <section className="hero">
        <h1>{text.packsTitle}</h1>
        <p>{text.packsIntro}</p>
      </section>

      <section className="packs-section">
        <h2>{text.rainbowsTitle}</h2>
        <p className="note">{text.rainbowsIntro}</p>
        {rainbows.length ? (
          <div className="pack-grid">{rainbows.map((p) => <PackCard key={p.listing.id} p={p} admin={admin} />)}</div>
        ) : (
          <p className="note">{text.rainbowsNone}</p>
        )}
      </section>

      <LeafDivider />

      <section className="packs-section">
        <h2>{text.rouletteTitle}</h2>
        <p className="note">{text.rouletteIntro}</p>
        {roulette.length ? (
          <div className="pack-grid">{roulette.map((p) => <PackCard key={p.listing.id} p={p} admin={admin} />)}</div>
        ) : (
          <p className="note">{text.rouletteNone}</p>
        )}
      </section>
      <p className="note-box">{text.packsNote}</p>
    </>
  );
}
