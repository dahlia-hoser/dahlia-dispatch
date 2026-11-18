// The stock checker. GitHub runs this every 10 minutes; it only reads the farms that are due.
// Run it yourself with:  npm run check-farms            (farms that are due)
//                        npm run check-farms -- --all   (every farm now)
import { db } from '../lib/db';
import { NameBook, autoAnswerSlips, hideNonDahlias, reconcileNames, syncSocieties, tidyForms, applyOwnerDecisions, applyFormSplits, blockFarms, syncFarmSources, tidyEmojiNames } from '../lib/name-ops';
import decisions from '../data/owner-decisions.json';
import formSplits from '../data/form-splits.json';
import farmList from '../data/farms.json';
import blockedFarms from '../data/blocked-farms.json';
import trusted from '../data/trusted-sources.json';
import { applyTrustedDetails, applyIntroYears, syncFarmDetails, confirmWhenFarmsAgree } from '../lib/name-ops';
import farmDetails from '../data/farm-details.json';
import { refreshShipping } from './shipping-read';
import startingVarieties from '../data/varieties.json';
import { slugify } from '../lib/names';
import societies from '../data/societies.json';
import { pauseIfNotCanadian } from './canada-check';
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

  // Update 2 columns exist only after supabase/update-2.sql has been run.
  const v2 = await t.probe('farms', 'ships_to');
  if (!v2) console.log('Note: run supabase/update-2.sql in Supabase to turn on shipping details and new-introduction tracking.');
  const v3 = await t.probe('listings', 'image');
  if (!v3) console.log('Note: run supabase/update-3.sql in Supabase to turn on farm photos in the review list.');
  if (v2) await syncFarmDetails(t, farmDetails as any[]);
  const added = await syncSocieties(t, societies as any[]);
  if (added) console.log(`Added ${added} clubs and societies to the calendar.`);
  await applyOwnerDecisions(t, decisions as any[]);
  for (const name of await syncFarmSources(t, farmList as any[])) console.log(`${name}: now read straight from its shop.`);
  const blockedNow = await blockFarms(t, blockedFarms as any[]);
  if (blockedNow) console.log(`Removed ${blockedNow} farms or suggestions you ruled out.`);
  const split = await applyFormSplits(t, formSplits as any[]);
  if (split) console.log(`Narrowed ${split} Decorative varieties to formal or informal.`);
  const unemoji = await tidyEmojiNames(t, v2);
  if (unemoji) console.log(`Took emoji and flags out of ${unemoji} variety names.`);
  const reformed = await tidyForms(t);
  if (reformed) console.log(`Updated ${reformed} varieties to the new form list.`);
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
        ({ products, allKeys } = await readWix(src, { known, knownNames: new Set(book.aliases.keys()), perRun: why === 'sale day' ? 150 : 80 }));
      } else products = platform === 'woocommerce' ? await readWoo(src) : await readShopify(src, new Set(book.aliases.keys()));
      const odd = products.find((p) => p.currency && p.currency.toUpperCase() !== 'CAD');
      if (odd) {
        notes.push(`${f.name}: shop answered in ${odd.currency}, prices left blank`);
        console.log(`! ${f.name}: the shop answered in ${odd.currency}, so its prices were left blank rather than shown wrong.`);
      }
      if (await pauseIfNotCanadian(t, f, platform, products)) {
        notes.push(`${f.name}: paused, shop isn't in Canada`);
        console.log(`✗ ${f.name}: paused, its shop says it isn't in Canada.`);
        continue;
      }
      const n = await save(t, book, f, products, allKeys, v2, v3);
      if (v2) {
        const intros = await applyIntroYears(t, f.id, products);
        if (intros) console.log(`  ${f.name}: ${intros} new introductions spotted.`);
      }
      const trust = (trusted as any[]).find((x) => x.farm === f.code);
      if (trust) {
        const updated = await applyTrustedDetails(t, f as any, products, trust.fields);
        if (updated) console.log(`  ${f.name}: used its labels for ${updated} varieties (${trust.fields.join(', ')}).`);
      }
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

  if (v2) for (const note of await refreshShipping(t, 3)) console.log(`Shipping: ${note}`);
  if (v2) {
    const agreed = await confirmWhenFarmsAgree(t);
    if (agreed) console.log(`Confirmed ${agreed} varieties where farms agree on the colour.`);
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
