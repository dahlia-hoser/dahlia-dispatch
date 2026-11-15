// Builds supabase/seed.sql from the files in data/. Run: npx tsx scripts/make-seed.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { normalize, slugify } from '../lib/names';

const read = (f: string) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const farms = read('farms.json');
const varieties: [string, string[], string | null, string | null, string | null, string][] = read('varieties.json');
const sales = read('sales.json');
const candidates = read('candidates.json');
const manual = read('manual-listings.json');

const q = (v: unknown) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const out: string[] = ['-- Starting data. Paste into Supabase > SQL Editor after schema.sql, then Run.', 'begin;'];

out.push('insert into farms (code, name, place, province, site, platform, collection, active) values');
out.push(
  farms
    .map((f: any) => `  (${q(f.code)}, ${q(f.name)}, ${q(f.place)}, ${q(f.province)}, ${q(f.site)}, ${q(f.platform)}, ${q(f.collection)}, ${f.site ? 'true' : 'false'})`)
    .join(',\n') + '\non conflict (code) do nothing;'
);

out.push('insert into varieties (slug, name, colour1, colour2, form, status) values');
out.push(
  varieties.map(([n, , c1, c2, form, st]) => `  (${q(slugify(n))}, ${q(n)}, ${q(c1)}, ${q(c2)}, ${q(form)}, ${q(st)})`).join(',\n') +
    '\non conflict (slug) do nothing;'
);

const aliasRows: string[] = [];
for (const [n, aka] of varieties) {
  aliasRows.push(`  (${q(normalize(n))}, (select id from varieties where slug = ${q(slugify(n))}), null)`);
  for (const a of aka) aliasRows.push(`  (${q(normalize(a))}, (select id from varieties where slug = ${q(slugify(n))}), ${q(a)})`);
}
out.push('insert into aliases (alias, variety_id, shown) values');
out.push(aliasRows.join(',\n') + '\non conflict (alias) do nothing;');

out.push('insert into sale_events (farm_id, label, starts_at, when_text, time_text, url, note) values');
out.push(
  sales
    .map((s: any) => `  ((select id from farms where code = ${q(s.farm)}), ${q(s.label)}, ${q(s.starts_at)}, ${q(s.when_text)}, ${q(s.time_text)}, ${q(s.url)}, ${q(s.note || null)})`)
    .join(',\n') + ';'
);

out.push('insert into farm_candidates (name, place, province, site, platform) values');
out.push(candidates.map((c: any) => `  (${q(c.name)}, ${q(c.place)}, ${q(c.province)}, ${q(c.site)}, ${q(c.platform)})`).join(',\n') + '\non conflict (name) do nothing;');

out.push('insert into listings (farm_id, product_key, variety_id, title, url, price_cents, in_stock, kind) values');
out.push(
  manual
    .map((m: any) => {
      const f = farms.find((x: any) => x.code === m.farm);
      return `  ((select id from farms where code = ${q(m.farm)}), ${q('manual-' + slugify(m.name))}, (select variety_id from aliases where alias = ${q(normalize(m.name))}), ${q(m.name)}, ${q(f.site)}, ${m.price == null ? 'null' : Math.round(m.price * 100)}, false, 'tuber')`;
    })
    .join(',\n') + '\non conflict (farm_id, product_key) do nothing;'
);

// First questions for the review list.
const review: [string, object][] = [
  ['name', { spelling: 'Bloomquist Allen', farm: 'Longwoods Flower Farm', suggestion: 'bloomquist-alan', note: 'Triple Wren spells it Alan.' }],
  ['name', { spelling: 'Sweet Nathalie', farm: 'Longwoods Flower Farm', suggestion: 'maarn', note: 'Longwoods’ Maarn page web address says “sweet-nathalie”.' }],
];
for (const [n, , , , , st] of varieties) if (st === 'Needs you') review.push(['details', { variety: slugify(n) }]);
out.push('insert into review_items (kind, data) values');
out.push(review.map(([k, d]) => `  (${q(k)}, ${q(JSON.stringify(d))}::jsonb)`).join(',\n') + ';');

out.push('commit;');
writeFileSync(new URL('../supabase/seed.sql', import.meta.url), out.join('\n') + '\n');
console.log('Wrote supabase/seed.sql');
