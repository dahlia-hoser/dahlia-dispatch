'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, adminToken } from '../../../lib/admin-auth';

export async function signIn(fd: FormData) {
  const given = String(fd.get('password') ?? '');
  const next = String(fd.get('next') ?? '/admin');
  const safeNext = next.startsWith('/admin') ? next : '/admin';
  if (!process.env.ADMIN_PASSWORD || given !== process.env.ADMIN_PASSWORD) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    redirect(`/admin/login?wrong=1&next=${encodeURIComponent(safeNext)}`);
  }
  (await cookies()).set(ADMIN_COOKIE, (await adminToken())!, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 90 * 86400,
  });
  redirect(safeNext);
}
