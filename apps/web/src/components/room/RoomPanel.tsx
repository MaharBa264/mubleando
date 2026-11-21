'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  analyzeRoom,
  floorAreaM2,
  mm,
  nearestWall,
  OPENING_NAME,
  placementAxes,
  removeCorner,
  setCornerAngle,
  setWallLength,
  snapToWall,
  splitWall,
  walls,
  type CabinetSize,
  type OpeningKind,
  type Placement,
  type RoomOpening,
  type RoomPlan,
  type RoomWarning,
} from '@mw/engine';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback';
import { Label, MmField, SelectField } from '@/components/ui/fields';
import type { Cabinet } from '@/data';
import { fmtDims, fmtMm, fmtNum } from '@/lib/format';
import type { RoomSelection, RoomStore } from './roomStore';

const uid = () => globalThis.crypto.randomUUID();
type Tab = 'walls' | 'openings' | 'cabinets' | 'warnings';

/** Panel lateral del editor de ambientes: paredes, aberturas, muebles y avisos. */
export function RoomPanel({
  store,
  plan,
  selection,
  cabinets,
  warnings,
  onSetQuantity,
}: {
  store: RoomStore;
  plan: RoomPlan;
  selection: RoomSelection;
  cabinets: Cabinet[];
  warnings: RoomWarning[];
  onSetQuantity: (cabinetId: string, quantity: number) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>('walls');
  // Al tocar algo en la planta, se abre la pestaña que le corresponde.
  useEffect(() => {
    if (selection.kind === 'wall') setTab('walls');
    if (selection.kind === 'opening') setTab('openings');
    if (selection.kind === 'placement') setTab('cabinets');
  }, [selection]);

  const tabs: [Tab, string][] = [
    ['walls', 'Paredes'],
    ['openings', 'Aberturas'],
    ['cabinets', 'Muebles'],
    ['warnings', warnings.length ? `Avisos (${warnings.length})` : 'Avisos'],
  ];

  return (
    <div>
      <div role="tablist" aria-label="Panel del ambiente" className="sticky top-0 z-10 flex border-b border-border bg-surface">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`flex-1 px-2 py-2.5 text-sm ${tab === k ? 'border-b-2 border-accent font-medium text-accent' : 'text-muted'} ${k === 'warnings' && warnings.length ? 'text-warning' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-5 p-4">
        {tab === 'walls' && <WallsTab store={store} plan={plan} selection={selection} />}
        {tab === 'openings' && <OpeningsTab store={store} plan={plan} selection={selection} />}
        {tab === 'cabinets' && <CabinetsTab store={store} plan={plan} selection={selection} cabinets={cabinets} onSetQuantity={onSetQuantity} />}
        {tab === 'warnings' && <WarningsTab store={store} warnings={warnings} />}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

/** Campo de ángulo en grados, con coma decimal. Aplica con Intro o al salir. */
function AngleField({ label, value, disabled, onCommit }: { label: string; value: number; disabled?: boolean; onCommit: (v: number) => void }) {
  const shown = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
  const [text, setText] = useState(shown);
  const [error, setError] = useState(false);
  useEffect(() => setText(shown), [shown]);
  const commit = () => {
    const v = Number(text.trim().replace('°', '').replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0 || v >= 360) return setError(true);
    setError(false);
    if (Math.abs(v - value) > 1e-6) onCommit(v);
  };
  const id = `ang-${label}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          disabled={disabled}
          value={text}
          aria-invalid={error}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setText(shown);
          }}
          className="tabular h-9 w-full rounded-control border border-border bg-surface px-3 pr-7 text-sm disabled:bg-surface-2 disabled:text-muted aria-[invalid=true]:border-danger"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">°</span>
      </div>
    </div>
  );
}

// ───────────────────────── paredes ─────────────────────────

function WallsTab({ store, plan, selection }: { store: RoomStore; plan: RoomPlan; selection: RoomSelection }) {
  const apply = store.getState().apply;
  const ws = walls(plan);
  const n = ws.length;
  const closing = ws[n - 1]!;
  const closingError = plan.closingMeasured !== undefined ? closing.length - plan.closingMeasured : null;

  return (
    <>
      <Section title="Ambiente">
        <div className="grid grid-cols-2 gap-2">
          <MmField compact label="Alto de las paredes" value={plan.wallHeight} min={mm(1800)} max={mm(6000)} onCommit={(v) => v !== null && apply((p) => ({ ...p, wallHeight: v }))} />
          <MmField compact label="Espesor de las paredes" value={plan.wallThickness} min={mm(50)} max={mm(600)} onCommit={(v) => v !== null && apply((p) => ({ ...p, wallThickness: v }))} />
        </div>
        <p className="text-sm text-muted">Superficie del piso: {fmtNum(floorAreaM2(plan), 2)} m²</p>
      </Section>

      <Section title="Paredes, como se miden en obra">
        <p className="text-xs text-muted">
          Cargá el largo de cada pared (por la cara de adentro) y el ángulo de cada esquina. La última pared cierra sola: si la mediste, poné su medida para ver el error de cierre. También podés arrastrar las esquinas en la planta.
        </p>
        <ol className="space-y-3">
          {ws.map((w, i) => {
            const isClosing = i === n - 1;
            const active = selection.kind === 'wall' && selection.index === i;
            return (
              <li
                key={w.id}
                className={`rounded-card border p-3 ${active ? 'border-accent bg-accent-soft' : 'border-border'}`}
                onFocus={() => store.getState().select({ kind: 'wall', index: i })}
              >
                <p className="mb-2 text-sm font-medium">
                  Pared {i + 1}
                  {isClosing && <span className="ml-1 text-xs font-normal text-muted">· cierra el ambiente</span>}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {isClosing ? (
                    <MmField
                      compact
                      label={`Medida en obra (calculada ${fmtMm(w.length)})`}
                      value={plan.closingMeasured ?? null}
                      allowEmpty
                      min={mm(1)}
                      placeholder="opcional"
                      onCommit={(v) => apply((p) => ({ ...p, closingMeasured: v ?? undefined }))}
                    />
                  ) : (
                    <MmField compact label="Largo" value={w.length} min={mm(100)} max={mm(30000)} onCommit={(v) => v !== null && apply((p) => setWallLength(p, i, v))} />
                  )}
                  <AngleField
                    label={i === 0 || i === n - 1 ? `Esquina ${i + 1} (calculada)` : `Esquina ${i + 1}`}
                    value={w.angleAtStart}
                    disabled={i === 0 || i === n - 1}
                    onCommit={(v) => apply((p) => setCornerAngle(p, i, v))}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" onClick={() => apply((p) => splitWall(p, i))} title="Agrega una esquina en el medio (para hacer una L, una ochava o un quiebre)">
                    Partir
                  </Button>
                  {n > 3 && (
                    <Button size="sm" variant="ghost" onClick={() => apply((p) => removeCorner(p, i))}>
                      Quitar esquina {i + 1}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {closingError !== null && (
          <Alert tone={Math.abs(closingError) > 500 ? 'warning' : 'info'} title="Error de cierre">
            La pared {n} sale de {fmtMm(closing.length)} mm con las demás medidas y en obra midió {fmtMm(plan.closingMeasured!)} mm: {closingError > 0 ? '+' : ''}
            {fmtMm(closingError)} mm.{' '}
            {Math.abs(closingError) > 500 ? 'Revisá algún largo o algún ángulo.' : 'Diferencia chica: normal en obra.'}
          </Alert>
        )}
      </Section>
    </>
  );
}

// ───────────────────────── aberturas ─────────────────────────

const DEFAULTS: Record<OpeningKind, Pick<RoomOpening, 'width' | 'height' | 'sill'>> = {
  door: { width: mm(800), height: mm(2050), sill: 0 },
  window: { width: mm(1000), height: mm(1100), sill: mm(1000) },
  opening: { width: mm(900), height: mm(2100), sill: 0 },
};

function OpeningsTab({ store, plan, selection }: { store: RoomStore; plan: RoomPlan; selection: RoomSelection }) {
  const apply = store.getState().apply;
  const ws = walls(plan);
  const wallIndex = selection.kind === 'wall' ? selection.index : 0;
  const add = (kind: OpeningKind) => {
    const w = ws[wallIndex]!;
    const d = DEFAULTS[kind];
    const id = uid();
    apply((p) => ({ ...p, openings: [...p.openings, { id, wallId: w.id, kind, offset: Math.max(0, Math.round((w.length - d.width) / 2)), ...d }] }));
    store.getState().select({ kind: 'opening', id });
  };
  const update = (id: string, patch: Partial<RoomOpening>) => apply((p) => ({ ...p, openings: p.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));

  return (
    <>
      <Section title={`Agregar en la pared ${wallIndex + 1}`}>
        <p className="text-xs text-muted">Tocá una pared en la planta para elegir dónde. Se agrega centrada; después ajustás la distancia.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => add('door')}>
            + Puerta
          </Button>
          <Button size="sm" onClick={() => add('window')}>
            + Ventana
          </Button>
          <Button size="sm" onClick={() => add('opening')}>
            + Abertura sin hoja
          </Button>
        </div>
      </Section>
      <Section title="Aberturas">
        {plan.openings.length === 0 && <p className="text-sm text-muted">Todavía no hay puertas ni ventanas.</p>}
        <ul className="space-y-3">
          {plan.openings.map((o) => {
            const active = selection.kind === 'opening' && selection.id === o.id;
            const wi = ws.findIndex((w) => w.id === o.wallId);
            return (
              <li key={o.id} className={`rounded-card border p-3 ${active ? 'border-accent bg-accent-soft' : 'border-border'}`} onFocus={() => store.getState().select({ kind: 'opening', id: o.id })}>
                <div className="grid grid-cols-2 gap-2">
                  <SelectField label="Tipo" value={o.kind} onChange={(e) => update(o.id, { kind: e.target.value as OpeningKind, sill: e.target.value === 'window' ? o.sill || mm(1000) : 0 })}>
                    <option value="door">Puerta</option>
                    <option value="window">Ventana</option>
                    <option value="opening">Abertura sin hoja</option>
                  </SelectField>
                  <SelectField label="Pared" value={o.wallId} onChange={(e) => update(o.id, { wallId: e.target.value, offset: 0 })}>
                    {ws.map((w) => (
                      <option key={w.id} value={w.id}>
                        Pared {w.index + 1} ({fmtMm(w.length)})
                      </option>
                    ))}
                  </SelectField>
                  <MmField compact label="Desde el inicio de la pared" value={o.offset} min={0} max={wi >= 0 ? ws[wi]!.length : undefined} onCommit={(v) => v !== null && update(o.id, { offset: v })} />
                  <MmField compact label="Ancho" value={o.width} min={mm(100)} onCommit={(v) => v !== null && update(o.id, { width: v })} />
                  <MmField compact label="Alto" value={o.height} min={mm(100)} onCommit={(v) => v !== null && update(o.id, { height: v })} />
                  {o.kind === 'window' && <MmField compact label="Antepecho (del piso)" value={o.sill} min={0} onCommit={(v) => v !== null && update(o.id, { sill: v })} />}
                </div>
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => apply((p) => ({ ...p, openings: p.openings.filter((x) => x.id !== o.id) }))}>
                  Quitar {OPENING_NAME[o.kind]}
                </Button>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}

// ───────────────────────── muebles ─────────────────────────

/** ¿Parece un mueble de colgar? (poco fondo y no muy alto): se coloca a 1,45 m del piso. */
const looksHung = (s: CabinetSize) => s.d <= mm(400) && s.h <= mm(1000);

function CabinetsTab({
  store,
  plan,
  selection,
  cabinets,
  onSetQuantity,
}: {
  store: RoomStore;
  plan: RoomPlan;
  selection: RoomSelection;
  cabinets: Cabinet[];
  onSetQuantity: (cabinetId: string, quantity: number) => Promise<void>;
}) {
  const apply = store.getState().apply;
  const sizes = Object.fromEntries(cabinets.map((c) => [c.id, c.design.size]));
  const ws = walls(plan);

  /** Coloca un mueble contra una pared, en el primer hueco libre (de 10 en 10 mm). */
  const place = (c: Cabinet) => {
    const size = c.design.size;
    const elevation = looksHung(size) ? mm(1450) : 0;
    const order = selection.kind === 'wall' ? [selection.index, ...ws.map((w) => w.index).filter((i) => i !== selection.index)] : ws.map((w) => w.index);
    const id = uid();
    for (const wi of order) {
      const w = ws[wi]!;
      for (let t = 0; t + size.w <= w.length; t += mm(10)) {
        const start = { x: w.a.x + w.dir.x * t, y: w.a.y + w.dir.y * t };
        const p = snapToWall(plan, { id, cabinetId: c.id, x: Math.round(start.x), y: Math.round(start.y), rotation: 0, elevation }, size, wi);
        const next = { ...plan, placements: [...plan.placements, p] };
        const clash = analyzeRoom(next, sizes).some((x) => (x.code === 'overlap' || x.code === 'blocks_door' || x.code === 'outside') && (x.placementId === id || plan.placements.some((q) => q.id === x.placementId)));
        if (!clash) {
          apply(() => next);
          store.getState().select({ kind: 'placement', id });
          return;
        }
      }
    }
    // Sin lugar libre: se pone contra la primera pared y avisa del choque.
    const p = snapToWall(plan, { id, cabinetId: c.id, x: ws[0]!.a.x, y: ws[0]!.a.y, rotation: 0, elevation }, size, 0);
    apply((pl) => ({ ...pl, placements: [...pl.placements, p] }));
    store.getState().select({ kind: 'placement', id });
  };

  const selected = selection.kind === 'placement' ? plan.placements.find((p) => p.id === selection.id) : undefined;
  const selCabinet = selected ? cabinets.find((c) => c.id === selected.cabinetId) : undefined;

  return (
    <>
      {selected && (
        <PlacementForm store={store} plan={plan} placement={selected} cabinet={selCabinet} />
      )}

      <Section title="Muebles del proyecto">
        {cabinets.length === 0 && <p className="text-sm text-muted">El proyecto todavía no tiene muebles. Crealos desde la página del proyecto.</p>}
        <ul className="space-y-2">
          {cabinets.map((c) => {
            const placed = plan.placements.filter((p) => p.cabinetId === c.id).length;
            return (
              <li key={c.id} className="rounded-card border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="tabular text-xs text-muted">{fmtDims(c.design.size.w, c.design.size.h, c.design.size.d)} mm</p>
                  </div>
                  <Button size="sm" onClick={() => place(c)}>
                    Colocar
                  </Button>
                </div>
                {placed > 0 && (
                  <p className="mt-1 text-xs text-muted">
                    Colocado {placed} {placed === 1 ? 'vez' : 'veces'} en este ambiente.
                    {placed !== c.quantity && (
                      <>
                        {' '}
                        En el despiece cuenta {c.quantity}.{' '}
                        <button type="button" className="font-medium text-accent underline" onClick={() => void onSetQuantity(c.id, placed)}>
                          Contar {placed}
                        </button>
                      </>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}

function PlacementForm({ store, plan, placement: p, cabinet }: { store: RoomStore; plan: RoomPlan; placement: Placement; cabinet: Cabinet | undefined }) {
  const apply = store.getState().apply;
  const update = (patch: Partial<Placement>) => apply((pl) => ({ ...pl, placements: pl.placements.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) }));
  const size = cabinet?.design.size;

  /** Gira el mueble sobre su centro. */
  const rotate = (deg: number) => {
    if (!size) return;
    const { u, f } = placementAxes(p.rotation);
    const c = { x: p.x + (u.x * size.w) / 2 + (f.x * size.d) / 2, y: p.y + (u.y * size.w) / 2 + (f.y * size.d) / 2 };
    const r = (((p.rotation + deg) % 360) + 360) % 360;
    const a = placementAxes(r);
    update({ rotation: r, x: Math.round(c.x - (a.u.x * size.w) / 2 - (a.f.x * size.d) / 2), y: Math.round(c.y - (a.u.y * size.w) / 2 - (a.f.y * size.d) / 2) });
  };

  return (
    <Section title={`Elegido: ${cabinet?.name ?? 'mueble borrado'}`}>
      {!cabinet && <Alert tone="warning">Este mueble ya no existe en el proyecto. Quitalo del ambiente.</Alert>}
      <div className="grid grid-cols-2 gap-2">
        <MmField compact label="X (esquina trasera izq.)" value={p.x} onCommit={(v) => v !== null && update({ x: v })} />
        <MmField compact label="Y (esquina trasera izq.)" value={p.y} onCommit={(v) => v !== null && update({ y: v })} />
        <AngleField label="Giro" value={p.rotation} onCommit={(v) => update({ rotation: v })} />
        <MmField compact label="Altura desde el piso" value={p.elevation} min={0} max={plan.wallHeight} onCommit={(v) => v !== null && update({ elevation: v })} />
      </div>
      <div className="flex flex-wrap gap-1">
        {size && (
          <Button size="sm" onClick={() => update(snapToWall(plan, p, size, nearestWall(plan, p, size)))}>
            Arrimar a la pared más cercana
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => rotate(90)}>
          Girar 90°
        </Button>
        <Button size="sm" variant="ghost" onClick={() => rotate(-90)}>
          Girar −90°
        </Button>
        {cabinet && (
          <Link href={`/muebles/${cabinet.id}`} className="inline-flex h-8 items-center rounded-control px-3 text-sm hover:bg-surface-2">
            Abrir el mueble
          </Link>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            apply((pl) => ({ ...pl, placements: pl.placements.filter((x) => x.id !== p.id) }));
            store.getState().select({ kind: 'none' });
          }}
        >
          Quitar del ambiente
        </Button>
      </div>
      <p className="text-xs text-muted">Arrastralo en la planta; si lo soltás a menos de 15 cm de una pared, se arrima solo.</p>
    </Section>
  );
}

// ───────────────────────── avisos ─────────────────────────

function WarningsTab({ store, warnings }: { store: RoomStore; warnings: RoomWarning[] }) {
  if (warnings.length === 0) return <p className="text-sm text-muted">Sin avisos: los muebles entran, no se pisan y no tapan puertas ni ventanas.</p>;
  return (
    <ul className="space-y-2">
      {warnings.map((w, i) => (
        <li key={i}>
          <Alert tone={w.code === 'out_of_square' ? 'info' : 'warning'}>
            {w.message}{' '}
            {w.placementId && (
              <button type="button" className="font-medium underline" onClick={() => store.getState().select({ kind: 'placement', id: w.placementId! })}>
                Ver
              </button>
            )}
          </Alert>
        </li>
      ))}
    </ul>
  );
}
