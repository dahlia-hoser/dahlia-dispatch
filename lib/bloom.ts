// Real bloom colours, so each dahlia card carries its own colour.
export const BLOOM: Record<string, string> = {
  White: '#f8f6f1',
  Cream: '#f2e3bd',
  Yellow: '#f2c230',
  Orange: '#ee7a2b',
  Peach: '#f6b48c',
  Pink: '#e7779c',
  Blush: '#f4c9cf',
  Red: '#c8202f',
  Burgundy: '#6e1f2d',
  Purple: '#6b3fa0',
  Lavender: '#b9a3dd',
  Bicolour: 'repeating-linear-gradient(135deg, #f8f6f1 0 4px, #c94a7a 4px 8px)',
};

/** The colours to paint for a dahlia: "Bicolour + Orange" shows orange with the bicolour stripe. */
export function bloomColours(c1?: string | null, c2?: string | null): string[] {
  return [c1, c2].filter((c): c is string => !!c && !!BLOOM[c]).map((c) => BLOOM[c]);
}
