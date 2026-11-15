import { loadAll, groupAll, search, suggestions, lastChecked, ago, type Filters as F } from '../lib/catalogue';
import { SearchBox } from '../components/SearchBox';
import { Filters } from '../components/Filters';
import { GroupCard } from '../components/Listing';
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
  const farmName = f.farm ? data.farms.find((x) => x.code === f.farm)?.name : undefined;
  const checked = lastChecked(data);
  const moreParams = new URLSearchParams(Object.entries({ ...f, show: String(limit + PAGE) }).filter(([, v]) => v) as [string, string][]);

  return (
    <>
      {!f.q && !f.farm && (
        <section className="hero">
          <h1>{text.siteName}</h1>
          <p>{text.tagline}</p>
        </section>
      )}
      <SearchBox items={suggestions(data, groups)} initial={f.q ?? ''} hidden={f as Record<string, string>} />
      <Filters f={f} farmName={farmName} />

      <div className="results-head">
        <h2>{fill(found.length === 1 ? (farmCount === 1 ? text.resultsCountOne : text.resultsCountOneVariety) : text.resultsCount, { varieties: found.length, farms: farmCount })}</h2>
        <p className="note">{fill(text.priceNote, { time: ago(checked) })}</p>
      </div>
      <p className="note-box">{text.notAvailableNote}</p>
      {f.get && <p className="note">{text.getInNote}</p>}

      {found.length === 0 && <p>{text.resultsNone}</p>}
      {shown.map((g) => <GroupCard key={g.key} g={g} />)}
      {found.length > shown.length && (
        <a className="btn ghost more" href={`/?${moreParams}`}>{fill(text.showMore, { n: found.length - shown.length })}</a>
      )}
    </>
  );
}
