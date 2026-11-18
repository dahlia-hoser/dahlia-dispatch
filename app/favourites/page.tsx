import { loadAll, groupAll, lastChecked, ago, money, gettingIt } from '../../lib/catalogue';
import { shoppingPlan, inStockOptions, PLAN_FROM } from '../../lib/plan';
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
  const inStock = inStockOptions(mine).size;
  const plan = inStock >= PLAN_FROM ? shoppingPlan(mine) : null;
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
          <p className="fav-summary">
            {inStock ? fill(text.favSummary, { in: inStock, total: mine.length }) : fill(text.favSummaryNone, { total: mine.length })}
          </p>
          {plan ? (
            <section className="plan">
              <h2>{plan.stops.length === 1 ? text.planTitleOne : fill(text.planTitle, { n: plan.stops.length })}</h2>
              <p className="note">{fill(text.planIntro, { count: plan.covered })}</p>
              {plan.stops.map((s) => (
                <div key={s.farm.id} className="plan-stop">
                  <div className="plan-farm">
                    <a href={`/?farm=${encodeURIComponent(s.farm.code)}`}><b>{s.farm.name}</b></a>
                    <span className="note">{[s.farm.place, gettingIt(s.farm)].filter(Boolean).join(' · ')}</span>
                  </div>
                  <ul>
                    {s.items.map((i) => (
                      <li key={i.slug}>
                        <a href={i.row.listing.url ?? s.farm.site ?? '#'} target="_blank" rel="noopener noreferrer">{i.name} ↗</a>
                        <span>{money(i.row.listing.price_cents)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="note">
                    {fill(text.planTotal, { total: money(s.totalCents) })}
                    {s.unpriced > 0 && <> · {fill(text.planUnpriced, { n: s.unpriced })}</>}
                  </p>
                </div>
              ))}
              <p className="note">{text.planNote}</p>
            </section>
          ) : (
            inStock > 0 && <p className="note">{text.planHint}</p>
          )}
          <p className="note">{fill(text.priceNote, { time: ago(lastChecked(data)) })}</p>
          {mine.map((g) => <GroupCard key={g.key} g={g} />)}
        </>
      )}
      {gone > 0 && mine.length > 0 && <p className="note">{fill(text.favGone, { n: gone })}</p>}
    </>
  );
}
