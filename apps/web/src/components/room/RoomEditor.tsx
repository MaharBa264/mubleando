'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { analyzeRoom, compute, roomSize, slideOpening, walls, type CabinetSize, type Hardware, type Material, type Method } from '@mw/engine';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button, buttonClass } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/Icon';
import { ConflictError, data, type Cabinet, type Room } from '@/data';
import { PlanView } from './PlanView';
import { RoomPanel } from './RoomPanel';
import { createRoomStore } from './roomStore';
import type { WallsMode } from './RoomViewer3D';

const RoomViewer3D = dynamic(() => import('./RoomViewer3D'), { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-none" /> });

type SaveState =
  | { kind: 'saved'; at: Date | null }
  | { kind: 'saving' }
  | { kind: 'offline' }
  | { kind: 'error'; message: string }
  | { kind: 'conflict' };

type MobileSheetSnap = 'peek' | 'half' | 'full';

/** Editor de un ambiente: planta/3D a pantalla completa + geometrías de obra + panel colapsable + estado Supabase. */
export function RoomEditor({
  room,
  cabinets: initialCabinets,
  materials,
  methods,
  hardware,
}: {
  room: Room;
  cabinets: Cabinet[];
  materials: Material[];
  methods: Method[];
  hardware: Hardware[];
}) {
  const router = useRouter();
  const { mode } = useAuth();
  const storeRef = useRef<ReturnType<typeof createRoomStore>>(null);
  storeRef.current ??= createRoomStore({ name: room.name, plan: room.plan });
  const store = storeRef.current;
  const plan = useStore(store, (s) => s.plan);
  const name = useStore(store, (s) => s.name);
  const selection = useStore(store, (s) => s.selection);
  const view = useStore(store, (s) => s.view);
  const canUndo = useStore(store, (s) => s.past.length > 0);
  const canRedo = useStore(store, (s) => s.future.length > 0);
  const [cabinets, setCabinets] = useState(initialCabinets);
  const [wallsMode, setWallsMode] = useState<WallsMode>('auto');

  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetSnap, setSheetSnap] = useState<MobileSheetSnap>('half');
  const touchStartY = useRef<number | null>(null);

  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [savingCopy, setSavingCopy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const [block, setBlock] = useState(false);
  useEffect(() => {
    try {
      setBlock(window.localStorage.getItem('mw-ambiente-bloquear') === '1');
    } catch {
      /* sin almacenamiento */
    }
  }, []);
  const toggleBlock = (v: boolean) => {
    setBlock(v);
    try {
      window.localStorage.setItem('mw-ambiente-bloquear', v ? '1' : '0');
    } catch {
      /* solo por esta vez */
    }
  };

  const names = useMemo(() => Object.fromEntries(cabinets.map((c) => [c.id, c.name])), [cabinets]);

  const partsByCabinet = useMemo(() => {
    const m = new Map<string, Pick<ReturnType<typeof compute>, 'parts' | 'legs'>>();
    for (const c of cabinets) {
      const method = methods.find((x) => x.id === c.methodId) ?? methods[0];
      if (method) m.set(c.id, compute(c.design, method, materials, hardware));
    }
    return m;
  }, [cabinets, methods, materials, hardware]);

  const sizes = useMemo(() => {
    const out: Record<string, CabinetSize> = {};
    for (const c of cabinets) {
      const method = methods.find((x) => x.id === c.methodId) ?? methods[0];
      out[c.id] = method ? roomSize(c.design, compute(c.design, method, materials, hardware), hardware) : c.design.size;
    }
    return out;
  }, [cabinets, methods, materials, hardware]);

  const warnings = useMemo(() => analyzeRoom(plan, sizes, names), [plan, sizes, names]);
  const flagged = useMemo(() => new Set(warnings.filter((w) => w.code !== 'out_of_square').map((w) => w.placementId).filter(Boolean) as string[]), [warnings]);
  const placed = useMemo(
    () =>
      plan.placements.flatMap((p) => {
        const r = partsByCabinet.get(p.cabinetId);
        return r ? [{ placementId: p.id, x: p.x, y: p.y, rotation: p.rotation, elevation: p.elevation, parts: r.parts, legs: r.legs }] : [];
      }),
    [plan.placements, partsByCabinet],
  );

  const rev = useRef(room.rev);
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
      rev.current = await data.saveRoom(room.id, rev.current, { plan, name: name.trim() || room.name });
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
  }, [mode, name, plan, room.id, room.name]);

  const handleSaveAsCopy = async () => {
    setSavingCopy(true);
    setCopyError(null);
    try {
      const baseName = (name.trim() || room.name).slice(0, 108);
      const created = await data.createRoom({
        projectId: room.projectId,
        name: `${baseName} (copia)`,
        plan,
      });
      setConflictModalOpen(false);
      setSave({ kind: 'saved', at: new Date() });
      router.push(`/ambientes/${created.id}`);
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : 'No se pudo guardar la copia del ambiente.');
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
  }, [plan, name, mode, saveTick, persistNow]);

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

  useEffect(() => {
    if (save.kind === 'saved') return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [save.kind]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (document.querySelector('dialog[open]')) return;
      const mod = e.ctrlKey || e.metaKey;
      const s = store.getState();
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        s.undo();
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        s.redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection.kind === 'placement') {
        const id = s.selection.id;
        s.apply((p) => ({ ...p, placements: p.placements.filter((x) => x.id !== id) }));
        s.select({ kind: 'none' });
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection.kind === 'block') {
        const id = s.selection.id;
        s.apply((p) => ({ ...p, blocks: (p.blocks ?? []).filter((x) => x.id !== id) }));
        s.select({ kind: 'none' });
      } else if (s.selection.kind === 'opening' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const id = s.selection.id;
        const o = s.plan.openings.find((x) => x.id === id);
        if (!o) return;
        const w = walls(s.plan).find((x) => x.id === o.wallId);
        if (!w) return;
        const v = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key as 'ArrowRight']!;
        const along = v[0] * w.dir.x + v[1] * w.dir.y;
        if (Math.abs(along) < 0.3) return;
        const step = (e.shiftKey ? 10000 : 1000) * Math.sign(along);
        s.apply((p) => slideOpening(p, id, o.offset + step));
      } else if (e.key === 'Escape') {
        s.select({ kind: 'none' });
      } else if (e.key === 'Tab' && !mod && !e.altKey) {
        e.preventDefault();
        setPanelOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [store]);

  const setQuantity = async (cabinetId: string, quantity: number) => {
    const c = cabinets.find((x) => x.id === cabinetId);
    if (!c) return;
    try {
      const newRev = await data.saveCabinet(c.id, c.rev, { quantity: Math.min(99, Math.max(1, quantity)) });
      setCabinets((cs) => cs.map((x) => (x.id === c.id ? { ...x, quantity, rev: newRev } : x)));
    } catch (e) {
      setSave({ kind: 'error', message: e instanceof ConflictError ? 'El mueble se cambió en otra pestaña: recargá la página.' : e instanceof Error ? e.message : String(e) });
    }
  };

  const cycleSheetSnap = () => {
    setSheetSnap((s) => (s === 'half' ? 'peek' : s === 'peek' ? 'full' : 'half'));
  };

  const handleSheetTouchEnd = (y: number) => {
    if (touchStartY.current === null) return;
    const dy = y - touchStartY.current;
    touchStartY.current = null;
    if (Math.abs(dy) < 32) return;
    if (dy < 0) setSheetSnap((s) => (s === 'peek' ? 'half' : 'full'));
    else setSheetSnap((s) => (s === 'full' ? 'half' : 'peek'));
  };

  const mobileSheetHeightClass =
    sheetSnap === 'peek' ? 'h-[64px]' : sheetSnap === 'half' ? 'h-[46dvh]' : 'h-[80dvh]';

  const mobileBottomOverlayClass =
    sheetSnap === 'peek'
      ? 'bottom-[76px] lg:bottom-3'
      : sheetSnap === 'half'
        ? 'bottom-[calc(46dvh+12px)] lg:bottom-3'
        : 'pointer-events-none opacity-0 lg:pointer-events-auto lg:bottom-3 lg:opacity-100';

  const toggle = (active: boolean) => `h-8 rounded-full px-3 text-xs font-medium transition-colors ${active ? 'bg-surface text-text shadow-1' : 'text-muted hover:text-text'}`;

  return (
    <div className="flex h-[calc(100dvh-3rem)] min-h-0 flex-col overflow-hidden bg-viewer">
      <div className="z-20 flex flex-wrap items-center gap-1.5 border-b border-border bg-surface px-2 py-1.5 sm:px-3">
        <Link href={`/proyectos/${room.projectId}`} className={buttonClass('ghost', 'icon-sm', 'text-muted hover:text-text')} aria-label="Volver al proyecto" title="Volver al proyecto">
          <Icon name="back" />
        </Link>
        <input
          aria-label="Nombre del ambiente"
          value={name}
          maxLength={120}
          onChange={(e) => store.getState().setName(e.target.value)}
          className="font-display h-8 min-w-[8rem] flex-1 rounded-control border border-transparent bg-transparent px-2 text-[15px] font-semibold tracking-tight hover:border-border focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20 sm:max-w-xs"
        />
        <RoomSaveBadge state={save} mode={mode} onConflictClick={() => setConflictModalOpen(true)} />

        {warnings.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setPanelOpen(true);
              if (sheetSnap === 'peek') setSheetSnap('half');
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning hover:underline"
            title="Ver avisos del ambiente en el panel"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
            {warnings.length === 1 ? '1 aviso' : `${warnings.length} avisos`}
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <div role="radiogroup" aria-label="Vista" className="flex gap-0.5 rounded-full bg-surface-2 p-0.5">
            <button type="button" role="radio" aria-checked={view === 'plan'} className={toggle(view === 'plan')} onClick={() => store.getState().setView('plan')}>
              Planta
            </button>
            <button type="button" role="radio" aria-checked={view === '3d'} className={toggle(view === '3d')} onClick={() => store.getState().setView('3d')}>
              3D
            </button>
          </div>
          <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" aria-hidden />
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            aria-pressed={panelOpen}
            aria-label="Mostrar u ocultar panel del ambiente"
            title={panelOpen ? 'Ocultar panel (Tab)' : 'Mostrar panel (Tab)'}
            className={`hidden h-8 w-8 items-center justify-center rounded-control transition-colors lg:flex ${panelOpen ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-text'}`}
          >
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
              <line x1="12.5" y1="3.5" x2="12.5" y2="16.5" />
            </svg>
          </button>
          <Button size="icon-sm" variant="ghost" onClick={() => store.getState().undo()} disabled={!canUndo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
            <Icon name="undo" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => store.getState().redo()} disabled={!canRedo} aria-label="Rehacer" title="Rehacer (Ctrl+Y)">
            <Icon name="redo" />
          </Button>
          <Link href={`/proyectos/${room.projectId}/despiece`} className={buttonClass('ghost', 'sm', 'hidden md:inline-flex')}>
            Cortes
          </Link>
        </div>
      </div>

      <Dialog
        open={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        title="Conflicto de guardado en la nube"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
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
          <p>Este ambiente se guardó desde otro dispositivo o pestaña mientras lo editabas. Elegí cómo continuar sin perder trabajo:</p>
          <ul className="list-disc space-y-1.5 pl-5 text-text">
            <li>
              <strong>Guardar como copia:</strong> crea un ambiente nuevo en este proyecto con tu distribución actual.
            </li>
            <li>
              <strong>Recargar versión nube:</strong> trae la última versión guardada en Supabase.
            </li>
          </ul>
          {copyError && <Alert tone="danger">{copyError}</Alert>}
        </div>
      </Dialog>

      {save.kind === 'conflict' && !conflictModalOpen && (
        <div className="z-20 px-3 pt-2">
          <Alert tone="danger" title="Otro dispositivo o pestaña guardó este ambiente">
            Tus cambios quedaron en pantalla sin subir a Supabase.{' '}
            <button type="button" className="font-medium underline" onClick={() => setConflictModalOpen(true)}>
              Resolver conflicto
            </button>
          </Alert>
        </div>
      )}
      {save.kind === 'offline' && (
        <div className="z-20 px-3 pt-2">
          <Alert tone="warning" title="Sin conexión a internet">
            Podés seguir acomodando el ambiente; se guardará en Supabase automáticamente cuando vuelva la señal.{' '}
            <button type="button" className="font-medium underline" onClick={() => void persistNow()}>
              Reintentar ahora
            </button>
          </Alert>
        </div>
      )}
      {save.kind === 'error' && (
        <div className="z-20 px-3 pt-2">
          <Alert tone="danger" title="No se pudo guardar">
            {save.message}{' '}
            <button type="button" className="font-medium underline" onClick={() => void persistNow()}>
              Reintentar
            </button>
          </Alert>
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <section className="relative h-full w-full bg-viewer" aria-label={view === 'plan' ? 'Planta' : 'Vista 3D'}>
          {view === 'plan' ? (
            <>
              <PlanView store={store} plan={plan} selection={selection} sizes={sizes} names={names} flagged={flagged} block={block} />
              <label
                className="absolute top-3 left-3 flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs shadow-float backdrop-blur"
                title="Si está marcado, un mueble no se puede soltar donde choca con otro o atraviesa una pared: vuelve al último lugar libre"
              >
                <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--accent)]" checked={block} onChange={(e) => toggleBlock(e.target.checked)} />
                Bloquear superposiciones
              </label>
              <p
                className={`pointer-events-none absolute left-3 hidden max-w-xl rounded-full border border-border bg-surface/90 px-3 py-1 text-[11px] text-muted shadow-float backdrop-blur transition-all duration-200 sm:block ${mobileBottomOverlayClass}`}
              >
                Medidas en mm (cara interior). Naranja: fuera de escuadra · Rojo: colisión · Punteado: barrido de puertas o pendiente.
              </p>
            </>
          ) : (
            <>
              <RoomViewer3D
                plan={plan}
                placed={placed}
                materials={materials}
                selectedId={selection.kind === 'placement' ? selection.id : null}
                selectedBlockId={selection.kind === 'block' ? selection.id : null}
                wallsMode={wallsMode}
                onSelect={(id) => store.getState().select(id ? { kind: 'placement', id } : { kind: 'none' })}
                onSelectBlock={(id) => store.getState().select(id ? { kind: 'block', id } : { kind: 'none' })}
              />
              <div
                role="radiogroup"
                aria-label="Paredes"
                className={`absolute left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 gap-0.5 rounded-full border border-border bg-surface/95 p-1 shadow-float backdrop-blur transition-all duration-200 ${mobileBottomOverlayClass} ${
                  panelOpen ? 'lg:left-[calc((100%-396px)/2)]' : 'lg:left-1/2'
                }`}
              >
                {(
                  [
                    ['auto', 'Paredes: auto'],
                    ['ghost', 'Transparentes'],
                    ['solid', 'Sólidas'],
                  ] as const
                ).map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={wallsMode === k} className={toggle(wallsMode === k)} onClick={() => setWallsMode(k)}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          {!panelOpen && (
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              aria-label="Abrir panel del ambiente"
              title="Abrir panel del ambiente (Tab)"
              className="absolute top-3 right-3 hidden items-center gap-1.5 rounded-full border border-border bg-surface/95 px-3 py-2 text-xs font-medium text-text shadow-float backdrop-blur transition-colors hover:bg-surface lg:flex"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
                <line x1="12.5" y1="3.5" x2="12.5" y2="16.5" />
              </svg>
              Panel
            </button>
          )}
        </section>

        <aside
          aria-label="Panel del ambiente"
          className={`absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-sheet border-t border-border bg-surface/95 shadow-2 backdrop-blur-md transition-[height,transform] duration-200 ${mobileSheetHeightClass} lg:inset-x-auto lg:top-3 lg:right-3 lg:bottom-3 lg:h-auto lg:w-[380px] lg:rounded-card lg:border lg:shadow-float ${
            panelOpen ? 'lg:translate-x-0' : 'lg:pointer-events-none lg:translate-x-[400px]'
          }`}
        >
          <div
            className="flex shrink-0 touch-none items-center justify-between gap-2 px-3 py-2 lg:hidden"
            onTouchStart={(e) => {
              const t = e.touches[0];
              if (t) touchStartY.current = t.clientY;
            }}
            onTouchEnd={(e) => {
              const t = e.changedTouches[0];
              if (t) handleSheetTouchEnd(t.clientY);
            }}
          >
            <button
              type="button"
              onClick={cycleSheetSnap}
              className="flex flex-1 flex-col items-start gap-1 text-left"
              aria-label="Cambiar altura del panel del ambiente"
            >
              <span className="mx-auto h-1 w-10 rounded-full bg-border-strong" aria-hidden />
              <span className="text-xs font-medium text-text">
                Panel del ambiente · {plan.placements.length} {plan.placements.length === 1 ? 'mueble' : 'muebles'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSheetSnap((s) => (s === 'peek' ? 'half' : 'peek'))}
              className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-text"
            >
              {sheetSnap === 'peek' ? 'Editar' : 'Ver plano'}
            </button>
          </div>

          <div className={`min-h-0 flex-1 overflow-y-auto ${sheetSnap === 'peek' ? 'hidden lg:block' : ''}`}>
            <RoomPanel store={store} plan={plan} selection={selection} cabinets={cabinets} warnings={warnings} onSetQuantity={setQuantity} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function RoomSaveBadge({
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

  let text = isCloud ? 'En la nube' : 'Local';
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
    title = isCloud ? 'Guardando ambiente en Supabase…' : 'Guardando ambiente…';
  } else if (state.kind === 'offline') {
    text = 'Sin conexión';
    tone = 'bg-warning-soft text-warning';
    dot = 'bg-warning';
    title = 'Sin conexión: se sincronizará al reconectar';
  } else if (state.kind === 'conflict') {
    text = 'Conflicto';
    tone = 'bg-danger-soft text-danger';
    dot = 'bg-danger';
    title = 'Otra sesión modificó este ambiente en Supabase';
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