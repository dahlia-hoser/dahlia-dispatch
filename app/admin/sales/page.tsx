import { db } from '../../../lib/db';
import { saveSale } from '../actions';
import type { Farm, SaleEvent } from '../../../lib/types';

function toEasternInput(iso: string | null) {
  if (!iso) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}T${String(+p.hour % 24).padStart(2, '0')}:${p.minute}`;
}

export default async function Sales({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const t = db();
  const [farms, sales] = (await Promise.all([t.all('farms'), t.all('sale_events')])) as [Farm[], SaleEvent[]];
  farms.sort((a, b) => a.name.localeCompare(b.name));
  const name = new Map(farms.map((f) => [f.id, f.name]));
  sales.sort((a, b) => (name.get(a.farm_id) ?? '').localeCompare(name.get(b.farm_id) ?? ''));

  const SaleForm = ({ s }: { s?: SaleEvent }) => (
    <form className="card form" action={saveSale} style={{ maxWidth: 'none' }}>
      {s && <input type="hidden" name="id" value={s.id} />}
      <label>Farm
        <select name="farm_id" defaultValue={s?.farm_id ?? ''} required>
          <option value="" disabled>Choose a farm</option>
          {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>
      <label>What it is<input name="label" defaultValue={s?.label ?? ''} placeholder="Tuber sale" /></label>
      <label>Exact opening time, Eastern (turns on fast checking)<input type="datetime-local" name="starts_local" defaultValue={toEasternInput(s?.starts_at ?? null)} /></label>
      <label>Calendar date text<input name="when_text" defaultValue={s?.when_text ?? ''} placeholder="Late Feb 2027, or Open now" /></label>
      <label>Time text<input name="time_text" defaultValue={s?.time_text ?? ''} placeholder="9:00 am ET (6 am PT)" /></label>
      <label>Link<input name="url" defaultValue={s?.url ?? ''} /></label>
      <label>Note<input name="note" defaultValue={s?.note ?? ''} /></label>
      <div className="inline">
        <button className="btn" type="submit">{s ? 'Save' : 'Add sale'}</button>
        {s && <button className="btn ghost" type="submit" name="delete" value="1">Delete</button>}
      </div>
    </form>
  );

  return (
    <>
      <a className="back" href="/calendar">← Sale calendar</a>
      <h1 style={{ fontSize: 32 }}>Sale dates</h1>
      {saved && <p className="saved">Saved.</p>}
      <p className="note">When you know the exact opening time, fill it in: the checker then looks at that farm every 10 minutes from 15 minutes before until 2 hours after.</p>
      <h2>Add a sale</h2>
      <SaleForm />
      <h2>All sales</h2>
      <div className="admin-grid">{sales.map((s) => <SaleForm key={s.id} s={s} />)}</div>
    </>
  );
}
