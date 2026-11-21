// Deciding which variety a farm's listing belongs to, and asking the owner when unsure.
import type { Tables } from './db';
import { kindFromTitle, matchName, normalize, sameEnough, slugify, tidyName, varietyNameFromTitle, stripEmoji, hasCanadaMark, looseKey } from './names';
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
    if (String(l.product_key).startsWith('manual-')) continue;
    if (!l.variety_id) {
      // Saved before it was recognised as one variety (e.g. "Bulk Cornel" used to count as a mix): link it now.
      const kind = kindFromTitle(l.title);
      if (!l.active || kind === 'mix' || kind === 'other') continue;
      const id = await book.resolve(l.title, farmName.get(l.farm_id) ?? '');
      if (id) {
        await t.update('listings', { id: l.id }, { variety_id: id, kind });
        moved++;
      }
      continue;
    }
    if (kindFromTitle(l.title) === 'mix') {
      await t.update('listings', { id: l.id }, { variety_id: null, kind: 'mix' });
      moved++;
      continue;
    }
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

/** Names saved with emoji or flags in them get cleaned; a 🇨🇦 or 🍁 marks the variety Canadian-bred. */
export async function tidyEmojiNames(t: Tables, canSetCanadian: boolean): Promise<number> {
  let n = 0;
  for (const v of await t.all('varieties')) {
    const clean = stripEmoji(v.name);
    if (clean === v.name || !clean) continue;
    const patch: Record<string, any> = { name: clean };
    if (canSetCanadian && hasCanadaMark(v.name) && v.canadian_bred == null) patch.canadian_bred = true;
    await t.update('varieties', { id: v.id }, patch);
    n++;
  }
  return n;
}

/** Form list changes: Single is now called Anemone; Bicolour moves from form to colour. */
export async function tidyForms(t: Tables): Promise<number> {
  let n = 0;
  // Bicolour always goes first ('Bicolour / Orange').
  for (const v of await t.where('varieties', { colour2: 'Bicolour' })) {
    await t.update('varieties', { id: v.id }, { colour1: 'Bicolour', colour2: v.colour1 ?? null });
    n++;
  }
  for (const v of await t.where('varieties', { form: 'Single' })) {
    await t.update('varieties', { id: v.id }, { form: 'Anemone' });
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

/**
 * Decisions the owner gave in chat rather than on the site (data/owner-decisions.json).
 * Applied once: the variety is then marked Confirmed and never touched again.
 */
export async function applyOwnerDecisions(t: Tables, decisions: { slug: string; [k: string]: any }[]): Promise<number> {
  let n = 0;
  for (const { slug, ...fields } of decisions) {
    const [v] = await t.where('varieties', { slug });
    if (!v || v.status === 'Confirmed') continue;
    await t.update('varieties', { id: v.id }, { ...fields, status: 'Confirmed' });
    const open = (await t.where('review_items', { kind: 'details' })).filter((r) => r.status !== 'done' && r.data?.variety === slug);
    for (const r of open) await t.update('review_items', { id: r.id }, { status: 'done', resolved_at: new Date().toISOString(), answer: { choice: 'save', auto: true } });
    n++;
  }
  return n;
}

/**
 * Farms the owner trusts for certain details (data/trusted-sources.json), e.g. Deva's for form.
 * Their label becomes the variety's default, even if another farm said something else first.
 * Confirmed varieties are never changed. Returns how many varieties were updated.
 */
export async function applyTrustedDetails(
  t: Tables,
  farm: { id: number; name: string },
  products: { key: string; title: string; hints?: { tags: string[]; text: string } }[],
  fields: string[]
): Promise<number> {
  const { guessDetails } = await import('./guess');
  const listings = await t.where('listings', { farm_id: farm.id });
  const varietyOf = new Map(listings.map((l) => [String(l.product_key), l.variety_id]));
  const varieties = new Map((await t.all('varieties')).map((v) => [v.id, v]));
  const openCards = (await t.where('review_items', { kind: 'details' })).filter((r) => r.status !== 'done');
  // Forms set from your corrections list are never changed by a farm's description.
  const lockedForm = new Set((await t.where('review_items', { kind: 'formfix' })).map((r) => r.data?.slug));
  let n = 0;
  for (const p of products) {
    const id = varietyOf.get(p.key);
    const v = id ? varieties.get(id) : null;
    if (!v || v.status === 'Not a dahlia' || !p.hints) continue;
    // A trusted farm is read in full: its form is often further down the description.
    const g = guessDetails(v.name, p.hints, { fullText: true }) as Record<string, string | null>;
    const patch: Record<string, string> = {};
    if (v.status === 'Confirmed') {
      // Your answers stand. The one exception: plain "Decorative" can be narrowed to formal or informal.
      if (fields.includes('form') && v.form === 'Decorative' && /^(Formal|Informal) decorative$/.test(g.form ?? '')) patch.form = g.form!;
    } else for (const f of fields) if (g[f] && v[f] !== g[f]) patch[f] = g[f]!;
    if (lockedForm.has(v.slug)) delete patch.form;
    // A trusted farm's colours come as a pair: one colour named means no second colour.
    if (v.status !== 'Confirmed' && fields.includes('colour2') && g.colour1 && !g.colour2 && v.colour2) patch.colour2 = null as any;
    if (!Object.keys(patch).length) continue;
    await t.update('varieties', { id: v.id }, patch);
    Object.assign(v, patch);
    for (const r of openCards.filter((r) => r.data?.variety === v.slug)) {
      await t.update('review_items', { id: r.id }, { data: { ...r.data, guessed: true, formFrom: fields.includes('form') && patch.form ? farm.name : r.data?.formFrom } });
    }
    n++;
  }
  return n;
}

/** Farms' own words like "2026 introduction" set the variety's introduction year (the latest one wins). */
export async function applyIntroYears(t: Tables, farmId: number, products: { key: string; title: string; hints?: { text: string } }[]): Promise<number> {
  const { introYear } = await import('./badges');
  const listings = await t.where('listings', { farm_id: farmId });
  const varietyOf = new Map(listings.map((l) => [String(l.product_key), l.variety_id]));
  const varieties = new Map((await t.all('varieties')).map((v) => [v.id, v]));
  let n = 0;
  for (const p of products) {
    const year = introYear(`${p.title} ${p.hints?.text ?? ''}`);
    const v = varieties.get(varietyOf.get(p.key));
    if (!year || !v || (v.intro_year && v.intro_year >= year)) continue;
    await t.update('varieties', { id: v.id }, { intro_year: year });
    v.intro_year = year;
    n++;
  }
  return n;
}

/** Shipping and pickup details from data/farm-details.json, filling only blanks. */
export async function syncFarmDetails(t: Tables, details: any[]): Promise<number> {
  const farms = await t.all('farms');
  let n = 0;
  for (const d of details) {
    const f = farms.find((x) => x.code === d.farm);
    if (!f) continue;
    const patch: Record<string, string> = {};
    for (const k of ['ships_to', 'ship_window', 'ship_cost', 'pickup']) if (d[k] && !f[k]) patch[k] = d[k];
    if (Object.keys(patch).length) {
      await t.update('farms', { id: f.id }, patch);
      n++;
    }
  }
  return n;
}

/**
 * When two or more farms' own descriptions agree on a variety's main colour (and none disagrees),
 * fill it in and confirm it, closing its colour question. Never touches Confirmed or hidden varieties.
 */
export async function confirmWhenFarmsAgree(t: Tables): Promise<number> {
  const { guessDetails } = await import('./guess');
  const [varieties, listings, review] = await Promise.all([t.all('varieties'), t.all('listings'), t.where('review_items', { kind: 'details' })]);
  const open = new Map<string, any[]>();
  for (const r of review) if (r.status !== 'done') open.set(r.data?.variety, [...(open.get(r.data?.variety) ?? []), r]);
  const byVariety = new Map<number, any[]>();
  for (const l of listings) if (l.variety_id && l.active && l.description) byVariety.set(l.variety_id, [...(byVariety.get(l.variety_id) ?? []), l]);
  let n = 0;
  for (const v of varieties) {
    if (v.status === 'Confirmed' || v.status === 'Not a dahlia' || !open.has(v.slug)) continue;
    const ls = byVariety.get(v.id) ?? [];
    const perFarm = new Map<number, ReturnType<typeof guessDetails>>();
    for (const l of ls) if (!perFarm.has(l.farm_id)) perFarm.set(l.farm_id, guessDetails(v.name, { tags: [], text: `${l.description}` }));
    const guesses = [...perFarm.values()].filter((g) => g.colour1);
    if (guesses.length < 2) continue;
    const main = guesses[0].colour1;
    if (!guesses.every((g) => g.colour1 === main)) continue;
    const second = guesses.map((g) => g.colour2).filter(Boolean);
    const colour2 = second.length >= 2 && second.every((c) => c === second[0]) ? second[0] : v.colour2 && v.colour2 !== main ? v.colour2 : null;
    const forms = guesses.map((g) => g.form).filter(Boolean);
    const form = forms.length >= 2 && forms.every((f) => f === forms[0]) ? forms[0] : v.form;
    if (!form) {
      // Colour settled, form still unknown: fill the colour but keep asking about the form.
      await t.update('varieties', { id: v.id }, { colour1: main, colour2 });
      continue;
    }
    await t.update('varieties', { id: v.id }, { colour1: main, colour2, form, status: 'Confirmed' });
    for (const r of open.get(v.slug)!) await t.update('review_items', { id: r.id }, { status: 'done', resolved_at: new Date().toISOString(), answer: { choice: 'save', auto: 'farms agree' } });
    n++;
  }
  return n;
}

/** Plain "Decorative" narrowed to formal or informal by the owner (data/form-splits.json). Never touches other forms. */
export async function applyFormSplits(t: Tables, splits: { slug: string; form: string }[]): Promise<number> {
  let n = 0;
  for (const { slug, form } of splits) {
    const [v] = await t.where('varieties', { slug });
    if (!v || (v.form && v.form !== 'Decorative') || v.form === form) continue;
    await t.update('varieties', { id: v.id }, { form });
    n++;
  }
  return n;
}

/** Farms the owner has ruled out (data/blocked-farms.json): never suggested, never shown. */
export async function blockFarms(t: Tables, blocked: { name: string }[]): Promise<number> {
  const key = (s: unknown) => String(s ?? '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
  const names = new Set(blocked.map((b) => key(b.name)));
  if (!names.size) return 0;
  let n = 0;
  const now = new Date().toISOString();
  for (const c of await t.all('farm_candidates')) {
    if (!names.has(key(c.name)) || c.status === 'no') continue;
    await t.update('farm_candidates', { id: c.id }, { status: 'no' });
    for (const r of await t.where('review_items', { kind: 'farm' }))
      if (r.data?.candidate === c.id && r.status !== 'done') await t.update('review_items', { id: r.id }, { status: 'done', resolved_at: now, answer: { choice: 'no', auto: 'blocked' } });
    n++;
  }
  for (const f of await t.all('farms')) {
    if (!names.has(key(f.name)) || !f.active) continue;
    await t.update('farms', { id: f.id }, { active: false, last_error: 'Removed by the owner: not in Canada.' });
    for (const l of await t.where('listings', { farm_id: f.id })) if (l.active) await t.update('listings', { id: l.id }, { active: false, in_stock: false });
    n++;
  }
  return n;
}

/**
 * Farms whose shop we've learned to read since they were added (data/farms.json): switch the
 * database over from a hand-entered price list, and retire the hand-entered listings.
 */
export async function syncFarmSources(t: Tables, list: { code: string; name?: string; place?: string | null; province?: string | null; site?: string | null; platform: string; collection?: string | null }[]): Promise<string[]> {
  const changed: string[] = [];
  const farms = await t.all('farms');
  const names = new Set(farms.map((x) => String(x.name).toLowerCase()));
  for (const j of list) {
    const f = farms.find((x) => x.code === j.code);
    // A farm added to the list since setup: add it (unless it's already there under another code).
    if (!f && j.name && !names.has(j.name.toLowerCase())) {
      await t.insert('farms', { code: j.code, name: j.name, place: j.place ?? null, province: j.province ?? null, site: j.site ?? null, platform: j.platform, collection: j.collection ?? null, active: !!j.site });
      changed.push(j.name);
      continue;
    }
    if (!f || !['manual', 'unknown'].includes(f.platform) || ['manual', 'unknown'].includes(j.platform) || f.platform === j.platform) continue;
    await t.update('farms', { id: f.id }, { platform: j.platform, site: j.site ?? f.site, collection: j.collection ?? f.collection ?? null, last_checked_at: null });
    for (const l of await t.where('listings', { farm_id: f.id }))
      if (String(l.product_key).startsWith('manual-') && l.active) await t.update('listings', { id: l.id }, { active: false });
    changed.push(f.name);
  }
  return changed;
}

/**
 * The owner's form corrections by name (data/form-fixes.json). They win over everything, even a
 * confirmed form, but each is applied only once per variety, so a later change on the site stands.
 * A name not on the site yet is applied when a farm first lists it.
 */
export async function applyFormFixes(t: Tables, fixes: { name: string; form: string }[]): Promise<number> {
  const varieties = await t.all('varieties');
  const aliases = await t.all('aliases');
  const done = new Set((await t.where('review_items', { kind: 'formfix' })).map((r) => `${r.data?.slug}|${r.data?.form}`));
  const byKey = new Map<string, any>();
  for (const v of varieties) byKey.set(looseKey(v.name), v);
  for (const a of aliases) {
    const v = varieties.find((x) => x.id === a.variety_id);
    if (v && !byKey.has(looseKey(a.alias))) byKey.set(looseKey(a.alias), v);
  }
  let n = 0;
  const now = new Date().toISOString();
  for (const f of fixes) {
    const v = byKey.get(looseKey(f.name));
    if (!v || done.has(`${v.slug}|${f.form}`)) continue;
    if (v.form !== f.form) {
      await t.update('varieties', { id: v.id }, { form: f.form });
      n++;
    }
    await t.insert('review_items', { kind: 'formfix', status: 'done', resolved_at: now, data: { slug: v.slug, form: f.form, name: f.name } });
  }
  return n;
}
