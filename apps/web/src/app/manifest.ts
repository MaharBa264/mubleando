import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mubleando · diseño de muebles',
    short_name: 'Mubleando',
    description: 'Diseño de muebles por paneles y listas de corte.',
    start_url: '/',
    display: 'standalone',
    background_color: '#efeeeb',
    theme_color: '#805a28',
    lang: 'es',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
