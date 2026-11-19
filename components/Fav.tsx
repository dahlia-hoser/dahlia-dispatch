'use client';
// Favourites live in this browser only: no account, nothing sent to us.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { text, fill } from '../site-text';

const KEY = 'dd-favs';
const EVENT = 'dd-favs-changed';

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private browsing or storage full: hearts just won't stick */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useFavs(): string[] {
  const [favs, setFavs] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setFavs(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync); // other tabs
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return favs;
}

export function FavButton({ slug, name, big = false }: { slug: string; name: string; big?: boolean }) {
  const favs = useFavs();
  const on = favs.includes(slug);
  const toggle = () => {
    const now = read();
    write(now.includes(slug) ? now.filter((s) => s !== slug) : [...now, slug]);
  };
  return (
    <button
      type="button"
      className={big ? 'fav big' : 'fav'}
      aria-pressed={on}
      aria-label={fill(on ? text.favRemove : text.favAdd, { name })}
      title={on ? text.favOnTitle : text.favOffTitle}
      onClick={toggle}
    >
      {on ? '♥' : '♡'}
    </button>
  );
}

export function FavCount() {
  const n = useFavs().length;
  return n > 0 ? <span className="count">{n}</span> : null;
}

/** Keeps the Favourites page's address in step with this browser's hearts. */
export function FavSync({ current, add }: { current: string; add?: string }) {
  const router = useRouter();
  const favs = useFavs();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Opened from a "my list" link: bring those favourites into this browser, keeping any already here.
    if (add) {
      const here = read();
      const extra = add.split(',').map((x) => x.trim()).filter((x) => x && !here.includes(x));
      if (extra.length) write([...here, ...extra]);
    }
    setReady(true);
  }, [add]);
  useEffect(() => {
    if (!ready) return;
    const want = read().join(',');
    if (want !== current) router.replace(want ? `/favourites?s=${encodeURIComponent(want)}` : '/favourites', { scroll: false });
  }, [favs, ready, current, router]);
  return null;
}

/** Copies (or shares, on phones) a link that brings this browser's favourites to any other device. */
export function CopyListLink() {
  const favs = useFavs();
  const [done, setDone] = useState(false);
  if (!favs.length) return null;
  const go = async () => {
    const url = `${location.origin}/favourites?add=${encodeURIComponent(favs.join(','))}`;
    try {
      if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) await navigator.share({ title: text.favShareTitle, url });
      else await navigator.clipboard.writeText(url);
      setDone(true);
    } catch {
      /* cancelled */
    }
  };
  return (
    <div className="copy-list">
      <button type="button" className="btn ghost" onClick={go}>{text.favCopyLink}</button>
      {done && <span className="note">{text.favCopied}</span>}
    </div>
  );
}
