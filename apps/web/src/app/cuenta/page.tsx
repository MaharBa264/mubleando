'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Page } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/feedback';
import { TextField } from '@/components/ui/fields';
import { importLocalData, localDataSummary, type ImportSummary } from '@/data/cloud';
import { supabase } from '@/lib/supabase';

/** Cuenta: sesión, subir los datos de este navegador y borrar la cuenta. */
export default function AccountPage() {
  const { mode, session } = useAuth();

  if (mode === 'local') {
    return (
      <Page title="Tus datos">
        <div className="max-w-2xl space-y-4 text-sm">
          <Alert tone="info" title="Se guardan en este navegador">
            Esta instalación no usa cuentas: lo que hagas aquí no aparece en otros dispositivos, y si borras los datos de navegación de este sitio, se borran tus proyectos.
          </Alert>
          <p className="text-muted">
            Para tener cuenta y sincronizar el ordenador y el móvil hay que conectar la app a un proyecto de Supabase. Los pasos están en <code>docs/nube.md</code>. Al entrar por primera vez podrás subir a tu cuenta todo lo que tengas aquí.
          </p>
        </div>
      </Page>
    );
  }
  if (!session) return null;
  return <CloudAccount email={session.user.email ?? ''} accessToken={session.access_token} />;
}

function CloudAccount({ email, accessToken }: { email: string; accessToken: string }) {
  const router = useRouter();
  const [local, setLocal] = useState<ImportSummary | null>(null);
  const [imported, setImported] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setLocal(localDataSummary()), []);

  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const signOut = (scope: 'local' | 'global') =>
    run(scope, async () => {
      const { error } = await supabase().auth.signOut({ scope });
      if (error) throw error;
      router.replace('/entrar');
    });

  return (
    <Page title="Cuenta">
      <div className="max-w-2xl space-y-8">
        {error && <Alert tone="danger">{error}</Alert>}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Sesión</h2>
          <p className="text-sm">
            Has entrado como <strong className="break-all">{email}</strong>. Tus proyectos, muebles y bibliotecas se guardan en la nube y se ven igual en todos tus dispositivos.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => signOut('local')} disabled={!!busy}>
              Cerrar sesión
            </Button>
            <Button variant="ghost" onClick={() => signOut('global')} disabled={!!busy}>
              Cerrar sesión en todos los dispositivos
            </Button>
          </div>
        </section>

        {local && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Datos de este navegador</h2>
            {imported ? (
              <Alert tone="info" title="Subido">
                {imported.projects} proyectos y {imported.cabinets} muebles copiados a tu cuenta. Lo que ya estaba no se ha duplicado. Los datos del navegador siguen ahí por si acaso.
              </Alert>
            ) : (
              <>
                <p className="text-sm text-muted">
                  Este navegador tiene {local.projects} {local.projects === 1 ? 'proyecto' : 'proyectos'} y {local.cabinets} {local.cabinets === 1 ? 'mueble' : 'muebles'} de antes de usar la cuenta, además de {local.materials} materiales y {local.methods} métodos. Puedes copiarlos a tu cuenta. No se borra nada, y si lo repites no se duplica.
                </p>
                <Button variant="primary" disabled={!!busy} onClick={() => run('import', async () => setImported(await importLocalData()))}>
                  {busy === 'import' ? 'Subiendo…' : 'Subir a mi cuenta'}
                </Button>
              </>
            )}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-danger">Borrar la cuenta</h2>
          <p className="text-sm text-muted">Se borran la cuenta y todos sus proyectos, muebles, materiales y métodos. No se puede deshacer.</p>
          <Button variant="danger" onClick={() => setDeleting(true)} disabled={!!busy}>
            Borrar mi cuenta…
          </Button>
        </section>
      </div>
      {deleting && <DeleteAccountDialog accessToken={accessToken} onClose={() => setDeleting(false)} />}
    </Page>
  );
}

function DeleteAccountDialog({ accessToken, onClose }: { accessToken: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const ok = text.trim().toUpperCase() === 'BORRAR';

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/cuenta/borrar', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'No se ha podido borrar la cuenta.');
      await supabase().auth.signOut({ scope: 'local' });
      router.replace('/entrar');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Borrar la cuenta"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="danger" disabled={!ok || busy} onClick={remove}>
            {busy ? 'Borrando…' : 'Borrar para siempre'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>Se borrarán la cuenta y todos sus datos. No hay papelera ni forma de recuperarlos.</p>
        <TextField label="Escribe BORRAR para confirmar" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
