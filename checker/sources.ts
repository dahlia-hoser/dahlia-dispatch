// Reading a farm's shop. Shopify and WooCommerce both publish their product list as plain data.
import { kindFromTitle, looksLikeDahlia, normalize, varietyNameFromTitle } from '../lib/names';
import { stripHtml, type Hints } from '../lib/guess';
import { looksLikeWix } from './wix';

export type Product = {
  key: string;
  title: string;
  url: string;
  price_cents: number | null;
  currency: string;
  in_stock: boolean;
  kind: 'tuber' | 'cutting' | 'plant' | 'mix' | 'other';
  hints?: Hints; // tags and description, used to guess colour and form
  image?: string; // the farm's main product photo (small size), for the review list
};

export type FarmSource = { name: string; site: string; platform: string; collection: string | null };

const HEADERS = {
  'User-Agent': 'HosersDahliaDispatch/0.1 (small Canadian dahlia price tracker; checks a few times a day)',
  Accept: 'application/json',
};
// The checker runs on servers in the US. Shopify shops with several currencies would answer a US
// visitor in US dollars, so every Shopify request asks, as a Canadian shopper would, for Canadian dollars.
const AS_CANADIAN = { Cookie: 'cart_currency=CAD; localization=CA', 'Accept-Language': 'en-CA,en;q=0.8' };
const SHOPIFY_HEADERS = { ...HEADERS, ...AS_CANADIAN };
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getJson(url: string, headers: Record<string, string> = HEADERS): Promise<any> {
  const res = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${url}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new Error(`Not product data at ${url}`);
  return res.json();
}

const base = (site: string) => site.replace(/\/+$/, '');

// ───────── Shopify ─────────
export function parseShopify(products: any[], site: string, collection: string | null): { items: Product[]; unfiltered: number; fellBack: boolean } {
  const all: Product[] = [];
  const dahlia: Product[] = [];
  for (const p of products) {
    const variants: any[] = p.variants ?? [];
    const item: Product = {
      key: String(p.id),
      title: String(p.title ?? '').trim(),
      url: `${base(site)}/products/${p.handle}`,
      price_cents: shopifyPrice(variants),
      currency: 'CAD',
      in_stock: variants.some((v) => v.available === true),
      kind: kindFromTitle(p.title ?? '', p.product_type ?? '', tagList(p.tags)),
      hints: { tags: [...tagList(p.tags), p.product_type ?? ''], text: stripHtml(String(p.body_html ?? '')) },
      image: shopifyImage(p),
    };
    all.push(item);
    if (looksLikeDahlia(item.title, p.product_type ?? '', tagList(p.tags), collection)) dahlia.push(item);
  }
  // A farm that only sells dahlias may never write "dahlia" in titles: keep everything that isn't clearly something else.
  if (!dahlia.length) return { items: all.filter((i) => i.kind !== 'other'), unfiltered: all.length, fellBack: true };
  return { items: dahlia, unfiltered: all.length, fellBack: false };
}

/** First product photo, asked for at a small size so the review page loads fast. */
export function shopifyImage(p: any): string | undefined {
  const src: string | undefined = p.images?.[0]?.src ?? p.image?.src;
  if (!src || !/^https:\/\//.test(src)) return undefined;
  return src + (src.includes('?') ? '&' : '?') + 'width=400';
}

// Options that aren't one ordinary tuber: deposits, cuttings, potted plants, seconds, wholesale, gift wrap…
const ODD_OPTION = /\b(deposit|cuttings?|rooted|potted|plants?|plugs?|seeds?|seconds?|small|mini|wholesale|bulk|gift|wrap|add[- ]?on|pre[- ]?order deposit)\b/i;

// The price a shopper would actually pay: an option they can buy right now, ideally a plain single tuber.
export function shopifyPrice(variants: any[]): number | null {
  const opts = variants
    .map((v) => ({ cents: Math.round(parseFloat(v.price) * 100), title: String(v.title ?? ''), available: v.available === true }))
    .filter((o) => !isNaN(o.cents) && o.cents > 0);
  if (!opts.length) return null;
  const plain = opts.filter((o) => !ODD_OPTION.test(o.title));
  const pool = plain.length ? plain : opts;
  const buyable = pool.filter((o) => o.available);
  return Math.min(...(buyable.length ? buyable : pool).map((o) => o.cents));
}

function tagList(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === 'string') return tags.split(',').map((s) => s.trim());
  return [];
}

async function readAllPages(url: string): Promise<any[]> {
  const raw: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const data = await getJson(`${url}?limit=250&page=${page}&currency=CAD&country=CA`, SHOPIFY_HEADERS);
    const products = data.products ?? [];
    raw.push(...products);
    if (products.length < 250) break;
    await pause(1500);
  }
  return raw;
}

/** Shop collections that hold dahlias, e.g. "tubercules", "dahlia-tubers", "rooted-cuttings". */
export function pickDahliaCollections(collections: { handle: string; title: string }[]): string[] {
  return collections
    .filter((c) => /dahlia|tuber|tubercule|cutting|bouture/i.test(`${c.handle} ${c.title}`))
    .filter((c) => !/tulip|ranunc|anemone-corm|bulb|seed|graine|gift|merch|tool|sweet-?pea|mum|chrys/i.test(`${c.handle} ${c.title}`))
    .map((c) => c.handle);
}

/**
 * Reads a Shopify farm. Products in the farm's own dahlia collections are trusted as dahlias
 * (many farms just write "Wine Eyed Jill" with no "dahlia" anywhere). Products outside those
 * collections are kept only if they look like dahlias.
 */
export async function readShopify(farm: FarmSource, knownNames: Set<string> = new Set()): Promise<Product[]> {
  const root = base(farm.site);
  let handles = (farm.collection ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  if (!handles.length) {
    try {
      const data = await getJson(`${root}/collections.json?limit=250`, SHOPIFY_HEADERS);
      handles = pickDahliaCollections(data.collections ?? []);
    } catch {
      handles = [];
    }
  }
  const byId = new Map<string, Product>();
  for (const h of handles) {
    try {
      const raw = await readAllPages(`${root}/collections/${h}/products.json`);
      for (const p of parseShopify(raw, farm.site, h).items) byId.set(p.key, p);
    } catch {
      /* a collection that has gone away: skip it */
    }
    await pause(1000);
  }
  const all = await readAllPages(`${root}/products.json`);
  const loose = parseShopify(all, farm.site, null);
  // Without any dahlia collection, fall back to everything that isn't clearly something else.
  if (!loose.fellBack || byId.size === 0) for (const p of loose.items) if (!byId.has(p.key)) byId.set(p.key, p);
  // Products outside the dahlia collections that never say "dahlia" (e.g. just "Tangerine Dream"):
  // keep them when the shop is mostly dahlias anyway, or when the name is a dahlia we already know.
  const mostlyDahlias = byId.size > 0 && byId.size >= 0.6 * all.length;
  for (const p of parseShopify(all, farm.site, 'everything').items) {
    if (byId.has(p.key)) continue;
    // Its own description saying daffodil, tulip and so on (and never dahlia) rules it out.
    const text = `${p.hints?.text ?? ''}`;
    if (/\b(?:daffodils?|narcissus|tulips?|hyacinths?|alliums?|ranunculus|peonies|lilies|gladiol(?:us|i))\b/i.test(text) && !/dahlia/i.test(text)) continue;
    if (mostlyDahlias || knownNames.has(normalize(varietyNameFromTitle(p.title)))) byId.set(p.key, p);
  }
  // Which currency the shop actually answered in. Prices in any other currency are not saved.
  const currency = await shopifyCurrency(root);
  return [...byId.values()].map((p) => ({ ...p, currency }));
}

/** The shop's cart says which currency this visitor is being shown. Unknown → assume Canadian. */
export async function shopifyCurrency(root: string): Promise<string> {
  try {
    const cart = await getJson(`${root}/cart.js?currency=CAD&country=CA`, SHOPIFY_HEADERS);
    return typeof cart.currency === 'string' && cart.currency ? cart.currency.toUpperCase() : 'CAD';
  } catch {
    return 'CAD';
  }
}

// ───────── WooCommerce ─────────
export function parseWoo(products: any[]): Product[] {
  const out: Product[] = [];
  for (const p of products) {
    const cats: string[] = (p.categories ?? []).map((c: any) => `${c.name} ${c.slug}`);
    const title = decodeEntities(String(p.name ?? '')).trim();
    if (!looksLikeDahlia(title, '', cats, null) && !cats.some((c) => /dahlia|tubercule/i.test(c))) continue;
    const minor = p.prices?.currency_minor_unit ?? 2;
    const raw = parseInt(p.prices?.price ?? '', 10);
    out.push({
      key: String(p.id),
      title,
      url: p.permalink,
      price_cents: isNaN(raw) ? null : Math.round(raw * Math.pow(10, 2 - minor)),
      currency: p.prices?.currency_code ?? 'CAD',
      in_stock: p.is_in_stock === true && p.is_purchasable !== false,
      kind: kindFromTitle(title, '', cats),
      hints: {
        tags: [...(p.tags ?? []).map((x: any) => String(x.name ?? '')), ...(p.categories ?? []).map((c: any) => String(c.name ?? ''))],
        text: stripHtml(decodeEntities(String(p.short_description ?? '') + ' ' + String(p.description ?? ''))),
      },
      image: httpsOnly(p.images?.[0]?.thumbnail ?? p.images?.[0]?.src),
    });
  }
  return out;
}

const httpsOnly = (u: unknown) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : undefined);

function decodeEntities(s: string) {
  return s
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#038;|&amp;/g, '&')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, '');
}

export async function readWoo(farm: FarmSource): Promise<Product[]> {
  const raw: any[] = [];
  for (let page = 1; page <= 30; page++) {
    const data = await getJson(`${base(farm.site)}/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
    if (!Array.isArray(data)) break;
    raw.push(...data);
    if (data.length < 100) break;
    await pause(1500);
  }
  return parseWoo(raw);
}

/** For farms marked "unknown": try both kinds of shop. */
export async function detectPlatform(site: string): Promise<'shopify' | 'woocommerce' | 'wix' | null> {
  try {
    const d = await getJson(`${base(site)}/products.json?limit=1`);
    if (Array.isArray(d.products)) return 'shopify';
  } catch {}
  try {
    const d = await getJson(`${base(site)}/wp-json/wc/store/v1/products?per_page=1`);
    if (Array.isArray(d)) return 'woocommerce';
  } catch {}
  if (await looksLikeWix(site)) return 'wix';
  return null;
}
