// First guesses at colour and form, from a farm's own tags and description.
// These are only suggestions: the owner confirms them in the review list.
import { COLOURS, FORMS } from './types';

const COLOUR_WORDS: [RegExp, string][] = [
  [/\bbi-?colou?r(ed)?\b|\btwo[- ]tone\b|\bbicolore\b/, 'Bicolour'],
  [/\b(pale|light|soft) pink\b|\bblush\b/, 'Blush'],
  [/\b(dark|deep) red\b|\bburgundy\b|\bwine\b|\bmaroon\b|\boxblood\b|\bblack\b|\bchocolate\b|\bmerlot\b/, 'Burgundy'],
  [/\bwhite\b|\bblanc(he)?\b/, 'White'],
  [/\bivory\b|\bcream\b|\bcreamy\b|\bcr[eè]me\b|\bchampagne\b|\bbuttercream\b/, 'Cream'],
  [/\byellow\b|\bgold(en)?\b|\blemon\b|\bbutter\b|\bjaune\b/, 'Yellow'],
  [/\borange\b|\bbronze\b|\bcopper\b|\btangerine\b|\bbrick\b|\brust\b|\bterracotta\b/, 'Orange'],
  [/\bpeach(y)?\b|\bapricot\b|\bcoral\b|\bsalmon\b|\bp[eê]che\b|\bcaramel\b|\bnude\b/, 'Peach'],
  [/\bpink\b|\brose\b|\bfuchsia\b|\bmagenta\b|\bhot pink\b|\braspberry\b|\brose\b|\bmauve\b/, 'Pink'],
  [/\bred\b|\bscarlet\b|\bcrimson\b|\bcherry\b|\brouge\b/, 'Red'],
  [/\bpurple\b|\bplum\b|\bviolet\b|\bmagenta purple\b|\baubergine\b|\bmauve\b/, 'Purple'],
  [/\blavender\b|\blilac\b|\blavande\b/, 'Lavender'],
];

const FORM_WORDS: [RegExp, string][] = [
  [/\bsemi[- ]?cactus\b/, 'Semi-cactus'],
  [/\bcactus\b/, 'Cactus'],
  [/\bwater ?lily\b|\bwaterlily\b|\bnénuphar\b/, 'Waterlily'],
  [/\bpom ?pons?\b|\bpom ?poms?\b/, 'Pompon'],
  [/\bminiature ball\b|\bball\b|\bboule\b/, 'Ball'],
  [/\bcollarette\b/, 'Collarette'],
  [/\banemone\b/, 'Single'],
  [/\bstellar\b/, 'Stellar'],
  [/\borchid\b|\borchidée\b/, 'Orchid'],
  [/\bpeony\b|\bpivoine\b/, 'Peony'],
  [/\blaciniated\b|\bfimbriated\b|\bfringed\b/, 'Laciniated'],
  [/\bsingle\b|\bsimple\b|\bmignon\b/, 'Single'],
  [/\bnovelty\b/, 'Novelty'],
  [/\bdecorative\b|\bdécoratif\b|\bdinnerplate\b|\bdinner plate\b/, 'Decorative'],
];

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();
}

function findAll(text: string, words: [RegExp, string][], max: number): string[] {
  // Earlier rules win: "soft pink" counts as Blush, and its "pink" isn't counted again.
  const taken: [number, number][] = [];
  const hits: { at: number; value: string }[] = [];
  for (const [re, value] of words) {
    const g = new RegExp(re.source, 'g');
    for (const m of text.matchAll(g)) {
      const a = m.index!, b = a + m[0].length;
      if (taken.some(([x, y]) => a < y && b > x)) continue;
      taken.push([a, b]);
      hits.push({ at: a, value });
      break;
    }
  }
  hits.sort((a, b) => a.at - b.at);
  const out: string[] = [];
  for (const h of hits) if (!out.includes(h.value)) out.push(h.value);
  return out.slice(0, max);
}

export type Hints = { tags: string[]; text: string };

export function guessDetails(name: string, h: Hints): { colour1: string | null; colour2: string | null; form: string | null } {
  // 1. Tags that are exactly a colour or form ("Pink", "Colour: Pink", "Ball Dahlias").
  const tagText = h.tags.map((t) => t.toLowerCase().replace(/^(colou?r|couleur|form|forme|type)\s*[:_-]\s*/, '')).join(' | ');
  let colours = findAll(tagText, COLOUR_WORDS, 2).filter((c) => COLOURS.includes(c));
  let form = findAll(tagText, FORM_WORDS, 1)[0] ?? null;
  // 2. Otherwise the start of the description (where farms usually describe the bloom).
  const text = h.text.toLowerCase().slice(0, 350);
  if (!colours.length) colours = findAll(text, COLOUR_WORDS, 2);
  if (!form) form = findAll(text, FORM_WORDS, 1)[0] ?? null;
  // Never guess from the variety's own name ("Cornel Bronze") without other evidence: skip.
  void name;
  return { colour1: colours[0] ?? null, colour2: colours[1] ?? null, form: form && FORMS.includes(form) ? form : null };
}
