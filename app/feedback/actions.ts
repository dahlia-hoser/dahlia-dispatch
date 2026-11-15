'use server';
import { redirect } from 'next/navigation';
import { db } from '../../lib/db';

// Feedback goes into the review list, which only the site owner sees. Nothing is shown publicly or emailed.
export async function sendFeedback(fd: FormData) {
  const message = String(fd.get('message') ?? '').trim().slice(0, 2000);
  const contact = String(fd.get('contact') ?? '').trim().slice(0, 200);
  const page = String(fd.get('page') ?? '').trim().slice(0, 200);
  const trap = String(fd.get('website') ?? '');
  if (message && !trap) {
    const t = db();
    const recent = (await t.where('review_items', { kind: 'feedback' })).filter((r) => Date.now() - new Date(r.created_at).getTime() < 3600000);
    if (recent.length < 30) await t.insert('review_items', { kind: 'feedback', data: { message, contact: contact || null, page: page || null } });
  }
  redirect('/feedback?sent=1');
}
