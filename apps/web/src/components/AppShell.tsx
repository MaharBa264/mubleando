'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AuthGate, AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { Icon } from '@/components/ui/Icon';
import { TooltipLayer } from '@/components/ui/TooltipLayer';
import { isAdmin } from '@/lib/admin';
import { useAsync } from '@/lib/useAsync';

const NAV = [
  {
    href: '/',
    label: 'Proyectos',
    match: (p: string) => p === '/' || p.startsWith('/proyectos') || p.startsWith('/muebles') || p.startsWith('/ambientes'),
  },
  { href: '/bibliotecas', label: 'Bibliotecas', match: (p: string) => p.startsWith('/bibliotecas') },
];
const ADMIN_NAV = { href: '/admin', label: 'Administración', match: (p: string) => p.startsWith('/admin') };

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '/';
  const { mode, session } = useAuth();
  const email = session?.user.email ?? '';
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // Administración solo aparece para las cuentas administradoras (lo decide la base de datos).
  const admin = useAsync(() => (mode === 'cloud' && session ? isAdmin() : Promise.resolve(false)), [mode, session?.user.id]);
  const nav = admin.status === 'ready' && admin.data ? [...NAV, ADMIN_NAV] : NAV;

  const accountTitle =
    mode === 'cloud'
      ? online
        ? `Conectado a Supabase · ${email}`
        : `Sin conexión · ${email}`
      : 'Modo local · datos guardados en este navegador';

  const statusDot =
    mode === 'cloud'
      ? online
        ? 'bg-success'
        : 'bg-warning'
      : 'bg-border-strong';

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      {/* Barra principal: baja (3rem) para dejarle el alto al espacio de trabajo. Los editores restan 3rem. */}
      <header className="no-print sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-3 px-3 sm:gap-5 sm:px-4">
          <Link href="/" className="flex items-center gap-2 rounded-control pr-1">
            <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden>
              <rect width="64" height="64" rx="14" fill="#f6f7f9" stroke="var(--border-strong)" strokeWidth="1.5" />
              <path d="M32 26H43V34L32 44V36.4L35.4 37.2V30.8L32 31.6V26Z" fill="var(--accent)" />
              <g stroke="#1a1d24" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <rect x="12" y="14" width="9" height="36" />
                <path d="M12 26H21M12 38H21M18.2 18.2V21.8M18.2 42.2V45.8" />
                <rect x="43" y="14" width="9" height="36" />
                <path d="M43 26H52M45.8 35.2V39.8" />
                <path d="M21 14L32 26L43 14M21 26H43M21 34L32 44L43 34" />
                <path d="M32 26V31.6L35.4 30.8V37.2L32 36.4V44" />
              </g>
            </svg>
            <span className="font-display hidden text-[17px] font-semibold tracking-tight min-[400px]:inline">Mubleando</span>
          </Link>
          {/* Navegación como control segmentado: mismo lenguaje que los selectores del panel. */}
          <nav aria-label="Principal" className="flex gap-0.5 rounded-full bg-surface-2 p-0.5">
            {nav.map((n) => {
              const active = n.match(path);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-full px-3.5 py-1 text-sm transition-colors ${active ? 'bg-surface font-medium text-text shadow-1' : 'text-muted hover:text-text'}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/ayuda"
            aria-label="Ayuda"
            title="Cómo se usa la app"
            aria-current={path.startsWith('/ayuda') ? 'page' : undefined}
            className={`ml-auto flex items-center gap-1.5 rounded-full p-1.5 text-sm hover:bg-surface-2 hover:text-text sm:px-3 ${path.startsWith('/ayuda') ? 'text-text' : 'text-muted'}`}
          >
            <Icon name="help" size={18} aria-hidden />
            <span aria-hidden className="hidden sm:inline">
              Ayuda
            </span>
          </Link>
          {(mode === 'local' || session) && (
            <Link
              href="/cuenta"
              aria-current={path.startsWith('/cuenta') ? 'page' : undefined}
              title={accountTitle}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 text-sm text-muted hover:bg-surface-2 hover:text-text sm:pr-3"
            >
              <span aria-hidden className="relative grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-xs font-semibold uppercase text-accent">
                {mode === 'cloud' ? email.slice(0, 1) || '?' : '⌂'}
                <span className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-bg ${statusDot}`} />
              </span>
              <span className="hidden sm:inline">
                {mode === 'cloud' ? (online ? 'Nube' : 'Sin conexión') : 'Local'}
              </span>
            </Link>
          )}
        </div>
      </header>
      <main id="main" className="flex flex-1 flex-col">
        <AuthGate>{children}</AuthGate>
      </main>
      <TooltipLayer />
    </div>
  );
}
export function Page({ title, actions, back, children }: { title: ReactNode; actions?: ReactNode; back?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
      {back && <div className="no-print mb-3 text-sm text-muted">{back}</div>}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <h1 className="min-w-0 break-words text-[28px] font-semibold leading-tight sm:text-[32px]">{title}</h1>
        {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
