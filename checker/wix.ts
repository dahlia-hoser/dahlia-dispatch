// Reading a Wix farm shop (Beneficial Meadows, Ferme Florale Boxland, Singing Meadows).
// Wix has no product list to download, so: the site map lists every product page, and each
// product page carries its price and stock in its page tags. Big shops are read in turns,
// a slice per run, so no farm gets hundreds of visits an hour.
import { kindFromTitle } from '../lib/names';
import { stripHtml } from '../lib/guess';
import type { FarmSource, Product } from './sources';

const HEADERS = {
  'User-Agent': 'HosersDahliaDispatch/0.1 (small Canadian dahlia price tracker; checks a few times a day)',
  Accept: 'text/html,application/xml;q=0.9,*/*;q=0.8',
};
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const base = (site: string) => site.replace(/\/+$/, '');

async function getText(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${url}`);
  return res.text();
}

export function isWixPage(html: string): boolean {
  return /Wix\.com Website Builder|static\.wixstatic\.com|wix-warmup-data/i.test(html);
}

export function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
}

/** Every product page address, from the site map (or, failing that, the shop pages). */
export async function productUrls(site: string): Promise<string[]> {
  const root = base(site);
  const found = new Set<string>();
  try {
    const index = locs(await getText(`${root}/sitemap.xml`));
    const productMaps = index.filter((u) => /store-products|product/i.test(u));
    for (const m of productMaps) {
      for (const u of locs(await getText(m))) if (/\/product-page\//.test(u)) found.add(u.split('?')[0]);
      await pause(500);
    }
  } catch {
    /* fall through */
  }
  return [...found].sort();
}

const meta = (html: string, prop: string) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop.replace(/[:.]/g, '\\$&')}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop.replace(/[:.]/g, '\\$&')}["']`, 'i');
  const m = html.match(re);
  return m ? (m[1] ?? m[2] ?? '').trim() : '';
};

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** One product page -> product. Returns null if it isn't a product page. */
export function parseWixProduct(html: string, url: string): Product | null {
  const price = meta(html, 'product:price:amount');
  const availability = meta(html, 'og:availability') || meta(html, 'product:availability');
  let title = decode(meta(html, 'og:title'));
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) title = decode(stripHtml(h1[1])) || title;
  title = title.replace(/\s*\|\s*[^|]+$/, '').trim(); // "A La Mode | Beneficial Meadows" -> "A La Mode"
  if (!title || (!price && !availability)) return null;
  const description = decode(meta(html, 'og:description'));
  const cents = Math.round(parseFloat(price) * 100);
  return {
    key: url.replace(/^.*\/product-page\//, '').replace(/\/$/, ''),
    title,
    url,
    price_cents: isNaN(cents) ? null : cents,
    currency: meta(html, 'product:price:currency') || 'CAD',
    in_stock: /instock|in stock|preorder/i.test(availability),
    kind: kindFromTitle(title),
    hints: { tags: [], text: description },
    image: /^https:\/\//.test(meta(html, 'og:image')) ? meta(html, 'og:image') : undefined,
  };
}

/** Which slice of a big shop to read this hour. */
export function sliceForThisRun(urls: string[], perRun: number, now = Date.now()): string[] {
  if (urls.length <= perRun) return urls;
  const slices = Math.ceil(urls.length / perRun);
  const i = Math.floor(now / 3600000) % slices;
  return urls.slice(i * perRun, (i + 1) * perRun);
}

export async function readWix(farm: FarmSource, opts: { perRun?: number; known?: Set<string> } = {}): Promise<{ products: Product[]; allKeys: string[] }> {
  const urls = await productUrls(farm.site);
  if (!urls.length) throw new Error('No product pages found in the Wix site map.');
  const keyOf = (u: string) => u.replace(/^.*\/product-page\//, '').replace(/\/$/, '');
  // Pages we've never read come first, then this hour's slice of the rest.
  const unseen = urls.filter((u) => !opts.known?.has(keyOf(u)));
  const perRun = opts.perRun ?? 80;
  const pick = [...new Set([...unseen.slice(0, perRun), ...sliceForThisRun(urls.filter((u) => !unseen.includes(u)), perRun)])];
  const products: Product[] = [];
  for (const u of pick) {
    try {
      const p = parseWixProduct(await getText(u), u);
      if (p) products.push(p);
    } catch {
      /* one bad page doesn't stop the rest */
    }
    await pause(800);
  }
  // Wix shops can sell seeds and other flowers too: keep products that mention dahlias,
  // unless none do (then the farm only sells dahlias and doesn't say so).
  const dahlia = products.filter((p) => p.kind !== 'other' && /dahlia|tuber|tubercule|bouture|cutting/i.test(`${p.title} ${p.hints?.text ?? ''}`));
  const kept = dahlia.length ? dahlia : products.filter((p) => p.kind !== 'other');
  return { products: kept, allKeys: urls.map(keyOf) };
}

export async function looksLikeWix(site: string): Promise<boolean> {
  try {
    return isWixPage(await getText(base(site)));
  } catch {
    return false;
  }
}
