// Sale timing shared by the calendar and the home page.
import type { SaleEvent } from './types';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Rough date for sorting entries like "Late Feb 2027" or "Usually mid-April". */
export function roughTime(s: SaleEvent, now: number): number {
  if (s.starts_at) return new Date(s.starts_at).getTime();
  const w = (s.when_text ?? '').toLowerCase();
  const m = MONTHS.findIndex((x) => new RegExp(`\\b${x}`).test(w));
  if (m < 0) return Number.MAX_SAFE_INTEGER;
  const day = /late/.test(w) ? 25 : /mid/.test(w) ? 15 : /early/.test(w) ? 3 : Number(w.match(/\b(\d{1,2})\b/)?.[1] ?? 10);
  const thisYear = new Date(now).getUTCFullYear();
  let t = Date.UTC(thisYear, m, day);
  if (t < now - 60 * 86400000) t = Date.UTC(thisYear + 1, m, day); // next season
  return t;
}

/** Open now, coming up (soonest first), and dates not posted yet. */
export function splitSales(sales: SaleEvent[], now: number) {
  const openNow = sales.filter((s) => /open now/i.test(s.when_text ?? '') || (s.starts_at && new Date(s.starts_at).getTime() <= now && now - new Date(s.starts_at).getTime() < 120 * 86400000));
  const rest = sales.filter((s) => !openNow.includes(s));
  const upcoming = rest.filter((s) => s.starts_at || !/tba/i.test(s.when_text ?? '')).sort((a, b) => roughTime(a, now) - roughTime(b, now));
  const later = rest.filter((s) => !upcoming.includes(s));
  return { openNow, upcoming, later };
}
