'use client';
import { usePathname } from 'next/navigation';
import { text } from '../site-text';

export function Nav({ reviewCount, admin }: { reviewCount: number; admin: boolean }) {
  const path = usePathname();
  const cur = (p: string) => (p === '/' ? path === '/' || path.startsWith('/v/') : path.startsWith(p)) ? 'page' : undefined;
  return (
    <nav className="nav" aria-label="Main">
      <a href="/" aria-current={cur('/')}>{text.navSearch}</a>
      <a href="/calendar" aria-current={cur('/calendar')}>{text.navCalendar}</a>
      <a href="/packs" aria-current={cur('/packs')}>{text.navPacks}</a>
      {admin && (
        <a href="/admin" aria-current={cur('/admin')}>
          {text.navReview}
          {reviewCount > 0 && <span className="count">{reviewCount}</span>}
        </a>
      )}
    </nav>
  );
}
