'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { compute, type Hardware, type Material, type Method } from '@mw/engine';
import { useAuth } from '@/components/auth/AuthProvider';
import { buttonClass, Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
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

type SaveState =
  | { kind: 'saved'; at: Date | null }
  | { kind: 'saving' }
  | { kind: 'offline' }
  | { kind: 'error'; message: string }
  | { kind: 'conflict' };

type MobileSheetSnap = 'peek' | 'half' | 'full';

/** S03 · Editor de mueble: lienzo 3D protagonista + inspectores colapsables + bottom sheet móvil + resolución de conflictos Supabase. */
export function Editor({ cabinet, materials, methods, hardware }: { cabinet: Cabinet; materials: Material[]; methods: Method[]; hardware: Hardware[] }) {
  const router = useRouter();
  const { mode } = useAuth();
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

  // Inspectores laterales colapsables en escritorio (Tab alterna modo foco).
  const [treeOpen, setTreeOpen] = useState(true);
  const [propsOpen, setPropsOpen] = useState(true);

  // Panel deslizable móvil en 3 alturas (peek | half | full).
  const [mobileTab, setMobileTab] = useState<'props' | 'tree'>('props');
  const [sheetSnap, setSheetSnap] = useState<MobileSheetSnap>('half');
  const touchStartY = useRef<number | null>(null);

  const [stlOpen, setStlOpen] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [savingCopy, setSavingCopy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Si lo seleccionado desaparece (p. ej. al quitar divisiones), volver al mueble.
  useEffect(() => {
    const s = store.getState().selection;
    if (s.kind === 'zone' && !result.zones.some((z) => z.id === s.id)) store.getState().select({ kind: 'cabinet' });
    if (s.kind === 'part' && !result.parts.some((p) => p.key === s.key)) store.getState().select({ kind: 'cabinet' });
  }, [result, store]);

  // — guardado automático con control de versión (rev) y detección de conexión —
  const rev = useRef(cabinet.rev);
  const [save, setSave] = useState<SaveState>({ kind: 'saved', at: null });
  const [saveTick, setSaveTick] = useState(0);
  const first = useRef(true);

  const persistNow = useCallback(async () => {
    if (mode === 'cloud' && typeof navigator !== 'undefined' && !navigator.onLine) {
      setSave({ kind: 'offline' });
      return;
    }
    setSave({ kind: 'saving' });
    try {
      rev.current = await data.saveCabinet(cabinet.id, rev.current, {
        design,
        methodId,
        quantity,
        name: name.trim() || cabinet.name,
      });
      setSave({ kind: 'saved', at: new Date() });
    } catch (e) {
      if (e instanceof ConflictError) {
        setSave({ kind: 'conflict' });
        setConflictModalOpen(true);
      } else if (mode === 'cloud' && typeof navigator !== 'undefined' && !navigator.onLine) {
        setSave({ kind: 'offline' });
      } else {
        setSave({ kind: 'error', message: e instanceof Error ? e.message : 'Error al guardar' });
      }
    }
  }, [cabinet.id, cabinet.name, design, methodId, mode, name, quantity]);

  const handleSaveAsCopy = async () => {
    setSavingCopy(true);
    setCopyError(null);
    try {
      const baseName = (name.trim() || cabinet.name).slice(0, 108);
      const created = await data.createCabinet({
        projectId: cabinet.projectId,
        name: `${baseName} (copia)`,
        methodId,
        design,
        quantity,
      });
      setConflictModalOpen(false);
      setSave({ kind: 'saved', at: new Date() });
      router.push(`/muebles/${created.id}`);
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : 'No se pudo crear la copia en este proyecto.');
    } finally {
      setSavingCopy(false);
    }
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (mode === 'cloud' && typeof navigator !== 'undefined' && !navigator.onLine) {
      setSave({ kind: 'offline' });
      return;
    }
    setSave({ kind: 'saving' });
    const t = setTimeout(() => {
      void persistNow();
    }, 600);
    return () => clearTimeout(t);
  }, [design, methodId, quantity, name, mode, saveTick, persistNow]);

  // Reintento automático cuando vuelve la conexión en modo Supabase.
  useEffect(() => {
    if (mode !== 'cloud') return;
    const onOnline = () => {
      setSave((prev) => {
        if (prev.kind === 'offline' || prev.kind === 'error') {
          setSaveTick((n) => n + 1);
          return { kind: 'saving' };
        }
        return prev;
      });
    };
    const onOffline = () => {
      setSave((prev) => (prev.kind === 'saving' ? { kind: 'offline' } : prev));
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [mode]);

  // Aviso al cerrar con cambios sin guardar.
  useEffect(() => {
    if (save.kind === 'saved') return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [save.kind]);

  // — atajos de teclado (Ctrl+Z, Ctrl+Y, Esc, Tab para modo foco) —
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (document.querySelector('dialog[open]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        store.getState().undo();
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        store.getState().redo();
      } else if (e.key === 'Escape') {
        store.getState().select({ kind: 'cabinet' });
      } else if (e.key === 'Tab' && !mod && !e.altKey) {
        e.preventDefault();
        const bothClosed = !treeOpen && !propsOpen;
        setTreeOpen(bothClosed);
        setPropsOpen(bothClosed);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [store, treeOpen, propsOpen]);

  const cycleSheetSnap = () => {
    setSheetSnap((s) => (s === 'half' ? 'peek' : s === 'peek' ? 'full' : 'half'));
  };

  const handleSheetTouchStart = (y: number) => {
    touchStartY.current = y;
  };

  const handleSheetTouchEnd = (y: number) => {
    if (touchStartY.current === null) return;
    const dy = y - touchStartY.current;
    touchStartY.current = null;
    if (Math.abs(dy) < 32) return;
    if (dy < 0) {
      // Deslizar hacia arriba: expandir
      setSheetSnap((s) => (s === 'peek' ? 'half' : 'full'));
    } else {
      // Deslizar hacia abajo: contraer
      setSheetSnap((s) => (s === 'full' ? 'half' : 'peek'));
    }
  };

  const mobileSheetHeightClass =
    sheetSnap === 'peek' ? 'h-[76px]' : sheetSnap === 'half' ? 'h-[48dvh]' : 'h-[80dvh]';

  const mobileCameraBottomClass =
    sheetSnap === 'peek'
      ? 'bottom-[88px] lg:bottom-3'
      : sheetSnap === 'half'
        ? 'bottom-[calc(48dvh+12px)] lg:bottom-3'
        : 'pointer-events-none opacity-0 lg:pointer-events-auto lg:bottom-3 lg:opacity-100';

  const env: EditorEnv = { store, result, materials, methods, method, hardware, labels };

  return (
    <EditorContext.Provider value={env}>
      <div className="flex h-[calc(100dvh-3rem)] min-h-0 flex-col overflow-hidden bg-viewer">
        {/* barra superior del editor */}
        <div className="z-20 flex flex-wrap items-center gap-1.5 border-b border-border bg-surface px-2 py-1.5 sm:px-3">
          <Link href={`/proyectos/${cabinet.projectId}`} className={buttonClass('ghost', 'icon-sm', 'text-muted hover:text-text')} aria-label="Volver al proyecto" title="Volver al proyecto">
            <Icon name="back" />
          </Link>
          <input
            aria-label="Nombre del mueble"
            value={name}
            maxLength={120}
            onChange={(e) => store.getState().setName(e.target.value)}
            className="font-display h-8 min-w-[8rem] flex-1 rounded-control border border-transparent bg-transparent px-2 text-[15px] font-semibold tracking-tight hover:border-border focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20 sm:max-w-xs"
          />
          <SaveBadge state={save} mode={mode} onConflictClick={() => setConflictModalOpen(true)} />

          {/* conmutador contextual de proyecto: Mueble | Despiece | Proyecto */}
          <nav aria-label="Vistas del mueble" className="hidden items-center gap-0.5 rounded-full bg-surface-2 p-0.5 md:flex">
            <span aria-current="page" className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-text shadow-1">
              Mueble 3D
            </span>
            <Link href={`/muebles/${cabinet.id}/despiece`} className="rounded-full px-3 py-1 text-xs text-muted transition-colors hover:text-text">
              Despiece
            </Link>
            <Link href={`/proyectos/${cabinet.projectId}/despiece`} className="rounded-full px-3 py-1 text-xs text-muted transition-colors hover:text-text">
              Cortes proyecto
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            {/* controles de inspectores en escritorio */}
            <div className="hidden items-center gap-0.5 lg:flex">
              <button
                type="button"
                onClick={() => setTreeOpen((v) => !v)}
                aria-pressed={treeOpen}
                aria-label="Mostrar u ocultar panel de estructura"
                title={treeOpen ? 'Ocultar estructura (Tab oculta ambos)' : 'Mostrar estructura (Tab)'}
                className={`flex h-8 w-8 items-center justify-center rounded-control transition-colors ${treeOpen ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-text'}`}
              >
                <PanelIcon side="left" />
              </button>
              <button
                type="button"
                onClick={() => setPropsOpen((v) => !v)}
                aria-pressed={propsOpen}
                aria-label="Mostrar u ocultar panel de propiedades"
                title={propsOpen ? 'Ocultar propiedades (Tab oculta ambos)' : 'Mostrar propiedades (Tab)'}
                className={`flex h-8 w-8 items-center justify-center rounded-control transition-colors ${propsOpen ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-text'}`}
              >
                <PanelIcon side="right" />
              </button>
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            </div>

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
            <Link href={`/muebles/${cabinet.id}/despiece`} className={buttonClass('primary', 'sm', 'md:hidden')}>
              Despiece
            </Link>
          </div>
        </div>

        <StlExportDialog open={stlOpen} onClose={() => setStlOpen(false)} parts={result.parts} zones={result.zones} legs={result.legs} size={design.size} name={name} />

        {/* Modal interactivo de resolución de ConflictError (concurrencia optimista rev en Supabase) */}
        <Dialog
          open={conflictModalOpen}
          onClose={() => setConflictModalOpen(false)}
          title="Conflicto de guardado en la nube"
          footer={
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <Button onClick={() => setStlOpen(true)} disabled={savingCopy}>
                Exportar STL
              </Button>
              <Button onClick={() => window.location.reload()} disabled={savingCopy}>
                Recargar versión nube
              </Button>
              <Button variant="primary" onClick={() => void handleSaveAsCopy()} disabled={savingCopy}>
                {savingCopy ? 'Guardando copia…' : 'Guardar como copia'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm text-muted">
            <p>
              Este mueble se actualizó en Supabase desde otro dispositivo o pestaña mientras lo editabas. Para no pisar ningún cambio, el autoguardado quedó en pausa.
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-text">
              <li>
                <strong>Guardar como copia:</strong> crea un mueble nuevo en este proyecto con tus cambios actuales y lo abre al instante.
              </li>
              <li>
                <strong>Recargar versión nube:</strong> descarta tus últimos cambios locales y trae la versión más reciente de Supabase.
              </li>
              <li>
                <strong>Exportar STL:</strong> descarga el modelo actual como respaldo antes de decidir.
              </li>
            </ul>
            {copyError && (
              <Alert tone="danger" title="No se pudo guardar la copia">
                {copyError}
              </Alert>
            )}
          </div>
        </Dialog>

        {/* alertas inline de sincronización */}
        {save.kind === 'conflict' && !conflictModalOpen && (
          <div className="z-20 px-3 pt-2">
            <Alert tone="danger" title="Este mueble se modificó desde otro dispositivo o pestaña">
              Tus últimos cambios no se subieron a Supabase.{' '}
              <button type="button" className="font-medium underline" onClick={() => setConflictModalOpen(true)}>
                Elegir cómo resolver el conflicto
              </button>
            </Alert>
          </div>
        )}
        {save.kind === 'offline' && (
          <div className="z-20 px-3 pt-2">
            <Alert tone="warning" title="Sin conexión a internet">
              Podés seguir editando; los cambios se sincronizarán en Supabase automáticamente cuando vuelva la señal.{' '}
              <button type="button" className="font-medium underline" onClick={() => void persistNow()}>
                Reintentar ahora
              </button>
            </Alert>
          </div>
        )}
        {save.kind === 'error' && (
          <div className="z-20 px-3 pt-2">
            <Alert tone="danger" title="No se ha podido guardar">
              {save.message}{' '}
              <button type="button" className="font-medium underline" onClick={() => void persistNow()}>
                Reintentar
              </button>
            </Alert>
          </div>
        )}

        {/*
          Cuerpo del editor:
          - Escritorio (lg+): visor 3D a pantalla completa + inspectores flotantes colapsables.
          - Móvil (<lg): visor 3D a pantalla completa + bottom sheet deslizable de 3 alturas.
        */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/* Lienzo 3D protagonista */}
          <section className="relative h-full w-full bg-viewer" aria-label="Vista 3D">
            <CabinetViewer
              size={design.size}
              parts={result.parts}
              zones={result.zones}
              legs={result.legs}
              cornerMechanism={result.cornerMechanism}
              materials={materials}
              selection={selection}
              hover={hover}
              view={view}
              onSelect={(s) => store.getState().select(s)}
              onHover={(h) => store.getState().setHover(h)}
            />

            {/* Chip de dimensiones + herramientas rápidas, respetando inspectores flotantes en escritorio */}
            <div
              className={`pointer-events-none absolute top-3 right-3 left-3 flex flex-wrap items-start gap-2 transition-[left,right] duration-200 ${
                treeOpen ? 'lg:left-[288px]' : 'lg:left-14'
              } ${propsOpen ? 'lg:right-[372px]' : 'lg:right-14'}`}
            >
              <span className="measure rounded-full bg-surface/95 px-3 py-1.5 text-xs font-medium shadow-float backdrop-blur">
                {fmtDims(design.size.w, design.size.h, design.size.d)} mm
              </span>
              <QuickTools />
            </div>

            {/* Botones rápidos en los bordes para reabrir inspectores colapsados (escritorio) */}
            {!treeOpen && (
              <button
                type="button"
                onClick={() => setTreeOpen(true)}
                aria-label="Abrir panel de estructura"
                title="Abrir estructura (Tab)"
                className="absolute top-3 left-3 hidden h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/95 text-muted shadow-float backdrop-blur transition-colors hover:text-text lg:flex"
              >
                <PanelIcon side="left" />
              </button>
            )}
            {!propsOpen && (
              <button
                type="button"
                onClick={() => setPropsOpen(true)}
                aria-label="Abrir panel de propiedades"
                title="Abrir propiedades (Tab)"
                className="absolute top-3 right-3 hidden h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/95 text-muted shadow-float backdrop-blur transition-colors hover:text-text lg:flex"
              >
                <PanelIcon side="right" />
              </button>
            )}

            {/* Barra flotante de cámara (se adapta automáticamente a la altura del bottom sheet en móvil) */}
            <div
              className={`absolute left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 gap-0.5 rounded-full border border-border bg-surface/95 p-1 shadow-float backdrop-blur transition-all duration-200 ${mobileCameraBottomClass}`}
              role="toolbar"
              aria-label="Vista"
            >
              <ToggleBtn
                icon={view.ortho ? 'square' : 'cube'}
                pressed={!view.ortho}
                onClick={() => store.getState().setView({ ortho: !view.ortho })}
                title={
                  view.ortho
                    ? 'Vista ortogonal, sin perspectiva: para ver las medidas de frente. Tocá para pasar a perspectiva'
                    : 'Vista en perspectiva. Tocá para pasar a ortogonal (sin perspectiva)'
                }
              >
                {view.ortho ? 'Ortogonal' : 'Perspectiva'}
              </ToggleBtn>
              <ToggleBtn
                icon="wire"
                pressed={view.wire}
                onClick={() => store.getState().setView({ wire: !view.wire })}
                title="Ver solo los bordes de las piezas, para ver lo de adentro"
              >
                Alámbrico
              </ToggleBtn>
              <ToggleBtn
                icon="ruler"
                pressed={view.dims}
                onClick={() => store.getState().setView({ dims: !view.dims })}
                title="Mostrar u ocultar las medidas sobre el dibujo"
              >
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
              <ToggleBtn
                icon="focus"
                onClick={() => store.getState().resetCamera()}
                title="Volver a encuadrar el mueble entero. Girá con el mouse o un dedo; zoom con la rueda o dos dedos"
              >
                Centrar
              </ToggleBtn>
            </div>

            <p className="sr-only" aria-live="polite">
              {selection.kind === 'zone' ? `Seleccionado: ${labels.get(selection.id)?.full}` : selection.kind === 'part' ? 'Seleccionada una pieza' : ''}
            </p>
          </section>

          {/* Inspector izquierdo flotante: Estructura (escritorio) */}
          <aside
            aria-label="Estructura"
            aria-hidden={!treeOpen}
            className={`hidden overflow-y-auto rounded-card border border-border bg-surface/95 shadow-float backdrop-blur-md transition-transform duration-200 lg:absolute lg:top-3 lg:bottom-3 lg:left-3 lg:z-10 lg:block lg:w-[264px] ${
              treeOpen ? 'lg:translate-x-0' : 'lg:pointer-events-none lg:-translate-x-[284px]'
            }`}
          >
            <StructureTree />
          </aside>

          {/* Inspector derecho flotante (escritorio) / Bottom sheet deslizable de 3 alturas (móvil) */}
          <aside
            aria-label="Propiedades"
            className={`absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-sheet border-t border-border bg-surface/95 shadow-2 backdrop-blur-md transition-[height,transform] duration-200 ${mobileSheetHeightClass} lg:inset-x-auto lg:top-3 lg:right-3 lg:bottom-3 lg:h-auto lg:w-[348px] lg:rounded-card lg:border lg:shadow-float ${
              propsOpen ? 'lg:translate-x-0' : 'lg:pointer-events-none lg:translate-x-[368px]'
            }`}
          >
            {/* Cabecera táctil del bottom sheet en móvil */}
            <div
              className="shrink-0 touch-none px-3 pt-2 pb-1.5 lg:hidden"
              onTouchStart={(e) => {
                const t = e.touches[0];
                if (t) handleSheetTouchStart(t.clientY);
              }}
              onTouchEnd={(e) => {
                const t = e.changedTouches[0];
                if (t) handleSheetTouchEnd(t.clientY);
              }}
            >
              <button
                type="button"
                onClick={cycleSheetSnap}
                aria-label={
                  sheetSnap === 'peek'
                    ? 'Expandir panel inferior'
                    : sheetSnap === 'half'
                      ? 'Minimizar panel para ver el 3D'
                      : 'Volver el panel a altura media'
                }
                title="Tocá o deslizá para cambiar la altura del panel"
                className="mx-auto mb-2 flex w-full items-center justify-center py-1"
              >
                <span className="h-1 w-10 rounded-full bg-border-strong" aria-hidden />
              </button>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-0.5 rounded-full bg-surface-2 p-0.5" role="tablist" aria-label="Panel">
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
                      onClick={() => {
                        setMobileTab(k);
                        if (sheetSnap === 'peek') setSheetSnap('half');
                      }}
                      className={`flex-1 rounded-full px-3 py-1.5 text-sm transition-colors ${mobileTab === k ? 'bg-surface font-medium text-text shadow-1' : 'text-muted'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSheetSnap((s) => (s === 'peek' ? 'half' : 'peek'))}
                  aria-label={sheetSnap === 'peek' ? 'Mostrar panel' : 'Ver 3D completo'}
                  className="shrink-0 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:text-text"
                >
                  {sheetSnap === 'peek' ? 'Editar' : 'Ver 3D'}
                </button>
              </div>
            </div>

            <div className={`min-h-0 flex-1 overflow-y-auto ${sheetSnap === 'peek' ? 'hidden lg:block' : ''}`}>
              <div className={mobileTab === 'props' ? '' : 'hidden lg:block'}>
                <PropertiesPanel />
              </div>
              <div className={mobileTab === 'tree' ? 'lg:hidden' : 'hidden'}>
                <StructureTree />
              </div>
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

/** Icono minimalista para alternar los paneles laterales sin depender de nuevos nombres en IconName. */
function PanelIcon({ side }: { side: 'left' | 'right' }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
      <line x1={side === 'left' ? '7.5' : '12.5'} y1="3.5" x2={side === 'left' ? '7.5' : '12.5'} y2="16.5" />
    </svg>
  );
}

function SaveBadge({
  state,
  mode,
  onConflictClick,
}: {
  state: SaveState;
  mode: 'cloud' | 'local';
  onConflictClick: () => void;
}) {
  const isCloud = mode === 'cloud';
  const timeStr =
    state.kind === 'saved' && state.at
      ? state.at.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      : null;

  let text = isCloud ? 'En la nube' : 'En este navegador';
  let tone = isCloud ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted';
  let dot = isCloud ? 'bg-success' : 'bg-border-strong';
  let title = isCloud
    ? timeStr
      ? `Sincronizado en Supabase a las ${timeStr}`
      : 'Sincronizado en Supabase'
    : 'Guardado localmente en este navegador';

  if (state.kind === 'saving') {
    text = 'Guardando…';
    tone = 'bg-accent-soft text-accent';
    dot = 'animate-pulse bg-accent';
    title = isCloud ? 'Guardando cambios en Supabase…' : 'Guardando cambios localmente…';
  } else if (state.kind === 'offline') {
    text = 'Sin conexión';
    tone = 'bg-warning-soft text-warning';
    dot = 'bg-warning';
    title = 'Sin conexión: se sincronizará automáticamente al reconectar';
  } else if (state.kind === 'conflict') {
    text = 'Conflicto';
    tone = 'bg-danger-soft text-danger';
    dot = 'bg-danger';
    title = 'Otra sesión modificó este mueble en Supabase. Tocá para resolverlo';
  } else if (state.kind === 'error') {
    text = 'Sin guardar';
    tone = 'bg-danger-soft text-danger';
    dot = 'bg-danger';
    title = state.message;
  }

  if (state.kind === 'conflict') {
    return (
      <button
        type="button"
        onClick={onConflictClick}
        title={title}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone} hover:underline`}
        role="status"
        aria-live="polite"
      >
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        <span>{text}</span>
      </button>
    );
  }

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="hidden sm:inline">{text}</span>
    </span>
  );
}
