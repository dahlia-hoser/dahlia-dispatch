// Preview copy of the database (used only when Supabase keys are not set).
import farmsJson from '../data/farms.json';
import varietiesJson from '../data/varieties.json';
import salesJson from '../data/sales.json';
import candidatesJson from '../data/candidates.json';
import manualJson from '../data/manual-listings.json';
import societiesJson from '../data/societies.json';
import farmDetailsJson from '../data/farm-details.json';
import previewListingsJson from '../data/preview-listings.json';
import { normalize, slugify, varietyNameFromTitle } from './names';

type Row = Record<string, any>;

export function buildPreviewTables(): Record<string, Row[]> {
  const now = Date.now();
  let id = 1;
  const farms = (farmsJson as any[]).map((f, i) => ({
    id: id++,
    ...f,
    active: !!f.site,
    last_checked_at: f.site ? new Date(now - (5 + i * 3) * 60000).toISOString() : null,
    last_error: null,
  }));
  for (const d of farmDetailsJson as any[]) {
    const f = farms.find((x) => x.code === d.farm);
    if (f) Object.assign(f, { ships_to: d.ships_to ?? null, ship_window: d.ship_window ?? null, ship_cost: d.ship_cost ?? null, pickup: d.pickup ?? null });
  }
  const farmId = (code: string) => farms.find((f) => f.code === code)!.id;

  const varieties: Row[] = [];
  const aliases: Row[] = [];
  const review: Row[] = [];
  const addVariety = (name: string, c1: string | null, c2: string | null, form: string | null, status: string, aka: string[] = []) => {
    const v = { id: id++, slug: slugify(name), name, colour1: c1, colour2: c2, form, status, notes: null, created_at: new Date(now).toISOString() };
    varieties.push(v);
    aliases.push({ alias: normalize(name), variety_id: v.id, shown: null });
    for (const a of aka) aliases.push({ alias: normalize(a), variety_id: v.id, shown: a });
    return v;
  };
  for (const [n, aka, c1, c2, form, st] of varietiesJson as any[]) {
    addVariety(n, c1, c2, form, st, aka);
    if (st === 'Needs you') review.push({ id: id++, kind: 'details', status: 'open', data: { variety: slugify(n) }, created_at: new Date(now).toISOString() });
  }
  const lookup = (title: string) => {
    const name = varietyNameFromTitle(title);
    const a = aliases.find((x) => x.alias === normalize(name) || x.alias.replace(/\s/g, '') === normalize(name).replace(/\s/g, ''));
    if (a) return a.variety_id;
    const v = addVariety(name, null, null, null, 'Suggested');
    review.push({ id: id++, kind: 'details', status: 'open', data: { variety: v.slug, isNew: true }, created_at: new Date(now).toISOString() });
    return v.id;
  };

  const listings: Row[] = [];
  const iso = new Date(now - 86400000 * 3).toISOString();
  for (const m of manualJson as any[]) {
    const f = farms.find((x) => x.code === m.farm)!;
    listings.push({ id: id++, farm_id: f.id, product_key: 'manual-' + slugify(m.name), variety_id: lookup(m.name), title: m.name, url: f.site, price_cents: m.price == null ? null : m.price * 100, currency: 'CAD', in_stock: false, kind: 'tuber', active: true, first_seen: iso, last_changed: iso });
  }
  for (const m of previewListingsJson as any[]) {
    const f = farms.find((x) => x.code === m.farm)!;
    listings.push({ id: id++, farm_id: f.id, product_key: 'preview-' + slugify(m.title), variety_id: lookup(m.title), title: m.title, url: f.site, price_cents: m.price == null ? null : m.price * 100, currency: 'CAD', in_stock: m.in_stock, kind: 'tuber', active: true, first_seen: iso, last_changed: iso, image: m.image ?? null });
  }

  review.unshift(
    { id: id++, kind: 'name', status: 'open', data: { spelling: 'Bloomquist Allen', farm: 'Longwoods Flower Farm', suggestion: 'bloomquist-alan', note: 'Triple Wren spells it Alan.' }, created_at: new Date(now).toISOString() },
    { id: id++, kind: 'name', status: 'open', data: { spelling: 'Sweet Nathalie', farm: 'Longwoods Flower Farm', suggestion: 'maarn', note: 'Longwoods’ Maarn page web address says “sweet-nathalie”.' }, created_at: new Date(now).toISOString() }
  );

  const candidates = (candidatesJson as any[]).map((c, i) => ({ id: id++, ...c, status: i < 3 ? 'suggested' : 'waiting', suggested_at: i < 3 ? new Date(now).toISOString() : null }));
  for (const c of candidates.slice(0, 3)) review.unshift({ id: id++, kind: 'farm', status: 'open', data: { candidate: c.id }, created_at: new Date(now).toISOString() });

  const sales = (salesJson as any[]).map((s) => ({ id: id++, farm_id: farmId(s.farm), label: s.label, starts_at: s.starts_at, when_text: s.when_text, time_text: s.time_text, url: s.url, note: s.note || null }));

  for (const c of societiesJson as any[]) {
    const f = { id: id++, code: c.code, name: c.name, place: c.place, province: c.province, site: c.site, platform: 'society', collection: null, active: false, last_checked_at: null, last_error: null };
    farms.push(f);
    sales.push({ id: id++, farm_id: f.id, label: c.label, starts_at: null, when_text: c.when_text, time_text: c.time_text, url: c.site, note: c.note });
  }
  return { farms, varieties, aliases, listings, sale_events: sales, review_items: review, farm_candidates: candidates, check_runs: [] };
}
