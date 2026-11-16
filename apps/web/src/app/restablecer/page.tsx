'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button, buttonClass } from '@/components/ui/Button';
import { Alert, LoadingBlock } from '@/components/ui/feedback';
import { TextField } from '@/components/ui/fields';
import { supabase } from '@/lib/supabase';

/**
 * Nueva contraseña. Se llega desde el enlace del correo de "He olvidado la contraseña":
 * Supabase abre una sesión temporal con ese enlace y aquí se elige la contraseña nueva.
 */
export default function ResetPasswordPage() {
  const { mode, session, loading } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === 'local') return null;
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <LoadingBlock label="Comprobando el enlace…" rows={2} />
      </div>
    );
  }
  if (!session) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <h1 className="mb-4 text-2xl font-semibold">Nueva contraseña</h1>
        <Alert tone="warning" title="El enlace no es válido o ha caducado">
          Los enlaces sirven una sola vez y durante poco tiempo. Pide otro desde «He olvidado la contraseña».
        </Alert>
        <Link href="/entrar" className={`${buttonClass('secondary')} mt-4`}>
          Ir a entrar
        </Link>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('La contraseña tiene que tener al menos 8 caracteres.');
    if (password !== repeat) return setError('Las dos contraseñas no coinciden.');
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace('/');
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Nueva contraseña</h1>
      <form onSubmit={submit} className="space-y-4 rounded-m border border-border bg-surface p-5 shadow-1" noValidate>
        <p className="text-sm text-muted">Cuenta: {session.user.email}</p>
        <TextField label="Contraseña nueva (al menos 8 caracteres)" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <TextField label="Repítela" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        {error && <Alert tone="danger">{error}</Alert>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          Guardar la contraseña
        </Button>
      </form>
    </div>
  );
}
