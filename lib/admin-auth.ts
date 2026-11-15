// The owner's tools (review list, edit pages) have their own password: ADMIN_PASSWORD.
// After signing in once, the browser keeps a cookie for 90 days.
export const ADMIN_COOKIE = 'dd_admin';

/** A fingerprint of the admin password, stored in the cookie (never the password itself). */
export async function adminToken(): Promise<string | null> {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  const data = new TextEncoder().encode(`hosers-dahlia-dispatch:${pw}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** True if this cookie value belongs to the owner. Without ADMIN_PASSWORD set, nobody is the owner. */
export async function isAdminCookie(value: string | undefined): Promise<boolean> {
  const token = await adminToken();
  return !!token && value === token;
}
