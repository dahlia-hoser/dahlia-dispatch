// Prints a summary of what the checker found, for checking name quality. Run: npx tsx scripts/report.ts
import { db } from '../lib/db';

async function main() {
  const t = db();
  const [farms, varieties, listings, review, aliases] = await Promise.all([t.all('farms'), t.all('varieties'), t.all('listings'), t.all('review_items'), t.all('aliases')]);
  const farmName = new Map(farms.map((f) => [f.id, f.code]));
  console.log('=== FARMS ===');
  for (const f of farms) console.log(`${f.code}\t${f.platform}\t${f.active}\t${listings.filter((l) => l.farm_id === f.id).length}\t${f.last_error ?? ''}`);
  console.log('=== LISTINGS (farm | kind | in stock | price | title -> variety) ===');
  const vName = new Map(varieties.map((v) => [v.id, v.name]));
  for (const l of listings) console.log(`${farmName.get(l.farm_id)}|${l.kind}|${l.in_stock ? 'Y' : 'N'}|${l.price_cents ?? ''}|${l.title} -> ${l.variety_id ? vName.get(l.variety_id) : '(waiting)'}`);
  console.log('=== NAME QUESTIONS ===');
  for (const r of review.filter((r) => r.kind === 'name' && r.status === 'open')) console.log(`${r.data.spelling} ?= ${r.data.suggestion} (${r.data.farm})`);
  console.log(`=== ${varieties.filter((v) => v.colour1).length} with a colour, ${varieties.filter((v) => v.form).length} with a form ===`);
  console.log(`=== ${varieties.length} varieties, ${aliases.length} aliases, ${review.filter((r) => r.status === 'open').length} open review items ===`);
}
main().catch((e) => { console.error(e); process.exit(1); });
