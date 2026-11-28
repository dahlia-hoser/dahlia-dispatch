import { bicolourFirst } from './guess';
import { kindFromTitle } from './names';
// The review list: questions for the owner, and what each answer does.
import { db } from './db';
import { isCanadianProvince } from './canada';
import { confirmSame, makeSeparate } from './name-ops';
import { normalize, varietyNameFromTitle } from './names';

/** Colour-and-form cards shown at once. The rest wait their turn, most-sold varieties first. */
export const DETAILS_AT_ONCE = 20;

/**
 * Colour questions worth your time: varieties sold by two or more farms, or in stock somewhere.
 * The rest keep their best guess (marked Suggested) without asking.
 */
export async function worthAsking(): Promise<Set<string>> {
  const t = db();
  const [varieties, listings] = await Promise.all([t.all('varieties'), t.all('listings')]);
  const farms = new Map<number, Set<number>>();
  const inStock = new Set<number>();
  for (const l of listings) {
    if (!l.active || !l.variety_id) continue;
    if (!farms.has(l.variety_id)) farms.set(l.variety_id, new Set());
    farms.get(l.variety_id)!.add(l.farm_id);
    if (l.in_stock) inStock.add(l.variety_id);
  }
  return new Set(varieties.filter((v) => (farms.get(v.id)?.size ?? 0) >= 2 || inStock.has(v.id)).map((v) => v.slug));
}

export async function openReviewCount() {
  const [open, worth] = await Promise.all([db().where('review_items', { status: 'open' }), worthAsking()]);
  const details = open.filter((r) => r.kind === 'details' && worth.has(r.data?.variety)).length;
  const others = open.filter((r) => r.kind !== 'details').length;
  return others + Math.min(details, DETAILS_AT_ONCE);
}

/** The whole picture: every flower left, not just today's batch. */
export async function reviewTotals() {
  const [open, worth] = await Promise.all([db().where('review_items', { status: 'open' }), worthAsking()]);
  const flowers = open.filter((r) => r.kind === 'details');
  const toReview = flowers.filter((r) => worth.has(r.data?.variety)).length;
  return { toReview, quiet: flowers.length - toReview, other: open.length - flowers.length };
}

export type Card =
  | { id: number; kind: 'feedback'; message: string; contact: string | null; page: string | null; at: string }
  | { id: number; kind: 'farm'; name: string; place: string | null; site: string | null; platform: string | null; canadian: boolean }
  | { id: number; kind: 'name'; spelling: string; farm: string; note: string | null; suggestion: { slug: string; name: string; detail: string } | null }
  | { id: number; kind: 'suggestion'; slug: string; name: string; now: { colour1: string | null; colour2: string | null; form: string | null }; suggested: { colour1: string | null; colour2: string | null; form: string | null }; note: string | null; image: string | null; at: string }
  | { id: number; kind: 'details'; slug: string; name: string; isNew: boolean; guessed: boolean; formFrom: string | null; colour1: string | null; colour2: string | null; form: string | null; seenAt: { farm: string; title: string; url: string | null; image: string | null }[] };

export async function waitingDetails(): Promise<number> {
  const [open, worth] = await Promise.all([db().where('review_items', { status: 'open' }), worthAsking()]);
  return Math.max(0, open.filter((r) => r.kind === 'details' && worth.has(r.data?.variety)).length - DETAILS_AT_ONCE);
}

export async function reviewCards(): Promise<Card[]> {
  const t = db();
  const worth = await worthAsking();
  const [items, varieties, candidates, listings, farms] = await Promise.all([
    t.where('review_items', { status: 'open' }),
    t.all('varieties'),
    t.all('farm_candidates'),
    t.all('listings'),
    t.all('farms'),
  ]);
  const vBySlug = new Map(varieties.map((v) => [v.slug, v]));
  const farmName = new Map(farms.map((f) => [f.id, f.name]));
  const order = { feedback: 0, suggestion: 1, farm: 2, name: 3, details: 4 } as Record<string, number>;
  const vIdBySlug = new Map(varieties.map((v) => [v.slug, v.id]));
  const sellers = new Map<number, number>();
  for (const l of listings) if (l.active && l.variety_id) sellers.set(l.variety_id, (sellers.get(l.variety_id) ?? 0) + 1);
  const popularity = (r: any) => (r.kind === 'details' ? sellers.get(vIdBySlug.get(r.data.variety) ?? -1) ?? 0 : 0);
  items.sort((a, b) => order[a.kind] - order[b.kind] || popularity(b) - popularity(a) || a.id - b.id);
  let detailsLeft = DETAILS_AT_ONCE;

  const cards: Card[] = [];
  for (const r of items) {
    if (r.kind === 'feedback') {
      cards.push({ id: r.id, kind: 'feedback', message: r.data.message, contact: r.data.contact ?? null, page: r.data.page ?? null, at: r.created_at });
    } else if (r.kind === 'suggestion') {
      const v = vBySlug.get(r.data.variety);
      if (!v) continue;
      const photo = listings.find((x) => x.variety_id === v.id && x.active && x.image)?.image ?? null;
      cards.push({
        id: r.id, kind: 'suggestion', slug: v.slug, name: v.name, note: r.data.note ?? null, image: photo, at: r.created_at,
        now: { colour1: v.colour1 ?? null, colour2: v.colour2 ?? null, form: v.form ?? null },
        suggested: { colour1: r.data.colour1 ?? null, colour2: r.data.colour2 ?? null, form: r.data.form ?? null },
      });
    } else if (r.kind === 'farm') {
      const c = candidates.find((x) => x.id === r.data.candidate);
      if (c) cards.push({ id: r.id, kind: 'farm', name: c.name, place: c.place, site: c.site, platform: c.platform, canadian: isCanadianProvince(c.province) });
    } else if (r.kind === 'name') {
      // Not a dahlia (a mentorship, a class...): nothing to ask. The checker closes these too.
      if (kindFromTitle(String(r.data?.spelling ?? '')) !== 'tuber') continue;
      const v = vBySlug.get(r.data.suggestion);
      cards.push({
        id: r.id,
        kind: 'name',
        spelling: r.data.spelling,
        farm: r.data.farm,
        note: r.data.note ?? null,
        suggestion: v ? { slug: v.slug, name: v.name, detail: [v.form, [v.colour1, v.colour2].filter(Boolean).join(' / ')].filter(Boolean).join(' · ') } : null,
      });
    } else if (r.kind === 'details') {
      const v = vBySlug.get(r.data.variety);
      if (!v || detailsLeft <= 0 || !worth.has(v.slug)) continue;
      detailsLeft--;
      // One link per farm, so the same farm doesn't repeat.
      // Listings with a photo first, so the card shows as many farm photos as possible.
      const seenAt: { farm: string; title: string; url: string | null; image: string | null }[] = [];
      const mine = listings.filter((x) => x.variety_id === v.id && x.active).sort((a, b) => Number(!!b.image) - Number(!!a.image));
      for (const l of mine) {
        const farm = farmName.get(l.farm_id) ?? '';
        if (!seenAt.some((x) => x.farm === farm)) seenAt.push({ farm, title: l.title, url: l.url, image: l.image ?? null });
        if (seenAt.length >= 4) break;
      }
      cards.push({ id: r.id, kind: 'details', slug: v.slug, name: v.name, isNew: !!r.data.isNew, guessed: !!r.data.guessed, formFrom: r.data.formFrom ?? null, colour1: v.colour1, colour2: v.colour2, form: v.form, seenAt });
    }
  }
  return cards;
}

export type Answer =
  | { choice: 'later' }
  | { choice: 'yes'; site?: string }
  | { choice: 'no' }
  | { choice: 'save'; colour1: string | null; colour2: string | null; form: string | null }
  | { choice: 'notdahlia' };

export async function answer(id: number, a: Answer) {
  const t = db();
  const [r] = await t.where('review_items', { id });
  if (!r || r.status !== 'open') return;
  const undo: Record<string, any> = {};
  const now = new Date().toISOString();

  if (a.choice === 'later') {
    await t.update('review_items', { id }, { status: 'later', resolved_at: now, answer: { choice: 'later' } });
    if (r.kind === 'farm') await t.update('farm_candidates', { id: r.data.candidate }, { status: 'later' });
    return;
  }

  if (r.kind === 'farm') {
    const [c] = await t.where('farm_candidates', { id: r.data.candidate });
    if (a.choice === 'yes' && c) {
      const site = (a as any).site?.trim() || c.site || null;
      const code = 'F' + c.id;
      const [farm] = await t.insert('farms', {
        code, name: c.name, place: c.place, province: c.province, site: site ? (/^https?:/.test(site) ? site : 'https://' + site) : null,
        platform: site ? (c.platform === 'shopify' ? 'shopify' : 'unknown') : 'unknown', active: !!site,
      });
      undo.farmId = farm.id;
      await t.update('farm_candidates', { id: c.id }, { status: 'yes' });
    } else if (c) {
      await t.update('farm_candidates', { id: c.id }, { status: 'no' });
    }
  }

  if (r.kind === 'name') {
    const spelling = r.data.spelling as string;
    const waiting = (await t.all('listings')).filter((l) => l.variety_id == null && normalize(varietyNameFromTitle(l.title)) === normalize(spelling));
    undo.listingIds = waiting.map((l) => l.id);
    if (a.choice === 'yes') {
      const [v] = await t.where('varieties', { slug: r.data.suggestion });
      if (v) {
        undo.alias = (await t.where('aliases', { alias: normalize(spelling) })).length ? null : normalize(spelling);
        await confirmSame(t, spelling, v.id);
      }
    } else {
      const before = new Set((await t.all('varieties')).map((v) => v.id));
      await makeSeparate(t, spelling);
      undo.varietyIds = (await t.all('varieties')).filter((v) => !before.has(v.id)).map((v) => v.id);
    }
  }

  if (r.kind === 'details' && a.choice === 'notdahlia') {
    const [v] = await t.where('varieties', { slug: r.data.variety });
    if (v) {
      undo.variety = { id: v.id, colour1: v.colour1, colour2: v.colour2, form: v.form, status: v.status };
      await t.update('varieties', { id: v.id }, { status: 'Not a dahlia' });
    }
  }

  if (r.kind === 'suggestion' && a.choice === 'yes') {
    const [v] = await t.where('varieties', { slug: r.data.variety });
    if (v) {
      undo.variety = { id: v.id, colour1: v.colour1, colour2: v.colour2, form: v.form, status: v.status };
      const [c1, c2] = bicolourFirst(r.data.colour1 ?? null, r.data.colour2 ?? null);
      await t.update('varieties', { id: v.id }, { colour1: c1, colour2: c2, form: r.data.form ?? v.form ?? null, status: 'Confirmed' });
    }
  }

  if (r.kind === 'details' && a.choice === 'save') {
    const [v] = await t.where('varieties', { slug: r.data.variety });
    if (v) {
      undo.variety = { id: v.id, colour1: v.colour1, colour2: v.colour2, form: v.form, status: v.status };
      const [c1, c2] = bicolourFirst(a.colour1, a.colour2);
      await t.update('varieties', { id: v.id }, { colour1: c1, colour2: c2, form: a.form, status: 'Confirmed' });
    }
  }

  await t.update('review_items', { id }, { status: 'done', resolved_at: now, answer: { ...a, undo } });
}

export async function undoAnswer(id: number) {
  const t = db();
  const [r] = await t.where('review_items', { id });
  if (!r || r.status === 'open') return;
  const u = r.answer?.undo ?? {};
  if (r.kind === 'farm') {
    if (u.farmId) await t.remove('farms', { id: u.farmId });
    await t.update('farm_candidates', { id: r.data.candidate }, { status: 'suggested' });
  }
  if (r.kind === 'name') {
    for (const lid of u.listingIds ?? []) await t.update('listings', { id: lid }, { variety_id: null });
    if (u.alias) await t.remove('aliases', { alias: u.alias });
    for (const vid of u.varietyIds ?? []) {
      const [v] = await t.where('varieties', { id: vid });
      if (!v) continue;
      const extra = (await t.where('review_items', { kind: 'details' })).filter((x) => x.data?.variety === v.slug);
      for (const x of extra) await t.remove('review_items', { id: x.id });
      await t.remove('aliases', { variety_id: vid });
      await t.remove('varieties', { id: vid });
    }
  }
  if ((r.kind === 'details' || r.kind === 'suggestion') && u.variety) {
    const { id: vid, ...prev } = u.variety;
    await t.update('varieties', { id: vid }, prev);
  }
  await t.update('review_items', { id }, { status: 'open', resolved_at: null, answer: null });
}
