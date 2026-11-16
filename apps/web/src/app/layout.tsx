import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { PwaRegister } from '@/components/PwaRegister';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'mueblesweb', template: '%s · mueblesweb' },
  description: 'Diseño de muebles por paneles, listas de corte y producción, en el navegador y en el móvil.',
  applicationName: 'mueblesweb',
  appleWebApp: { capable: true, title: 'mueblesweb', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1f1e1c' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
        <PwaRegister />
      </body>
    </html>
  );
}
