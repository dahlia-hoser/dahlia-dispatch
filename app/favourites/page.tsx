import { loadAll, groupAll, lastChecked, ago } from '../../lib/catalogue';
import { GroupCard } from '../../components/Listing';
import { FavSync } from '../../components/Fav';
import { LeafDivider } from '../../components/Leaf';
import { text, fill } from '../../site-text';

export const metadata = { title: 'Favourites · The Hosers’ Dahlia Dispatch' };

export default async function Favourites({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s = '' } = await searchParams;
  const slugs = s.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 300);
  const data = await loadAll();
  const groups = groupAll(data);
  const bySlug = new Map(groups.filter((g) => g.variety).map((g) => [g.variety!.slug, g]));
  // In the order they were hearted, newest first.
  const mine = [...slugs].reverse().map((x) => bySlug.get(x)).filter(Boolean) as typeof groups;
  const gone = slugs.length - mine.length;
  return (
    <>
      <FavSync current={slugs.join(',')} />
      <h1>{text.favTitle}</h1>
      <p className="note">{text.favIntro}</p>
      <LeafDivider />
      {mine.length === 0 ? (
        <p>{text.favNone}</p>
      ) : (
        <>
          <p className="note">{fill(text.priceNote, { time: ago(lastChecked(data)) })}</p>
          {mine.map((g) => <GroupCard key={g.key} g={g} />)}
        </>
      )}
      {gone > 0 && mine.length > 0 && <p className="note">{fill(text.favGone, { n: gone })}</p>}
    </>
  );
}
