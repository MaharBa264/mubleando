'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { analyzeRoom, compute, roomSize, slideOpening, walls, type CabinetSize, type Hardware, type Material, type Method } from '@mw/engine';
import { Button, buttonClass } from '@/components/ui/Button';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { Icon } from '@/components/ui/Icon';
import { ConflictError, data, type Cabinet, type Room } from '@/data';
import { PlanView } from './PlanView';
import { RoomPanel } from './RoomPanel';
import { createRoomStore } from './roomStore';
import type { WallsMode } from './RoomViewer3D';

const RoomViewer3D = dynamic(() => import('./RoomViewer3D'), { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-none" /> });

type SaveState = { kind: 'saved' } | { kind: 'saving' } | { kind: 'error'; message: string } | { kind: 'conflict' };

/** Editor de un ambiente: planta (o 3D) a un lado y panel de paredes, aberturas, muebles y avisos al otro. */
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
  // Bloquear superposiciones al arrastrar (preferencia de este navegador).
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

  // Piezas de cada mueble (para el 3D): se calculan una vez por mueble, no por cada vez que se coloca.
  const partsByCabinet = useMemo(() => {
    const m = new Map<string, Pick<ReturnType<typeof compute>, 'parts' | 'legs'>>();
    for (const c of cabinets) {
      const method = methods.find((x) => x.id === c.methodId) ?? methods[0];
      if (method) m.set(c.id, compute(c.design, method, materials, hardware));
    }
    return m;
  }, [cabinets, methods, materials, hardware]);
  // Medidas para el ambiente: alto real, patas que sobresalen y puertas que barren al abrirse.
  const sizes = useMemo(() => {
    const out: Record<string, CabinetSize> = {};
    for (const c of cabinets) {
      const method = methods.find((x) => x.id === c.methodId) ?? methods[0];
      out[c.id] = method ? roomSize(c.design, compute(c.design, method, materials, hardware)) : c.design.size;
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
      } else if (s.selection.kind === 'opening' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        // Flechas: la abertura elegida se desliza por su pared, de a 10 mm (100 con Mayús), hacia donde apunta la flecha.
        e.preventDefault();
        const id = s.selection.id;
        const o = s.plan.openings.find((x) => x.id === id);
        if (!o) return;
        const w = walls(s.plan).find((x) => x.id === o.wallId);
        if (!w) return;
        // La flecha empuja en esa dirección de la pantalla; cuenta lo que coincide con la pared.
        const v = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key as 'ArrowRight']!;
        const along = v[0]! * w.dir.x + v[1]! * w.dir.y;
        if (Math.abs(along) < 0.3) return; // flecha casi perpendicular a la pared
        const step = (e.shiftKey ? 10000 : 1000) * Math.sign(along);
        s.apply((p) => slideOpening(p, id, o.offset + step));
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

  const toggle = (active: boolean) => `h-8 rounded-full px-3 text-xs font-medium transition-colors ${active ? 'bg-surface text-text shadow-1' : 'text-muted hover:text-text'}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-viewer lg:h-[calc(100dvh-3rem)] lg:flex-none">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-surface px-2 py-1.5 sm:px-3">
        <Link href={`/proyectos/${room.projectId}`} className={buttonClass('ghost', 'icon-sm', 'text-muted hover:text-text')} aria-label="Volver al proyecto">
          <Icon name="back" />
        </Link>
        <input
          aria-label="Nombre del ambiente"
          value={name}
          maxLength={120}
          onChange={(e) => store.getState().setName(e.target.value)}
          className="font-display h-8 min-w-[9rem] flex-1 rounded-control border border-transparent bg-transparent px-2 text-[15px] font-semibold tracking-tight hover:border-border focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20 sm:max-w-sm"
        />
        <span className={`text-xs ${save.kind === 'error' || save.kind === 'conflict' ? 'text-danger' : 'text-muted'}`} role="status" aria-live="polite">
          {{ saved: 'Guardado', saving: 'Guardando…', error: 'Sin guardar', conflict: 'Conflicto' }[save.kind]}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" onClick={() => store.getState().undo()} disabled={!canUndo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
            <Icon name="undo" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => store.getState().redo()} disabled={!canRedo} aria-label="Rehacer" title="Rehacer (Ctrl+Y)">
            <Icon name="redo" />
          </Button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <div role="radiogroup" aria-label="Vista" className="flex gap-0.5 rounded-full bg-surface-2 p-0.5">
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

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)] lg:gap-3 lg:p-3">
        <section className="relative h-[55dvh] min-h-[320px] bg-viewer lg:order-1 lg:h-auto" aria-label={view === 'plan' ? 'Planta' : 'Vista 3D'}>
          {view === 'plan' ? (
            <>
              <PlanView store={store} plan={plan} selection={selection} sizes={sizes} names={names} flagged={flagged} block={block} />
              <label
                className="absolute right-3 top-3 flex items-center gap-2 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs shadow-float"
                title="Si está marcado, un mueble no se puede soltar donde choca con otro o atraviesa una pared: vuelve al último lugar libre"
              >
                <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--accent)]" checked={block} onChange={(e) => toggleBlock(e.target.checked)} />
                Bloquear superposiciones
              </label>
            </>
          ) : (
            <>
              <RoomViewer3D
                plan={plan}
                placed={placed}
                materials={materials}
                selectedId={selection.kind === 'placement' ? selection.id : null}
                wallsMode={wallsMode}
                onSelect={(id) => store.getState().select(id ? { kind: 'placement', id } : { kind: 'none' })}
              />
              <div role="radiogroup" aria-label="Paredes" className="absolute bottom-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 gap-0.5 rounded-full border border-border bg-surface-2/95 p-1 shadow-float backdrop-blur">
                {(
                  [
                    ['auto', 'Paredes: automático'],
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
          {view === 'plan' && (
            <p className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-border bg-surface/95 px-3 py-1 text-[11px] text-muted shadow-float">
              Medidas en mm por la cara interior. Ángulos fuera de escuadra en naranja. En rojo, lo que choca; en punteado, por dónde abren las puertas.
            </p>
          )}
        </section>
        <aside className="border-t border-border bg-surface lg:order-2 lg:overflow-y-auto lg:rounded-card lg:border lg:shadow-float" aria-label="Panel del ambiente">
          <RoomPanel store={store} plan={plan} selection={selection} cabinets={cabinets} warnings={warnings} onSetQuantity={setQuantity} />
        </aside>
      </div>
    </div>
  );
}
