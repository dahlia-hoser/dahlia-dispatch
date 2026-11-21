/** Only owner pages on this site can be a "go back to" address, so a link can't send you elsewhere. */
export function safeBack(raw?: string | null): string | null {
  if (!raw) return null;
  const s = raw.split('#')[0];
  return /^\/admin(?:\/[\w\-/]*)?(?:\?[\w=&%.\-+]*)?$/.test(s) && !s.startsWith('//') ? s.replace(/([?&])saved=[^&]*&?/, '$1').replace(/([?&])at=[^&]*&?/, '$1').replace(/[?&]$/, '') : null;
}
