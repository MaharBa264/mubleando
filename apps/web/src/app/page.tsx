'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Page } from '@/components/AppShell';
import { HelpIntro } from '@/components/HelpIntro';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/feedback';
import { TextField } from '@/components/ui/fields';
import { data, type ProjectSummary } from '@/data';
import { fmtDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';

/** S01 · Proyectos: resumen de taller, guía rápida de novedades, búsqueda, orden y tarjetas con accesos directos. */
export default function ProjectsPage() {
  const router = useRouter();
  const projects = useAsync(() => data.listProjects(), []);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<ProjectSummary | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [tipsOpen, setTipsOpen] = useState(false);

  const list = projects.status === 'ready' ? projects.data : [];
  const totalCabinets = useMemo(() => list.reduce((acc, p) => acc + p.cabinetCount, 0), [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? list.filter((p) => p.name.toLowerCase().includes(q)) : list;
    return [...base].sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, 'es')
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [list, query, sort]);

  return (
    <Page
      title="Proyectos"
      actions={
        <>
          <ButtonLink href="/bibliotecas">
            Bibliotecas
          </ButtonLink>
          <Button variant="primary" onClick={() => setCreating(true)} title="Crear un nuevo proyecto de carpintería">
            + Nuevo proyecto
          </Button>
        </>
      }
    >
      <HelpIntro />

      {/* Ayuda contextual desplegable con las funciones recientes del taller */}
      <div className="mb-5 rounded-card border border-border bg-surface px-4 py-3 shadow-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            <span className="font-medium text-text">Guía rápida de herramientas nuevas</span>
            <span className="hidden text-xs text-muted sm:inline">· Esquinero ciego, Obra 3D, Alzado, Bajo escalera y Modo taller</span>
          </div>
          <button
            type="button"
            onClick={() => setTipsOpen((v) => !v)}
            aria-expanded={tipsOpen}
            className="text-xs font-medium text-accent hover:underline"
          >
            {tipsOpen ? 'Ocultar' : 'Ver cómo usarlas'}
          </button>
        </div>
        {tipsOpen && (
          <ul className="mt-3 grid gap-2.5 border-t border-border pt-3 text-xs text-muted sm:grid-cols-2">
            <li>
              <strong className="text-text">Obra 3D y Bajo escalera diagonal (Ambientes → Obra):</strong> agregá muretes, mesadas o una losa inclinada y usá <em>Generar módulos bajo escalera</em> para crear muebles con corte diagonal automático.
            </li>
            <li>
              <strong className="text-text">Vista Alzado por pared (Ambientes → Alzado):</strong> elegí cualquier pared para ver muebles y pendientes de frente, y arrastrá con bloqueo de eje (solo horizontal o solo vertical).
            </li>
            <li>
              <strong className="text-text">Esquinero ciego con mecanismo (Plantillas y Propiedades):</strong> creá un bajo de esquina con panel ciego, puerta y rinconero extraíble o media luna; al abrir frentes en 3D las bandejas salen hacia afuera.
            </li>
            <li>
              <strong className="text-text">Cortes en ángulo y Modo taller (Despiece y PDF):</strong> la maderera recibe el rectángulo completo y el PDF incluye croquis acotados para hacer el corte diagonal en taller; además podés tildar piezas cortadas.
            </li>
          </ul>
        )}
      </div>

      {projects.status === 'loading' && <LoadingBlock label="Cargando proyectos…" />}
      {projects.status === 'error' && <ErrorState error={projects.error} onRetry={projects.reload} />}

      {projects.status === 'ready' && list.length === 0 && (
        <EmptyState
          title="Todavía no tenés proyectos"
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Crear el primer proyecto
            </Button>
          }
        >
          Un proyecto agrupa los muebles y ambientes de un trabajo: una cocina, un placard o un bajo escalera completo. Empezá creando uno para diseñar en 3D y generar el despiece.
        </EmptyState>
      )}

      {projects.status === 'ready' && list.length > 0 && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3.5 shadow-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-baseline gap-1.5">
                <span className="tabular font-display text-lg font-semibold text-text">{list.length}</span>
                <span className="text-muted">{list.length === 1 ? 'proyecto' : 'proyectos'}</span>
              </div>
              <span className="h-4 w-px bg-border" aria-hidden />
              <div className="flex items-baseline gap-1.5">
                <span className="tabular font-display text-lg font-semibold text-accent">{totalCabinets}</span>
                <span className="text-muted">{totalCabinets === 1 ? 'mueble diseñado' : 'muebles diseñados'}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {list.length >= 3 && (
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar proyecto…"
                  aria-label="Buscar proyecto"
                  className="h-9 min-w-[11rem] flex-1 rounded-control border border-border bg-bg px-3 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20 sm:w-52 sm:flex-none"
                />
              )}
              <div role="radiogroup" aria-label="Ordenar proyectos" className="inline-flex gap-0.5 rounded-full bg-surface-2 p-0.5">
                {(
                  [
                    ['recent', 'Recientes'],
                    ['name', 'A–Z'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={sort === k}
                    onClick={() => setSort(k)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${sort === k ? 'bg-surface text-text shadow-1' : 'text-muted hover:text-text'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-card border border-dashed border-border-strong bg-surface px-6 py-10 text-center text-sm text-muted">
              No encontramos proyectos con “{query}”.{' '}
              <button type="button" className="font-medium text-accent underline" onClick={() => setQuery('')}>
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <li
                  key={p.id}
                  className="group relative flex flex-col justify-between rounded-card border border-border bg-surface p-4 shadow-1 transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-float"
                >
                  <div>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <span
                        aria-hidden
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-accent-soft text-accent"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="16" rx="2" />
                          <path d="M3 11h18M12 11v9" />
                        </svg>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="relative z-10 text-muted opacity-70 hover:text-danger group-hover:opacity-100"
                        aria-label={`Eliminar proyecto ${p.name}`}
                        title="Eliminar proyecto"
                        onClick={() => setToDelete(p)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                        </svg>
                      </Button>
                    </div>

                    <Link href={`/proyectos/${p.id}`} className="block after:absolute after:inset-0 after:content-['']">
                      <h2 className="font-display truncate text-base font-semibold text-text group-hover:text-accent" title={p.name}>
                        {p.name}
                      </h2>
                    </Link>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`tabular inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          p.cabinetCount > 0 ? 'bg-surface-2 text-text' : 'bg-surface-2 text-muted'
                        }`}
                      >
                        {p.cabinetCount === 0 ? 'Sin muebles aún' : p.cabinetCount === 1 ? '1 mueble' : `${p.cabinetCount} muebles`}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted">
                    <span>Editado {fmtDate(p.updatedAt)}</span>
                    {p.cabinetCount > 0 && (
                      <Link
                        href={`/proyectos/${p.id}/despiece`}
                        title="Abrir lista de corte y plano de cortes del proyecto"
                        className="relative z-10 rounded-full bg-surface-2 px-2.5 py-1 font-medium text-text transition-colors hover:bg-accent-soft hover:text-accent"
                      >
                        Despiece →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
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
            Se borrará <strong className="text-text">{toDelete?.name}</strong> con todos sus muebles y ambientes. No se puede deshacer.
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
            {busy ? 'Creando…' : 'Crear proyecto'}
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
