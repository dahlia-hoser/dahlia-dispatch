/** @type {import('next').NextConfig} */
const security = [
  // Private test site: ask search engines not to list any page.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  // Don't let other sites show this site inside a frame (stops click-jacking tricks).
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  // Don't tell farm sites which page of ours someone came from beyond the site name.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: security }];
  },
};
export default nextConfig;
