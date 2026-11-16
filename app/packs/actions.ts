'use server';
import { revalidatePath } from 'next/cache';
import { db } from '../../lib/db';
import { requireAdmin } from '../../lib/is-admin';

/** Owner only: hide a pack that isn't dahlias (or isn't a real pack). */
export async function hidePack(fd: FormData) {
  await requireAdmin();
  await db().insert('review_items', {
    kind: 'hide',
    status: 'done',
    data: { farm_id: Number(fd.get('farm_id')), product_key: String(fd.get('product_key')) },
  });
  revalidatePath('/packs');
}
