import { loadAll, groupAll, search, suggestions, lastChecked, ago, gettingIt, type Filters as F } from '../lib/catalogue';
import { SearchBox } from '../components/SearchBox';
import { Filters } from '../components/Filters';
import { Tile } from '../components/Tile';
import { FavsHere } from '../components/FavsHere';
import { Happening } from '../components/Happening';
import { LeafDivider } from '../components/Leaf';
import { text, fill } from '../site-text';

const PAGE = 40;

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const f: F = { q: sp.q?.trim() || undefined, farm: sp.farm, avail: sp.avail, form: sp.form, colour: sp.colour, prov: sp.prov, get: sp.get, only: sp.only };
  const limit = Math.max(PAGE, Number(sp.show) || PAGE);
  const data = await loadAll();
  const groups = groupAll(data);
  const found = search(groups, f);
  const shown = found.slice(0, limit);
  const farmCount = new Set(found.flatMap((g) => g.rows.map((r) => r.farm.id))).size;
  const farm = f.farm ? data.farms.find((x) => x.code === f.farm) : undefined;
  const farmName = farm?.name;
  const checked = lastChecked(data);
  const moreParams = new URLSearchParams(Object.entries({ ...f, show: String(limit + PAGE) }).filter(([, v]) => v) as [string, string][]);

  return (
    <>
      {farm && (
        <section className="farm-head">
          <h1>{farm.name}</h1>
          <p className="note">{[farm.place, gettingIt(farm)].filter(Boolean).join(' · ')}</p>
          <FavsHere items={groups.filter((g) => g.variety && g.rows.some((r) => r.farm.id === farm.id)).map((g) => ({ slug: g.variety!.slug, name: g.name, inStock: g.rows.some((r) => r.farm.id === farm.id && r.avail === 'in') }))} />
          {farm.site && <a className="btn ghost" href={farm.site} target="_blank" rel="noopener noreferrer">{text.farmVisit} ↗</a>}
        </section>
      )}
      {!f.q && !f.farm && (
        <section className="hero">
          <h1>{text.siteName}</h1>
          <p>{text.tagline}</p>
        </section>
      )}
      <SearchBox items={suggestions(data, groups)} initial={f.q ?? ''} hidden={f as Record<string, string>} />
      <Filters f={f} farmName={farmName} />
      {!f.q && !f.farm && !Object.entries(f).some(([, v]) => v) && <Happening sales={data.sales} farms={data.farms} />}

      <div className="results-head">
        <h2>{fill(found.length === 1 ? (farmCount === 1 ? text.resultsCountOne : text.resultsCountOneVariety) : farmCount === 1 ? text.resultsCountOneFarm : text.resultsCount, { varieties: found.length, farms: farmCount })}</h2>
        <p className="note">{fill(text.priceNote, { time: ago(checked) })}</p>
      </div>
      <p className="note-box">{text.notAvailableNote}</p>
      <LeafDivider />
      {f.get && <p className="note">{text.getInNote}</p>}

      {found.length === 0 && <p>{text.resultsNone}</p>}
      <div className="tiles">{shown.map((g) => <Tile key={g.key} g={g} />)}</div>
      {found.length > shown.length && (
        <a className="btn ghost more" href={`/?${moreParams}`}>{fill(text.showMore, { n: found.length - shown.length })}</a>
      )}
    </>
  );
}
