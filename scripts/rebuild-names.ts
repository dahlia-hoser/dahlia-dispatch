// One-off clean-up: forget what the checker saved from farm shops, keep the owner's own data,
// so the next full check rebuilds listings and variety names with the improved cleaning.
// Keeps: farms, sale dates, the 49 starting varieties, anything Confirmed, answered review items,
// hand-entered price lists, and farm suggestions.
import { readFileSync } from 'node:fs';
import { db } from '../lib/db';
import { slugify } from '../lib/names';

async function main() {
  const t = db();
  if (t.preview) throw new Error('Needs SUPABASE_URL and SUPABASE_SECRET_KEY');
  const seed = new Set((JSON.parse(readFileSync(new URL('../data/varieties.json', import.meta.url), 'utf8')) as any[]).map((v) => slugify(v[0])));

  const farms = await t.all('farms');
  const listings = await t.all('listings');
  const fromShops = listings.filter((l) => !String(l.product_key).startsWith('manual-')).map((l) => l.id);
  await t.removeIn('listings', 'id', fromShops);
  console.log(`Removed ${fromShops.length} shop listings.`);

  const varieties = await t.all('varieties');
  const drop = varieties.filter((v) => !seed.has(v.slug) && v.status !== 'Confirmed');
  const dropIds = drop.map((v) => v.id);
  const dropSlugs = new Set(drop.map((v) => v.slug));
  await t.removeIn('aliases', 'variety_id', dropIds);
  const review = await t.all('review_items');
  const reviewDrop = review
    .filter((r) => r.status !== 'done')
    .filter((r) => (r.kind === 'details' && dropSlugs.has(r.data?.variety)) || (r.kind === 'name' && !r.data?.note))
    .map((r) => r.id);
  await t.removeIn('review_items', 'id', reviewDrop);
  await t.removeIn('varieties', 'id', dropIds);
  console.log(`Removed ${dropIds.length} checker-made varieties and ${reviewDrop.length} unanswered questions.`);

  for (const f of farms) if (f.platform !== 'manual') await t.update('farms', { id: f.id }, { last_checked_at: null });
  console.log('Ready for a full check.');
}
main().catch((e) => { console.error(e); process.exit(1); });
