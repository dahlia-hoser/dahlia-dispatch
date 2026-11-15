import './globals.css';
import type { Metadata } from 'next';
import { text } from '../site-text';
import { Nav } from '../components/Nav';
import { openReviewCount } from '../lib/review';

export const metadata: Metadata = {
  title: text.siteName,
  description: text.tagline,
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const count = await openReviewCount().catch(() => 0);
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Carlito:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="top">
          <div className="wrap">
            <a className="brand" href="/">{text.siteName}</a>
            <Nav reviewCount={count} />
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer>
          <div className="wrap">{text.footer}</div>
        </footer>
      </body>
    </html>
  );
}
