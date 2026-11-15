// Once a month per farm: read its shipping or FAQ page and fill in blank shipping details.
import type { Tables } from '../lib/db';
import { extractShipping, SHIPPING_PAGES, type ShippingInfo } from '../lib/shipping';
import { stripHtml } from '../lib/guess';

async function getText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'HosersDahliaDispatch/0.1 (Canadian dahlia tracker)' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('html')) return null;
    return stripHtml((await res.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' '));
  } catch {
    return null;
  }
}

export async function readShippingPages(site: string): Promise<ShippingInfo> {
  const found: ShippingInfo = {};
  const root = site.replace(/\/+$/, '');
  for (const path of SHIPPING_PAGES) {
    const text = await getText(root + path);
    if (text && text.length > 200) {
      const info = extractShipping(text);
      for (const [k, v] of Object.entries(info)) if (v && !(found as any)[k]) (found as any)[k] = v;
    }
    await new Promise((r) => setTimeout(r, 600));
    if (found.ships_to && found.ship_window && found.ship_cost && found.pickup) break;
  }
  return found;
}

/** Checks up to `max` farms whose shipping details are over a month old. */
export async function refreshShipping(t: Tables, max = 3): Promise<string[]> {
  const month = 30 * 86400000;
  const due = (await t.all('farms'))
    .filter((f) => f.active && f.site && f.platform !== 'society' && (!f.shipping_checked_at || Date.now() - new Date(f.shipping_checked_at).getTime() > month))
    .slice(0, max);
  const notes: string[] = [];
  for (const f of due) {
    const info = await readShippingPages(f.site);
    const patch: Record<string, any> = { shipping_checked_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(info)) if (v && !f[k]) patch[k] = v;
    await t.update('farms', { id: f.id }, patch);
    const filled = Object.keys(patch).filter((k) => k !== 'shipping_checked_at');
    notes.push(`${f.name}: ${filled.length ? 'found ' + filled.join(', ') : 'no new shipping details'}`);
  }
  return notes;
}
