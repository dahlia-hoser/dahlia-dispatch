// For pages and actions: is the person looking at this the site owner?
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, isAdminCookie } from './admin-auth';

export async function isAdmin(): Promise<boolean> {
  return isAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value);
}

/** Stops an owner-only action if someone else tries it. */
export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Owner sign-in needed.');
}
