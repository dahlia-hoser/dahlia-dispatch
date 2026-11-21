import { suggestFix } from './actions';
import { COLOURS, FORMS } from '../../../lib/types';
import { notFound } from 'next/navigation';
import { loadAll, groupAll, lastChecked, ago, suggestions } from '../../../lib/catalogue';
import { SearchBox } from '../../../components/SearchBox';
import { ListingRow, Badges } from '../../../components/Listing';
import { text, fill } from '../../../site-text';
import { FavButton } from '../../../components/Fav';
import { isAdmin } from '../../../lib/is-admin';

export default async function VarietyPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ suggested?: string }> }) {
  const { suggested } = await searchParams;
  const { slug } = await params;
  const [data, admin] = await Promise.all([loadAll(), isAdmin()]);
  const groups = groupAll(data);
  const g = groups.find((x) => x.variety?.slug === slug);
  if (!g || !g.variety) notFound();
  const v = g.variety;
  const colours = [v.colour1, v.colour2].filter(Boolean).join(' / ');

  return (
    <>
      <a className="back" href="/">{text.varietyBack}</a>
      <SearchBox items={suggestions(data, groups)} initial="" hidden={{}} />
      <div className="vhead">
        <div className="left">
          <div className="inline" style={{ gap: 10, alignItems: 'center' }}>
            <h1>{v.name}</h1>
            <FavButton slug={v.slug} name={v.name} big />
          </div>
          <Badges g={g} />
          {g.aka.length > 0 && <p className="note">{text.alsoSoldAs}: {g.aka.join(', ')}</p>}
          <dl className="facts">
            <div><dt>{text.varietyForm}</dt><dd>{v.form ?? text.varietyUnknown}</dd></div>
            <div><dt>{text.varietyColour}</dt><dd>{colours || text.varietyUnknown}</dd></div>
          </dl>
          {admin && <div><a className="btn ghost" href={`/admin/varieties/${v.slug}`}>{text.editButton}</a></div>}
          {suggested ? (
            <p className="saved">{text.suggestThanks}</p>
          ) : (
            <details className="suggest">
              <summary>{text.suggestOpen}</summary>
              <form action={suggestFix} className="form">
                <p className="note">{text.suggestIntro}</p>
                <input type="hidden" name="slug" value={v.slug} />
                <input type="text" name="website" tabIndex={-1} autoComplete="off" className="trap" aria-hidden="true" />
                <label>{text.suggestColour1}
                  <select name="colour1" defaultValue={v.colour1 ?? ''}><option value="">{text.suggestNone}</option>{COLOURS.map((c) => <option key={c}>{c}</option>)}</select>
                </label>
                <label>{text.suggestColour2}
                  <select name="colour2" defaultValue={v.colour2 ?? ''}><option value="">{text.suggestNone}</option>{COLOURS.map((c) => <option key={c}>{c}</option>)}</select>
                </label>
                <label>{text.suggestForm}
                  <select name="form" defaultValue={v.form ?? ''}><option value="">{text.suggestNone}</option>{FORMS.map((c) => <option key={c}>{c}</option>)}</select>
                </label>
                <label>{text.suggestNote}<textarea name="note" rows={2} maxLength={300} /></label>
                <div><button className="btn" type="submit">{text.suggestSend}</button></div>
              </form>
            </details>
          )}
        </div>
        <div className="right">
          <div className="results-head">
            <h2>{text.varietyFarmsHeading} · {g.rows.length}</h2>
          </div>
          {g.rows.length ? (
            <div className="group">{g.rows.map((r) => <ListingRow key={r.listing.id} r={r} groupName={g.name} />)}</div>
          ) : (
            <p>{text.varietyNoListings}</p>
          )}
          <p className="note">{fill(text.priceNote, { time: ago(lastChecked(data)) })}</p>
          <p className="note-box">{text.notAvailableNote}</p>
        </div>
      </div>
    </>
  );
}
