'use client';
// A different quote on each page. Add or change quotes in site-text.ts (footerQuotes).
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { text } from '../site-text';

export function FooterQuote() {
  const quotes = text.footerQuotes;
  const path = usePathname();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (quotes.length > 1) setI(Math.floor(Math.random() * quotes.length));
  }, [path, quotes.length]);
  const q = quotes[i];
  if (!q) return null;
  return (
    <figure className="footer-quote">
      <blockquote>“{q.quote}”</blockquote>
      <figcaption>— {q.by}</figcaption>
    </figure>
  );
}
