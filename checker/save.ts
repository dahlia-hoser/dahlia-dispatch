// Saving what the checker read, and the weekly review-list housekeeping.
import type { Tables } from '../lib/db';
import type { NameBook } from '../lib/name-ops';
import type { Product } from './sources';

/** Saves one farm's listings. Returns how many changed. */
/** allKeys: every product the shop has, when only some were read this time (Wix). */
export async function save(t: Tables, book: NameBook, farm: any, products: Product[], allKeys?: string[]): Promise<number> {
  const existing = await t.where('listings', { farm_id: farm.id });
  const byKey = new Map(existing.map((l) => [l.product_key, l]));
  const now = new Date().toISOString();
  let changed = 0;
  const seen = new Set<string>();
  const fresh: Record<string, any>[] = []; // new listings, saved together below (much faster)

  for (const p of products) {
    seen.add(p.key);
    const old = byKey.get(p.key);
    if (!old) {
      const variety_id = p.kind === 'other' ? null : await book.resolve(p.title, farm.name, p.hints);
      fresh.push({
        farm_id: farm.id, product_key: p.key, variety_id, title: p.title, url: p.url,
        price_cents: p.price_cents, currency: p.currency, in_stock: p.in_stock, kind: p.kind,
        active: true, first_seen: now, last_seen: now, last_changed: now,
      });
      changed++;
      continue;
    }
    const differs = old.title !== p.title || old.kind !== p.kind || old.price_cents !== p.price_cents || old.in_stock !== p.in_stock || !old.active || old.url !== p.url;
    if (!differs) continue; // only write when something changed, to keep the checker quick
    const patch: Record<string, any> = { title: p.title, url: p.url, price_cents: p.price_cents, in_stock: p.in_stock, kind: p.kind, active: true, last_seen: now, last_changed: now };
    if (old.title !== p.title && old.variety_id == null && p.kind !== 'other') patch.variety_id = await book.resolve(p.title, farm.name, p.hints);
    await t.update('listings', { id: old.id }, patch);
    changed++;
  }

  for (let i = 0; i < fresh.length; i += 200) await t.insert('listings', fresh.slice(i, i + 200));

  // Listings that disappeared from the shop. If the shop suddenly returns nothing, assume a hiccup and keep them.
  if (products.length > 0 || existing.length === 0) {
    for (const l of existing) {
      const stillThere = allKeys ? allKeys.includes(l.product_key) : seen.has(l.product_key);
      if (!stillThere && l.active && !String(l.product_key).startsWith('manual-')) {
        await t.update('listings', { id: l.id }, { active: false, in_stock: false, last_changed: now });
        changed++;
      }
    }
  }
  return changed;
}

/** Once a week: three farm suggestions for the review list. "Ask me later" items come back after a week. */
export async function weeklyHousekeeping(t: Tables, now: number) {
  const week = 7 * 86400000;
  const review = await t.all('review_items');
  for (const r of review) {
    if (r.status === 'later' && r.resolved_at && now - new Date(r.resolved_at).getTime() > week) {
      await t.update('review_items', { id: r.id }, { status: 'open', resolved_at: null });
    }
  }
  const candidates = await t.all('farm_candidates');
  const lastSuggested = Math.max(0, ...candidates.map((c) => (c.suggested_at ? new Date(c.suggested_at).getTime() : 0)));
  if (now - lastSuggested < week) return;
  const n = await suggestFarms(t, 3, now);
  if (n) console.log(`Suggested ${n} farms for the review list.`);
}

/** Puts the next few waiting farms on the review list. Used weekly, and by the "Suggest more" button. */
export async function suggestFarms(t: Tables, count: number, now = Date.now()): Promise<number> {
  const candidates = await t.all('farm_candidates');
  const pick = candidates.filter((c) => c.status === 'waiting').sort((a, b) => a.id - b.id).slice(0, count);
  for (const c of pick) {
    await t.update('farm_candidates', { id: c.id }, { status: 'suggested', suggested_at: new Date(now).toISOString() });
    await t.insert('review_items', { kind: 'farm', data: { candidate: c.id } });
  }
  return pick.length;
}

