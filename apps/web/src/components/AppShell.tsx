'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AuthGate, AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { isAdmin } from '@/lib/admin';
import { useAsync } from '@/lib/useAsync';

const NAV = [
  { href: '/', label: 'Proyectos', match: (p: string) => p === '/' || p.startsWith('/proyectos') || p.startsWith('/muebles') },
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
  // Administración solo aparece para las cuentas administradoras (lo decide la base de datos).
  const admin = useAsync(() => (mode === 'cloud' && session ? isAdmin() : Promise.resolve(false)), [mode, session?.user.id]);
  const nav = admin.status === 'ready' && admin.data ? [...NAV, ADMIN_NAV] : NAV;
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
              <rect width="64" height="64" rx="16" fill="var(--accent)" />
              <rect x="16" y="16" width="32" height="32" rx="3" fill="none" stroke="var(--accent-contrast)" strokeWidth="4.5" />
              <path d="M16 32h32M32 32v16" stroke="var(--accent-contrast)" strokeWidth="4.5" />
            </svg>
            <span className="font-display hidden text-[17px] font-semibold tracking-tight min-[400px]:inline">mueblesweb</span>
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
          {(mode === 'local' || session) && (
            <Link
              href="/cuenta"
              aria-current={path.startsWith('/cuenta') ? 'page' : undefined}
              title={mode === 'cloud' ? email : 'Datos guardados en este navegador'}
              className="ml-auto flex items-center gap-2 rounded-full py-1 pl-1 pr-1 text-sm text-muted hover:bg-surface-2 hover:text-text sm:pr-3"
            >
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-xs font-semibold uppercase text-accent">
                {mode === 'cloud' ? email.slice(0, 1) || '?' : '⌂'}
              </span>
              <span className="hidden sm:inline">{mode === 'cloud' ? 'Cuenta' : 'En este navegador'}</span>
            </Link>
          )}
        </div>
      </header>
      <main id="main" className="flex flex-1 flex-col">
        <AuthGate>{children}</AuthGate>
      </main>
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
