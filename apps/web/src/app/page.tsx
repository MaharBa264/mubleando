'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Page } from '@/components/AppShell';
import { HelpIntro } from '@/components/HelpIntro';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/feedback';
import { TextField } from '@/components/ui/fields';
import { data, type ProjectSummary } from '@/data';
import { fmtDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';

/** S01 · Proyectos */
export default function ProjectsPage() {
  const router = useRouter();
  const projects = useAsync(() => data.listProjects(), []);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<ProjectSummary | null>(null);

  return (
    <Page
      title="Proyectos"
      actions={
        <Button variant="primary" onClick={() => setCreating(true)}>
          Nuevo proyecto
        </Button>
      }
    >
      <HelpIntro />
      {projects.status === 'loading' && <LoadingBlock label="Cargando proyectos…" />}
      {projects.status === 'error' && <ErrorState error={projects.error} onRetry={projects.reload} />}
      {projects.status === 'ready' && projects.data.length === 0 && (
        <EmptyState
          title="Todavía no tenés proyectos"
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Crear el primero
            </Button>
          }
        >
          Un proyecto agrupa los muebles de un trabajo: una cocina, un placard, un local. Adentro creás los muebles y los ambientes.
        </EmptyState>
      )}
      {projects.status === 'ready' && projects.data.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.data.map((p) => (
            <li key={p.id} className="group relative rounded-card border border-border bg-surface p-4 shadow-1 hover:border-border-strong">
              <Link href={`/proyectos/${p.id}`} className="block after:absolute after:inset-0 after:content-['']">
                <h2 className="truncate pr-8 font-semibold" title={p.name}>
                  {p.name}
                </h2>
              </Link>
              <p className="mt-1 text-sm text-muted">
                {p.cabinetCount === 0 ? 'Sin muebles' : p.cabinetCount === 1 ? '1 mueble' : `${p.cabinetCount} muebles`}
              </p>
              <p className="mt-3 text-xs text-muted">Modificado {fmtDate(p.updatedAt)}</p>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2 z-10"
                aria-label={`Eliminar proyecto ${p.name}`}
                onClick={() => setToDelete(p)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                </svg>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <NewProjectDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={async (name) => {
          const p = await data.createProject(name);
          router.push(`/proyectos/${p.id}`);
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar proyecto"
        message={
          <>
            Se borrará <strong className="text-text">{toDelete?.name}</strong> con todos sus muebles. No se puede deshacer.
          </>
        }
        confirmLabel="Eliminar"
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await data.deleteProject(toDelete.id);
          projects.reload();
        }}
      />
    </Page>
  );
}

function NewProjectDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await onCreate(name);
    } finally {
      setBusy(false);
      setName('');
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuevo proyecto"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" form="new-project" type="submit" disabled={busy}>
            Crear proyecto
          </Button>
        </>
      }
    >
      <form
        id="new-project"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <TextField label="Nombre" autoFocus placeholder="Cocina García" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </form>
    </Dialog>
  );
}
