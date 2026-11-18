// Before saving a farm's listings, make sure its shop is in Canada.
import type { Tables } from '../lib/db';
import { shopVerdict } from '../lib/canada';
import { getJson, type Product } from './sources';

export async function shopCountry(site: string, platform: string, products: Product[]): Promise<{ country: string | null; currency: string | null }> {
  if (platform === 'shopify') {
    try {
      const m = await getJson(`${site.replace(/\/+$/, '')}/meta.json`);
      return { country: m.country ?? m.country_code ?? null, currency: m.currency ?? null };
    } catch {
      /* fall back to prices below */
    }
  }
  const currencies = new Set(products.map((p) => p.currency).filter(Boolean));
  return { country: null, currency: currencies.size === 1 ? [...currencies][0] : null };
}

/** Pauses a farm whose shop says it's outside Canada. Returns true if paused. */
export async function pauseIfNotCanadian(t: Tables, farm: any, platform: string, products: Product[]): Promise<boolean> {
  if (farm.platform === 'manual' || farm.platform === 'society' || !farm.site) return false;
  const { country, currency } = await shopCountry(farm.site, platform, products);
  if (shopVerdict(country, currency) !== 'not') return false;
  const where = [country && `country ${country}`, currency && `prices in ${currency}`].filter(Boolean).join(', ');
  await t.update('farms', { id: farm.id }, { active: false, last_error: `Paused: the shop says it isn't in Canada (${where}).` });
  for (const l of await t.where('listings', { farm_id: farm.id })) if (l.active) await t.update('listings', { id: l.id }, { active: false, in_stock: false });
  const already = (await t.where('review_items', { kind: 'feedback' })).some((r) => r.data?.pausedFarm === farm.id);
  if (!already) {
    await t.insert('review_items', {
      kind: 'feedback',
      data: {
        pausedFarm: farm.id,
        message: `Paused ${farm.name}: its shop says it isn't in Canada (${where}). It's hidden from the site. If that's wrong, tell Claude and it can be switched back on.`,
        contact: null,
        page: farm.site,
      },
    });
  }
  return true;
}
