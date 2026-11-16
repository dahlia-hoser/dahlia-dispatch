// Rainbows & Roulette: mixed, curated and mystery packs.
import { db } from './db';
import { isRoulette, kindFromTitle, normalize, packSize } from './names';
import type { Farm, Listing } from './types';
import { status, type Avail } from './catalogue';

export type Pack = {
  listing: Listing;
  farm: Farm;
  size: number;
  eachCents: number | null;
  colours: string[];
  varieties: { name: string; slug: string }[];
  roulette: boolean;
  avail: Avail;
  label: string;
};

// Theme words farms use for mixes, and the colours they mean.
const THEMES: [RegExp, string[]][] = [
  [/autumn|fall|harvest|automne/, ['Orange', 'Burgundy', 'Yellow']],
  [/pastel|soft|blush|romantic|wedding|bridal/, ['Blush', 'Peach', 'Lavender']],
  [/sunset|sunrise|tropical|citrus|fiesta/, ['Orange', 'Pink', 'Yellow']],
  [/jewel|moody|dark|gothic/, ['Burgundy', 'Purple', 'Pink']],
  [/rainbow|bright|confetti|party|carnival|arc-en-ciel/, ['Red', 'Orange', 'Yellow', 'Purple']],
  [/white|ivory|snow|blanc/, ['White', 'Cream']],
  [/coffee|café|latte|neutral|nude|cream/, ['Cream', 'Peach', 'Blush']],
  [/red|crimson|rouge/, ['Red']],
  [/pink|rose/, ['Pink']],
  [/purple|violet/, ['Purple']],
  [/yellow|gold|jaune/, ['Yellow']],
  [/orange|coral|apricot|peach/, ['Orange', 'Peach']],
  [/burgundy|wine|black/, ['Burgundy']],
];

export function packColours(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  for (const [re, cols] of THEMES) if (re.test(t)) for (const c of cols) if (!out.includes(c)) out.push(c);
  return out.slice(0, 5);
}

/** Owner-hidden packs are stored as done review items, so no new table is needed. */
export async function hiddenPackKeys(): Promise<Set<string>> {
  const items = await db().where('review_items', { kind: 'hide' });
  return new Set(items.map((r) => `${r.data?.farm_id}:${r.data?.product_key}`));
}

export async function loadPacks(): Promise<{ rainbows: Pack[]; roulette: Pack[] }> {
  const t = db();
  const [farms, listings, sales, varieties, aliases, hidden] = await Promise.all([t.all('farms'), t.all('listings'), t.all('sale_events'), t.all('varieties'), t.all('aliases'), hiddenPackKeys()]);
  const farmById = new Map((farms as Farm[]).map((f) => [f.id, f]));
  // For spotting named varieties inside a collection's description.
  const known = new Map<string, { name: string; slug: string }>();
  const vById = new Map(varieties.filter((v) => v.status !== 'Not a dahlia').map((v) => [v.id, v]));
  for (const a of aliases) {
    const v = vById.get(a.variety_id);
    if (v && a.alias.length >= 6) known.set(a.alias, { name: v.name, slug: v.slug });
  }
  const packs: Pack[] = [];
  for (const l of listings as Listing[]) {
    if (!l.active || kindFromTitle(l.title) !== 'mix') continue;
    const farm = farmById.get(l.farm_id);
    if (!farm || hidden.has(`${l.farm_id}:${l.product_key}`)) continue;
    const desc = (l as any).description ?? '';
    const size = packSize(`${l.title} ${desc.slice(0, 120)}`);
    const roulette = isRoulette(l.title, desc);
    const text = ` ${normalize(desc)} `;
    const inside: { name: string; slug: string }[] = [];
    if (!roulette && desc) for (const [alias, v] of known) if (text.includes(` ${alias} `) && !inside.some((x) => x.slug === v.slug)) inside.push(v);
    const st = status(l, farm, sales as any);
    packs.push({
      listing: l,
      farm,
      size,
      eachCents: l.price_cents != null && size > 1 ? Math.round(l.price_cents / size) : null,
      colours: roulette ? [] : packColours(`${l.title} ${desc.slice(0, 300)}`),
      varieties: inside.slice(0, 12),
      roulette,
      ...st,
    });
  }
  const order: Record<Avail, number> = { in: 0, soon: 1, list: 2, out: 3 };
  const sort = (a: Pack, b: Pack) => order[a.avail] - order[b.avail] || (a.eachCents ?? a.listing.price_cents ?? 1e9) - (b.eachCents ?? b.listing.price_cents ?? 1e9);
  return { rainbows: packs.filter((p) => !p.roulette).sort(sort), roulette: packs.filter((p) => p.roulette).sort(sort) };
}
