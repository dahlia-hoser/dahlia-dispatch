// Daily: fill colour and form from the American Dahlia Society's show lists, and confirm
// varieties that match. Run by .github/workflows/ads.yml, or: npx tsx checker/ads-import.ts
import { readFileSync } from 'node:fs';
import { db } from '../lib/db';
import { parseAdsText, type AdsEntry } from '../lib/ads';
import { looseKey, slugify } from '../lib/names';
import { pdfLines } from './pdf-lines';
import sources from '../data/ads-sources.json';

export function buildAdsMap(entries: AdsEntry[]): Map<string, AdsEntry> {
  const map = new Map<string, AdsEntry>();
  for (const e of entries) map.set(looseKey(e.name), e); // later lists (newer years) win
  return map;
}

/** Applies ADS details. Never touches Confirmed or hidden varieties, and keeps colours from the owner's starting list. */
export async function applyAds(map: Map<string, AdsEntry>, keepSlugs: Set<string>) {
  const t = db();
  const [varieties, aliases, review] = await Promise.all([t.all('varieties'), t.all('aliases'), t.where('review_items', { kind: 'details' })]);
  const v2 = await t.probe('varieties', 'canadian_bred');
  const spellings = new Map<number, string[]>();
  for (const v of varieties) spellings.set(v.id, [v.name]);
  for (const a of aliases) spellings.get(a.variety_id)?.push(a.alias);
  let filled = 0, confirmed = 0;
  for (const v of varieties) {
    if (v.status === 'Not a dahlia') continue;
    const e = (spellings.get(v.id) ?? []).map((s) => map.get(looseKey(s))).find(Boolean);
    if (!e) continue;
    if (v.status === 'Confirmed') {
      // Your answers stand, except plain "Decorative" gets narrowed to formal or informal.
      if (v.form === 'Decorative' && /^(Formal|Informal) decorative$/.test(e.form ?? '')) {
        await t.update('varieties', { id: v.id }, { form: e.form });
        filled++;
      }
      continue;
    }
    const fromOwner = keepSlugs.has(v.slug);
    const patch: Record<string, any> = {};
    if (e.form && (!v.form || !fromOwner)) patch.form = e.form;
    if (e.colours.length && (!v.colour1 || !fromOwner)) {
      patch.colour1 = e.colours[0];
      patch.colour2 = e.colours[1] ?? null;
    }
    if (v2 && e.canadian && v.canadian_bred == null) patch.canadian_bred = true;
    const form = patch.form ?? v.form;
    const colour = patch.colour1 ?? v.colour1;
    // Confirm when the ADS gave both a form and a plain colour, or agrees with what's there.
    if (form && colour && (e.colours.length || fromOwner)) patch.status = 'Confirmed';
    if (!Object.keys(patch).length) continue;
    await t.update('varieties', { id: v.id }, patch);
    filled++;
    if (patch.status === 'Confirmed') {
      confirmed++;
      for (const r of review) if (r.status !== 'done' && r.data?.variety === v.slug)
        await t.update('review_items', { id: r.id }, { status: 'done', resolved_at: new Date().toISOString(), answer: { choice: 'save', auto: 'ads' } });
    }
  }
  return { filled, confirmed };
}

async function main() {
  const t = db();
  if (t.preview) {
    console.log('No Supabase keys found. Nothing to do.');
    return;
  }
  const all: AdsEntry[] = [];
  for (const url of sources as string[]) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'HosersDahliaDispatch/0.1 (Canadian dahlia tracker)' }, signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`${res.status}`);
      const lines = await pdfLines(new Uint8Array(await res.arrayBuffer()));
      const entries = parseAdsText(lines);
      console.log(`${url.split('/').pop()}: ${lines.length} lines, ${entries.length} varieties`);
      all.push(...entries);
    } catch (e: any) {
      console.log(`${url.split('/').pop()}: could not read (${e?.message ?? e})`);
    }
  }
  const map = buildAdsMap(all);
  const keep = new Set((JSON.parse(readFileSync(new URL('../data/varieties.json', import.meta.url), 'utf8')) as any[]).map((v) => slugify(v[0])));
  const { filled, confirmed } = await applyAds(map, keep);
  const summary = `ADS lists: ${map.size} varieties known; updated ${filled}, confirmed ${confirmed}`;
  console.log(summary);
  await t.insert('check_runs', { checked: 0, changes: filled, errors: 0, summary });
}

if (process.argv[1]?.endsWith('ads-import.ts')) main().catch((e) => { console.error(e); process.exit(1); });
