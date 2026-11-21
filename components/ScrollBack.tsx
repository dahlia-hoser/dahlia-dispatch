'use client';
// After saving an edit, put you back on the flower you were at in the list (and flash it).
import { useEffect } from 'react';

export function ScrollBack({ at, near }: { at?: string; near?: string }) {
  useEffect(() => {
    // The flower you edited, or (if it has left the list) the one that came after it.
    const el = (at && document.getElementById(`v-${at}`)) || (near && document.getElementById(`v-${near}`));
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.classList.add('just-saved');
    const t = setTimeout(() => el.classList.remove('just-saved'), 2500);
    return () => clearTimeout(t);
  }, [at, near]);
  return null;
}
