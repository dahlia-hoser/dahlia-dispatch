// Reading a farm's shop. Shopify and WooCommerce both publish their product list as plain data.
import { kindFromTitle, looksLikeDahlia } from '../lib/names';
import { stripHtml, type Hints } from '../lib/guess';

export type Product = {
  key: string;
  title: string;
  url: string;
  price_cents: number | null;
  currency: string;
  in_stock: boolean;
  kind: 'tuber' | 'cutting' | 'other';
  hints?: Hints; // tags and description, used to guess colour and form
};

export type FarmSource = { name: string; site: string; platform: string; collection: string | null };

const HEADERS = {
  'User-Agent': 'HosersDahliaDispatch/0.1 (small Canadian dahlia price tracker; checks a few times a day)',
  Accept: 'application/json',
};
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${url}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new Error(`Not product data at ${url}`);
  return res.json();
}

const base = (site: string) => site.replace(/\/+$/, '');

// ───────── Shopify ─────────
export function parseShopify(products: any[], site: string, collection: string | null): { items: Product[]; unfiltered: number } {
  const all: Product[] = [];
  const dahlia: Product[] = [];
  for (const p of products) {
    const variants: any[] = p.variants ?? [];
    const prices = variants.map((v) => Math.round(parseFloat(v.price) * 100)).filter((n) => !isNaN(n));
    const item: Product = {
      key: String(p.id),
      title: String(p.title ?? '').trim(),
      url: `${base(site)}/products/${p.handle}`,
      price_cents: prices.length ? Math.min(...prices) : null,
      currency: 'CAD',
      in_stock: variants.some((v) => v.available === true),
      kind: kindFromTitle(p.title ?? '', p.product_type ?? '', tagList(p.tags)),
      hints: { tags: [...tagList(p.tags), p.product_type ?? ''], text: stripHtml(String(p.body_html ?? '')) },
    };
    all.push(item);
    if (looksLikeDahlia(item.title, p.product_type ?? '', tagList(p.tags), collection)) dahlia.push(item);
  }
  // A farm that only sells dahlias may never write "dahlia" in titles: keep everything that isn't clearly something else.
  if (!dahlia.length) return { items: all.filter((i) => i.kind !== 'other'), unfiltered: all.length };
  return { items: dahlia, unfiltered: all.length };
}

function tagList(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === 'string') return tags.split(',').map((s) => s.trim());
  return [];
}

export async function readShopify(farm: FarmSource): Promise<Product[]> {
  const path = farm.collection ? `/collections/${farm.collection}/products.json` : '/products.json';
  const raw: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const data = await getJson(`${base(farm.site)}${path}?limit=250&page=${page}`);
    const products = data.products ?? [];
    raw.push(...products);
    if (products.length < 250) break;
    await pause(1500);
  }
  return parseShopify(raw, farm.site, farm.collection).items;
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
    });
  }
  return out;
}

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
export async function detectPlatform(site: string): Promise<'shopify' | 'woocommerce' | null> {
  try {
    const d = await getJson(`${base(site)}/products.json?limit=1`);
    if (Array.isArray(d.products)) return 'shopify';
  } catch {}
  try {
    const d = await getJson(`${base(site)}/wp-json/wc/store/v1/products?per_page=1`);
    if (Array.isArray(d)) return 'woocommerce';
  } catch {}
  return null;
}
