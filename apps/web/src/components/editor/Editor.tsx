'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { compute, type Hardware, type Material, type Method } from '@mw/engine';
import { buttonClass, Button } from '@/components/ui/Button';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { StlExportDialog } from '@/components/StlExportDialog';
import { ConflictError, data, type Cabinet } from '@/data';
import { fmtDims } from '@/lib/format';
import { EditorContext, type EditorEnv } from './context';
import { zoneLabels } from './labels';
import { PropertiesPanel } from './PropertiesPanel';
import { QuickTools } from './QuickTools';
import { createEditorStore } from './store';
import { StructureTree } from './StructureTree';

const CabinetViewer = dynamic(() => import('@/components/viewer/CabinetViewer'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const NEXT_FRONTS = { closed: 'open', open: 'hidden', hidden: 'closed' } as const;
const FRONTS_LABEL = { closed: 'Frentes cerrados', open: 'Frentes abiertos', hidden: 'Sin frentes' } as const;

type SaveState = { kind: 'saved' } | { kind: 'saving' } | { kind: 'error'; message: string } | { kind: 'conflict' };

/** S03 · Editor de mueble: estructura + visor 3D + propiedades. */
export function Editor({ cabinet, materials, methods, hardware }: { cabinet: Cabinet; materials: Material[]; methods: Method[]; hardware: Hardware[] }) {
  const storeRef = useRef<ReturnType<typeof createEditorStore>>(null);
  storeRef.current ??= createEditorStore({
    name: cabinet.name,
    design: cabinet.design,
    methodId: cabinet.methodId,
    quantity: cabinet.quantity,
  });
  const store = storeRef.current;

  const design = useStore(store, (s) => s.design);
  const methodId = useStore(store, (s) => s.methodId);
  const quantity = useStore(store, (s) => s.quantity);
  const name = useStore(store, (s) => s.name);
  const selection = useStore(store, (s) => s.selection);
  const hover = useStore(store, (s) => s.hover);
  const view = useStore(store, (s) => s.view);
  const canUndo = useStore(store, (s) => s.past.length > 0);
  const canRedo = useStore(store, (s) => s.future.length > 0);

  const method = methods.find((m) => m.id === methodId) ?? methods[0]!;
  const result = useMemo(() => compute(design, method, materials, hardware), [design, method, materials, hardware]);
  const labels = useMemo(() => zoneLabels(design), [design]);
  const hasFronts = result.parts.some((p) => p.role === 'door' || p.role === 'drawer-front');

  // Si lo seleccionado desaparece (p. ej. al quitar divisiones), volver al mueble.
  useEffect(() => {
    const s = store.getState().selection;
    if (s.kind === 'zone' && !result.zones.some((z) => z.id === s.id)) store.getState().select({ kind: 'cabinet' });
    if (s.kind === 'part' && !result.parts.some((p) => p.key === s.key)) store.getState().select({ kind: 'cabinet' });
  }, [result, store]);

  // ── guardado automático con control de versión ──
  const rev = useRef(cabinet.rev);
  const [save, setSave] = useState<SaveState>({ kind: 'saved' });
  const [stlOpen, setStlOpen] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSave({ kind: 'saving' });
    const t = setTimeout(async () => {
      try {
        rev.current = await data.saveCabinet(cabinet.id, rev.current, { design, methodId, quantity, name: name.trim() || cabinet.name });
        setSave({ kind: 'saved' });
      } catch (e) {
        if (e instanceof ConflictError) setSave({ kind: 'conflict' });
        else setSave({ kind: 'error', message: e instanceof Error ? e.message : 'Error al guardar' });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [design, methodId, quantity, name, cabinet.id, cabinet.name]);

  // Aviso al cerrar con cambios sin guardar.
  useEffect(() => {
    if (save.kind === 'saved') return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [save.kind]);

  // ── atajos de teclado ──
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        store.getState().undo();
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        store.getState().redo();
      } else if (e.key === 'Escape' && !document.querySelector('dialog[open]')) {
        store.getState().select({ kind: 'cabinet' });
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [store]);

  const env: EditorEnv = { store, result, materials, methods, method, hardware, labels };
  const [mobileTab, setMobileTab] = useState<'props' | 'tree'>('props');

  return (
    <EditorContext.Provider value={env}>
      <div className="flex min-h-0 flex-1 flex-col lg:h-[calc(100dvh-3.5rem)]">
        {/* barra superior */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
          <Link href={`/proyectos/${cabinet.projectId}`} className={buttonClass('ghost', 'sm')} aria-label="Volver al proyecto">
            ←
          </Link>
          <input
            aria-label="Nombre del mueble"
            value={name}
            maxLength={120}
            onChange={(e) => store.getState().setName(e.target.value)}
            className="h-8 min-w-[9rem] flex-1 rounded-s border border-transparent bg-transparent px-2 font-semibold hover:border-border focus:border-border sm:max-w-sm"
          />
          <SaveBadge state={save} />
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => store.getState().undo()} disabled={!canUndo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
              ↶
            </Button>
            <Button size="sm" variant="ghost" onClick={() => store.getState().redo()} disabled={!canRedo} aria-label="Rehacer" title="Rehacer (Ctrl+Y)">
              ↷
            </Button>
            <Button size="sm" onClick={() => setStlOpen(true)} title="Exportar a STL para impresión 3D">
              STL
            </Button>
            <Link href={`/muebles/${cabinet.id}/despiece`} className={buttonClass('primary', 'sm')}>
              Despiece
            </Link>
          </div>
        </div>
        <StlExportDialog open={stlOpen} onClose={() => setStlOpen(false)} parts={result.parts} name={name} />
        {save.kind === 'conflict' && (
          <div className="px-3 pt-2">
            <Alert tone="danger" title="Otro dispositivo o pestaña guardó este mueble mientras lo editabas">
              Tus últimos cambios no se han guardado.{' '}
              <button type="button" className="font-medium underline" onClick={() => window.location.reload()}>
                Recargar la versión guardada
              </button>
            </Alert>
          </div>
        )}
        {save.kind === 'error' && (
          <div className="px-3 pt-2">
            <Alert tone="danger" title="No se ha podido guardar">
              {save.message}
            </Alert>
          </div>
        )}

        {/* cuerpo: estructura | visor | propiedades (apilado en móvil) */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)]">
          <aside className="hidden overflow-y-auto border-r border-border bg-surface lg:block" aria-label="Estructura">
            <StructureTree />
          </aside>

          <section className="relative h-[46dvh] min-h-[280px] bg-viewer lg:h-auto" aria-label="Vista 3D">
            <CabinetViewer
              size={design.size}
              parts={result.parts}
              zones={result.zones}
              materials={materials}
              selection={selection}
              hover={hover}
              view={view}
              onSelect={(s) => store.getState().select(s)}
              onHover={(h) => store.getState().setHover(h)}
            />
            <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start gap-2">
              <span className="tabular rounded-s bg-surface/90 px-2 py-1 text-xs shadow-1">{fmtDims(design.size.w, design.size.h, design.size.d)} mm</span>
              <QuickTools />
            </div>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-m bg-surface/95 p-1 shadow-1" role="toolbar" aria-label="Vista">
              <ToggleBtn pressed={!view.ortho} onClick={() => store.getState().setView({ ortho: !view.ortho })}>
                {view.ortho ? 'Ortogonal' : 'Perspectiva'}
              </ToggleBtn>
              <ToggleBtn pressed={view.wire} onClick={() => store.getState().setView({ wire: !view.wire })}>
                Alámbrico
              </ToggleBtn>
              <ToggleBtn pressed={view.dims} onClick={() => store.getState().setView({ dims: !view.dims })}>
                Cotas
              </ToggleBtn>
              {hasFronts && (
                <ToggleBtn
                  pressed={view.fronts !== 'closed'}
                  onClick={() => store.getState().setView({ fronts: NEXT_FRONTS[view.fronts] })}
                  title="Cambiar cómo se ven puertas y cajones"
                >
                  {FRONTS_LABEL[view.fronts]}
                </ToggleBtn>
              )}
              <ToggleBtn onClick={() => store.getState().resetCamera()}>Centrar</ToggleBtn>
            </div>
            <p className="sr-only" aria-live="polite">
              {selection.kind === 'zone' ? `Seleccionado: ${labels.get(selection.id)?.full}` : selection.kind === 'part' ? `Seleccionada una pieza` : ''}
            </p>
          </section>

          <aside className="border-t border-border bg-surface lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Propiedades">
            <div className="flex border-b border-border lg:hidden" role="tablist" aria-label="Panel">
              {(
                [
                  ['props', 'Propiedades'],
                  ['tree', 'Estructura'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={mobileTab === k}
                  onClick={() => setMobileTab(k)}
                  className={`flex-1 px-3 py-2.5 text-sm ${mobileTab === k ? 'border-b-2 border-accent font-medium text-accent' : 'text-muted'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={mobileTab === 'props' ? '' : 'hidden lg:block'}>
              <PropertiesPanel />
            </div>
            <div className={mobileTab === 'tree' ? 'lg:hidden' : 'hidden'}>
              <StructureTree />
            </div>
          </aside>
        </div>
      </div>
    </EditorContext.Provider>
  );
}

function ToggleBtn({ pressed, onClick, children, title }: { pressed?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-s px-3 py-1.5 text-xs font-medium ${pressed ? 'bg-accent-soft text-accent' : 'hover:bg-surface-2'}`}
    >
      {children}
    </button>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const text = { saved: 'Guardado', saving: 'Guardando…', error: 'Sin guardar', conflict: 'Conflicto' }[state.kind];
  const tone = state.kind === 'saved' ? 'text-muted' : state.kind === 'saving' ? 'text-muted' : 'text-danger';
  return (
    <span className={`text-xs ${tone}`} role="status" aria-live="polite">
      {text}
    </span>
  );
}
