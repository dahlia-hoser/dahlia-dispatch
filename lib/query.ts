// Understanding what people type: colours, forms and sizes ("pink ball", "orange dinnerplate"),
// and names spelled close enough ("labirynth" → Labyrinth).
import { normalize } from './names';

const COLOUR_WORDS: [string, string][] = [
  ['pale pink', 'Blush'], ['light pink', 'Blush'], ['soft pink', 'Blush'], ['blush', 'Blush'],
  ['dark red', 'Burgundy'], ['deep red', 'Burgundy'], ['burgundy', 'Burgundy'], ['wine', 'Burgundy'], ['maroon', 'Burgundy'], ['black', 'Burgundy'], ['chocolate', 'Burgundy'],
  ['white', 'White'], ['ivory', 'White'], ['cream', 'Cream'],
  ['yellow', 'Yellow'], ['gold', 'Yellow'], ['golden', 'Yellow'], ['lemon', 'Yellow'],
  ['orange', 'Orange'], ['tangerine', 'Orange'], ['bronze', 'Orange'],
  ['peach', 'Peach'], ['apricot', 'Peach'], ['salmon', 'Peach'], ['coral', 'Peach'],
  ['pink', 'Pink'], ['rose', 'Pink'], ['hot pink', 'Pink'], ['magenta', 'Pink'],
  ['red', 'Red'], ['scarlet', 'Red'], ['crimson', 'Red'],
  ['purple', 'Purple'], ['violet', 'Purple'], ['plum', 'Purple'],
  ['lavender', 'Lavender'], ['lilac', 'Lavender'], ['mauve', 'Lavender'],
  ['bicolour', 'Bicolour'], ['bicolor', 'Bicolour'], ['two tone', 'Bicolour'], ['two-tone', 'Bicolour'], ['striped', 'Bicolour'], ['speckled', 'Bicolour'], ['variegated', 'Bicolour'], ['flecked', 'Bicolour'], ['streaked', 'Bicolour'],
];
const FORM_WORDS: [string, string][] = [
  ['formal decorative', 'Formal decorative'], ['informal decorative', 'Informal decorative'], ['decorative', 'Decorative'],
  ['semi cactus', 'Semi-cactus'], ['semi-cactus', 'Semi-cactus'], ['cactus', 'Cactus'],
  ['water lily', 'Waterlily'], ['waterlily', 'Waterlily'], ['ball', 'Ball'], ['balls', 'Ball'], ['pompon', 'Pompon'], ['pompom', 'Pompon'], ['pom pom', 'Pompon'],
  ['collarette', 'Collarette'], ['anemone', 'Anemone'], ['single', 'Anemone'], ['singles', 'Anemone'], ['stellar', 'Stellar'],
  ['novelty', 'Novelty'], ['orchid', 'Orchid'], ['peony', 'Peony'], ['laciniated', 'Laciniated'], ['fimbriated', 'Laciniated'], ['frilly', 'Laciniated'],
];
const SIZE_WORDS = ['dinnerplate', 'dinner plate', 'dinnerplates', 'giant', 'huge', 'big'];
const CANADA_WORDS = ['canadian', 'canadian bred', 'canada'];
const FILLER = ['dahlias', 'dahlia', 'tubers', 'tuber', 'the', 'a', 'and', 'with', 'flowers', 'flower', 'in', 'of'];

export type Look = { colours: string[]; forms: string[]; dinnerplate: boolean; canadian: boolean; rest: string };

/** Pulls colour, form and size words out of a search, leaving the rest (maybe a name). */
export function parseLook(raw: string): Look {
  let s = ` ${normalize(raw).replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const take = (words: string[]) => {
    let hit = false;
    for (const w of [...words].sort((a, b) => b.length - a.length)) {
      const re = new RegExp(` ${w.replace(/[-]/g, '[- ]')} `, 'g');
      if (re.test(s)) {
        hit = true;
        s = s.replace(re, ' ');
      }
    }
    return hit;
  };
  const pick = (list: [string, string][]) => {
    const found: string[] = [];
    for (const [w, v] of [...list].sort((a, b) => b[0].length - a[0].length)) if (take([w]) && !found.includes(v)) found.push(v);
    return found;
  };
  const forms = pick(FORM_WORDS);
  const colours = pick(COLOUR_WORDS);
  const dinnerplate = take(SIZE_WORDS);
  const canadian = take(CANADA_WORDS);
  take(FILLER);
  return { colours, forms, dinnerplate, canadian, rest: s.replace(/\s+/g, ' ').trim() };
}

export const lookIsEmpty = (l: Look) => !l.colours.length && !l.forms.length && !l.dinnerplate && !l.canadian;

/** Spelling distance (with swapped letters counting as one slip). */
export function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}
const allowed = (len: number) => (len <= 3 ? 0 : len <= 5 ? 1 : 2);

/** A name spelled close enough: every word typed is close to some word of the name (or the whole name is close). */
export function closeTo(query: string, name: string): boolean {
  const q = normalize(query).trim();
  const n = normalize(name).trim();
  if (!q) return false;
  if (distance(q, n) <= allowed(q.length)) return true;
  const nw = n.split(/[\s-]+/).filter(Boolean);
  return q.split(/\s+/).filter(Boolean).every((w) => nw.some((x) => x.startsWith(w) || distance(w, x) <= allowed(w.length) || (x.length > w.length && distance(w, x.slice(0, w.length)) <= allowed(w.length) && w.length >= 5)));
}
