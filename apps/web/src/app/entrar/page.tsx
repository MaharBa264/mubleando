'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback';
import { TextField } from '@/components/ui/fields';
import { supabase } from '@/lib/supabase';

type Tab = 'entrar' | 'crear' | 'olvido';

/** Solo rutas internas: evita que un enlace manipulado mande a otra web después de entrar. */
function safeNext(v: string | null): string {
  return v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/entrar') ? v : '/';
}

/** Traduce los errores habituales de Supabase Auth. */
function authMessage(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'El correo o la contraseña no son correctos.';
  if (/email not confirmed/i.test(msg)) return 'Todavía no has confirmado el correo. Buscá el mensaje que te enviamos (mirá también en spam).';
  // El registro es solo para los mails de la lista: la base rechaza el alta (Supabase lo devuelve como un error genérico).
  if (/MW403|database error saving new user/i.test(msg)) return 'Este correo todavía no está habilitado en la lista de acceso. Pedile autorización al administrador.';
  if (/already registered|already exists/i.test(msg)) return 'Ya hay una cuenta con ese correo. Entrá o recuperá la contraseña.';
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos seguidos. Esperá unos minutos y volvé a probar.';
  if (/password should be at least|weak password/i.test(msg)) return 'La contraseña es demasiado corta o débil: usá al menos 8 caracteres.';
  if (/fetch|network/i.test(msg)) return 'No hay conexión con el servidor. Comprobá tu conexión a internet.';
  return msg;
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const { mode, session } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('volver'));
  const [tab, setTab] = useState<Tab>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  if (mode === 'local') {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-12">
        <h1 className="mb-4 text-2xl font-semibold">Entrar</h1>
        <Alert tone="info" title="Esta instalación no usa cuentas">
          Los datos se guardan en este navegador. Para usar cuentas y sincronizar entre dispositivos hay que configurar la nube (ver docs/nube.md).
        </Alert>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const mail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(mail)) return setError('Escribí un correo válido.');
    if (tab !== 'olvido' && password.length < 8) return setError('La contraseña tiene que tener al menos 8 caracteres.');
    setBusy(true);
    const auth = supabase().auth;
    const origin = window.location.origin;
    try {
      if (tab === 'entrar') {
        const { error } = await auth.signInWithPassword({ email: mail, password });
        if (error) throw error;
      } else if (tab === 'crear') {
        const { data, error } = await auth.signUp({ email: mail, password, options: { emailRedirectTo: `${origin}/entrar` } });
        if (error) throw error;
        if (!data.session) {
          setNotice(`Te enviamos un correo a ${mail}. Abrí el enlace para confirmar la cuenta y después entrá acá.`);
          setTab('entrar');
          setPassword('');
        }
      } else {
        const { error } = await auth.resetPasswordForEmail(mail, { redirectTo: `${origin}/restablecer` });
        if (error) throw error;
        setNotice(`Si hay una cuenta con ${mail}, te va a llegar un correo con un enlace para elegir una contraseña nueva.`);
      }
    } catch (err) {
      setError(authMessage(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const tabs: [Tab, string][] = [
    ['entrar', 'Entrar'],
    ['crear', 'Crear cuenta'],
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-8 sm:py-12">
      <div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,420px)] lg:gap-12">
        {/* Columna izquierda: identidad y valor del taller */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted shadow-1">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            Diseño paramétrico de muebles y plano de cortes
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden className="shrink-0 shadow-1 rounded-[12px]">
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
              <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Mubleando</h1>
            </div>
            <p className="max-w-lg text-base text-muted">
              Diseñá muebles de tablero en 3D, ubicalos en cada ambiente y sacá al instante el despiece, los costos y el plano de cortes listo para el taller.
            </p>
          </div>

          <ul className="hidden space-y-3 border-t border-border pt-5 text-sm text-muted lg:block">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>
                <strong className="font-medium text-text">Cálculo automático al milímetro:</strong> descuentos de canto, herrajes, vidrios y optimización de placas en tiempo real.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>
                <strong className="font-medium text-text">Sincronizado en la nube con Supabase:</strong> empezá un proyecto en la compu y chequeá el checklist de cortes desde el celular en el taller.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>
                <strong className="font-medium text-text">Exportación directa:</strong> CSV para optimizadores, etiquetas A4, PDF técnico y modelos STL 3D.
              </span>
            </li>
          </ul>
        </div>

        {/* Columna derecha: tarjeta de acceso */}
        <div className="rounded-sheet border border-border bg-surface p-6 shadow-float sm:p-7">
          <div className="mb-5">
            <h2 className="font-display text-xl font-semibold">
              {tab === 'olvido' ? 'Recuperar contraseña' : tab === 'crear' ? 'Crear tu cuenta' : 'Ingresá a tu taller'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {tab === 'olvido'
                ? 'Te mandamos un enlace por correo para definir una clave nueva.'
                : tab === 'crear'
                  ? 'El alta está habilitada para correos autorizados en la lista de acceso.'
                  : 'Tus proyectos y bibliotecas te esperan sincronizados.'}
            </p>
          </div>

          {tab !== 'olvido' && (
            <div role="tablist" aria-label="Entrar o crear cuenta" className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
              {tabs.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => {
                    setTab(k);
                    setError(null);
                    setNotice(null);
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${tab === k ? 'bg-surface font-medium text-text shadow-1' : 'text-muted hover:text-text'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4" noValidate>
            <TextField
              label="Correo electrónico"
              type="email"
              placeholder="tu@correo.com"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {tab !== 'olvido' && (
              <div className="space-y-1">
                <div className="relative">
                  <TextField
                    label={tab === 'crear' ? 'Contraseña (mínimo 8 caracteres)' : 'Contraseña'}
                    type={showPass ? 'text' : 'password'}
                    autoComplete={tab === 'crear' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-2.5 bottom-2 rounded-control px-2 py-0.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-text"
                  >
                    {showPass ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
            )}

            {error && <Alert tone="danger">{error}</Alert>}
            {notice && <Alert tone="info">{notice}</Alert>}

            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              {busy ? 'Un momento…' : tab === 'entrar' ? 'Entrar al taller' : tab === 'crear' ? 'Crear cuenta' : 'Enviar enlace de recuperación'}
            </Button>
          </form>

          <div className="mt-5 border-t border-border pt-4 text-center text-sm">
            {tab === 'olvido' ? (
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={() => {
                  setTab('entrar');
                  setError(null);
                  setNotice(null);
                }}
              >
                ← Volver a entrar
              </button>
            ) : (
              <button
                type="button"
                className="text-muted hover:text-accent hover:underline"
                onClick={() => {
                  setTab('olvido');
                  setError(null);
                  setNotice(null);
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
