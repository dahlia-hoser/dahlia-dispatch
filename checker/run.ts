// The stock checker. GitHub runs this every 10 minutes; it only reads the farms that are due.
// Run it yourself with:  npm run check-farms            (farms that are due)
//                        npm run check-farms -- --all   (every farm now)
import { db } from '../lib/db';
import { NameBook, autoAnswerSlips, hideNonDahlias, reconcileNames, syncSocieties } from '../lib/name-ops';
import startingVarieties from '../data/varieties.json';
import { slugify } from '../lib/names';
import societies from '../data/societies.json';
import { detectPlatform, readShopify, readWoo } from './sources';
import { readWix } from './wix';
import { save, weeklyHousekeeping } from './save';
import { whyDue } from './schedule';

const force = process.argv.includes('--all');

async function main() {
  const t = db();
  if (t.preview) {
    console.log('No Supabase keys found (SUPABASE_URL and SUPABASE_SECRET_KEY). Nothing to do.');
    return;
  }
  const now = Date.now();
  const [farms, sales] = await Promise.all([t.all('farms'), t.all('sale_events')]);
  const due = farms.map((f) => ({ f, why: whyDue(f as any, sales as any, now, force) })).filter((x) => x.why);
  console.log(`${due.length} of ${farms.length} farms due.`);

  const added = await syncSocieties(t, societies as any[]);
  if (added) console.log(`Added ${added} clubs and societies to the calendar.`);
  const slips = await autoAnswerSlips(t);
  if (slips) console.log(`Merged ${slips} small spelling slips without asking.`);
  const book = await new NameBook(t).load();
  const keep = new Set((startingVarieties as any[]).map((v) => slugify(v[0])));
  const fixed = await reconcileNames(t, book, keep);
  if (fixed.moved || fixed.removed) console.log(`Tidied names: moved ${fixed.moved} listings, removed ${fixed.removed} empty varieties.`);
  let changes = 0, errors = 0;
  const notes: string[] = [];

  for (const { f, why } of due) {
    try {
      let platform = f.platform;
      if (platform === 'unknown') {
        const found = await detectPlatform(f.site);
        await t.update('farms', { id: f.id }, { last_checked_at: new Date().toISOString(), last_error: found ? null : 'Shop type not recognised; may need a price list.' });
        if (!found) { notes.push(`${f.name}: shop type not found`); continue; }
        platform = found;
        await t.update('farms', { id: f.id }, { platform });
        notes.push(`${f.name}: found a ${platform} shop`);
      }
      const src = { name: f.name, site: f.site, platform, collection: f.collection };
      let products, allKeys: string[] | undefined;
      if (platform === 'wix') {
        const known = new Set((await t.where('listings', { farm_id: f.id })).map((l) => String(l.product_key)));
        ({ products, allKeys } = await readWix(src, { known, perRun: why === 'sale day' ? 150 : 80 }));
      } else products = platform === 'woocommerce' ? await readWoo(src) : await readShopify(src);
      const n = await save(t, book, f, products, allKeys);
      changes += n;
      await t.update('farms', { id: f.id }, { last_checked_at: new Date().toISOString(), last_error: null });
      console.log(`✓ ${f.name} (${why}): ${products.length} listings, ${n} changes`);
    } catch (e: any) {
      errors++;
      const msg = String(e?.message ?? e).slice(0, 300);
      await t.update('farms', { id: f.id }, { last_error: msg });
      console.log(`✗ ${f.name}: ${msg}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  const hiddenCount = await hideNonDahlias(t);
  if (hiddenCount) console.log(`Hid ${hiddenCount} things that aren't dahlias.`);
  await weeklyHousekeeping(t, now);

  if (due.length) {
    await t.insert('check_runs', {
      checked: due.length,
      changes,
      errors,
      summary: [`${book.created} new varieties`, `${book.questions} name questions`, ...notes].join('; '),
    });
  }
  console.log(`Done: ${changes} changes, ${errors} errors, ${book.created} new varieties, ${book.questions} questions for the review list.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
