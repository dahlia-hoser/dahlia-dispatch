// Shopping plan: buy every in-stock favourite from as few farms as possible, shipping counted.
import type { Group, Row } from './catalogue';
import type { Farm } from './types';
import { isBulk, packSize } from './names';
import { parseShipCost, shippingFor } from './ship-cost';
import type { SaleEvent } from './types';
import { roughTime, splitSales } from './sales';

/** The plan shows once this many favourites are in stock. */
export const PLAN_FROM = 5;

/** One ordinary tuber: not a multi-pack, not a bulk lot. */
export const isSingle = (r: Row) => packSize(r.listing.title) === 1 && !isBulk(r.listing.title);

export type PlanStop = {
  farm: Farm;
  items: { name: string; slug: string; row: Row }[];
  totalCents: number; // tubers only
  unpriced: number;
  shippingCents: number | null; // null: the farm hasn't said
  toFreeShippingCents: number | null; // how much more to reach free shipping, when it's close
};
export type PlanOption = { stops: PlanStop[]; totalCents: number; unknownShipping: number };
export type Plan = PlanOption & { covered: number; cheaper?: PlanOption & { savesCents: number } };

/** In-stock single tubers per favourite (one favourite = one variety group). Packs, bulk lots and potted plants don't count. */
export function inStockOptions(groups: Group[]): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const g of groups) {
    if (!g.variety) continue;
    const rows = g.rows.filter((r) => r.avail === 'in' && r.listing.kind !== 'plant' && isSingle(r));
    if (rows.length) out.set(g.variety.slug, rows);
  }
  return out;
}

/** Favourites in stock only as packs or bulk lots. */
export function inStockOnlyAsPacks(groups: Group[]): number {
  const singles = inStockOptions(groups);
  return groups.filter((g) => g.variety && !singles.has(g.variety.slug) && g.rows.some((r) => r.avail === 'in' && r.listing.kind !== 'plant')).length;
}

const NUDGE = 5000; // say "add $X for free shipping" when within $50

/**
 * Fewest farms that between them have every in-stock favourite; among plans with that many farms,
 * the cheapest including shipping. Also looks at plans with up to two more farms, and offers one
 * if it's at least $10 cheaper overall.
 */
export function shoppingPlan(groups: Group[]): Plan {
  const opts = inStockOptions(groups);
  const names = new Map(groups.filter((g) => g.variety).map((g) => [g.variety!.slug, g.name]));
  const carries = new Map<number, Set<string>>();
  for (const [slug, rows] of opts) for (const r of rows) {
    if (!carries.has(r.farm.id)) carries.set(r.farm.id, new Set());
    carries.get(r.farm.id)!.add(slug);
  }
  const all = [...opts.keys()];
  if (!all.length) return { stops: [], totalCents: 0, unknownShipping: 0, covered: 0 };
  const ids = [...carries.keys()];
  const price = (r: Row) => r.listing.price_cents ?? 1e9;

  const build = (chosen: number[]): PlanOption => {
    const stops = new Map<number, PlanStop>();
    for (const slug of all) {
      const r = opts.get(slug)!.filter((x) => chosen.includes(x.farm.id)).sort((a, b) => price(a) - price(b))[0];
      if (!stops.has(r.farm.id)) stops.set(r.farm.id, { farm: r.farm, items: [], totalCents: 0, unpriced: 0, shippingCents: null, toFreeShippingCents: null });
      const s = stops.get(r.farm.id)!;
      s.items.push({ name: names.get(slug) ?? slug, slug, row: r });
      if (r.listing.price_cents == null) s.unpriced++;
      else s.totalCents += r.listing.price_cents;
    }
    let total = 0;
    let unknown = 0;
    for (const s of stops.values()) {
      s.shippingCents = shippingFor(s.farm.ship_cost, s.totalCents);
      const free = parseShipCost(s.farm.ship_cost).freeOverCents;
      if (free != null && s.totalCents < free && free - s.totalCents <= NUDGE) s.toFreeShippingCents = free - s.totalCents;
      if (s.shippingCents == null) unknown++;
      total += s.totalCents + (s.shippingCents ?? 0);
    }
    return { stops: [...stops.values()].sort((a, b) => b.items.length - a.items.length), totalCents: total, unknownShipping: unknown };
  };
  const covers = (chosen: number[]) => all.every((slug) => chosen.some((id) => carries.get(id)!.has(slug)));

  // Every covering combination, smallest first (within reason).
  const bySize = new Map<number, number[][]>();
  let tried = 0;
  const maxSize = Math.min(ids.length, 8);
  let smallest = Infinity;
  for (let k = 1; k <= maxSize && k <= smallest + 2 && tried < 200000; k++) {
    const combo: number[] = [];
    const walk = (start: number) => {
      if (tried >= 200000) return;
      if (combo.length === k) {
        tried++;
        if (covers(combo)) {
          if (!bySize.has(k)) bySize.set(k, []);
          bySize.get(k)!.push([...combo]);
        }
        return;
      }
      for (let i = start; i < ids.length; i++) {
        combo.push(ids[i]);
        walk(i + 1);
        combo.pop();
      }
    };
    walk(0);
    if (bySize.has(k) && smallest === Infinity) smallest = k;
  }

  let main: PlanOption;
  if (smallest === Infinity) {
    // Too many farms to try every combination: greedy, always a valid answer.
    const pick: number[] = [];
    const left = new Set(all);
    while (left.size) {
      const best = ids.filter((id) => !pick.includes(id)).sort((a, b) => [...carries.get(b)!].filter((s) => left.has(s)).length - [...carries.get(a)!].filter((s) => left.has(s)).length)[0];
      pick.push(best);
      for (const s of carries.get(best)!) left.delete(s);
    }
    main = build(pick);
    return { ...main, covered: all.length };
  }
  const cheapest = (combos: number[][]) => combos.map(build).sort((a, b) => a.totalCents - b.totalCents)[0];
  main = cheapest(bySize.get(smallest)!);
  const others = [...bySize.entries()].filter(([k]) => k > smallest).flatMap(([, c]) => c);
  const alt = others.length ? cheapest(others) : null;
  const plan: Plan = { ...main, covered: all.length };
  if (alt && main.totalCents - alt.totalCents >= 1000) plan.cheaper = { ...alt, savesCents: main.totalCents - alt.totalCents };
  return plan;
}

/**
 * Sale-day game plan: for favourites you can't buy as single tubers right now, the next sale at a
 * farm that lists them, soonest first. Several favourites at one sale are grouped together.
 */

export type GamePlanStop = { sale: SaleEvent; farm: Farm; names: { name: string; slug: string }[]; at: number };
export function gamePlan(groups: Group[], sales: SaleEvent[], now: number): { stops: GamePlanStop[]; noDate: { name: string; slug: string }[] } {
  const inStock = inStockOptions(groups);
  const { upcoming } = splitSales(sales, now);
  // The soonest upcoming sale for each farm.
  const nextSale = new Map<number, SaleEvent>();
  for (const s of upcoming) if (!nextSale.has(s.farm_id)) nextSale.set(s.farm_id, s);
  const stops = new Map<number, GamePlanStop>();
  const noDate: { name: string; slug: string }[] = [];
  for (const g of groups) {
    if (!g.variety || inStock.has(g.variety.slug)) continue;
    const options = g.rows
      .filter((r) => r.listing.kind !== 'plant')
      .map((r) => ({ r, s: nextSale.get(r.farm.id) }))
      .filter((x): x is { r: Row; s: SaleEvent } => !!x.s)
      .sort((a, b) => roughTime(a.s, now) - roughTime(b.s, now));
    const first = options[0];
    if (!first) {
      noDate.push({ name: g.name, slug: g.variety.slug });
      continue;
    }
    if (!stops.has(first.s.id)) stops.set(first.s.id, { sale: first.s, farm: first.r.farm, names: [], at: roughTime(first.s, now) });
    stops.get(first.s.id)!.names.push({ name: g.name, slug: g.variety.slug });
  }
  return { stops: [...stops.values()].sort((a, b) => a.at - b.at), noDate };
}
