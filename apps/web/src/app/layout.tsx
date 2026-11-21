import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono, Onest } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { PwaRegister } from '@/components/PwaRegister';
import './globals.css';

/*
 * Tipografías (ver docs/diseno.md). next/font las descarga al compilar y las sirve desde la propia app:
 * no hay pedidos a Google desde el navegador del usuario.
 * - Onest: interfaz y textos. Clara en tamaños chicos y con cifras tabulares.
 * - Bricolage Grotesque: títulos de página y marca. Le da carácter propio a la app.
 * - JetBrains Mono: medidas que se leen como dato técnico (cotas, chip de dimensiones).
 */
const ui = Onest({ subsets: ['latin', 'latin-ext'], variable: '--font-ui', display: 'swap' });
const titles = Bricolage_Grotesque({ subsets: ['latin', 'latin-ext'], variable: '--font-titles', display: 'swap' });
const num = JetBrains_Mono({ subsets: ['latin'], variable: '--font-num', display: 'swap' });

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
    { media: '(prefers-color-scheme: light)', color: '#f3f0eb' },
    { media: '(prefers-color-scheme: dark)', color: '#131312' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR" className={`${ui.variable} ${titles.variable} ${num.variable}`}>
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
        <PwaRegister />
      </body>
    </html>
  );
}
