'use client';

import type { Session } from '@supabase/supabase-js';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { LoadingBlock } from '@/components/ui/feedback';
import { cloudEnabled, supabase } from '@/lib/supabase';

interface AuthState {
  /** 'local' = sin nube: no hay cuentas, todo se guarda en el navegador. */
  mode: 'cloud' | 'local';
  session: Session | null;
  /** Mientras se lee la sesión guardada al abrir la app. */
  loading: boolean;
  /** true justo después de abrir el enlace de "olvidé mi contraseña". */
  recovering: boolean;
}

const AuthContext = createContext<AuthState>({ mode: 'local', session: null, loading: false, recovering: false });

export const useAuth = () => useContext(AuthContext);

/** Páginas que se pueden ver sin haber entrado. */
const PUBLIC = ['/entrar', '/restablecer'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ mode: cloudEnabled ? 'cloud' : 'local', session: null, loading: cloudEnabled, recovering: false });

  useEffect(() => {
    if (!cloudEnabled) return;
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => setState((s) => ({ ...s, session: data.session, loading: false })));
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      setState((s) => ({ ...s, session, loading: false, recovering: event === 'PASSWORD_RECOVERY' ? true : event === 'SIGNED_OUT' ? false : s.recovering }));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

/**
 * En modo nube, manda a /entrar a quien no ha entrado (guardando a dónde iba) y no pinta
 * la página mientras tanto. En modo local no hace nada.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { mode, session, loading } = useAuth();
  const path = usePathname() ?? '/';
  const router = useRouter();
  const isPublic = PUBLIC.some((p) => path.startsWith(p));
  const blocked = mode === 'cloud' && !loading && !session && !isPublic;

  useEffect(() => {
    if (blocked) router.replace(`/entrar?volver=${encodeURIComponent(path)}`);
  }, [blocked, path, router]);

  if (mode === 'cloud' && !isPublic && (loading || !session)) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <LoadingBlock label="Comprobando la sesión…" rows={2} />
      </div>
    );
  }
  return <>{children}</>;
}
