// Rarity, new introductions and Canadian-bred.
import { normalize } from './names';

/** The dahlia season a sale belongs to: sales from July on are for next summer. */
export function seasonYear(now = Date.now()): number {
  const d = new Date(now);
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
}

/** "2026 introduction", "New for 2027", "(2025 Release)", "New introduction" -> a year. */
export function introYear(text: string, now = Date.now()): number | null {
  const t = text.toLowerCase();
  const years: number[] = [];
  const pats = [
    /\b((?:19|20)\d\d)\s*(?:introductions?|intros?|releases?|new release|debut|nouveauté)\b/g,
    /\b(?:new|introduced|introduction|released?|nouveauté|nouveau)\s*(?:for|in|en|pour)?\s*(?:the\s*)?((?:19|20)\d\d)\b/g,
    /\bnouveautés?\s*((?:19|20)\d\d)\b/g,
  ];
  for (const re of pats) for (const m of t.matchAll(re)) years.push(Number(m[1]));
  const now_ = seasonYear(now);
  const ok = years.filter((y) => y >= 1900 && y <= now_ + 1);
  if (ok.length) return Math.max(...ok);
  if (/\bnew (?:introduction|release|intro)\b|\bnouvelle introduction\b/.test(t)) return now_;
  return null;
}

/** Shown as "New introduction" for this season and last. */
export function isNewIntro(year: number | null | undefined, now = Date.now()): boolean {
  return !!year && year >= seasonYear(now) - 1;
}

// Canadian-bred, from the American Dahlia Society's "country of introduction" (C = Canada)
// and known Canadian hybridizers. The owner can override any variety on its Edit page.
const CANADIAN_PREFIXES = ['ferncliff', 'lulu island', 'vivas', 'meadows', 'hy '];
// Anywhere in the name (e.g. the Letterkenny series).
const CANADIAN_WORDS = ['letterkenny', 'skeena'];
const CANADIAN_NAMES = ['ben huston', 'clara huston', 'elsie huston', 'hamilton lillian', 'colleen mooney', 'millennium', 'connie pei yang', 'r joan'];

export function isCanadianBred(name: string, override: boolean | null | undefined): boolean {
  if (override === true || override === false) return override;
  const n = normalize(name) + ' ';
  return CANADIAN_WORDS.some((w) => n.includes(w)) || CANADIAN_PREFIXES.some((p) => n.startsWith(p)) || CANADIAN_NAMES.some((x) => n.trim() === x);
}
