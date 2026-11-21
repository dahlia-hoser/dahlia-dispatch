import type { MetadataRoute } from 'next';
import { text } from '../site-text';

// Lets phones save the site to the home screen with the logo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: text.siteName,
    short_name: 'Dahlia Hoser',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbf7f0',
    theme_color: '#1e4d3a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
