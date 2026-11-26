'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  analyzeRoom,
  floorAreaM2,
  LIMITS,
  mm,
  nearestWall,
  OPENING_NAME,
  placementAxes,
  removeCorner,
  setCornerAngle,
  setWallLength,
  snapToWall,
  splitWall,
  TEMPLATES,
  walls,
  type CabinetSize,
  type Design,
  type Len,
  type Method,
  type OpeningKind,
  type Placement,
  type RoomBlock,
  type RoomBlockKind,
  type RoomBlockMaterial,
  type RoomOpening,
  type RoomPlan,
  type RoomWarning,
} from '@mw/engine';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/feedback';
import { Label, MmField, SelectField, TextField } from '@/components/ui/fields';
import type { Cabinet } from '@/data';
import { fmtDims, fmtMm, fmtNum } from '@/lib/format';
import type { RoomSelection, RoomStore } from './roomStore';

const uid = () => globalThis.crypto.randomUUID();
type Tab = 'walls' | 'openings' | 'blocks' | 'cabinets' | 'warnings';

export interface UnderStairModuleSpec {
  name: string;
  methodId: string;
  design: Design;
  x: Len;
  y: Len;
  rotation: number;
  elevation: Len;
}

/** Panel lateral del editor de ambientes: paredes, aberturas, obra, muebles y avisos. */
export function RoomPanel({
  store,
  plan,
  selection,
  cabinets,
  methods = [],
  warnings,
  onSetQuantity,
  onGenerateUnderStair,
}: {
  store: RoomStore;
  plan: RoomPlan;
  selection: RoomSelection;
  cabinets: Cabinet[];
  methods?: Method[];
  warnings: RoomWarning[];
  onSetQuantity: (cabinetId: string, quantity: number) => Promise<void>;
  onGenerateUnderStair?: (modules: UnderStairModuleSpec[]) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>('walls');
  useEffect(() => {
    if (selection.kind === 'wall') setTab('walls');
    if (selection.kind === 'opening') setTab('openings');
    if (selection.kind === 'block') setTab('blocks');
    if (selection.kind === 'placement') setTab('cabinets');
  }, [selection]);

  const tabs: [Tab, string, string][] = [
    ['walls', 'Paredes', 'Medidas de obra, alto, espesor y ángulos de cada esquina'],
    ['openings', 'Aberturas', 'Puertas, ventanas y vanos en cada pared'],
    ['blocks', 'Obra', 'Mampostería, pies de mesada, islas y losas inclinadas de bajo escalera'],
    ['cabinets', 'Muebles', 'Colocar, girar, elevar y ajustar los muebles del proyecto'],
    ['warnings', warnings.length ? `Avisos (${warnings.length})` : 'Avisos', 'Colisiones, puertas y esquinas fuera de escuadra'],
  ];

  return (
    <div>
      <div role="tablist" aria-label="Panel del ambiente" className="sticky top-0 z-10 flex border-b border-border bg-surface">
        {tabs.map(([k, label, tip]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            title={tip}
            onClick={() => setTab(k)}
            className={`flex-1 px-1.5 py-2.5 text-xs sm:text-sm ${tab === k ? 'border-b-2 border-accent font-medium text-accent' : 'text-muted'} ${k === 'warnings' && warnings.length ? 'text-warning' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-5 p-4">
        {tab === 'walls' && <WallsTab store={store} plan={plan} selection={selection} />}
        {tab === 'openings' && <OpeningsTab store={store} plan={plan} selection={selection} />}
        {tab === 'blocks' && <BlocksTab store={store} plan={plan} selection={selection} methods={methods} onGenerateUnderStair={onGenerateUnderStair} />}
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

function AngleField({ label, value, disabled, onCommit }: { label: string; value: number; disabled?: boolean; onCommit: (v: number) => void }) {
  const shown = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
  const [text, setText] = useState(shown);
  const [error, setError] = useState(false);
  useEffect(() => setText(shown), [shown]);
  const commit = () => {
    const v = Number(text.trim().replace('°', '').replace(',', '.'));
    if (!Number.isFinite(v) || v < 0 || v >= 360) return setError(true);
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

// ────────────────────────── paredes ──────────────────────────

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
          Cargá el largo de cada pared (cara interior) y el ángulo de cada esquina. Desde cualquier pared podés abrir su <strong>Alzado</strong> para ver muebles, aberturas y pendientes de frente.
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
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Pared {i + 1}
                    {isClosing && <span className="ml-1 text-xs font-normal text-muted">· cierra el ambiente</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      store.getState().setElevationWall(i);
                      store.getState().select({ kind: 'wall', index: i });
                      store.getState().setView('elevation');
                    }}
                    title="Abrir la vista lateral (alzado) de frente a esta pared"
                    className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft"
                  >
                    Ver alzado
                  </button>
                </div>
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
                  <Button size="sm" variant="ghost" onClick={() => apply((p) => splitWall(p, i))} title="Agrega una esquina en el medio para hacer una L, una ochava o un quiebre">
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
            {fmtMm(closingError)} mm.
          </Alert>
        )}
      </Section>
    </>
  );
}

// ────────────────────────── aberturas ──────────────────────────

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
        <p className="text-xs text-muted">Tocá una pared en la planta para elegir dónde. También podés arrastrar aberturas desde la vista <strong>Alzado</strong> con eje bloqueado.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => add('door')} title="Agregar una puerta centrada en esta pared">
            + Puerta
          </Button>
          <Button size="sm" onClick={() => add('window')} title="Agregar una ventana con antepecho centrada en esta pared">
            + Ventana
          </Button>
          <Button size="sm" onClick={() => add('opening')} title="Agregar un vano sin hoja">
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

// ────────────────────────── obra (geometrías 3D + asistente bajo escalera) ──────────────────────────

function BlocksTab({
  store,
  plan,
  selection,
  methods,
  onGenerateUnderStair,
}: {
  store: RoomStore;
  plan: RoomPlan;
  selection: RoomSelection;
  methods: Method[];
  onGenerateUnderStair?: (modules: UnderStairModuleSpec[]) => Promise<void>;
}) {
  const apply = store.getState().apply;
  const blocks = plan.blocks ?? [];
  const ws = walls(plan);
  const w0 = ws[selection.kind === 'wall' ? selection.index : 0] ?? ws[0]!;

  const addPreset = (preset: 'pier' | 'countertop' | 'stair') => {
    const id = uid();
    const rot = Math.round(((Math.atan2(w0.dir.y, w0.dir.x) * 180) / Math.PI + 360) % 360);
    const base = {
      id,
      x: Math.round(w0.a.x + w0.inward.x * mm(50)),
      y: Math.round(w0.a.y + w0.inward.y * mm(50)),
      rotation: rot,
    };
    const item: RoomBlock =
      preset === 'pier'
        ? { ...base, name: 'Pie de mampostería', kind: 'box', material: 'masonry', elevation: 0, width: mm(150), depth: mm(600), height: mm(850) }
        : preset === 'countertop'
          ? { ...base, name: 'Mesada / isla', kind: 'box', material: 'countertop', elevation: mm(850), width: mm(1800), depth: mm(650), height: mm(40) }
          : {
              ...base,
              name: 'Losa bajo escalera',
              kind: 'slope',
              material: 'concrete',
              elevation: 0,
              width: Math.min(w0.length, mm(2800)),
              depth: mm(900),
              height: mm(180),
              heightStart: 0,
              heightEnd: Math.min(plan.wallHeight, mm(2600)),
            };
    apply((p) => ({ ...p, blocks: [...(p.blocks ?? []), item] }));
    store.getState().select({ kind: 'block', id });
  };

  const selected = selection.kind === 'block' ? blocks.find((b) => b.id === selection.id) : undefined;

  return (
    <>
      <Section title="Agregar geometría de obra">
        <p className="text-xs text-muted">
          Modelá pies de mampostería, mesadas o la losa inclinada de un bajo escalera. Al elegir una losa inclinada podés <strong>generar los módulos escalonados automáticamente</strong>.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => addPreset('pier')} title="Agrega un murete o pie de mampostería de 150 × 600 × 850 mm">
            + Pie / murete
          </Button>
          <Button size="sm" onClick={() => addPreset('countertop')} title="Agrega una mesada o isla elevada a 850 mm del piso">
            + Mesada / isla
          </Button>
          <Button size="sm" onClick={() => addPreset('stair')} title="Agrega una losa inclinada de escalera para diseñar muebles bajo escalera">
            + Bajo escalera
          </Button>
        </div>
      </Section>

      {selected && <BlockForm store={store} plan={plan} block={selected} methods={methods} onGenerateUnderStair={onGenerateUnderStair} />}

      <Section title="Elementos en el ambiente">
        {blocks.length === 0 ? (
          <p className="text-sm text-muted">Todavía no agregaste mampostería ni rampas en este ambiente.</p>
        ) : (
          <ul className="space-y-2">
            {blocks.map((b) => {
              const active = selection.kind === 'block' && selection.id === b.id;
              return (
                <li
                  key={b.id}
                  onClick={() => store.getState().select({ kind: 'block', id: b.id })}
                  className={`cursor-pointer rounded-card border p-3 text-sm transition-colors ${active ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-2'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{b.name}</span>
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                      {b.kind === 'slope' ? 'Pendiente' : 'Bloque'}
                    </span>
                  </div>
                  <p className="tabular mt-1 text-xs text-muted">
                    {b.kind === 'slope'
                      ? `${fmtMm(b.width)} × ${fmtMm(b.depth)} mm · sube ${fmtMm(b.heightStart ?? 0)} → ${fmtMm(b.heightEnd ?? b.height)} mm`
                      : `${fmtDims(b.width, b.height, b.depth)} mm${b.elevation > 0 ? ` · a ${fmtMm(b.elevation)} mm` : ''}`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}

function BlockForm({
  store,
  plan,
  block: b,
  methods,
  onGenerateUnderStair,
}: {
  store: RoomStore;
  plan: RoomPlan;
  block: RoomBlock;
  methods: Method[];
  onGenerateUnderStair?: (modules: UnderStairModuleSpec[]) => Promise<void>;
}) {
  const apply = store.getState().apply;
  const [wizardOpen, setWizardOpen] = useState(false);

  const update = (patch: Partial<RoomBlock>) =>
    apply((pl) => ({ ...pl, blocks: (pl.blocks ?? []).map((x) => (x.id === b.id ? { ...x, ...patch } : x)) }));

  const rotate = (deg: number) => {
    const { u, f } = placementAxes(b.rotation);
    const c = { x: b.x + (u.x * b.width) / 2 + (f.x * b.depth) / 2, y: b.y + (u.y * b.width) / 2 + (f.y * b.depth) / 2 };
    const r = (((b.rotation + deg) % 360) + 360) % 360;
    const a = placementAxes(r);
    update({
      rotation: r,
      x: Math.round(c.x - (a.u.x * b.width) / 2 - (a.f.x * b.depth) / 2),
      y: Math.round(c.y - (a.u.y * b.width) / 2 - (a.f.y * b.depth) / 2),
    });
  };

  return (
    <Section title={`Editando: ${b.name}`}>
      <div className="space-y-3 rounded-card border border-accent/40 bg-surface p-3">
        <TextField label="Nombre" value={b.name} maxLength={120} onChange={(e) => update({ name: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Geometría"
            value={b.kind}
            onChange={(e) => {
              const kind = e.target.value as RoomBlockKind;
              update(
                kind === 'slope'
                  ? { kind, heightStart: b.heightStart ?? 0, heightEnd: b.heightEnd ?? Math.min(plan.wallHeight, mm(2600)), height: Math.min(b.height, mm(250)) }
                  : { kind },
              );
            }}
          >
            <option value="box">Bloque / mampostería</option>
            <option value="slope">Losa inclinada / escalera</option>
          </SelectField>
          <SelectField label="Terminación" value={b.material} onChange={(e) => update({ material: e.target.value as RoomBlockMaterial })}>
            <option value="masonry">Mampostería</option>
            <option value="concrete">Hormigón</option>
            <option value="countertop">Mesada / piedra</option>
            <option value="wood">Madera</option>
          </SelectField>
          <MmField compact label="Largo" value={b.width} min={mm(20)} max={mm(20000)} onCommit={(v) => v !== null && update({ width: v })} />
          <MmField compact label="Profundidad / espesor" value={b.depth} min={mm(20)} max={mm(10000)} onCommit={(v) => v !== null && update({ depth: v })} />
          <MmField
            compact
            label={b.kind === 'slope' ? 'Espesor de losa' : 'Alto'}
            value={b.height}
            min={mm(10)}
            max={plan.wallHeight}
            onCommit={(v) => v !== null && update({ height: v })}
          />
          <MmField compact label="Altura desde el piso" value={b.elevation} min={0} max={plan.wallHeight} onCommit={(v) => v !== null && update({ elevation: v })} />
          {b.kind === 'slope' && (
            <>
              <MmField compact label="Altura libre izq." value={b.heightStart ?? 0} min={0} max={plan.wallHeight} onCommit={(v) => v !== null && update({ heightStart: v })} />
              <MmField compact label="Altura libre der." value={b.heightEnd ?? mm(2600)} min={0} max={plan.wallHeight} onCommit={(v) => v !== null && update({ heightEnd: v })} />
            </>
          )}
          <MmField compact label="X" value={b.x} onCommit={(v) => v !== null && update({ x: v })} />
          <MmField compact label="Y" value={b.y} onCommit={(v) => v !== null && update({ y: v })} />
        </div>
        <AngleField label="Giro" value={b.rotation} onCommit={(v) => update({ rotation: v })} />

        {/* Botón asistente Opción A: generar módulos escalonados bajo escalera */}
        {b.kind === 'slope' && onGenerateUnderStair && methods.length > 0 && (
          <div className="rounded-control bg-accent-soft p-2.5">
            <p className="mb-2 text-xs text-accent">
              Creá automáticamente los muebles escalonados con la altura exacta de cada tramo debajo de esta losa.
            </p>
            <Button
              size="sm"
              variant="primary"
              className="w-full"
              onClick={() => setWizardOpen(true)}
              title="Abre el asistente para calcular, crear y ubicar módulos escalonados bajo esta pendiente"
            >
              Generar módulos bajo escalera
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-1 pt-1">
          <Button size="sm" variant="ghost" onClick={() => rotate(90)} title="Gira el bloque 90° en sentido horario">
            Girar 90°
          </Button>
          <Button size="sm" variant="ghost" onClick={() => rotate(-90)} title="Gira el bloque 90° en sentido antihorario">
            Girar -90°
          </Button>
          {b.kind === 'slope' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => update({ heightStart: b.heightEnd ?? mm(2600), heightEnd: b.heightStart ?? 0 })}
              title="Intercambia la altura izquierda y derecha de la rampa"
            >
              Invertir pendiente
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              apply((pl) => ({ ...pl, blocks: (pl.blocks ?? []).filter((x) => x.id !== b.id) }));
              store.getState().select({ kind: 'none' });
            }}
          >
            Quitar
          </Button>
        </div>
      </div>

      {b.kind === 'slope' && onGenerateUnderStair && methods.length > 0 && (
        <UnderStairWizardDialog
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          block={b}
          methods={methods}
          onConfirm={onGenerateUnderStair}
        />
      )}
    </Section>
  );
}

/** Asistente Opción A: calcula y genera módulos rectangulares escalonados debajo de una losa inclinada. */
function UnderStairWizardDialog({
  open,
  onClose,
  block,
  methods,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  block: RoomBlock;
  methods: Method[];
  onConfirm: (modules: UnderStairModuleSpec[]) => Promise<void>;
}) {
  const [count, setCount] = useState(4);
  const [depth, setDepth] = useState<Len>(Math.min(block.depth, mm(600)));
  const [clearance, setClearance] = useState<Len>(mm(20));
  const [templateId, setTemplateId] = useState(TEMPLATES[0]!.id);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0]!;
  const method = methods.find((m) => m.id === methodId) ?? methods[0];

  const planPreview = useMemo(() => {
    const W = block.width;
    const h0 = block.elevation + (block.heightStart ?? 0);
    const h1 = block.elevation + (block.heightEnd ?? block.height);
    const segW = Math.floor(W / count / 100) * 100;
    const clampedW = Math.min(Math.max(segW, LIMITS.w.min), LIMITS.w.max);
    const clampedD = Math.min(Math.max(depth, LIMITS.d.min), LIMITS.d.max);
    const { u } = placementAxes(block.rotation);

    const items: { index: number; width: Len; height: Len; skipped: boolean; x: Len; y: Len }[] = [];
    for (let i = 0; i < count; i++) {
      const u0 = i * segW;
      const u1 = u0 + segW;
      const z0 = h0 + (h1 - h0) * (u0 / (W || 1));
      const z1 = h0 + (h1 - h0) * (u1 / (W || 1));
      const minClear = Math.min(z0, z1);
      const rawH = Math.floor((minClear - clearance) / 100) * 100;
      const skipped = rawH < LIMITS.h.min || segW < LIMITS.w.min;
      const clampedH = Math.min(Math.max(rawH, LIMITS.h.min), LIMITS.h.max);
      items.push({
        index: i + 1,
        width: clampedW,
        height: clampedH,
        skipped,
        x: Math.round(block.x + u.x * u0),
        y: Math.round(block.y + u.y * u0),
      });
    }
    return { items, clampedD };
  }, [block, count, depth, clearance]);

  const validItems = planPreview.items.filter((x) => !x.skipped);

  const submit = async () => {
    if (!method || validItems.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const specs: UnderStairModuleSpec[] = validItems.map((it) => ({
        name: `${block.name} · M${it.index}`.slice(0, 120),
        methodId: method.id,
        design: template.build({ w: it.width, h: it.height, d: planPreview.clampedD }),
        x: it.x,
        y: it.y,
        rotation: block.rotation,
        elevation: 0,
      }));
      await onConfirm(specs);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron crear los módulos.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Generar módulos bajo escalera"
      wide
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy || validItems.length === 0 || !method}>
            {busy ? 'Creando módulos…' : `Crear y colocar ${validItems.length} ${validItems.length === 1 ? 'módulo' : 'módulos'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Dividimos los <strong>{fmtMm(block.width)} mm</strong> de <strong>{block.name}</strong> en módulos independientes calculando la altura libre más baja de cada tramo menos la luz de montaje. Luego podés abrir cada mueble para ajustarlo y sacar su despiece.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SelectField label="Cantidad de tramos" value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} tramos ({fmtMm(Math.floor(block.width / n / 100) * 100)} mm c/u)
              </option>
            ))}
          </SelectField>
          <MmField compact label="Profundidad muebles" value={depth} min={LIMITS.d.min} max={Math.min(LIMITS.d.max, block.depth)} onCommit={(v) => v !== null && setDepth(v)} />
          <MmField compact label="Luz libre superior" value={clearance} min={0} max={mm(200)} onCommit={(v) => v !== null && setClearance(v)} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField label="Plantilla base" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Método de fabricación" value={method?.id ?? ''} onChange={(e) => setMethodId(e.target.value)}>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="rounded-card border border-border bg-surface-2 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Vista previa de los módulos</p>
          <ul className="space-y-1.5 text-sm">
            {planPreview.items.map((it) => (
              <li key={it.index} className={`tabular flex items-center justify-between rounded-control px-2.5 py-1.5 ${it.skipped ? 'bg-surface/60 text-muted' : 'bg-surface text-text shadow-1'}`}>
                <span className="font-medium">Tramo {it.index}</span>
                {it.skipped ? (
                  <span className="text-xs">Muy bajo (&lt; {fmtMm(LIMITS.h.min)} mm) · se omite</span>
                ) : (
                  <span className="text-xs text-muted">
                    {fmtMm(it.width)} ancho × <strong className="text-text">{fmtMm(it.height)} alto</strong> × {fmtMm(planPreview.clampedD)} fondo mm
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}

// ────────────────────────── muebles ──────────────────────────

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
    const p = snapToWall(plan, { id, cabinetId: c.id, x: ws[0]!.a.x, y: ws[0]!.a.y, rotation: 0, elevation }, size, 0);
    apply((pl) => ({ ...pl, placements: [...pl.placements, p] }));
    store.getState().select({ kind: 'placement', id });
  };

  const selected = selection.kind === 'placement' ? plan.placements.find((p) => p.id === selection.id) : undefined;
  const selCabinet = selected ? cabinets.find((c) => c.id === selected.cabinetId) : undefined;

  return (
    <>
      {selected && <PlacementForm store={store} plan={plan} placement={selected} cabinet={selCabinet} />}

      {!selected && cabinets.length > 0 && (
        <p className="rounded-control bg-surface-2 px-3 py-2 text-xs text-muted">
          {plan.placements.length === 0
            ? 'Tocá Colocar en un mueble: aparece contra una pared y después lo movés en Planta o en Alzado (con eje bloqueado).'
            : 'Arrastrá un mueble en Planta o en Alzado. Tocalo para girarlo, subirlo o arrimarlo a la pared.'}
        </p>
      )}
      <Section title="Muebles del proyecto">
        {cabinets.length === 0 && <p className="text-sm text-muted">El proyecto todavía no tiene muebles. Crealos desde la página del proyecto o con el asistente de Bajo escalera en Obra.</p>}
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
                  <Button size="sm" onClick={() => place(c)} title="Agregar este mueble al ambiente, contra una pared">
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
          <Button size="sm" onClick={() => update(snapToWall(plan, p, size, nearestWall(plan, p, size)))} title="Alinea la espalda del mueble contra la pared más cercana">
            Arrimar a la pared
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => rotate(90)}>
          Girar 90°
        </Button>
        <Button size="sm" variant="ghost" onClick={() => rotate(-90)}>
          Girar -90°
        </Button>
        {cabinet && (
          <Link href={`/muebles/${cabinet.id}`} className="inline-flex h-8 items-center rounded-control px-3 text-sm hover:bg-surface-2" title="Abrir este mueble en el editor 3D para modificar puertas, estantes o cajones">
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
      <p className="text-xs text-muted">En Alzado podés arrastrarlo solo en horizontal o solo en vertical (eje bloqueado).</p>
    </Section>
  );
}

// ────────────────────────── avisos ──────────────────────────

function WarningsTab({ store, warnings }: { store: RoomStore; warnings: RoomWarning[] }) {
  if (warnings.length === 0) return <p className="text-sm text-muted">Sin avisos: los muebles entran, no se pisan y no chocan con la obra.</p>;
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
