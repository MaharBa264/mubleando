import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mubleando · diseño de muebles',
    short_name: 'Mubleando',
    description: 'Diseño de muebles por paneles y listas de corte.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f7f9',
    theme_color: '#c25e1a',
    lang: 'es',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
