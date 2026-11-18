'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { analyzeRoom, compute, type Material, type Method } from '@mw/engine';
import { Button, buttonClass } from '@/components/ui/Button';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { ConflictError, data, type Cabinet, type Room } from '@/data';
import { PlanView } from './PlanView';
import { RoomPanel } from './RoomPanel';
import { createRoomStore } from './roomStore';

const RoomViewer3D = dynamic(() => import('./RoomViewer3D'), { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-none" /> });

type SaveState = { kind: 'saved' } | { kind: 'saving' } | { kind: 'error'; message: string } | { kind: 'conflict' };

/** Editor de un ambiente: planta (o 3D) a un lado y panel de paredes, aberturas, muebles y avisos al otro. */
export function RoomEditor({ room, cabinets: initialCabinets, materials, methods }: { room: Room; cabinets: Cabinet[]; materials: Material[]; methods: Method[] }) {
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
  const [wallsGhost, setWallsGhost] = useState(false);

  const sizes = useMemo(() => Object.fromEntries(cabinets.map((c) => [c.id, c.design.size])), [cabinets]);
  const names = useMemo(() => Object.fromEntries(cabinets.map((c) => [c.id, c.name])), [cabinets]);
  const warnings = useMemo(() => analyzeRoom(plan, sizes, names), [plan, sizes, names]);
  const flagged = useMemo(() => new Set(warnings.filter((w) => w.code !== 'out_of_square').map((w) => w.placementId).filter(Boolean) as string[]), [warnings]);

  // Piezas de cada mueble (para el 3D): se calculan una vez por mueble, no por cada vez que se coloca.
  const partsByCabinet = useMemo(() => {
    const m = new Map<string, ReturnType<typeof compute>['parts']>();
    for (const c of cabinets) {
      const method = methods.find((x) => x.id === c.methodId) ?? methods[0];
      if (method) m.set(c.id, compute(c.design, method, materials).parts);
    }
    return m;
  }, [cabinets, methods, materials]);
  const placed = useMemo(
    () =>
      plan.placements.flatMap((p) => {
        const parts = partsByCabinet.get(p.cabinetId);
        return parts ? [{ placementId: p.id, x: p.x, y: p.y, rotation: p.rotation, elevation: p.elevation, parts }] : [];
      }),
    [plan.placements, partsByCabinet],
  );

  // ── guardado automático con control de versión ──
  const rev = useRef(room.rev);
  const [save, setSave] = useState<SaveState>({ kind: 'saved' });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSave({ kind: 'saving' });
    const t = setTimeout(async () => {
      try {
        rev.current = await data.saveRoom(room.id, rev.current, { plan, name: name.trim() || room.name });
        setSave({ kind: 'saved' });
      } catch (e) {
        if (e instanceof ConflictError) setSave({ kind: 'conflict' });
        else setSave({ kind: 'error', message: e instanceof Error ? e.message : 'Error al guardar' });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [plan, name, room.id, room.name]);

  useEffect(() => {
    if (save.kind === 'saved') return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [save.kind]);

  // ── atajos: deshacer, rehacer, Supr para quitar el mueble elegido, Esc ──
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
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
      } else if (e.key === 'Escape' && !document.querySelector('dialog[open]')) {
        s.select({ kind: 'none' });
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [store]);

  /** Cantidad del mueble en el despiece = veces colocado. */
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

  const toggle = (active: boolean) => `rounded-s px-3 py-1.5 text-xs font-medium ${active ? 'bg-accent-soft text-accent' : 'hover:bg-surface-2'}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:h-[calc(100dvh-3.5rem)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Link href={`/proyectos/${room.projectId}`} className={buttonClass('ghost', 'sm')} aria-label="Volver al proyecto">
          ←
        </Link>
        <input
          aria-label="Nombre del ambiente"
          value={name}
          maxLength={120}
          onChange={(e) => store.getState().setName(e.target.value)}
          className="h-8 min-w-[9rem] flex-1 rounded-s border border-transparent bg-transparent px-2 font-semibold hover:border-border focus:border-border sm:max-w-sm"
        />
        <span className={`text-xs ${save.kind === 'error' || save.kind === 'conflict' ? 'text-danger' : 'text-muted'}`} role="status" aria-live="polite">
          {{ saved: 'Guardado', saving: 'Guardando…', error: 'Sin guardar', conflict: 'Conflicto' }[save.kind]}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => store.getState().undo()} disabled={!canUndo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
            ↶
          </Button>
          <Button size="sm" variant="ghost" onClick={() => store.getState().redo()} disabled={!canRedo} aria-label="Rehacer" title="Rehacer (Ctrl+Y)">
            ↷
          </Button>
          <div role="radiogroup" aria-label="Vista" className="flex gap-1 rounded-s bg-surface-2 p-1">
            <button type="button" role="radio" aria-checked={view === 'plan'} className={toggle(view === 'plan')} onClick={() => store.getState().setView('plan')}>
              Planta
            </button>
            <button type="button" role="radio" aria-checked={view === '3d'} className={toggle(view === '3d')} onClick={() => store.getState().setView('3d')}>
              3D
            </button>
          </div>
        </div>
      </div>
      {(save.kind === 'conflict' || save.kind === 'error') && (
        <div className="px-3 pt-2">
          <Alert tone="danger" title={save.kind === 'conflict' ? 'Otro dispositivo o pestaña guardó este ambiente mientras lo editabas' : 'No se pudo guardar'}>
            {save.kind === 'error' ? save.message : 'Tus últimos cambios no se guardaron.'}{' '}
            <button type="button" className="font-medium underline" onClick={() => window.location.reload()}>
              Recargar
            </button>
          </Alert>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)]">
        <section className="relative h-[55dvh] min-h-[320px] bg-viewer lg:order-1 lg:h-auto" aria-label={view === 'plan' ? 'Planta' : 'Vista 3D'}>
          {view === 'plan' ? (
            <PlanView store={store} plan={plan} selection={selection} sizes={sizes} names={names} flagged={flagged} />
          ) : (
            <>
              <RoomViewer3D
                plan={plan}
                placed={placed}
                materials={materials}
                selectedId={selection.kind === 'placement' ? selection.id : null}
                wallsGhost={wallsGhost}
                onSelect={(id) => store.getState().select(id ? { kind: 'placement', id } : { kind: 'none' })}
              />
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-m bg-surface/95 p-1 shadow-1">
                <button type="button" aria-pressed={wallsGhost} className={toggle(wallsGhost)} onClick={() => setWallsGhost((v) => !v)}>
                  Paredes transparentes
                </button>
              </div>
            </>
          )}
          {view === 'plan' && (
            <p className="pointer-events-none absolute bottom-2 left-3 rounded-s bg-surface/90 px-2 py-1 text-[11px] text-muted shadow-1">
              Medidas en mm por la cara interior. Ángulos fuera de escuadra en naranja.
            </p>
          )}
        </section>
        <aside className="border-t border-border bg-surface lg:order-2 lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Panel del ambiente">
          <RoomPanel store={store} plan={plan} selection={selection} cabinets={cabinets} warnings={warnings} onSetQuantity={setQuantity} />
        </aside>
      </div>
    </div>
  );
}
