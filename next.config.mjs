/** @type {import('next').NextConfig} */
const nextConfig = {
  // Private test site: ask search engines not to list any page.
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};
export default nextConfig;
