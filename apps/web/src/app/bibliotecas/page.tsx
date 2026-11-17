'use client';

import { useState } from 'react';
import { mm, PRESET_MATERIALS, PRESET_METHODS, type Material, type Method } from '@mw/engine';
import { Page } from '@/components/AppShell';
import { MaterialDialog } from '@/components/libraries/MaterialDialog';
import { MethodDialog } from '@/components/libraries/MethodDialog';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Alert, ErrorState, LoadingBlock } from '@/components/ui/feedback';
import { data } from '@/data';
import { fmtMm, fmtMoney } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';

const uid = () => globalThis.crypto.randomUUID();

type Editing =
  | { kind: 'material'; value: Material }
  | { kind: 'method'; value: Method; isNew: boolean }
  | null;

type Deleting = { kind: 'material' | 'method'; id: string; name: string } | null;

/** S10 / S11 / S12 · Tableros, cantos y métodos de fabricación, editables. */
export default function LibrariesPage() {
  const state = useAsync(async () => ({ materials: await data.listMaterials(), methods: await data.listMethods() }), []);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Deleting>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const remove = async (d: NonNullable<Deleting>) => {
    setError(null);
    try {
      if (d.kind === 'material') await data.deleteMaterial(d.id);
      else await data.deleteMethod(d.id);
      state.reload();
    } catch (e) {
      setError(`No se puede borrar «${d.name}». ${e instanceof Error ? e.message : ''}`);
    }
  };

  const newMaterial = (kind: Material['kind']): Material => ({
    id: uid(),
    name: '',
    kind,
    thickness: kind === 'panel' ? mm(19) : mm(1),
    grain: 'none',
    priceCents: 0,
    color: 'var(--mat-white)',
  });

  return (
    <Page title="Bibliotecas">
      <p className="-mt-3 mb-6 text-sm text-muted">
        Tus tableros, cantos y métodos de fabricación. Los precios, en pesos, sirven para calcular el costo del material en el despiece.
      </p>
      {state.status === 'loading' && <LoadingBlock />}
      {state.status === 'error' && <ErrorState error={state.error} onRetry={state.reload} />}
      {state.status === 'ready' && (
        <div className="space-y-10">
          {error && (
            <Alert tone="danger" title="No se pudo completar">
              {error}
            </Alert>
          )}

          {(() => {
            const missingMats = PRESET_MATERIALS.filter((m) => !state.data.materials.some((x) => x.id === m.id));
            const missingMethods = PRESET_METHODS.filter((m) => !state.data.methods.some((x) => x.id === m.id));
            if (missingMats.length + missingMethods.length === 0) return null;
            return (
              <Alert tone="info" title="Materiales y métodos de partida para Argentina">
                <p>
                  Melamina de 18 mm, fibrofácil de 3 mm, tapacantos de 0,45 y 2 mm y dos métodos con esas medidas. Te faltan {missingMats.length} materiales y{' '}
                  {missingMethods.length} métodos. Se agregan sin precio y sin tocar lo que ya tenés.
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  className="mt-2"
                  disabled={adding}
                  onClick={async () => {
                    setAdding(true);
                    setError(null);
                    try {
                      for (const m of missingMats) await data.saveMaterial(m);
                      for (const m of missingMethods) await data.saveMethod(m);
                      state.reload();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    } finally {
                      setAdding(false);
                    }
                  }}
                >
                  {adding ? 'Agregando…' : 'Agregarlos'}
                </Button>
              </Alert>
            );
          })()}

          {(['panel', 'edge'] as const).map((kind) => {
            const list = state.data.materials.filter((m) => m.kind === kind);
            return (
              <section key={kind} aria-labelledby={`h-${kind}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 id={`h-${kind}`} className="text-lg font-semibold">
                    {kind === 'panel' ? 'Tableros' : 'Cantos'}
                  </h2>
                  <Button size="sm" onClick={() => setEditing({ kind: 'material', value: newMaterial(kind) })}>
                    {kind === 'panel' ? 'Nuevo tablero' : 'Nuevo canto'}
                  </Button>
                </div>
                <ul className="divide-y divide-border rounded-m border border-border bg-surface shadow-1">
                  {list.length === 0 && <li className="px-4 py-3 text-sm text-muted">Todavía no hay ninguno.</li>}
                  {list.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span aria-hidden className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-border" style={{ background: m.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium break-words">{m.name}</span>
                        <span className="tabular block text-xs text-muted">
                          {fmtMm(m.thickness)} mm{m.grain === 'length' ? ' · con veta' : ''} ·{' '}
                          {m.priceCents > 0 ? `${fmtMoney(m.priceCents)} / ${kind === 'panel' ? 'm²' : 'm'}` : <span className="font-medium text-warning">sin precio</span>}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ kind: 'material', value: m })}>
                          Editar
                        </Button>
                        <Button size="sm" variant="ghost" aria-label={`Borrar ${m.name}`} onClick={() => setDeleting({ kind: 'material', id: m.id, name: m.name })}>
                          Borrar
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <section aria-labelledby="h-methods">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="h-methods" className="text-lg font-semibold">
                Métodos de fabricación
              </h2>
              <Button
                size="sm"
                onClick={() =>
                  setEditing({
                    kind: 'method',
                    isNew: true,
                    value: { ...structuredClone(state.data.methods[0] ?? PRESET_METHODS[0]!), id: uid(), name: 'Mi método' },
                  })
                }
              >
                Nuevo método
              </Button>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {state.data.methods.map((m) => (
                <MethodCard
                  key={m.id}
                  method={m}
                  materials={state.data.materials}
                  onEdit={() => setEditing({ kind: 'method', value: m, isNew: false })}
                  onDuplicate={() => setEditing({ kind: 'method', isNew: true, value: { ...structuredClone(m), id: uid(), name: `${m.name} (copia)` } })}
                  onDelete={() => setDeleting({ kind: 'method', id: m.id, name: m.name })}
                />
              ))}
            </ul>
          </section>

          {editing?.kind === 'material' && (
            <MaterialDialog
              key={editing.value.id}
              open
              initial={editing.value}
              onClose={() => setEditing(null)}
              onSave={async (m) => {
                await data.saveMaterial(m);
                state.reload();
              }}
            />
          )}
          {editing?.kind === 'method' && (
            <MethodDialog
              key={editing.value.id}
              open
              isNew={editing.isNew}
              initial={editing.value}
              materials={state.data.materials}
              onClose={() => setEditing(null)}
              onSave={async (m) => {
                await data.saveMethod(m);
                state.reload();
              }}
            />
          )}
          <ConfirmDialog
            open={!!deleting}
            title={deleting?.kind === 'method' ? 'Borrar método' : 'Borrar material'}
            message={<>¿Borrar «{deleting?.name}»? No se puede deshacer.</>}
            confirmLabel="Borrar"
            onConfirm={() => deleting && void remove(deleting)}
            onClose={() => setDeleting(null)}
          />
        </div>
      )}
    </Page>
  );
}

function MethodCard({
  method: m,
  materials,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  method: Method;
  materials: Material[];
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const name = (id: string | null) => (id ? (materials.find((x) => x.id === id)?.name ?? '(borrado)') : 'sin canto');
  return (
    <li className="flex flex-col rounded-m border border-border bg-surface p-4 text-sm shadow-1">
      <h3 className="font-semibold">{m.name}</h3>
      <dl className="mt-2 grid flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted">
        <dt>Estructura</dt>
        <dd className="text-text">
          {name(m.carcassMaterialId)} · canto {name(m.frontEdgeMaterialId)}
        </dd>
        <dt>Trasera</dt>
        <dd className="text-text">
          {m.back.mode === 'none'
            ? 'sin trasera'
            : `${name(m.back.materialId)} · ${m.back.mode === 'groove' ? `en ranura de ${fmtMm(m.back.grooveDepth)} mm a ${fmtMm(m.back.inset)} mm del fondo` : 'clavada por detrás'}`}
        </dd>
        <dt>Estantes</dt>
        <dd className="text-text">retranqueados {fmtMm(m.shelfFrontSetback)} mm</dd>
        <dt>Frentes</dt>
        <dd className="text-text">
          {name(m.fronts.materialId)} · {name(m.fronts.edgeMaterialId)} · holgura {fmtMm(m.fronts.gap)} mm
        </dd>
        <dt>Cajones</dt>
        <dd className="text-text">
          {name(m.drawer.materialId)}, fondo {name(m.drawer.bottomMaterialId)} {m.drawer.bottomMode === 'groove' ? 'en ranura' : 'clavado'} · guías {fmtMm(m.drawer.sideClearance)} mm
        </dd>
      </dl>
      <div className="mt-3 flex flex-wrap gap-1">
        <Button size="sm" onClick={onEdit}>
          Editar
        </Button>
        <Button size="sm" variant="ghost" onClick={onDuplicate}>
          Duplicar
        </Button>
        <Button size="sm" variant="ghost" aria-label={`Borrar ${m.name}`} onClick={onDelete}>
          Borrar
        </Button>
      </div>
    </li>
  );
}
