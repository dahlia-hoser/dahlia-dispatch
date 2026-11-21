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
/** Emoji and flags farms add to titles ("Letterkenny Wayne 🇨🇦"): not part of the name. */
export const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}]/gu;
export const stripEmoji = (s: string) => s.replace(EMOJI, ' ').replace(/\s+/g, ' ').trim();
/** A farm marking a dahlia Canadian with a flag or maple leaf. */
export const hasCanadaMark = (s: string) => /🇨🇦|🍁/u.test(s);

export function varietyNameFromTitle(title: string): string {
  let t = stripEmoji(title);
  t = t.replace(/\s+(?:NEW!?|New!|\*\s*new\s*\*)\s*$/i, '').trim(); // shop badge, not part of the name
  // Text inside quotes is usually the variety name.
  const quoted = t.match(/(?:^|\s)[‘'"“]([^'’"”]{3,})['’"”](?=\s|$|[-–—,.|:])/);
  if (quoted) t = quoted[1];
  t = t.replace(/[®™]/g, '');
  t = t.replace(/[\u0000-\u001f​-‏￼�]/g, ' ');
  t = t.replace(/\b(dahlias?|dhalias?|dahilas?|dahli)\b/gi, ' ');
  t = t.replace(/\bbulk(?:\s+(?:pack|lot|order|buy))?\b|\b\d{1,2}\s*-?\s*(?:pack|pk|pcs|count|ct)\b|\bpack\s*(?:of\s*)?\d{1,2}\b|(?:^|\s)x\s?\d{1,2}\b|\b\d{1,2}\s?x(?=\s|$)|\b\d{1,2}\s*(?:tubers|tubercules|cuttings|boutures|clumps)\b|\b(?:two|three|four|five|six|ten)[- ]pack\b/gi, ' ');
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
const NOT_DAHLIA = /^\s*anemones?\b(?![\s-]*(?:flowered|dahlia))(?!.*\bdahlia)|\banemone\s+(?:carmel|mistral|galil|meron|full\s*of\s*fun)\b|\b(?:arch|arches|arbou?rs?|trellis(?:es)?|obelisks?|netting|stakes?|supports?|support rings?|rentals?|flower walls?|backdrops?|gift baskets?|baskets? of)\b|\bvarieties\s*$|^\s*(?:ball|pompon|water\s?lily|waterlily|decorative|cactus|semi-cactus|collarette|anemone|single|stellar|orchid|peony|dinnerplate|novelty|mixed)\s+dahlias?\s*$|\bdaffodils?\b|\bnarcissus\b|\bnarcissi\b|\bjonquils?\b|\bhyacinths?\b|\bmuscari\b|\balliums?\b|\bcrocus(?:es)?\b|\bfritillari(?:a|as)\b|\bwreaths?\b|\bgarlands?\b|\bswags?\b|\bcent(?:er|re)pieces?\b|\bdried (?:flowers?|florals?|bouquets?)\b|\bkissing balls?\b|\bdoor hangers?\b|\bornaments?\b|\bcandles?\b|flower buckets?|buckets? of (?:cut |fresh )?(?:flowers|blooms|stems)|\b(?:cut|fresh|bulk) flowers?\b|\b\d+\s*stems\b|gift ?card|carte[- ]cadeau|bouquet|subscription|\bcsa\b|workshop|atelier|\bseeds?\b|graines?|t-?shirt|\bshirt|hoodie|sweater|crewneck|\bhats?\b|\btote|canvas bag|\bmugs?\b|stickers?|shipping|tulipes?|tulips?|narcisses?|renoncules?|\bbulbs?\b|\bcorms?\b|ranunculus|\bsnips?\b|holster|\btags?\b|vinyl|compost|fertili[sz]er|\bsoil\b|giveaway|cut flower|gloves|\bvases?\b|twine|labels?\b|\bbooks?\b|chrysanth|\bmums?\b|garlic|peony roots?|sweet ?peas?|lisianthus|snapdragon|agrostemma|corn cockle|breadseed|papaver|\bpoppies\b|\bcosmos\b|delphinium|larkspur|gladiol|zinnia|orlaya|clarkia|lavatera|mignonette|soapwort|forget-me-not|queen anne|lace flower|bunny tails|^\s*pivoines?\b|^\s*an[ée]mones?\s+['‘’"“]|season of|centerpiece|brews|\bbare ?roots?\b|^\s*peony\s|\bbrush(?:es)?\b|\bstamps?\b|stazon|\bink (?:pad|refill)|sizing ring|corsage|\b(?:you|u)-?pick\b|\bfarm tours?\b|\byoga\b|important info|graduation|groceries|^\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/i;

// Mixed, curated and mystery packs: not one variety, so they live on the Rainbows & Roulette page.
const MIX = /\b(?:white|cream|yellow|orange|peach|pink|blush|red|burgundy|purple|lavender|pastel|bright|autumn|fall|farmer.?s|our)\s+(?:favou?rites?|faves)\b|\bfavou?rites\b|bucket of|\bkits?\b|\bbulk (?:dahlias?|tubers?)\b|\bmystery (tubers?|grab|bag|box|pack|dahlias?|mix)\b|\bdahlia mystery\b|myst[eè]res\b|ensemble de|grab bag|grower.?s choice|\bmix(ed|es)?\b|assort|\bnoid\b|\bno[- ]?id\b|value pack|\bcollection\b|surprise (pack|bag|box|tubers?)|lucky dip|\bbundle\b|sampler|unlabel+ed|un-?named|\brainbow pack\b|^\s*random\s*$/i;

/** tuber, cutting, potted plant, mixed pack, or other (mums, seeds, gift cards, tulip bulbs, tools...). */
/** Other flowers farms tag their products with. */
const SPRING_BULB = /\b(?:daffodils?|narcissus|narcissi|jonquils?|tulips?|hyacinths?|alliums?|crocus(?:es)?|muscari|ranunculus|anemones?|irises|iris|peonies|lil(?:y|ies)|gladiol(?:us|i)|sweet peas?|garlic)\b/i;

export function kindFromTitle(title: string, type = '', tags: string[] = []): 'tuber' | 'cutting' | 'plant' | 'mix' | 'other' {
  if (NOT_DAHLIA.test(`${title} ${type}`)) return 'other';
  // A farm's tags can give it away too ("Pink Charm" tagged Daffodil), unless they also say dahlia.
  const tagText = tags.join(' ');
  if (tagText && !/dahlia/i.test(`${title} ${type} ${tagText}`) && SPRING_BULB.test(tagText)) return 'other';
  if (MIX.test(title)) return 'mix';
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

/** How many tubers or cuttings a listing is for: "(5 Pack)", "3-pack", "Pack of 3", "x3", "3 tubers". 1 if not a pack. */
export function packSize(title: string): number {
  const t = title.toLowerCase();
  const m =
    t.match(/\b(\d{1,2})\s*-?\s*(?:pack|pk|pcs|pieces|count|ct)\b/) ||
    t.match(/\bpack\s*(?:of\s*)?(\d{1,2})\b/) ||
    t.match(/\b(\d{1,2})\s*(?:tubers|tubercules|cuttings|boutures|clumps)\b/) ||
    t.match(/(?:^|\s)x\s?(\d{1,2})\b|\b(\d{1,2})\s?x(?:\s|$)/) ||
    t.match(/\b(two|three|four|five|six|ten)[- ]pack\b/);
  if (!m) return 1;
  const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10 };
  const raw = m[1] ?? m[2];
  const n = words[raw] ?? Number(raw);
  return n >= 2 && n <= 50 ? n : 1;
}

/** "Bulk Nicholas": several tubers of one variety, count not always given. */
export function isBulk(title: string): boolean {
  return /\bbulk\b/i.test(title) && !MIX.test(title);
}

/** Roulette = you don't know what you'll get. Everything else mixed is a Rainbow. */
export function isRoulette(title: string, description = ''): boolean {
  return /myst|grab bag|\bnoid\b|\bno[- ]?id\b|grower.?s choice|surprise|random|lucky|unlabel|un-?named|roulette|farmer.?s (choice|pick)/i.test(`${title} ${description.slice(0, 200)}`);
}
