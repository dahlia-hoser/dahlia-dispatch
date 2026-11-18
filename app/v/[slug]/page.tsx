import { notFound } from 'next/navigation';
import { loadAll, groupAll, lastChecked, ago, suggestions } from '../../../lib/catalogue';
import { SearchBox } from '../../../components/SearchBox';
import { ListingRow, Badges } from '../../../components/Listing';
import { text, fill } from '../../../site-text';
import { FavButton } from '../../../components/Fav';
import { isAdmin } from '../../../lib/is-admin';

export default async function VarietyPage({ params }: { params: Promise<{ slug: string }> }) {
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
