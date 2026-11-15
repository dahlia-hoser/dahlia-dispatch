// Deciding which variety a farm's listing belongs to, and asking the owner when unsure.
import type { Tables } from './db';
import { matchName, normalize, slugify, tidyName, varietyNameFromTitle } from './names';
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
