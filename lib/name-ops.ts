// Deciding which variety a farm's listing belongs to, and asking the owner when unsure.
import type { Tables } from './db';
import { kindFromTitle, matchName, normalize, sameEnough, slugify, tidyName, varietyNameFromTitle } from './names';
import { guessDetails, type Hints } from './guess';

export class NameBook {
  aliases = new Map<string, number>();
  slugs = new Map<number, string>();
  private openSpellings = new Set<string>();
  private usedSlugs = new Set<string>();
  created = 0;
  questions = 0;

  constructor(private t: Tables) {}

  async load() {
    const [aliases, varieties, review] = await Promise.all([this.t.all('aliases'), this.t.all('varieties'), this.t.all('review_items')]);
    for (const a of aliases) this.aliases.set(a.alias, a.variety_id);
    for (const v of varieties) {
      this.slugs.set(v.id, v.slug);
      this.usedSlugs.add(v.slug);
    }
    for (const r of review) if (r.kind === 'name' && r.status !== 'done') this.openSpellings.add(normalize(r.data.spelling));
    return this;
  }

  /** Returns the variety id, or null while a "same flower?" question waits in the review list. */
  async resolve(title: string, farmName: string, hints?: Hints): Promise<number | null> {
    const name = varietyNameFromTitle(title);
    const m = matchName(name, this.aliases);
    if (m.kind === 'exact') return m.varietyId;
    const key = normalize(name);
    if (this.openSpellings.has(key)) return null; // already asked the owner about this spelling
    if (m.kind === 'close') {
      if (!this.openSpellings.has(key)) {
        this.openSpellings.add(key);
        this.questions++;
        await this.t.insert('review_items', { kind: 'name', data: { spelling: name, farm: farmName, suggestion: this.slugs.get(m.varietyId) } });
      }
      return null;
    }
    return this.create(name, hints);
  }

  /** Brand-new variety: give it a page now, ask the owner for colour and form. */
  async create(name: string, hints?: Hints): Promise<number> {
    const clean = tidyName(name);
    let slug = slugify(clean) || 'variety';
    for (let i = 2; this.usedSlugs.has(slug); i++) slug = `${slugify(clean)}-${i}`;
    const guess = hints ? guessDetails(clean, hints) : { colour1: null, colour2: null, form: null };
    const [v] = await this.t.insert('varieties', { slug, name: clean, status: 'Suggested', ...guess });
    this.usedSlugs.add(slug);
    this.slugs.set(v.id, slug);
    await this.t.insert('aliases', { alias: normalize(clean), variety_id: v.id, shown: null });
    this.aliases.set(normalize(clean), v.id);
    await this.t.insert('review_items', { kind: 'details', data: { variety: slug, isNew: true, guessed: !!(guess.colour1 || guess.form) } });
    this.created++;
    return v.id;
  }
}

/** The owner said "same flower": remember the spelling and attach waiting listings. */
export async function confirmSame(t: Tables, spelling: string, varietyId: number) {
  const alias = normalize(spelling);
  const existing = await t.where('aliases', { alias });
  if (!existing.length) await t.insert('aliases', { alias, variety_id: varietyId, shown: spelling });
  await attachWaiting(t, alias, varietyId);
}

/** The owner said "different flower": make it its own variety. */
export async function makeSeparate(t: Tables, spelling: string) {
  const book = await new NameBook(t).load();
  const id = await book.create(spelling);
  await attachWaiting(t, normalize(spelling), id);
}

async function attachWaiting(t: Tables, alias: string, varietyId: number) {
  const waiting = (await t.all('listings')).filter((l) => l.variety_id == null && normalize(varietyNameFromTitle(l.title)) === alias);
  for (const l of waiting) await t.update('listings', { id: l.id }, { variety_id: varietyId });
}

/** Answers "same flower?" questions that turn out to be small spelling slips. Returns how many. */
export async function autoAnswerSlips(t: Tables): Promise<number> {
  const open = (await t.where('review_items', { kind: 'name' })).filter((r) => r.status !== 'done');
  if (!open.length) return 0;
  const [varieties, aliases] = await Promise.all([t.all('varieties'), t.all('aliases')]);
  let n = 0;
  for (const r of open) {
    const v = varieties.find((x) => x.slug === r.data?.suggestion);
    if (!v) continue;
    const spellings = [v.name, ...aliases.filter((a) => a.variety_id === v.id).map((a) => a.alias)];
    if (!spellings.some((sp) => sameEnough(sp, r.data.spelling))) continue;
    await confirmSame(t, r.data.spelling, v.id);
    await t.update('review_items', { id: r.id }, { status: 'done', resolved_at: new Date().toISOString(), answer: { choice: 'yes', auto: true } });
    n++;
  }
  return n;
}

/**
 * A variety whose every listing turned out to be something else (seeds, peonies, workshops...)
 * is marked "Not a dahlia" and its colour question closed. Mary's confirmed varieties are never touched.
 */
export async function hideNonDahlias(t: Tables): Promise<number> {
  const [varieties, listings, review] = await Promise.all([t.all('varieties'), t.all('listings'), t.where('review_items', { kind: 'details' })]);
  const byVariety = new Map<number, any[]>();
  for (const l of listings) if (l.variety_id) byVariety.set(l.variety_id, [...(byVariety.get(l.variety_id) ?? []), l]);
  let n = 0;
  for (const v of varieties) {
    if (v.status === 'Confirmed' || v.status === 'Not a dahlia') continue;
    const ls = byVariety.get(v.id);
    // Judge by today's rules, so it also catches listings the checker has since dropped.
    if (!ls?.length || !ls.every((l) => kindFromTitle(l.title) === 'other')) continue;
    await t.update('varieties', { id: v.id }, { status: 'Not a dahlia' });
    for (const r of review) if (r.status !== 'done' && r.data?.variety === v.slug) await t.update('review_items', { id: r.id }, { status: 'done', resolved_at: new Date().toISOString(), answer: { choice: 'notdahlia', auto: true } });
    n++;
  }
  return n;
}

/** Clubs and societies from data/societies.json: added once, then edited on the site like any sale. */
export async function syncSocieties(t: Tables, societies: any[]): Promise<number> {
  const farms = await t.all('farms');
  let n = 0;
  for (const s of societies) {
    if (farms.some((f) => f.code === s.code)) continue;
    const [f] = await t.insert('farms', { code: s.code, name: s.name, place: s.place, province: s.province, site: s.site, platform: 'society', active: false });
    await t.insert('sale_events', { farm_id: f.id, label: s.label, starts_at: null, when_text: s.when_text, time_text: s.time_text, url: s.site, note: s.note });
    n++;
  }
  return n;
}

/**
 * When the name-cleaning rules improve, listings already saved under a wrong name
 * (like "Potted") are moved to the right variety, and leftover empty varieties the
 * checker made are removed. The starting list and anything Confirmed are never removed.
 */
export async function reconcileNames(t: Tables, book: NameBook, keepSlugs: Set<string>): Promise<{ moved: number; removed: number }> {
  const [listings, varieties, aliases, farms] = await Promise.all([t.all('listings'), t.all('varieties'), t.all('aliases'), t.all('farms')]);
  const farmName = new Map(farms.map((f) => [f.id, f.name]));
  const spellings = new Map<number, string[]>();
  for (const v of varieties) spellings.set(v.id, [v.name]);
  for (const a of aliases) spellings.get(a.variety_id)?.push(a.alias);
  let moved = 0;
  for (const l of listings) {
    if (!l.variety_id || String(l.product_key).startsWith('manual-')) continue;
    const clean = varietyNameFromTitle(l.title);
    const own = spellings.get(l.variety_id) ?? [];
    if (own.some((sp) => normalize(sp) === normalize(clean) || sameEnough(sp, clean))) continue;
    const id = await book.resolve(l.title, farmName.get(l.farm_id) ?? '');
    if (id !== l.variety_id) {
      await t.update('listings', { id: l.id }, { variety_id: id });
      moved++;
    }
  }
  // Empty checker-made varieties.
  const used = new Set((await t.all('listings')).map((l) => l.variety_id));
  const empty = varieties.filter((v) => !used.has(v.id) && !keepSlugs.has(v.slug) && v.status !== 'Confirmed' && v.status !== 'Not a dahlia');
  if (empty.length) {
    const slugs = new Set(empty.map((v) => v.slug));
    const questions = (await t.where('review_items', { kind: 'details' })).filter((r) => r.status !== 'done' && slugs.has(r.data?.variety));
    await t.removeIn('review_items', 'id', questions.map((r) => r.id));
    await t.removeIn('aliases', 'variety_id', empty.map((v) => v.id));
    await t.removeIn('varieties', 'id', empty.map((v) => v.id));
  }
  return { moved, removed: empty.length };
}

/** Form list changes: Anemone now counts as Single; Bicolour moves from form to colour. */
export async function tidyForms(t: Tables): Promise<number> {
  let n = 0;
  for (const v of await t.where('varieties', { form: 'Anemone' })) {
    await t.update('varieties', { id: v.id }, { form: 'Single' });
    n++;
  }
  for (const v of await t.where('varieties', { form: 'Bicolour' })) {
    const patch: Record<string, any> = { form: null };
    if (!v.colour1) patch.colour1 = 'Bicolour';
    else if (!v.colour2) patch.colour2 = 'Bicolour';
    await t.update('varieties', { id: v.id }, patch);
    n++;
  }
  return n;
}
