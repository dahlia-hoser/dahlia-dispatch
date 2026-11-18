// The Dispatch is Canada-only. These checks keep it that way.
export const CANADA = new Set(['BC', 'AB', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU']);

export const isCanadianProvince = (p: unknown) => typeof p === 'string' && CANADA.has(p.trim().toUpperCase());

/** What a shop says about itself. 'not' only when it clearly says somewhere else. */
export function shopVerdict(country?: string | null, currency?: string | null): 'canadian' | 'not' | 'unknown' {
  const c = (country ?? '').trim().toUpperCase();
  const cur = (currency ?? '').trim().toUpperCase();
  if (c) return c === 'CA' || c === 'CANADA' ? 'canadian' : 'not';
  if (cur) return cur === 'CAD' ? 'canadian' : 'not';
  return 'unknown';
}
