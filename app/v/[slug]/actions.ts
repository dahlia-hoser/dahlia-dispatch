'use server';
import { redirect } from 'next/navigation';
import { db } from '../../../lib/db';
import { COLOURS, FORMS } from '../../../lib/types';

// A visitor suggests a different colour or form. It waits on the owner's Review list; nothing changes until she approves.
export async function suggestFix(fd: FormData) {
  const slug = String(fd.get('slug') ?? '').slice(0, 120);
  const pick = (k: string, list: readonly string[]) => {
    const v = String(fd.get(k) ?? '');
    return list.includes(v) ? v : null;
  };
  const colour1 = pick('colour1', COLOURS);
  const colour2 = pick('colour2', COLOURS);
  const form = pick('form', FORMS);
  const note = String(fd.get('note') ?? '').trim().slice(0, 300) || null;
  const trap = String(fd.get('website') ?? '');
  const t = db();
  const [v] = await t.where('varieties', { slug });
  if (v && !trap) {
    const changed = colour1 !== (v.colour1 ?? null) || colour2 !== (v.colour2 ?? null) || form !== (v.form ?? null);
    const open = await t.where('review_items', { kind: 'suggestion' });
    const recent = open.filter((r) => Date.now() - new Date(r.created_at).getTime() < 3600000).length;
    const same = open.some((r) => r.status === 'open' && r.data?.variety === slug && r.data?.colour1 === colour1 && r.data?.colour2 === colour2 && r.data?.form === form);
    if ((changed || note) && !same && recent < 60) {
      await t.insert('review_items', { kind: 'suggestion', data: { variety: slug, colour1, colour2, form, note } });
    }
  }
  redirect(`/v/${encodeURIComponent(slug)}?suggested=1`);
}
