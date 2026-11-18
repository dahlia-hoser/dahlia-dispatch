// Reading the data for the public pages: statuses, search, grouping by variety.
import { db } from './db';
import { isBulk, kindFromTitle, normalize, packSize, varietyNameFromTitle, stripEmoji, hasCanadaMark } from './names';
import type { AllData, Farm, Listing, SaleEvent, Variety } from './types';
import { NOT_DAHLIA } from './types';
import { isCanadianBred, isNewIntro } from './badges';
import { text, fill } from '../site-text';

export async function loadAll(): Promise<AllData> {
  const t = db();
  const [farms, varieties, aliases, listings, sales, questions] = await Promise.all([
    t.all('farms'),
    t.all('varieties'),
    t.all('aliases'),
    t.all('listings'),
    t.all('sale_events'),
    t.where('review_items', { kind: 'name' }),
  ]);
  // Varieties marked "Not a dahlia" are hidden, with their listings.
  const hidden = new Set(varieties.filter((v) => v.status === NOT_DAHLIA).map((v) => v.id));
  return {
    farms: farms as Farm[],
    varieties: (varieties as Variety[]).filter((v) => !hidden.has(v.id)),
    aliases: aliases as any,
    listings: (listings as Listing[]).filter((l) => l.active && !['other', 'mix'].includes(l.kind) && !['other', 'mix'].includes(kindFromTitle(l.title)) && !hidden.has(l.variety_id as number)),
    sales: sales as SaleEvent[],
    // While a "same flower?" question waits, show those listings under the suggested name.
    pending: questions.filter((q) => q.status !== 'done' && q.data?.suggestion).map((q) => ({ spelling: q.data.spelling, slug: q.data.suggestion })),
  };
}

const TZ = 'America/Toronto';
export function shortDate(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));
}
export function dateTime(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) + ' ET';
}
export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return 'not yet';
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
export function money(cents: number | null) {
  if (cents == null) return text.noPrice;
  return '$' + (cents / 100).toFixed(2);
}

export type Avail = 'in' | 'out' | 'soon' | 'list';
export const AVAIL_LABEL: Record<Avail, string> = {
  in: text.availInStock,
  out: text.availNotAvailable,
  soon: text.availComingSoon,
  list: text.availPriceList,
};

const OPEN_NOW = /open now|tba/i;

/** The sale that a farm is waiting for, if any. */
export function nextSale(farmId: number, sales: SaleEvent[], now = Date.now(), kind?: string): SaleEvent | null {
  // A cuttings sale doesn't open tubers, and a tuber sale doesn't open cuttings.
  const fits = (s: SaleEvent) => !kind || (/cutting/i.test(s.label ?? '') ? kind === 'cutting' : /tuber/i.test(s.label ?? '') ? kind !== 'cutting' : true);
  const mine = sales.filter((s) => s.farm_id === farmId && fits(s));
  const timed = mine.filter((s) => s.starts_at && new Date(s.starts_at).getTime() > now).sort((a, b) => a.starts_at!.localeCompare(b.starts_at!));
  if (timed[0]) return timed[0];
  return mine.find((s) => !s.starts_at && s.when_text && !OPEN_NOW.test(s.when_text)) ?? null;
}

export function status(l: Listing, farm: Farm, sales: SaleEvent[], now = Date.now()): { avail: Avail; label: string } {
  if (l.in_stock) return { avail: 'in', label: text.availInStock };
  if (farm.platform === 'manual') return { avail: 'list', label: text.availPriceList };
  const s = nextSale(farm.id, sales, now, l.kind);
  if (s) return { avail: 'soon', label: fill(text.opensOn, { date: s.starts_at ? shortDate(s.starts_at) : s.when_text ?? '' }) };
  return { avail: 'out', label: text.availNotAvailable };
}

export type Row = { listing: Listing; farm: Farm; avail: Avail; label: string; isNew: boolean };
export type Group = { key: string; variety: Variety | null; name: string; aka: string[]; rows: Row[]; newIntro?: boolean; canadian?: boolean };

export type Filters = { q?: string; farm?: string; avail?: string; form?: string; colour?: string; prov?: string; get?: string; only?: string };

export function groupAll(data: AllData, now = Date.now()): Group[] {
  const farmById = new Map(data.farms.map((f) => [f.id, f]));
  const varietyById = new Map(data.varieties.map((v) => [v.id, v]));
  // "New" = first seen in the last 7 days, but not the farm's first-ever import.
  const firstImport = new Map<number, number>();
  for (const l of data.listings) {
    const t = new Date(l.first_seen).getTime();
    firstImport.set(l.farm_id, Math.min(firstImport.get(l.farm_id) ?? t, t));
  }
  const bySlug = new Map(data.varieties.map((v) => [v.slug, v.id]));
  const pending = new Map((data.pending ?? []).map((p) => [normalize(p.spelling), bySlug.get(p.slug)]));
  // A listing not yet linked to a variety still joins it when the names match exactly.
  const byName = new Map<string, number>();
  for (const v of data.varieties) byName.set(normalize(v.name), v.id);
  for (const a of data.aliases) if (!byName.has(normalize(a.alias))) byName.set(normalize(a.alias), a.variety_id);
  const groups = new Map<string, Group>();
  for (const v of data.varieties) {
    groups.set('v' + v.id, {
      key: 'v' + v.id,
      variety: v,
      name: stripEmoji(v.name),
      aka: data.aliases.filter((a) => a.variety_id === v.id && a.shown).map((a) => a.shown!),
      rows: [],
    });
  }
  for (const l of data.listings) {
    const farm = farmById.get(l.farm_id);
    if (!farm) continue;
    const clean = varietyNameFromTitle(l.title);
    const guessId = l.variety_id ?? byName.get(normalize(clean)) ?? pending.get(normalize(clean)) ?? null;
    const key = guessId && varietyById.has(guessId) ? 'v' + guessId : 't' + normalize(clean);
    if (!groups.has(key)) groups.set(key, { key, variety: null, name: clean, aka: [], rows: [] });
    const st = status(l, farm, data.sales, now);
    const first = new Date(l.first_seen).getTime();
    const isNew = now - first < 7 * 86400000 && first - (firstImport.get(l.farm_id) ?? first) > 3600000;
    groups.get(key)!.rows.push({ listing: l, farm, ...st, isNew });
  }
  const order: Record<Avail, number> = { in: 0, soon: 1, list: 2, out: 3 };
  for (const g of groups.values()) {
    // Cheapest first, comparing packs by their price per tuber.
    const each = (r: Row) => (r.listing.price_cents ?? 1e9) / packSize(r.listing.title);
    g.rows.sort((a, b) => order[a.avail] - order[b.avail] || each(a) - each(b));
    // "Also sold as": other spellings farms use, cleaned of shop talk, each once.
    const have = new Set([normalize(g.name), ...g.aka.map(normalize)]);
    for (const r of g.rows) {
      const n = varietyNameFromTitle(r.listing.title);
      const k = normalize(n);
      if (!have.has(k) && k.replace(/\s/g, '') !== normalize(g.name).replace(/\s/g, '')) {
        have.add(k);
        g.aka.push(n);
      }
    }
  }
  for (const g of groups.values()) {
    g.newIntro = isNewIntro(g.variety?.intro_year, now);
    g.canadian = isCanadianBred(g.name, g.variety?.canadian_bred) || (g.variety?.canadian_bred !== false && g.rows.some((r) => hasCanadaMark(r.listing.title)));
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

/** Can someone in this province get it from this farm, by shipping or pickup? */
export function canGetIn(farm: Farm, prov: string): boolean {
  const to = (farm.ships_to ?? '').toUpperCase();
  if (to === 'ALL' || to.split(/[\s,]+/).includes(prov)) return true;
  return !!farm.pickup && farm.province === prov;
}

/** One line about getting it: "Ships across Canada · April–May · $18, free over $250 · Pickup: at the farm" */
export function gettingIt(farm: Farm): string {
  const parts: string[] = [];
  const to = (farm.ships_to ?? '').trim();
  if (to.toLowerCase() === 'all') parts.push(text.shipsAcross);
  else if (to) parts.push(fill(text.shipsTo, { provinces: to.toUpperCase().split(/[\s,]+/).join(', ') }));
  if (farm.ship_window) parts.push(farm.ship_window);
  if (farm.ship_cost) parts.push(farm.ship_cost);
  if (farm.pickup) parts.push(fill(text.pickupAt, { where: farm.pickup }));
  return parts.join(' · ');
}

export function search(groups: Group[], f: Filters): Group[] {
  const q = f.q ? normalize(f.q) : '';
  const out: Group[] = [];
  for (const g of groups) {
    const v = g.variety;
    // "Decorative" finds formal and informal decoratives too.
    if (f.form && v?.form !== f.form && !(f.form === 'Decorative' && /decorative$/i.test(v?.form ?? ''))) continue;
    if (f.colour && v?.colour1 !== f.colour && v?.colour2 !== f.colour) continue;
    let rows = g.rows;
    if (f.farm) rows = rows.filter((r) => r.farm.code === f.farm);
    if (f.prov) rows = rows.filter((r) => r.farm.province === f.prov);
    if (f.get) rows = rows.filter((r) => canGetIn(r.farm, f.get!));
    if (f.only === 'pickup') rows = rows.filter((r) => !!r.farm.pickup);
    if (f.only === 'packs') rows = rows.filter((r) => packSize(r.listing.title) > 1 || isBulk(r.listing.title));
    if (f.only === 'new' && !g.newIntro) continue;
    if (f.only === 'canadian' && !g.canadian) continue;
    if (f.avail && f.avail !== 'all') rows = rows.filter((r) => r.avail === f.avail);
    if (!rows.length) continue;
    if (q) {
      const names = [g.name, ...g.aka].map(normalize);
      const nameHit = names.some((n) => n.includes(q));
      const farmRows = rows.filter((r) => normalize(r.farm.name).includes(q) || normalize(r.farm.place ?? '').includes(q));
      if (nameHit) {
        /* keep all rows */
      } else if (farmRows.length) rows = farmRows;
      else continue;
    }
    out.push({ ...g, rows });
  }
  // What you can buy now first, then what's opening soon, then the rest (alphabetical within each).
  const rank = (g: Group) => Math.min(...g.rows.map((r) => ({ in: 0, soon: 1, list: 2, out: 3 })[r.avail]));
  return out.map((g, i) => ({ g, i, r: rank(g) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.g);
}

export type Suggestion = { label: string; alts: string[]; sub: string; href: string; kind: 'variety' | 'farm' };

export function suggestions(data: AllData, groups: Group[]): Suggestion[] {
  // One row per variety. Other spellings are used for matching, not shown as extra rows.
  const list: Suggestion[] = [];
  for (const g of groups) {
    if (!g.rows.length && !g.variety) continue;
    const href = g.variety ? `/v/${g.variety.slug}` : `/?q=${encodeURIComponent(g.name)}`;
    list.push({ label: g.name, alts: g.aka, sub: '', href, kind: 'variety' });
  }
  for (const f of data.farms) if (f.active) list.push({ label: f.name, alts: [], sub: f.place ?? '', href: `/?farm=${f.code}`, kind: 'farm' });
  return list;
}

export function lastChecked(data: AllData): string | null {
  const times = data.farms.map((f) => f.last_checked_at).filter(Boolean) as string[];
  return times.sort().at(-1) ?? null;
}
