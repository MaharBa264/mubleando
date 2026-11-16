'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AuthGate, AuthProvider, useAuth } from '@/components/auth/AuthProvider';

const NAV = [
  { href: '/', label: 'Proyectos', match: (p: string) => p === '/' || p.startsWith('/proyectos') || p.startsWith('/muebles') },
  { href: '/bibliotecas', label: 'Bibliotecas', match: (p: string) => p.startsWith('/bibliotecas') },
];

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
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-s focus:bg-surface focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="text-accent">
              <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M3 12h18M12 12v9" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span>mueblesweb</span>
          </Link>
          <nav aria-label="Principal" className="flex gap-1">
            {NAV.map((n) => {
              const active = n.match(path);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-s px-3 py-1.5 text-sm ${active ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface-2 hover:text-text'}`}
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
              className="ml-auto flex items-center gap-2 rounded-s px-2 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-text"
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
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      {back && <div className="no-print mb-3 text-sm">{back}</div>}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="min-w-0 break-words text-2xl font-semibold">{title}</h1>
        {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
