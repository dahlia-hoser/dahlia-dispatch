import { loadAll, groupAll, lastChecked, ago, money, gettingIt, dateTime } from '../../lib/catalogue';
import { shoppingPlan, gamePlan, inStockOptions, inStockOnlyAsPacks, PLAN_FROM, type PlanOption } from '../../lib/plan';
import { GroupCard } from '../../components/Listing';
import { FavSync, CopyListLink } from '../../components/Fav';
import { LeafDivider } from '../../components/Leaf';
import { text, fill } from '../../site-text';

export const metadata = { title: 'Your favourites' };

function Stops({ option }: { option: PlanOption }) {
  return (
    <>
      {option.stops.map((s) => (
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
            {' · '}
            {s.shippingCents == null ? text.planShipUnknown : s.shippingCents === 0 ? text.planShipFree : fill(text.planShipping, { cost: money(s.shippingCents) })}
          </p>
          {s.toFreeShippingCents != null && <p className="nudge">{fill(text.planNudge, { more: money(s.toFreeShippingCents) })}</p>}
        </div>
      ))}
      <p className="plan-grand">
        {option.unknownShipping
          ? fill(option.unknownShipping === 1 ? text.planGrandUnknownOne : text.planGrandUnknown, { total: money(option.totalCents), n: option.unknownShipping })
          : fill(text.planGrand, { total: money(option.totalCents) })}
      </p>
    </>
  );
}

export default async function Favourites({ searchParams }: { searchParams: Promise<{ s?: string; add?: string }> }) {
  const { s = '', add = '' } = await searchParams;
  const slugs = (s || add).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 300);
  const data = await loadAll();
  const groups = groupAll(data);
  const bySlug = new Map(groups.filter((g) => g.variety).map((g) => [g.variety!.slug, g]));
  // In the order they were hearted, newest first.
  const mine = [...slugs].reverse().map((x) => bySlug.get(x)).filter(Boolean) as typeof groups;
  const gone = slugs.length - mine.length;
  const inStock = inStockOptions(mine).size;
  const packsOnly = inStockOnlyAsPacks(mine);
  const plan = inStock >= PLAN_FROM ? shoppingPlan(mine) : null;
  const now = Date.now();
  const game = gamePlan(mine, data.sales, now);
  return (
    <>
      <FavSync current={s} add={add || undefined} />
      <h1>{text.favTitle}</h1>
      <p className="note">{text.favIntro}</p>
      <CopyListLink />
      <LeafDivider />
      {mine.length === 0 ? (
        <p>{text.favNone}</p>
      ) : (
        <>
          <p className="fav-summary">
            {inStock ? fill(text.favSummary, { in: inStock, total: mine.length }) : fill(text.favSummaryNone, { total: mine.length })}
          </p>
          {packsOnly > 0 && <p className="note">{fill(text.favPacksOnly, { n: packsOnly })}</p>}
          {plan ? (
            <section className="plan">
              <h2>{plan.stops.length === 1 ? text.planTitleOne : fill(text.planTitle, { n: plan.stops.length })}</h2>
              <p className="note">{fill(text.planIntro, { count: plan.covered })}</p>
              <Stops option={plan} />
              {plan.cheaper && (
                <details className="plan-alt">
                  <summary>{fill(text.planCheaper, { n: plan.cheaper.stops.length, saves: money(plan.cheaper.savesCents) })}</summary>
                  <Stops option={plan.cheaper} />
                </details>
              )}
              <p className="note">{text.planNote}</p>
            </section>
          ) : (
            inStock > 0 && <p className="note">{text.planHint}</p>
          )}
          {(game.stops.length > 0 || game.noDate.length > 0) && (
            <section className="plan game">
              <h2>{text.gameTitle}</h2>
              <p className="note">{text.gameIntro}</p>
              {game.stops.map((g) => (
                <div key={g.sale.id} className="plan-stop">
                  <div className="plan-farm">
                    <span className="game-when">{g.sale.starts_at && new Date(g.sale.starts_at).getTime() > now ? dateTime(g.sale.starts_at) : g.sale.when_text}</span>
                    <span>
                      <a href={g.sale.url ?? g.farm.site ?? `/?farm=${encodeURIComponent(g.farm.code)}`} target="_blank" rel="noopener noreferrer"><b>{g.farm.name}</b> ↗</a>
                      {g.sale.label && <span className="note"> · {g.sale.label}</span>}
                    </span>
                  </div>
                  <p className="game-names">
                    <span aria-hidden="true">♥ </span>
                    {g.names.map((n, i) => (
                      <span key={n.slug}>{i > 0 && ', '}<a href={`/v/${n.slug}`}>{n.name}</a></span>
                    ))}
                  </p>
                </div>
              ))}
              {game.noDate.length > 0 && <p className="note">{fill(text.gameNoDate, { names: game.noDate.map((n) => n.name).join(', ') })}</p>}
            </section>
          )}
          <p className="note">{fill(text.priceNote, { time: ago(lastChecked(data)) })}</p>
          {mine.map((g) => <GroupCard key={g.key} g={g} limit={3} />)}
        </>
      )}
      {gone > 0 && mine.length > 0 && <p className="note">{fill(text.favGone, { n: gone })}</p>}
    </>
  );
}
