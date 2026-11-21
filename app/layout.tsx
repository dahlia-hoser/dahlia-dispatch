import { FooterQuote } from '../components/FooterQuote';
import './globals.css';
import type { Metadata } from 'next';
import { text } from '../site-text';
import { Nav } from '../components/Nav';
import { openReviewCount } from '../lib/review';
import { isAdmin } from '../lib/is-admin';
import { Leaf, LeafCluster } from '../components/Leaf';

// Page titles lead with what people search for ("Café au Lait dahlia tubers in Canada"), then the name.
export const metadata: Metadata = {
  title: { default: `${text.siteName} · Dahlia tubers from Canadian growers`, template: `%s · ${text.siteName}` },
  description: text.tagline,
  openGraph: { siteName: text.siteName, locale: 'en_CA', type: 'website' },
  robots: { index: false, follow: false }, // beta: hidden from search engines until launch
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-logo" src="/logo-120.png" alt="" width={60} height={60} />
              <span className="brand-words">
                {text.siteName}
                <span className="byline"><Leaf size={12} />{text.byline}</span>
              </span>
            </a>
            <Nav reviewCount={count} admin={admin} />
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer>
          <LeafCluster corner="bottom-right" />
          <div className="wrap inline" style={{ justifyContent: 'space-between' }}>
            <FooterQuote />
            <span>{text.footer}</span>
            <a href="/feedback">{text.footerFeedback}</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
