// Turning a farm's product title into a variety name, and matching spellings.

/** Matching form: lower case, no accents, no ® ™ ' ’ quotes, single spaces. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[®™©]/g, '')
    .replace(/[’'`´"“”]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(s: string): string {
  return normalize(s).replace(/[()]/g, '').trim().replace(/\s+/g, '-');
}

// A piece of a title that is shop talk, not part of the variety name.
const JUNK_PART = /^(potted|potted plants?|plants?|plugs?|starts?|live plants?|green plants?|pots?|\d+(\.\d+)?\s*(l|litre|liter|gal|gallon|in|inch|cm)\b.*)$|\*|sold ?out|[ée]puis[ée]|\bsale\b|coming|limit|pre-?order|pr[ée]commande|available|disponible|\bships?\b|shipping|\bnew\b|\bpack\b|clump|division|\bsingle\b|\bonly\b/i;
const STOCK_CODE = /^[A-Z0-9]{2,6}$/; // e.g. "BLMG" in "Black Magic - BLMG"

/** "Dahlia 'Café au Lait' – Tuber (Pre-order)" -> "Café au Lait" */
export function varietyNameFromTitle(title: string): string {
  let t = title.replace(/\s+/g, ' ').trim();
  // Text inside quotes is usually the variety name.
  const quoted = t.match(/(?:^|\s)[‘'"“]([^'’"”]{3,})['’"”](?=\s|$|[-–—,.|:])/);
  if (quoted) t = quoted[1];
  t = t.replace(/[®™]/g, '');
  t = t.replace(/[\u0000-\u001f​-‏￼�]/g, ' ');
  t = t.replace(/\b(dahlias?|dhalias?|dahilas?|dahli)\b/gi, ' ');
  t = t.replace(/\b(rooted )?cuttings?\b|\bboutures?\b/gi, ' ');
  t = t.replace(/\b(tubers?|tubercules?|tubes?|clumps?)\b/gi, ' ');
  t = t.replace(/\b(potted|live|green)\s+plants?\b|\bpotted\b|\bplugs?\b|\b(in a|\d+(\.\d+)?\s*(l|litre|liter|gal|gallon))\s+pots?\b/gi, ' ');
  t = t.replace(/^\s*(de|du|d’|d')\s+/i, '');
  // Drop brackets about the product, keep ones that are part of the name, like "(Double)".
  t = t.replace(/\(([^)]*)\)?/g, (m, inner: string) => (inner.trim() === '' || /pack|limit|tuber|cutting|bouture|pre|clump|single|division|sold|new|\d|only|^\s*(aka|a\.k\.a|also|us|usa|can|ca)\b/i.test(inner) ? ' ' : m));
  const parts = t
    .split(/\s+[-–—|:/]\s*|\s*[-–—|]\s+|:\s+|,\s+/)
    .map((x) => x.replace(/^[-–—|:,/.\s‘“"]+|[-–—|:,/\s’”"]+$/g, '').replace(/^'|'$/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const good = parts.find((x) => !JUNK_PART.test(x) && !STOCK_CODE.test(x));
  return (good ?? parts[0] ?? title).trim();
}

// Products that are not dahlia tubers or cuttings. Checked against the title and product type only.
const NOT_DAHLIA = /gift ?card|carte[- ]cadeau|bouquet|subscription|\bcsa\b|workshop|atelier|\bseeds?\b|graines?|t-?shirt|\bshirt|hoodie|sweater|crewneck|\bhats?\b|\btote|canvas bag|\bmugs?\b|stickers?|shipping|tulipes?|tulips?|narcisses?|renoncules?|\bbulbs?\b|\bcorms?\b|ranunculus|\bsnips?\b|holster|\btags?\b|vinyl|compost|fertili[sz]er|\bsoil\b|bucket of|\bkits?\b|\bbulk\b|mystery (tuber|grab|bag|box|pack)|myst[eè]res?|ensemble de|grab bag|giveaway|cut flower|grower.?s choice|\bmix(ed)?\b|assort|\bnoid\b|value pack|\bcollection\b|gloves|\bvases?\b|twine|labels?\b|\bbooks?\b|chrysanth|\bmums?\b|garlic|peony roots?|sweet ?peas?|lisianthus|snapdragon|agrostemma|corn cockle|breadseed|papaver|\bpoppies\b|\bcosmos\b|delphinium|larkspur|gladiol|zinnia|orlaya|clarkia|lavatera|mignonette|soapwort|forget-me-not|queen anne|lace flower|bunny tails|^\s*pivoines?\b|^\s*an[ée]mones?\s+['‘’"“]|season of|centerpiece|brews/i;

/** tuber, cutting or other (mums, seeds, gift cards, tulip bulbs, tools...). */
export function kindFromTitle(title: string, type = '', tags: string[] = []): 'tuber' | 'cutting' | 'plant' | 'other' {
  if (NOT_DAHLIA.test(`${title} ${type}`)) return 'other';
  if (/\bpotted\b|\bplugs?\b|\b(live|green) plants?\b/i.test(`${title} ${type}`)) return 'plant';
  const all = `${title} ${type} ${tags.join(' ')}`.toLowerCase();
  if (/cutting|bouture/.test(all) && !/tuber|tubercule/.test(`${title} ${type}`.toLowerCase())) return 'cutting';
  return 'tuber';
}

/** Does this product look like a dahlia at all? */
export function looksLikeDahlia(title: string, type = '', tags: string[] = [], collection?: string | null): boolean {
  if (collection) return kindFromTitle(title, type, tags) !== 'other';
  const all = `${title} ${type} ${tags.join(' ')}`.toLowerCase();
  if (kindFromTitle(title, type, tags) === 'other') return false;
  return /dahlia|tuber|tubercule|cutting|bouture/.test(all);
}

function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export type MatchResult =
  | { kind: 'exact'; varietyId: number }
  | { kind: 'close'; varietyId: number; alias: string }
  | { kind: 'new' };

/**
 * aliases: matching-form spelling -> variety id.
 * exact = same spelling after normalizing (also ignores spaces, so Appleblossom = Apple Blossom).
 * close = one or two letters off, or the same apart from one extra word: ask the owner.
 */
/** Spellings farms use interchangeably. */
function canon(n: string) {
  return n.replace(/\bavenue\b/g, 'ave').replace(/\bsaint\b/g, 'st').replace(/\bmount\b/g, 'mt').replace(/\band\b/g, 'n');
}

/**
 * Spellings that only differ in ways farms commonly slip on, safe to merge without asking:
 * spaces and punctuation, a doubled letter (Sanne/Sane), an "s" on the end of a word
 * (KA's/KA, Pinelands/Pineland), -re/-er (Sceptre/Scepter), -our/-or (Splendour/Splendor),
 * -ie/-y (Debbie/Debby) and th/t (Nathalie/Natalie).
 */
export function looseKey(n: string): string {
  return canon(normalize(n))
    .split(' ')
    .map((w) => (w.length > 3 ? w.replace(/s$/, '') : w.replace(/^(\w+)s$/, '$1')))
    .map((w) => w.replace(/re$/, 'er').replace(/our/g, 'or').replace(/ie$/, 'y').replace(/th/g, 't'))
    .join('')
    .replace(/(.)\1+/g, '$1');
}

export function sameEnough(a: string, b: string): boolean {
  return looseKey(a) === looseKey(b);
}

export function matchName(name: string, aliases: Map<string, number>): MatchResult {
  const n = normalize(name);
  const hit = aliases.get(n);
  if (hit != null) return { kind: 'exact', varietyId: hit };
  const loose = looseKey(n);
  for (const [alias, id] of aliases) if (looseKey(alias) === loose) return { kind: 'exact', varietyId: id };
  const squash = canon(n).replace(/\s/g, '');
  let best: { id: number; alias: string; d: number } | null = null;
  for (const [alias, id] of aliases) {
    const sa = canon(alias).replace(/\s/g, '');
    if (sa === squash) return { kind: 'exact', varietyId: id };
    const d = lev(sa, squash);
    const limit = Math.min(2, Math.floor(Math.min(sa.length, squash.length) / 5));
    if (d <= limit && (!best || d < best.d)) best = { id, alias, d };
  }
  if (best) return { kind: 'close', varietyId: best.id, alias: best.alias };
  // "Cornel" vs "Cornel Bronze": one extra word. Ask, never merge automatically.
  for (const [alias, id] of aliases) {
    const a = alias.split(' '), b = n.split(' ');
    if (Math.abs(a.length - b.length) === 1 && Math.min(a.length, b.length) >= 1) {
      const [short, long] = a.length < b.length ? [a, b] : [b, a];
      if (short.every((w, i) => long[i] === w) && short.join('').length >= 5) return { kind: 'close', varietyId: id, alias };
    }
  }
  return { kind: 'new' };
}

/** Title case for a brand-new variety name the farm wrote in capitals. */
export function tidyName(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}
