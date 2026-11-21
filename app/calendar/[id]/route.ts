import { db } from '../../../lib/db';
import { icsFor } from '../../../lib/ics';

// /calendar/123 → a calendar file for that sale, with reminders.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = db();
  const [s] = await t.where('sale_events', { id: Number(id) });
  if (!s?.starts_at) return new Response('Not found', { status: 404 });
  const [f] = await t.where('farms', { id: s.farm_id });
  const name = String(f?.name ?? 'dahlia-sale').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return new Response(icsFor(s as any, f as any), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}-sale.ics"`, 'Cache-Control': 'no-store' },
  });
}
