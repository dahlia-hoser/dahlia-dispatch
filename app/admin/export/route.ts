import { db } from '../../../lib/db';
import { isAdmin } from '../../../lib/is-admin';

// /admin/export → the whole dahlia list as a spreadsheet file (owner only).
const cell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  if (!(await isAdmin())) return new Response('Owner sign-in needed.', { status: 403 });
  const t = db();
  const [varieties, listings, farms] = await Promise.all([t.all('varieties'), t.all('listings'), t.all('farms')]);
  const farmName = new Map(farms.map((f: any) => [f.id, f.name]));
  const seen = new Map<number, Set<string>>();
  for (const l of listings as any[]) {
    if (l.variety_id == null) continue;
    if (!seen.has(l.variety_id)) seen.set(l.variety_id, new Set());
    seen.get(l.variety_id)!.add(String(farmName.get(l.farm_id) ?? ''));
  }
  const rows = [['name', 'form', 'colour1', 'colour2', 'status', 'farms']];
  for (const v of [...(varieties as any[])].sort((a, b) => a.name.localeCompare(b.name))) {
    rows.push([v.name, v.form, v.colour1, v.colour2, v.status, [...(seen.get(v.id) ?? [])].join('; ')]);
  }
  const csv = rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="dahlia-list-${day}.csv"`, 'Cache-Control': 'no-store' },
  });
}
