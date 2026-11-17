'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Page } from '@/components/AppShell';
import { CabinetSketch } from '@/components/CabinetSketch';
import { NewCabinetDialog } from '@/components/NewCabinetDialog';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/feedback';
import { data, type Cabinet } from '@/data';
import { fmtDims } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';

/** Proyecto: sus muebles, crear uno nuevo (S02) y despiece del proyecto. */
export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const state = useAsync(async () => {
    const [project, cabinets, methods, materials] = await Promise.all([data.getProject(id), data.listCabinets(id), data.listMethods(), data.listMaterials()]);
    return { project, cabinets, methods, materials };
  }, [id]);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Cabinet | null>(null);
  const [renaming, setRenaming] = useState(false);

  const back = (
    <Link href="/" className="text-muted hover:text-text">
      ← Proyectos
    </Link>
  );

  if (state.status === 'loading')
    return (
      <Page title="Proyecto" back={back}>
        <LoadingBlock label="Cargando proyecto…" />
      </Page>
    );
  if (state.status === 'error')
    return (
      <Page title="Proyecto" back={back}>
        <ErrorState error={state.error} onRetry={state.reload} />
      </Page>
    );
  const { project, cabinets, methods, materials } = state.data;
  if (!project)
    return (
      <Page title="Proyecto no encontrado" back={back}>
        <EmptyState title="Este proyecto no existe" action={<ButtonLink href="/">Volver a proyectos</ButtonLink>}>
          Puede que se haya borrado o que el enlace esté mal.
        </EmptyState>
      </Page>
    );

  const methodName = (mid: string) => methods.find((m) => m.id === mid)?.name ?? 'Método desconocido';

  return (
    <Page
      back={back}
      title={
        renaming ? (
          <input
            aria-label="Nombre del proyecto"
            autoFocus
            defaultValue={project.name}
            maxLength={120}
            className="w-full rounded-s border border-border bg-surface px-2 text-2xl font-semibold"
            onBlur={async (e) => {
              await data.renameProject(project.id, e.target.value);
              setRenaming(false);
              state.reload();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setRenaming(false);
            }}
          />
        ) : (
          <button type="button" className="text-left hover:underline" title="Cambiar nombre" onClick={() => setRenaming(true)}>
            {project.name}
          </button>
        )
      }
      actions={
        <>
          {cabinets.length > 0 && <ButtonLink href={`/proyectos/${project.id}/despiece`}>Despiece del proyecto</ButtonLink>}
          <Button variant="primary" onClick={() => setCreating(true)}>
            Nuevo mueble
          </Button>
        </>
      }
    >
      {cabinets.length === 0 ? (
        <EmptyState
          title="Este proyecto aún no tiene muebles"
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Añadir un mueble
            </Button>
          }
        >
          Elegí una plantilla (bajo con puertas, cajonera, alacena, columna, placard…) y ajustá las medidas. Después podés cambiar todo en el editor.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-m border border-border bg-surface shadow-1">
          {cabinets.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <Link href={`/muebles/${c.id}`} className="shrink-0 rounded-s bg-surface-2 p-1" tabIndex={-1} aria-hidden>
                {(() => {
                  const m = methods.find((x) => x.id === c.methodId) ?? methods[0];
                  return m ? <CabinetSketch design={c.design} method={m} materials={materials} className="h-14 w-14" /> : null;
                })()}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/muebles/${c.id}`} className="block truncate font-medium hover:underline" title={c.name}>
                  {c.name}
                </Link>
                <p className="tabular text-sm text-muted">
                  {fmtDims(c.design.size.w, c.design.size.h, c.design.size.d)} mm · {methodName(c.methodId)}
                  {c.quantity > 1 && ` · ×${c.quantity}`}
                </p>
              </div>
              <div className="flex gap-1">
                <ButtonLink size="sm" href={`/muebles/${c.id}`}>
                  Abrir
                </ButtonLink>
                <ButtonLink size="sm" variant="ghost" href={`/muebles/${c.id}/despiece`}>
                  Despiece
                </ButtonLink>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Duplicar ${c.name}`}
                  onClick={async () => {
                    await data.createCabinet({ projectId: project.id, name: `${c.name} (copia)`.slice(0, 120), methodId: c.methodId, design: c.design, quantity: c.quantity });
                    state.reload();
                  }}
                >
                  Duplicar
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Eliminar ${c.name}`} onClick={() => setToDelete(c)}>
                  Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <NewCabinetDialog
        open={creating}
        onClose={() => setCreating(false)}
        methods={methods}
        materials={materials}
        onCreate={async ({ name, methodId, design }) => {
          const c = await data.createCabinet({ projectId: project.id, name, methodId, design });
          router.push(`/muebles/${c.id}`);
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar mueble"
        message={
          <>
            Se borrará <strong className="text-text">{toDelete?.name}</strong>. No se puede deshacer.
          </>
        }
        confirmLabel="Eliminar"
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await data.deleteCabinet(toDelete.id);
          state.reload();
        }}
      />
    </Page>
  );
}
