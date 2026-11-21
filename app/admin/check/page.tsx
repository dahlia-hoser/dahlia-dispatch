// Owner check: every dahlia with one colour (Bicolour by default), to untick the ones that aren't.
import { db } from '../../../lib/db';
import { COLOURS } from '../../../lib/types';
import { BLOOM } from '../../../lib/bloom';
import { removeColour } from '../actions';
import { text, fill } from '../../../site-text';

export const dynamic = 'force-dynamic';

export default async function CheckColour({ searchParams }: { searchParams: Promise<{ colour?: string; done?: string; saved?: string }> }) {
  const { colour: asked, done, saved } = await searchParams;
  const colour = COLOURS.includes(asked as any) ? (asked as string) : 'Bicolour';
  const t = db();
  const [varieties, listings, farms] = await Promise.all([t.all('varieties'), t.all('listings'), t.all('farms')]);
  const farmName = new Map(farms.map((f) => [f.id, f.name]));
  const marked = varieties
    .filter((v) => v.colour1 === colour || v.colour2 === colour)
    .sort((a, b) => Number(b.status === 'Confirmed') - Number(a.status === 'Confirmed') || a.name.localeCompare(b.name));
  return (
    <>
      <a className="back" href="/admin">← {text.reviewTitle}</a>
      <h1 style={{ fontSize: 32 }}>{fill(text.checkTitle, { colour })}</h1>
      <form className="inline" action="/admin/check" method="get" style={{ gap: 8 }}>
        <select name="colour" defaultValue={colour}>
          {COLOURS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn ghost" type="submit">{text.checkShow}</button>
      </form>
      {done && <p className="saved">{fill(text.checkDone, { n: done, colour })}</p>}
      {saved && <p className="saved">{fill(text.editSavedBack, { name: saved })}</p>}
      <p className="note">{fill(marked.length === 1 ? text.checkIntroOne : text.checkIntro, { n: marked.length, colour })}</p>
      {marked.length > 0 && (
        <form action={removeColour} className="batch">
          <input type="hidden" name="colour" value={colour} />
          <div className="batch-grid">
            {marked.map((v) => {
              const mine = listings.filter((l) => l.variety_id === v.id && l.active);
              const photo = mine.find((l) => l.image)?.image;
              const cols = [v.colour1, v.colour2].filter(Boolean) as string[];
              return (
                <label key={v.id} className="batch-tile" id={`v-${v.slug}`}>
                  <input type="checkbox" name="wrong" value={v.id} aria-label={fill(text.checkNot, { colour })} />
                  {photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="batch-photo" src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  )}
                  <span className="batch-body">
                    <b>{v.name}</b>
                    <span className="inline" style={{ gap: 6 }}>
                      {cols.map((x) => <span key={x} className="dot" style={{ background: BLOOM[x] }} title={x} />)}
                      <span className="note">{cols.join(' / ')}{v.status === 'Confirmed' ? ` · ${text.checkYours}` : ''}</span>
                    </span>
                    <span className="note">
                      {[...new Map(mine.map((l) => [l.farm_id, l])).values()].slice(0, 4).map((l, i) => (
                        <span key={l.id}>{i > 0 && ' · '}{l.url ? <a href={l.url} target="_blank" rel="noopener noreferrer">{farmName.get(l.farm_id)} ↗</a> : farmName.get(l.farm_id)}</span>
                      ))}
                    </span>
                    <a href={`/admin/varieties/${v.slug}?back=${encodeURIComponent(`/admin/check?colour=${colour}`)}`}>{text.batchFix}</a>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="inline">
            <button className="btn" type="submit">{fill(text.checkRemove, { colour })}</button>
          </div>
        </form>
      )}
    </>
  );
}
