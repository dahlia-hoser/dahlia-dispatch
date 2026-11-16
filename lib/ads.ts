// Reading the American Dahlia Society's "Cream of the Crop" lists: each line is a variety with its
// ADS classification number. The number's last two digits are the colour class, and the letters
// beside it give the form. Country "C" means it was introduced in Canada.
const SIZES = new Set(['AA', 'A', 'B', 'BB', 'M', 'MC']);
const FORMS: Record<string, string> = {
  FD: 'Decorative', ID: 'Decorative', SC: 'Semi-cactus', C: 'Cactus', IC: 'Cactus', LC: 'Laciniated',
  BA: 'Ball', MB: 'Ball', P: 'Pompon', ST: 'Stellar', WL: 'Waterlily', MWL: 'Waterlily',
  PE: 'Peony', MP: 'Peony', AN: 'Single', MA: 'Single', O: 'Orchid', MO: 'Orchid', OT: 'Orchid',
  CO: 'Collarette', MCO: 'Collarette', MCL: 'Collarette', S: 'Single', MS: 'Single', NO: 'Novelty', NX: 'Novelty', N: 'Novelty',
};
// Colour class from the last two digits. Light and dark blends (10, 13) are left to the farms.
const COLOUR_BY_CODE: Record<string, string[]> = {
  '01': ['White'], '02': ['Yellow'], '03': ['Orange'], '04': ['Pink'], '05': ['Pink'], '06': ['Red'],
  '07': ['Burgundy'], '08': ['Lavender'], '09': ['Purple'], '10': [], '11': ['Orange'], '12': ['Orange', 'Red'],
  '13': [], '14': ['Bicolour'], '15': ['Bicolour'],
};
const COLOUR_CODES = new Set(['W', 'Y', 'OR', 'PK', 'DP', 'R', 'DR', 'L', 'PR', 'LB', 'BR', 'FL', 'DB', 'V', 'BI']);

export type AdsEntry = { name: string; code: string; form: string | null; colours: string[]; canadian: boolean };

function formFromCode(code: string): string | null {
  const x = Number(code[0]), y = Number(code[1]);
  if (x <= 5) return ['Decorative', 'Decorative', 'Semi-cactus', 'Cactus', 'Cactus', 'Laciniated'][y] ?? null;
  const two = code.slice(0, 2);
  return ({ '60': 'Ball', '61': 'Ball', '62': 'Pompon', '70': 'Stellar', '73': 'Waterlily', '80': 'Peony', '82': 'Single', '92': 'Orchid', '93': 'Orchid', '94': 'Orchid', '97': 'Single' } as Record<string, string>)[two] ?? null;
}

/** The tokens after the name: [size] form colour awards. Returns the form token, or null if it doesn't fit. */
function readCodes(tokens: string[]): { form: string | null; ok: boolean } {
  let i = 0;
  if (SIZES.has(tokens[i]) && (FORMS[tokens[i + 1]] || COLOUR_CODES.has(tokens[i + 1]))) i++;
  const form = FORMS[tokens[i]] ? tokens[i] : null;
  if (form) i++;
  const ok = COLOUR_CODES.has(tokens[i]) && /^\d{1,4}$/.test(tokens[i + 1] ?? '');
  return { form, ok };
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/^[·\s*]+|[·\s*]+$/g, '').trim();

/** One line of text from the PDF -> a variety, or null. Handles "NAME 1234 B ID PK 30 ..." and "1234 NAME B ID PK 30 ...". */
export function parseAdsLine(raw: string): AdsEntry | null {
  const tokens = raw.replace(/·/g, ' ').replace(/\*/g, ' ').split(/\s+/).filter(Boolean);
  const country = tokens.at(-1) === 'C';
  // Name first, then the number.
  for (let i = 1; i < tokens.length; i++) {
    if (!/^\d{4}$/.test(tokens[i])) continue;
    const r = readCodes(tokens.slice(i + 1));
    if (r.ok) return make(tokens.slice(0, i).join(' '), tokens[i], r.form, country);
  }
  // Number first, then the name.
  if (/^\d{4}$/.test(tokens[0])) {
    for (let j = 2; j < tokens.length; j++) {
      if (!(SIZES.has(tokens[j]) || FORMS[tokens[j]] || COLOUR_CODES.has(tokens[j]))) continue;
      const r = readCodes(tokens.slice(j));
      if (r.ok) return make(tokens.slice(1, j).join(' '), tokens[0], r.form, country);
    }
  }
  return null;
}

function make(name: string, code: string, formToken: string | null, canadian: boolean): AdsEntry | null {
  const n = tidy(name);
  if (n.length < 2 || !/[A-Z]/.test(n)) return null;
  return {
    name: n,
    code,
    form: formToken ? FORMS[formToken] : formFromCode(code),
    colours: COLOUR_BY_CODE[code.slice(2)] ?? [],
    canadian,
  };
}

export function parseAdsText(lines: string[]): AdsEntry[] {
  const out: AdsEntry[] = [];
  for (const l of lines) {
    const e = parseAdsLine(l);
    if (e) out.push(e);
  }
  return out;
}
