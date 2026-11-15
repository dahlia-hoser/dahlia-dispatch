import type { MetadataRoute } from 'next';

// Private test site: keep every search engine out.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
