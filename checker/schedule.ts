// How often each farm is checked.
//   Sale window (15 min before to 2 hours after a known opening time): every run (about every 10 minutes)
//   In season (November to May): about once an hour
//   Off season (June to October): once a day
export type FarmTiming = { id: number; platform: string; site: string | null; active: boolean; last_checked_at: string | null };
export type SaleTiming = { farm_id: number; starts_at: string | null };

export function inSaleWindow(farmId: number, sales: SaleTiming[], now: number): boolean {
  return sales.some((s) => {
    if (s.farm_id !== farmId || !s.starts_at) return false;
    const t = new Date(s.starts_at).getTime();
    return now >= t - 15 * 60000 && now <= t + 2 * 3600000;
  });
}

export function isInSeason(now: number): boolean {
  const month = new Date(now).getUTCMonth() + 1; // 1-12
  return month >= 11 || month <= 5;
}

export function whyDue(f: FarmTiming, sales: SaleTiming[], now: number, force = false): string | null {
  if (!f.active || !f.site || f.platform === 'manual' || f.platform === 'society') return null;
  const last = f.last_checked_at ? new Date(f.last_checked_at).getTime() : 0;
  const since = now - last;
  if (force) return 'asked';
  if (f.platform === 'unknown') return since > 23 * 3600000 ? 'find shop type' : null;
  if (inSaleWindow(f.id, sales, now)) return 'sale day';
  if (isInSeason(now)) return since > 55 * 60000 ? 'hourly' : null;
  return since > 23 * 3600000 ? 'daily' : null;
}
