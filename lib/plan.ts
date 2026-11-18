// Shopping plan: buy every in-stock favourite from as few farms as possible.

/** The plan shows once this many favourites are in stock. */
export const PLAN_FROM = 10;
import type { Group, Row } from './catalogue';
import type { Farm } from './types';

export type PlanStop = { farm: Farm; items: { name: string; slug: string; row: Row }[]; totalCents: number; unpriced: number };
export type Plan = { stops: PlanStop[]; covered: number };

/** In-stock rows per favourite (one favourite = one variety group). Potted plants and price lists don't count. */
export function inStockOptions(groups: Group[]): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const g of groups) {
    if (!g.variety) continue;
    const rows = g.rows.filter((r) => r.avail === 'in' && r.listing.kind !== 'plant');
    if (rows.length) out.set(g.variety.slug, rows);
  }
  return out;
}

/**
 * Fewest farms that between them have every in-stock favourite. Exact for small cases
 * (tries every combination up to 6 farms), otherwise a good greedy answer. Ties go to
 * the cheaper total. Each favourite is then bought at the cheapest of the chosen farms.
 */
export function shoppingPlan(groups: Group[]): Plan {
  const opts = inStockOptions(groups);
  const names = new Map(groups.filter((g) => g.variety).map((g) => [g.variety!.slug, g.name]));
  const farms = new Map<number, Farm>();
  const carries = new Map<number, Set<string>>();
  for (const [slug, rows] of opts) for (const r of rows) {
    farms.set(r.farm.id, r.farm);
    if (!carries.has(r.farm.id)) carries.set(r.farm.id, new Set());
    carries.get(r.farm.id)!.add(slug);
  }
  const all = [...opts.keys()];
  if (!all.length) return { stops: [], covered: 0 };
  const ids = [...carries.keys()];
  const cheapest = (slug: string, chosen: number[]) =>
    opts.get(slug)!.filter((r) => chosen.includes(r.farm.id)).sort((a, b) => (a.listing.price_cents ?? 1e9) - (b.listing.price_cents ?? 1e9))[0];
  const cost = (chosen: number[]) => all.reduce((s, slug) => s + (cheapest(slug, chosen)?.listing.price_cents ?? 0), 0);
  const covers = (chosen: number[]) => all.every((slug) => chosen.some((id) => carries.get(id)!.has(slug)));

  // Greedy first: always a valid answer.
  let best: number[] = [];
  const left = new Set(all);
  while (left.size) {
    const pick = ids.filter((id) => !best.includes(id)).sort((a, b) => count(b) - count(a) || cost([...best, a]) - cost([...best, b]))[0];
    best.push(pick);
    for (const s of carries.get(pick)!) left.delete(s);
  }
  function count(id: number) {
    return [...carries.get(id)!].filter((s) => left.has(s)).length;
  }
  // Then look for something smaller (or as small and cheaper), within reason.
  const limit = Math.min(best.length, 6);
  let tried = 0;
  for (let k = 1; k <= limit && tried < 300000; k++) {
    let found: number[] | null = null;
    const combo: number[] = [];
    const walk = (start: number) => {
      if (tried >= 300000) return;
      if (combo.length === k) {
        tried++;
        if (covers(combo) && (!found || cost(combo) < cost(found))) found = [...combo];
        return;
      }
      for (let i = start; i < ids.length; i++) {
        combo.push(ids[i]);
        walk(i + 1);
        combo.pop();
      }
    };
    walk(0);
    if (found) {
      if ((found as number[]).length < best.length || cost(found) < cost(best)) best = found;
      break;
    }
  }

  const stops = new Map<number, PlanStop>();
  for (const slug of all) {
    const r = cheapest(slug, best)!;
    if (!stops.has(r.farm.id)) stops.set(r.farm.id, { farm: r.farm, items: [], totalCents: 0, unpriced: 0 });
    const s = stops.get(r.farm.id)!;
    s.items.push({ name: names.get(slug) ?? slug, slug, row: r });
    if (r.listing.price_cents == null) s.unpriced++;
    else s.totalCents += r.listing.price_cents;
  }
  return { stops: [...stops.values()].sort((a, b) => b.items.length - a.items.length), covered: all.length };
}
