// The review list: questions for the owner, and what each answer does.
import { db } from './db';
import { confirmSame, makeSeparate } from './name-ops';
import { normalize, varietyNameFromTitle } from './names';

/** Colour-and-form cards shown at once. The rest wait their turn, most-sold varieties first. */
export const DETAILS_AT_ONCE = 20;

export async function openReviewCount() {
  const open = await db().where('review_items', { status: 'open' });
  const details = open.filter((r) => r.kind === 'details').length;
  return open.length - details + Math.min(details, DETAILS_AT_ONCE);
}

export type Card =
  | { id: number; kind: 'farm'; name: string; place: string | null; site: string | null; platform: string | null }
  | { id: number; kind: 'name'; spelling: string; farm: string; note: string | null; suggestion: { slug: string; name: string; detail: string } | null }
  | { id: number; kind: 'details'; slug: string; name: string; isNew: boolean; guessed: boolean; colour1: string | null; colour2: string | null; form: string | null; seenAt: { farm: string; title: string; url: string | null }[] };

export async function waitingDetails(): Promise<number> {
  const open = await db().where('review_items', { status: 'open' });
  return Math.max(0, open.filter((r) => r.kind === 'details').length - DETAILS_AT_ONCE);
}

export async function reviewCards(): Promise<Card[]> {
  const t = db();
  const [items, varieties, candidates, listings, farms] = await Promise.all([
    t.where('review_items', { status: 'open' }),
    t.all('varieties'),
    t.all('farm_candidates'),
    t.all('listings'),
    t.all('farms'),
  ]);
  const vBySlug = new Map(varieties.map((v) => [v.slug, v]));
  const farmName = new Map(farms.map((f) => [f.id, f.name]));
  const order = { farm: 0, name: 1, details: 2 } as Record<string, number>;
  const vIdBySlug = new Map(varieties.map((v) => [v.slug, v.id]));
  const sellers = new Map<number, number>();
  for (const l of listings) if (l.active && l.variety_id) sellers.set(l.variety_id, (sellers.get(l.variety_id) ?? 0) + 1);
  const popularity = (r: any) => (r.kind === 'details' ? sellers.get(vIdBySlug.get(r.data.variety) ?? -1) ?? 0 : 0);
  items.sort((a, b) => order[a.kind] - order[b.kind] || popularity(b) - popularity(a) || a.id - b.id);
  let detailsLeft = DETAILS_AT_ONCE;

  const cards: Card[] = [];
  for (const r of items) {
    if (r.kind === 'farm') {
      const c = candidates.find((x) => x.id === r.data.candidate);
      if (c) cards.push({ id: r.id, kind: 'farm', name: c.name, place: c.place, site: c.site, platform: c.platform });
    } else if (r.kind === 'name') {
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
      if (!v || detailsLeft <= 0) continue;
      detailsLeft--;
      const seenAt = listings
        .filter((l) => l.variety_id === v.id && l.active)
        .slice(0, 4)
        .map((l) => ({ farm: farmName.get(l.farm_id) ?? '', title: l.title, url: l.url }));
      cards.push({ id: r.id, kind: 'details', slug: v.slug, name: v.name, isNew: !!r.data.isNew, guessed: !!r.data.guessed, colour1: v.colour1, colour2: v.colour2, form: v.form, seenAt });
    }
  }
  return cards;
}

export type Answer =
  | { choice: 'later' }
  | { choice: 'yes'; site?: string }
  | { choice: 'no' }
  | { choice: 'save'; colour1: string | null; colour2: string | null; form: string | null };

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

  if (r.kind === 'details' && a.choice === 'save') {
    const [v] = await t.where('varieties', { slug: r.data.variety });
    if (v) {
      undo.variety = { id: v.id, colour1: v.colour1, colour2: v.colour2, form: v.form, status: v.status };
      await t.update('varieties', { id: v.id }, { colour1: a.colour1, colour2: a.colour2, form: a.form, status: 'Confirmed' });
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
  if (r.kind === 'details' && u.variety) {
    const { id: vid, ...prev } = u.variety;
    await t.update('varieties', { id: vid }, prev);
  }
  await t.update('review_items', { id }, { status: 'open', resolved_at: null, answer: null });
}
