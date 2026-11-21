'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { compute, type Hardware, type Material, type Method } from '@mw/engine';
import { buttonClass, Button } from '@/components/ui/Button';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { Icon, type IconName } from '@/components/ui/Icon';
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
      <div className="flex min-h-0 flex-1 flex-col bg-viewer lg:h-[calc(100dvh-3rem)] lg:flex-none">
        {/* barra superior */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-surface px-2 py-1.5 sm:px-3">
          <Link href={`/proyectos/${cabinet.projectId}`} className={buttonClass('ghost', 'icon-sm', 'text-muted hover:text-text')} aria-label="Volver al proyecto">
            <Icon name="back" />
          </Link>
          <input
            aria-label="Nombre del mueble"
            value={name}
            maxLength={120}
            onChange={(e) => store.getState().setName(e.target.value)}
            className="font-display h-8 min-w-[9rem] flex-1 rounded-control border border-transparent bg-transparent px-2 text-[15px] font-semibold tracking-tight hover:border-border focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20 sm:max-w-sm"
          />
          <SaveBadge state={save} />
          <div className="ml-auto flex items-center gap-1">
            <Button size="icon-sm" variant="ghost" onClick={() => store.getState().undo()} disabled={!canUndo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
              <Icon name="undo" />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => store.getState().redo()} disabled={!canRedo} aria-label="Rehacer" title="Rehacer (Ctrl+Y)">
              <Icon name="redo" />
            </Button>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <Button size="sm" onClick={() => setStlOpen(true)} title="Exportar a STL para impresión 3D">
              <Icon name="download" size={16} className="-ml-0.5" />
              STL
            </Button>
            <Link href={`/muebles/${cabinet.id}/despiece`} className={buttonClass('primary', 'sm')}>
              Despiece
            </Link>
          </div>
        </div>
        <StlExportDialog open={stlOpen} onClose={() => setStlOpen(false)} parts={result.parts} zones={result.zones} size={design.size} name={name} />
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
        {/*
          Escritorio: la escena (bg-viewer) es el fondo de todo y los paneles flotan encima como tarjetas,
          así el mueble se lee como protagonista. Móvil: visor arriba y panel con pestañas debajo.
        */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[264px_minmax(0,1fr)_348px] lg:grid-rows-[minmax(0,1fr)] lg:gap-3 lg:p-3">
          <aside className="hidden overflow-y-auto rounded-card border border-border bg-surface shadow-float lg:block" aria-label="Estructura">
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
              <span className="measure rounded-full bg-surface/95 px-3 py-1.5 text-xs font-medium shadow-float">{fmtDims(design.size.w, design.size.h, design.size.d)} mm</span>
              <QuickTools />
            </div>
            <div className="absolute bottom-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 gap-0.5 rounded-full border border-border bg-surface/95 p-1 shadow-float backdrop-blur" role="toolbar" aria-label="Vista">
              <ToggleBtn
                icon={view.ortho ? 'square' : 'cube'}
                pressed={!view.ortho}
                onClick={() => store.getState().setView({ ortho: !view.ortho })}
                title={view.ortho ? 'Vista ortogonal, sin perspectiva: para ver las medidas de frente. Tocá para pasar a perspectiva' : 'Vista en perspectiva. Tocá para pasar a ortogonal (sin perspectiva)'}
              >
                {view.ortho ? 'Ortogonal' : 'Perspectiva'}
              </ToggleBtn>
              <ToggleBtn icon="wire" pressed={view.wire} onClick={() => store.getState().setView({ wire: !view.wire })} title="Ver solo los bordes de las piezas, para ver lo de adentro">
                Alámbrico
              </ToggleBtn>
              <ToggleBtn icon="ruler" pressed={view.dims} onClick={() => store.getState().setView({ dims: !view.dims })} title="Mostrar u ocultar las medidas sobre el dibujo">
                Cotas
              </ToggleBtn>
              {hasFronts && (
                <ToggleBtn
                  icon="door"
                  pressed={view.fronts !== 'closed'}
                  onClick={() => store.getState().setView({ fronts: NEXT_FRONTS[view.fronts] })}
                  title="Cambiar cómo se ven puertas y cajones: cerrados, abiertos o sin frentes"
                >
                  {FRONTS_LABEL[view.fronts]}
                </ToggleBtn>
              )}
              <ToggleBtn icon="focus" onClick={() => store.getState().resetCamera()} title="Volver a encuadrar el mueble entero. Girá con el mouse o un dedo; zoom con la rueda o dos dedos">
                Centrar
              </ToggleBtn>
            </div>
            <p className="sr-only" aria-live="polite">
              {selection.kind === 'zone' ? `Seleccionado: ${labels.get(selection.id)?.full}` : selection.kind === 'part' ? `Seleccionada una pieza` : ''}
            </p>
          </section>

          <aside className="border-t border-border bg-surface lg:overflow-y-auto lg:rounded-card lg:border lg:shadow-float" aria-label="Propiedades">
            <div className="sticky top-0 z-10 m-2 flex gap-0.5 rounded-full bg-surface-2 p-0.5 lg:hidden" role="tablist" aria-label="Panel">
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
                  className={`flex-1 rounded-full px-3 py-2 text-sm transition-colors ${mobileTab === k ? 'bg-surface font-medium text-text shadow-1' : 'text-muted'}`}
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

/**
 * Botón de la barra de vista. En pantallas chicas muestra solo el icono (el texto queda como
 * nombre accesible y como tooltip); en las demás, icono + texto.
 */
function ToggleBtn({ pressed, onClick, children, title, icon }: { pressed?: boolean; onClick: () => void; children: string; title?: string; icon: IconName }) {
  return (
    <button
      type="button"
      title={title ?? children}
      aria-label={children}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors sm:px-3 ${pressed ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-text'}`}
    >
      <Icon name={icon} size={17} />
      <span className="hidden sm:inline" aria-hidden>
        {children}
      </span>
    </button>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const text = { saved: 'Guardado', saving: 'Guardando…', error: 'Sin guardar', conflict: 'Conflicto' }[state.kind];
  const tone = state.kind === 'saved' ? 'text-muted' : state.kind === 'saving' ? 'text-muted' : 'text-danger';
  const dot = state.kind === 'saved' ? 'bg-border-strong' : state.kind === 'saving' ? 'animate-pulse bg-accent' : 'bg-danger';
  return (
    <span className={`flex items-center gap-1.5 text-xs ${tone}`} role="status" aria-live="polite">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  );
}
