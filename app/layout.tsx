import './globals.css';
import type { Metadata } from 'next';
import { text } from '../site-text';
import { Nav } from '../components/Nav';
import { openReviewCount } from '../lib/review';
import { isAdmin } from '../lib/is-admin';
import { Leaf, LeafCluster } from '../components/Leaf';

export const metadata: Metadata = {
  title: text.siteName,
  description: text.tagline,
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  const count = admin ? await openReviewCount().catch(() => 0) : 0;
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Carlito:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="beta">
          <div className="wrap">
            {text.betaNote} <a href="/feedback">{text.betaLink}</a>
          </div>
        </div>
        <header className="top">
          <LeafCluster corner="top-right" />
          <div className="wrap">
            <a className="brand" href="/">
              {text.siteName}
              <span className="byline"><Leaf size={12} />{text.byline}</span>
            </a>
            <Nav reviewCount={count} admin={admin} />
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer>
          <LeafCluster corner="bottom-right" />
          <div className="wrap inline" style={{ justifyContent: 'space-between' }}>
            <span>{text.footer}</span>
            <a href="/feedback">{text.footerFeedback}</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
