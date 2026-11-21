'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Page } from '@/components/AppShell';
import { CabinetSketch } from '@/components/CabinetSketch';
import { NewCabinetDialog } from '@/components/NewCabinetDialog';
import { NewRoomDialog } from '@/components/room/NewRoomDialog';
import { RoomSketch } from '@/components/room/RoomSketch';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/feedback';
import { data, type Cabinet, type Room } from '@/data';
import { fmtDims, fmtNum } from '@/lib/format';
import { floorAreaM2 } from '@mw/engine';
import { useAsync } from '@/lib/useAsync';

/** Proyecto: sus muebles, crear uno nuevo (S02) y despiece del proyecto. */
export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const state = useAsync(async () => {
    const [project, cabinets, methods, materials, rooms] = await Promise.all([
      data.getProject(id),
      data.listCabinets(id),
      data.listMethods(),
      data.listMaterials(),
      data.listRooms(id),
    ]);
    return { project, cabinets, methods, materials, rooms };
  }, [id]);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Cabinet | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
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
  const { project, cabinets, methods, materials, rooms } = state.data;
  if (!project)
    return (
      <Page title="Proyecto no encontrado" back={back}>
        <EmptyState title="Este proyecto no existe" action={<ButtonLink href="/">Volver a proyectos</ButtonLink>}>
          Puede que se haya borrado o que el enlace esté mal.
        </EmptyState>
      </Page>
    );

  const methodName = (mid: string) => methods.find((m) => m.id === mid)?.name ?? 'Método desconocido';
  const sizes = Object.fromEntries(cabinets.map((c) => [c.id, c.design.size]));

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
            className="w-full rounded-control border border-border bg-surface px-2 text-2xl font-semibold"
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
      <section aria-labelledby="h-rooms" className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="h-rooms" className="text-lg font-semibold">
            Ambientes
          </h2>
          <Button size="sm" onClick={() => setCreatingRoom(true)}>
            Nuevo ambiente
          </Button>
        </div>
        {rooms.length === 0 ? (
          <p className="rounded-card border border-dashed border-border px-4 py-3 text-sm text-muted">
            Dibujá la planta de la cocina o la habitación (paredes, puertas, ventanas) y colocá los muebles del proyecto en ella.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => (
              <li key={r.id} className="flex gap-3 rounded-card border border-border bg-surface p-3 shadow-1">
                <Link href={`/ambientes/${r.id}`} className="shrink-0 rounded-control bg-surface-2 p-1" tabIndex={-1} aria-hidden>
                  <RoomSketch plan={r.plan} sizes={sizes} className="h-20 w-24" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/ambientes/${r.id}`} className="block truncate font-medium hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-sm text-muted">
                    {fmtNum(floorAreaM2(r.plan), 1)} m² · {r.plan.placements.length} {r.plan.placements.length === 1 ? 'mueble' : 'muebles'}
                  </p>
                  <div className="mt-1 flex gap-1">
                    <ButtonLink size="sm" href={`/ambientes/${r.id}`}>
                      Abrir
                    </ButtonLink>
                    <Button size="sm" variant="ghost" aria-label={`Eliminar ${r.name}`} onClick={() => setRoomToDelete(r)}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="mb-3 text-lg font-semibold">Muebles</h2>
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
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-1">
          {cabinets.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <Link href={`/muebles/${c.id}`} className="shrink-0 rounded-control bg-surface-2 p-1" tabIndex={-1} aria-hidden>
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

      <NewRoomDialog
        open={creatingRoom}
        onClose={() => setCreatingRoom(false)}
        onCreate={async ({ name, plan }) => {
          const r = await data.createRoom({ projectId: project.id, name, plan });
          router.push(`/ambientes/${r.id}`);
        }}
      />
      <ConfirmDialog
        open={!!roomToDelete}
        title="Eliminar ambiente"
        message={
          <>
            Se borrará <strong className="text-text">{roomToDelete?.name}</strong> con su planta. Los muebles del proyecto no se borran. No se puede deshacer.
          </>
        }
        confirmLabel="Eliminar"
        onClose={() => setRoomToDelete(null)}
        onConfirm={async () => {
          if (roomToDelete) await data.deleteRoom(roomToDelete.id);
          state.reload();
        }}
      />
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
