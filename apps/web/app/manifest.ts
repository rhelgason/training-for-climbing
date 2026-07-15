import type { MetadataRoute } from 'next';

/** PWA manifest — enables add-to-home-screen with a standalone, dark app shell. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Training for Climbing',
    short_name: 'Climbing',
    description: 'Assess, plan, train, and track your climbing — a companion to Eric Hörst’s book.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f1115',
    theme_color: '#0f1115',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      // PNG raster generated at /icon and /apple-icon (see app/icon.tsx, app/apple-icon.tsx).
      { src: '/icon', sizes: '256x256', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
