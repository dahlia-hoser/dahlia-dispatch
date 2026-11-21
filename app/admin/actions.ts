'use server';
import { bicolourFirst } from '../../lib/guess';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../../lib/db';
import { answer, undoAnswer, type Answer } from '../../lib/review';
import { normalize } from '../../lib/names';
import { requireAdmin } from '../../lib/is-admin';
import { suggestFarms } from '../../checker/save';

export async function answerAction(id: number, a: Answer) {
  await requireAdmin();
  await answer(id, a);
  revalidatePath('/', 'layout');
}

export async function undoAction(id: number) {
  await requireAdmin();
  await undoAnswer(id);
  revalidatePath('/', 'layout');
}

const val = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').trim();
  return v === '' ? null : v;
};

export async function saveVariety(fd: FormData) {
  await requireAdmin();
  const t = db();
  const id = Number(fd.get('id'));
  const [v] = await t.where('varieties', { id });
  if (!v) return;
  const [c1, c2] = bicolourFirst(val(fd, 'colour1'), val(fd, 'colour2'));
  await t.update('varieties', { id }, {
    name: val(fd, 'name') ?? v.name,
    colour1: c1,
    colour2: c2,
    form: val(fd, 'form'),
    status: val(fd, 'status') ?? v.status,
    notes: val(fd, 'notes'),
    ...((await t.probe('varieties', 'intro_year'))
      ? {
          intro_year: Number(val(fd, 'intro_year')) || null,
          canadian_bred: val(fd, 'canadian_bred') === 'yes' ? true : val(fd, 'canadian_bred') === 'no' ? false : null,
        }
      : {}),
  });
  // "Also sold as": one spelling per line.
  const wanted = String(fd.get('aka') ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  const existing = await t.where('aliases', { variety_id: id });
  const keep = new Set([normalize(val(fd, 'name') ?? v.name), normalize(v.name)]);
  for (const w of wanted) {
    const a = normalize(w);
    keep.add(a);
    const found = existing.find((e) => e.alias === a);
    if (found) await t.update('aliases', { alias: a }, { shown: w });
    else {
      const taken = await t.where('aliases', { alias: a });
      if (taken.length) await t.update('aliases', { alias: a }, { variety_id: id, shown: w });
      else await t.insert('aliases', { alias: a, variety_id: id, shown: w });
    }
  }
  for (const e of existing) {
    if (!keep.has(e.alias) && e.shown) await t.update('aliases', { alias: e.alias }, { shown: null });
  }
  const newName = normalize(val(fd, 'name') ?? v.name);
  if (!existing.some((e) => e.alias === newName) && !(await t.where('aliases', { alias: newName })).length) {
    await t.insert('aliases', { alias: newName, variety_id: id, shown: null });
  }
  revalidatePath('/', 'layout');
  redirect(`/admin/varieties/${v.slug}?saved=1`);
}

export async function saveSale(fd: FormData) {
  await requireAdmin();
  const t = db();
  const id = Number(fd.get('id')) || null;
  const local = val(fd, 'starts_local'); // "2026-11-29T09:00" in Eastern time
  const row = {
    farm_id: Number(fd.get('farm_id')),
    label: val(fd, 'label'),
    when_text: val(fd, 'when_text'),
    time_text: val(fd, 'time_text'),
    url: val(fd, 'url'),
    note: val(fd, 'note'),
    starts_at: local ? easternToUtc(local) : null,
  };
  if (fd.get('delete') && id) await t.remove('sale_events', { id });
  else if (id) await t.update('sale_events', { id }, row);
  else await t.insert('sale_events', row);
  revalidatePath('/', 'layout');
  redirect('/admin/sales?saved=1');
}

export async function saveFarm(fd: FormData) {
  await requireAdmin();
  const t = db();
  const id = Number(fd.get('id'));
  await t.update('farms', { id }, {
    name: val(fd, 'name'),
    place: val(fd, 'place'),
    province: val(fd, 'province'),
    site: val(fd, 'site'),
    platform: val(fd, 'platform') ?? 'unknown',
    collection: val(fd, 'collection'),
    active: fd.get('active') === 'on',
    ...((await t.probe('farms', 'ships_to'))
      ? { ships_to: val(fd, 'ships_to'), ship_window: val(fd, 'ship_window'), ship_cost: val(fd, 'ship_cost'), pickup: val(fd, 'pickup') }
      : {}),
  });
  revalidatePath('/', 'layout');
  redirect('/admin/farms?saved=1');
}

/** "2026-11-29T09:00" Toronto time -> UTC ISO string (handles daylight saving). */
function easternToUtc(local: string): string {
  const guess = new Date(local + ':00Z');
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(guess);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const asToronto = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  const offset = asToronto - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

export async function suggestMoreFarms() {
  await requireAdmin();
  await suggestFarms(db(), 3);
  revalidatePath('/', 'layout');
  redirect('/admin');
}

/** Batch screen: confirm every ticked variety with the colour and form it already shows. */
export async function confirmBatch(fd: FormData) {
  await requireAdmin();
  const t = db();
  const ids = fd.getAll('ok').map(Number).filter(Boolean);
  let n = 0;
  for (const id of ids) {
    const [r] = await t.where('review_items', { id });
    if (!r || r.status !== 'open' || r.kind !== 'details') continue;
    const [v] = await t.where('varieties', { slug: r.data.variety });
    if (!v) continue;
    await answer(id, { choice: 'save', colour1: v.colour1, colour2: v.colour2, form: v.form });
    n++;
  }
  revalidatePath('/', 'layout');
  redirect(`/admin/colours?done=${n}`);
}

/** Check page: take one colour off every ticked variety (the other colour stays, moved to first). */
export async function removeColour(fd: FormData) {
  await requireAdmin();
  const t = db();
  const colour = String(fd.get('colour') ?? '');
  const ids = fd.getAll('wrong').map(Number).filter(Boolean);
  let n = 0;
  for (const id of ids) {
    const [v] = await t.where('varieties', { id });
    if (!v || (v.colour1 !== colour && v.colour2 !== colour)) continue;
    const left = [v.colour1, v.colour2].filter((c) => c && c !== colour);
    await t.update('varieties', { id }, { colour1: left[0] ?? null, colour2: left[1] ?? null });
    n++;
  }
  revalidatePath('/', 'layout');
  redirect(`/admin/check?colour=${encodeURIComponent(colour)}&done=${n}`);
}
