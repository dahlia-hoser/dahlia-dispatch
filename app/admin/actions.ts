'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../../lib/db';
import { answer, undoAnswer, type Answer } from '../../lib/review';
import { normalize } from '../../lib/names';

export async function answerAction(id: number, a: Answer) {
  await answer(id, a);
  revalidatePath('/', 'layout');
}

export async function undoAction(id: number) {
  await undoAnswer(id);
  revalidatePath('/', 'layout');
}

const val = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? '').trim();
  return v === '' ? null : v;
};

export async function saveVariety(fd: FormData) {
  const t = db();
  const id = Number(fd.get('id'));
  const [v] = await t.where('varieties', { id });
  if (!v) return;
  await t.update('varieties', { id }, {
    name: val(fd, 'name') ?? v.name,
    colour1: val(fd, 'colour1'),
    colour2: val(fd, 'colour2'),
    form: val(fd, 'form'),
    status: val(fd, 'status') ?? v.status,
    notes: val(fd, 'notes'),
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
