'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Page } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState, ErrorState, LoadingBlock } from '@/components/ui/feedback';
import { Label, TextField } from '@/components/ui/fields';
import { AdminNotInstalledError, addAllowed, isAdmin, listAccounts, listAllowed, parseEmails, removeAllowed, type Account, type AllowedEmail } from '@/lib/admin';
import { fmtDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';

/** Administración: quién puede crear una cuenta. Solo para las cuentas administradoras. */
export default function AdminPage() {
  const { mode, session } = useAuth();
  const admin = useAsync(() => (mode === 'cloud' && session ? isAdmin() : Promise.resolve(false)), [mode, session?.user.id]);

  if (mode === 'local') {
    return (
      <Page title="Administración">
        <Alert tone="info">Esta instalación guarda todo en el navegador y no tiene cuentas: no hay nada que administrar.</Alert>
      </Page>
    );
  }
  if (!session || admin.status === 'loading') {
    return (
      <Page title="Administración">
        <LoadingBlock />
      </Page>
    );
  }
  if (admin.status === 'error' || !admin.data) {
    return (
      <Page title="Administración">
        <Alert tone="warning" title="Solo para administradores">
          Esta cuenta no administra la app. Si sos el responsable y acabás de aplicar la migración del registro, volvé a entrar.
        </Alert>
      </Page>
    );
  }
  return <Admin />;
}

function Admin() {
  const data = useAsync(() => Promise.all([listAllowed(), listAccounts()]), []);
  return (
    <Page title="Administración">
      {data.status === 'loading' && <LoadingBlock />}
      {data.status === 'error' &&
        (data.error instanceof AdminNotInstalledError ? (
          <Alert tone="warning" title="Falta un paso en Supabase">
            {data.error.message} Los pasos están en <code>docs/nube.md</code>.
          </Alert>
        ) : (
          <ErrorState error={data.error} onRetry={data.reload} />
        ))}
      {data.status === 'ready' && <AdminContent allowed={data.data[0]} accounts={data.data[1]} reload={data.reload} />}
    </Page>
  );
}

function AdminContent({ allowed, accounts, reload }: { allowed: AllowedEmail[]; accounts: Account[]; reload: () => void }) {
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const parsed = parseEmails(text);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (parsed.invalid.length) return setError(`Esto no parece un mail: ${parsed.invalid.join(', ')}`);
    if (!parsed.valid.length) return setError('Escribí al menos un mail.');
    const known = new Set(allowed.map((a) => a.email));
    const fresh = parsed.valid.filter((m) => !known.has(m));
    setBusy(true);
    try {
      await addAllowed(fresh, note);
      const already = parsed.valid.length - fresh.length;
      setNotice(
        `${fresh.length === 1 ? 'Se agregó 1 mail' : `Se agregaron ${fresh.length} mails`}${already ? ` (${already} ya estaba${already === 1 ? '' : 'n'} en la lista)` : ''}. Ya pueden crear su cuenta en la página de entrada.`,
      );
      setText('');
      setNote('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (email: string) => {
    setError(null);
    setNotice(null);
    try {
      await removeAllowed(email);
      setNotice(`${email} ya no puede crear una cuenta. Si ya la tenía, la sigue teniendo.`);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const before = accounts.filter((a) => !a.allowed && !a.isAdmin);

  return (
    <div className="max-w-3xl space-y-10">
      <section aria-labelledby="lista" className="space-y-4">
        <div>
          <h2 id="lista" className="text-lg font-semibold">
            Mails que pueden registrarse
          </h2>
          <p className="mt-1 text-sm text-muted">Solo estos mails pueden crear una cuenta. Quitar uno no borra la cuenta si ya la tenía.</p>
        </div>

        <form onSubmit={add} className="space-y-3 rounded-card border border-border bg-surface p-4">
          <div className="space-y-1.5">
            <Label htmlFor="mails">Mails (uno por línea, o separados por comas)</Label>
            <textarea
              id="mails"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="nombre@ejemplo.com"
              className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <TextField label="Nota (opcional, por ejemplo quién es)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={busy}>
              {parsed.valid.length > 1 ? `Agregar ${parsed.valid.length} mails` : 'Agregar'}
            </Button>
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          {notice && <Alert tone="info">{notice}</Alert>}
        </form>

        {allowed.length === 0 ? (
          <EmptyState title="La lista está vacía">Nadie más puede crear una cuenta. Agregá arriba los mails de las personas que quieras invitar.</EmptyState>
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border bg-surface">
            {allowed.map((a) => (
              <li key={a.email} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="break-all font-medium">{a.email}</p>
                  <p className="text-xs text-muted">
                    {a.note && <span>{a.note} · </span>}
                    {a.registeredAt ? `Cuenta creada el ${fmtDate(a.registeredAt)}` : 'Todavía no creó su cuenta'}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(a.email)} title={`Quitar ${a.email} de la lista`}>
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="cuentas" className="space-y-4">
        <div>
          <h2 id="cuentas" className="text-lg font-semibold">
            Cuentas
          </h2>
          <p className="mt-1 text-sm text-muted">Todas las cuentas que existen. Para borrar una, entrá en Supabase → Authentication → Users.</p>
        </div>
        {before.length > 0 && (
          <Alert tone="warning" title={before.length === 1 ? 'Hay 1 cuenta que no está en la lista' : `Hay ${before.length} cuentas que no están en la lista`}>
            Se crearon antes de que el registro fuera solo con lista. Siguen funcionando: si no las reconocés, borralas en Supabase.
          </Alert>
        )}
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {accounts.map((a) => (
            <li key={a.email + a.createdAt} className="px-4 py-3 text-sm">
              <p className="flex flex-wrap items-center gap-2 break-all font-medium">
                {a.email}
                {a.isAdmin && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">administrador</span>}
                {!a.allowed && !a.isAdmin && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">no está en la lista</span>}
              </p>
              <p className="text-xs text-muted">
                Creada el {fmtDate(a.createdAt)} · {a.lastSignInAt ? `último ingreso el ${fmtDate(a.lastSignInAt)}` : 'nunca entró'}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
