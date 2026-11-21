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
  if (/email not confirmed/i.test(msg)) return 'Todavía no has confirmado el correo. Busca el mensaje que te enviamos (mira también en spam).';
  if (/already registered|already exists/i.test(msg)) return 'Ya hay una cuenta con ese correo. Entra o recupera la contraseña.';
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.';
  if (/password should be at least|weak password/i.test(msg)) return 'La contraseña es demasiado corta o débil: usa al menos 8 caracteres.';
  if (/fetch|network/i.test(msg)) return 'No hay conexión con el servidor. Comprueba tu conexión a internet.';
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  if (mode === 'local') {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10">
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
    if (!/^\S+@\S+\.\S+$/.test(mail)) return setError('Escribe un correo válido.');
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
          setNotice(`Te hemos enviado un correo a ${mail}. Abre el enlace para confirmar la cuenta y luego entra aquí.`);
          setTab('entrar');
          setPassword('');
        }
      } else {
        const { error } = await auth.resetPasswordForEmail(mail, { redirectTo: `${origin}/restablecer` });
        if (error) throw error;
        // Mismo mensaje exista o no la cuenta: no se revela qué correos están registrados.
        setNotice(`Si hay una cuenta con ${mail}, te llegará un correo con un enlace para poner una contraseña nueva.`);
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
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="mb-2 text-2xl font-semibold">{tab === 'olvido' ? 'Recuperar la contraseña' : tab === 'crear' ? 'Crear cuenta' : 'Entrar'}</h1>
      <p className="mb-6 text-sm text-muted">Con tu cuenta, tus proyectos se guardan en la nube y los ves igual en el ordenador y en el móvil.</p>

      {tab !== 'olvido' && (
        <div role="tablist" aria-label="Entrar o crear cuenta" className="mb-5 grid grid-cols-2 gap-1 rounded-control bg-surface-2 p-1">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => {
                setTab(k);
                setError(null);
              }}
              className={`rounded-control px-3 py-1.5 text-sm ${tab === k ? 'bg-surface font-medium shadow-1' : 'text-muted hover:text-text'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-1" noValidate>
        <TextField label="Correo electrónico" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {tab !== 'olvido' && (
          <TextField
            label={tab === 'crear' ? 'Contraseña (al menos 8 caracteres)' : 'Contraseña'}
            type="password"
            autoComplete={tab === 'crear' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        {notice && <Alert tone="info">{notice}</Alert>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? 'Un momento…' : tab === 'entrar' ? 'Entrar' : tab === 'crear' ? 'Crear cuenta' : 'Enviar el enlace'}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm">
        {tab === 'olvido' ? (
          <button type="button" className="text-accent underline" onClick={() => setTab('entrar')}>
            Volver a entrar
          </button>
        ) : (
          <button type="button" className="text-accent underline" onClick={() => setTab('olvido')}>
            He olvidado la contraseña
          </button>
        )}
      </p>
    </div>
  );
}
