'use client';

import { useState, type ReactNode } from 'react';
import {
  equalize,
  findParent,
  findZone,
  LIMITS,
  mm,
  setChildSize,
  setDivisions,
  setDrawerCount,
  setDrawerSize,
  setFront,
  setOverride,
  setConstruction,
  setPlinth,
  setShelfHeight,
  setSize,
  type Construction,
  type HardwareChoice,
  type HardwareKind,
  type Design,
  type Edges,
  type Front,
  type FrontMount,
  type PartRole,
} from '@mw/engine';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback';
import { MmField, SelectField, Stepper } from '@/components/ui/fields';
import { fmtDims, fmtMm } from '@/lib/format';
import { useEditor, useEnv } from './context';

/** S04 · Propiedades de lo seleccionado (mueble, hueco o pieza). */
export function PropertiesPanel() {
  const selection = useEditor((s) => s.selection);
  return (
    <div className="space-y-5 p-4">
      {selection.kind === 'cabinet' && <CabinetProps />}
      {selection.kind === 'zone' && <ZoneProps key={selection.id} id={selection.id} />}
      {selection.kind === 'part' && <PartProps key={selection.key} partKey={selection.key} />}
    </div>
  );
}

export const ROLE_LABEL: Record<PartRole, string> = {
  side: 'Costado',
  top: 'Tapa',
  bottom: 'Base',
  back: 'Trasera',
  shelf: 'Estante',
  divider: 'Divisor',
  plinth: 'Zócalo',
  door: 'Puerta',
  'drawer-front': 'Frente de cajón',
  'drawer-side': 'Lateral de cajón',
  'drawer-back': 'Trasera o contrafrente de cajón',
  'drawer-bottom': 'Fondo de cajón',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

/** Botones excluyentes (radiogroup) con aspecto de interruptor segmentado. */
function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-s bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => value !== v && onChange(v)}
          className={`rounded-s px-2 py-1.5 text-sm ${value === v ? 'bg-surface font-medium shadow-1' : 'text-muted hover:text-text'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Warnings({ zoneId }: { zoneId?: string }) {
  const { result } = useEnv();
  const list = result.warnings.filter((w) => (zoneId ? w.zoneId === zoneId : true));
  if (list.length === 0) return null;
  return (
    <div className="space-y-2">
      {list.map((w, i) => (
        <Alert key={i} tone="warning">
          {w.message}
        </Alert>
      ))}
    </div>
  );
}

// ───────────────────────── mueble ─────────────────────────

function CabinetProps() {
  const { methods, result } = useEnv();
  const design = useEditor((s) => s.design);
  const methodId = useEditor((s) => s.methodId);
  const quantity = useEditor((s) => s.quantity);
  const apply = useEditor((s) => s.apply);
  const setMeta = useEditor((s) => s.setMeta);
  const select = useEditor((s) => s.select);
  const { w, h, d } = design.size;
  const plinth = design.plinth;
  const count = (roles: PartRole[]) => result.parts.filter((p) => roles.includes(p.role)).length;
  const doors = count(['door']);
  const drawers = count(['drawer-front']);

  return (
    <>
      <Section title="Medidas exteriores">
        <div className="grid grid-cols-3 gap-2">
          <MmField compact label="Ancho" value={w} min={LIMITS.w.min} max={LIMITS.w.max} onCommit={(v) => v !== null && apply((x) => setSize(x, { w: v }))} />
          <MmField compact label="Alto" value={h} min={LIMITS.h.min} max={LIMITS.h.max} onCommit={(v) => v !== null && apply((x) => setSize(x, { h: v }))} />
          <MmField compact label="Fondo" value={d} min={LIMITS.d.min} max={LIMITS.d.max} onCommit={(v) => v !== null && apply((x) => setSize(x, { d: v }))} />
        </div>
      </Section>

      <Section title="Zócalo">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            checked={!!plinth}
            onChange={(e) => apply((x) => setPlinth(x, e.target.checked ? { height: mm(100), setback: mm(50) } : undefined))}
          />
          Con zócalo (la base sube y se pone un tablero delante, retranqueado)
        </label>
        {plinth && (
          <div className="grid grid-cols-2 gap-2">
            <MmField compact label="Altura" value={plinth.height} min={mm(20)} max={h - mm(100)} onCommit={(v) => v !== null && apply((x) => setPlinth(x, { ...plinth, height: v }))} />
            <MmField compact label="Retranqueo" value={plinth.setback} min={0} max={d - mm(100)} onCommit={(v) => v !== null && apply((x) => setPlinth(x, { ...plinth, setback: v }))} />
          </div>
        )}
      </Section>

      <ConstructionSection />

      <HardwareSection />

      <Section title="Fabricación">
        <SelectField label="Método" value={methodId} onChange={(e) => setMeta({ methodId: e.target.value })}>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </SelectField>
        <Stepper label="Unidades de este mueble" value={quantity} min={1} max={99} onChange={(n) => setMeta({ quantity: n })} />
      </Section>

      <Section title="Resumen">
        <p className="text-sm text-muted">
          {result.parts.length} piezas
          {doors > 0 && ` · ${doors} ${doors === 1 ? 'puerta' : 'puertas'}`}
          {drawers > 0 && ` · ${drawers} ${drawers === 1 ? 'cajón' : 'cajones'}`}.{' '}
          <button type="button" className="font-medium text-accent underline" onClick={() => select({ kind: 'zone', id: design.root.id })}>
            Dividir el interior o ponerle frentes
          </button>
        </p>
      </Section>
      <Warnings />
    </>
  );
}

const HW_LABEL: Record<HardwareKind, string> = { hinge: 'Bisagras', slide: 'Correderas de cajón', sliding: 'Sistema corredizo' };

/** Herrajes del mueble: los del método o los que se elijan aquí. Cambian holguras y descuentos. */
function HardwareSection() {
  const { hardware, method, result } = useEnv();
  const design = useEditor((s) => s.design);
  const apply = useEditor((s) => s.apply);
  const set = (kind: HardwareKind, id: string) =>
    apply((d) => {
      const next: HardwareChoice = { ...d.hardware };
      if (id) next[kind] = id;
      else delete next[kind];
      if (Object.keys(next).length === 0) {
        const { hardware: _h, ...rest } = d;
        return rest;
      }
      return { ...d, hardware: next };
    });
  if (hardware.length === 0) return null;
  const nameOf = (id?: string) => hardware.find((h) => h.id === id)?.name ?? 'ninguno (holguras del método)';
  return (
    <Section title="Herrajes">
      {(['hinge', 'slide', 'sliding'] as const).map((kind) => (
        <SelectField key={kind} label={HW_LABEL[kind]} value={design.hardware?.[kind] ?? ''} onChange={(e) => set(kind, e.target.value)}>
          <option value="">Del método: {nameOf(method.hardware?.[kind])}</option>
          {hardware
            .filter((h) => h.kind === kind)
            .map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
        </SelectField>
      ))}
      {result.hardware.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted">
          {result.hardware.map((h) => (
            <li key={h.hardwareId + (h.note ?? '')}>
              {h.qty} {h.unit === 'par' ? (h.qty === 1 ? 'par' : 'pares') : h.unit === 'juego' ? (h.qty === 1 ? 'juego' : 'juegos') : h.qty === 1 ? 'unidad' : 'unidades'} · {h.name}
              {h.note ? ` · ${h.note}` : ''}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Cómo se arman tapa, base y fondo. */
function ConstructionSection() {
  const design = useEditor((s) => s.design);
  const apply = useEditor((s) => s.apply);
  const c = design.construction ?? {};
  const set = (patch: Partial<Construction>) => apply((d) => setConstruction(d, patch));
  return (
    <Section title="Construcción">
      <SelectField label="Tapa" value={c.top ?? 'between'} onChange={(e) => set({ top: e.target.value as Construction['top'] })}>
        <option value="between">Entre los costados</option>
        <option value="over">Encima de los costados</option>
        <option value="rails">Dos travesaños (bajo mesada)</option>
        <option value="none">Sin tapa</option>
      </SelectField>
      {c.top === 'rails' && (
        <MmField compact label="Ancho de cada travesaño" value={c.railWidth ?? mm(100)} min={mm(30)} max={design.size.d / 2} onCommit={(v) => v !== null && set({ railWidth: v })} />
      )}
      <SelectField label="Base" value={c.bottom ?? 'between'} onChange={(e) => set({ bottom: e.target.value as Construction['bottom'] })}>
        <option value="between">Entre los costados</option>
        <option value="under">Debajo de los costados</option>
      </SelectField>
      <SelectField label="Fondo" value={c.back ?? 'method'} onChange={(e) => set({ back: e.target.value as Construction['back'] })}>
        <option value="method">El del método de fabricación</option>
        <option value="none">Sin fondo</option>
      </SelectField>
      <p className="text-xs text-muted">Cambia qué piezas van enteras y cuáles entre otras: las medidas de corte se recalculan solas.</p>
    </Section>
  );
}

// ───────────────────────── hueco ─────────────────────────

/** Hueco que contiene a `id` y tiene frente, si lo hay. */
function coveringZone(design: Design, id: string): string | null {
  let cur = findParent(design.root, id);
  while (cur) {
    if (cur.parent.front) return cur.parent.id;
    cur = findParent(design.root, cur.parent.id);
  }
  return null;
}

function ZoneProps({ id }: { id: string }) {
  const { result, labels } = useEnv();
  const design = useEditor((s) => s.design);
  const apply = useEditor((s) => s.apply);
  const select = useEditor((s) => s.select);
  const zone = findZone(design.root, id);
  const out = result.zones.find((z) => z.id === id);
  const parent = findParent(design.root, id);
  const [axis, setAxis] = useState<'x' | 'y'>(zone?.split?.axis ?? 'y');

  if (!zone || !out) {
    return <Alert tone="info">Este hueco ya no existe. Elige otro en la estructura.</Alert>;
  }

  const split = zone.split;
  const panels = split ? split.children.length - 1 : 0;
  const childBoxes = result.zones.filter((z) => z.parentId === id);
  const noun = (a: 'x' | 'y', n: number) => (a === 'y' ? (n === 1 ? 'estante' : 'estantes') : n === 1 ? 'divisor' : 'divisores');

  return (
    <>
      <div>
        <p className="text-xs text-muted">Hueco</p>
        <h2 className="text-lg font-semibold">{labels.get(id)?.full}</h2>
        <p className="tabular text-sm text-muted">
          Libre: {fmtDims(out.box.dx, out.box.dy, out.box.dz)} mm (ancho × alto × fondo)
        </p>
      </div>

      <FrontSection zoneId={id} />

      {/* S05 · Añadir divisiones */}
      <Section title="Dividir">
        <Segmented
          label="Tipo de división"
          value={axis}
          onChange={setAxis}
          options={[
            ['y', 'Estantes'],
            ['x', 'Divisores verticales'],
          ]}
        />
        <Stepper
          label={axis === 'y' ? 'Número de estantes' : 'Número de divisores'}
          value={split?.axis === axis ? panels : 0}
          min={0}
          max={20}
          onChange={(n) => apply((d) => setDivisions(d, id, axis, n))}
        />
        {split && split.axis !== axis && (
          <p className="text-xs text-warning">
            Ahora tiene {panels} {noun(split.axis, panels)}. Si pones {axis === 'y' ? 'estantes' : 'divisores'}, se sustituyen junto con lo que haya dentro.
          </p>
        )}
        {zone.front?.kind === 'drawers' && <p className="text-xs text-warning">Si lo divides, se quitan los cajones de este hueco.</p>}
      </Section>

      {split && (
        <Section title={split.axis === 'y' ? 'Altura de cada nivel' : 'Ancho de cada columna'}>
          <p className="text-xs text-muted">Déjalo vacío para que se reparta solo. El nivel 1 es el de abajo.</p>
          <div className="space-y-2">
            {split.children.map((c, i) => {
              const box = childBoxes.find((z) => z.index === i)?.box;
              const auto = box ? (split.axis === 'y' ? box.dy : box.dx) : 0;
              return (
                <div key={c.id} className="flex items-end gap-2">
                  <div className="flex-1">
                    <MmField
                      compact
                      label={labels.get(c.id)?.short ?? `Hueco ${i + 1}`}
                      value={split.sizes[i] ?? null}
                      allowEmpty
                      min={mm(1)}
                      placeholder={`auto · ${fmtMm(auto)}`}
                      onCommit={(v) => apply((d) => setChildSize(d, id, i, v))}
                    />
                  </div>
                  <Button size="sm" variant="ghost" className="mb-0.5" onClick={() => select({ kind: 'zone', id: c.id })}>
                    Abrir
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => apply((d) => equalize(d, id))} disabled={split.sizes.every((s) => s === null)}>
              Repartir igual
            </Button>
            <Button size="sm" variant="ghost" onClick={() => apply((d) => setDivisions(d, id, split.axis, 0))}>
              Quitar divisiones
            </Button>
          </div>
        </Section>
      )}

      {parent && (
        <Button size="sm" variant="ghost" onClick={() => select({ kind: 'zone', id: parent.parent.id })}>
          ↑ Ir al hueco que lo contiene
        </Button>
      )}
      <Warnings zoneId={id} />
    </>
  );
}

/** S06 / S07 · Puerta o cajones del hueco. */
function FrontSection({ zoneId }: { zoneId: string }) {
  const { result, labels } = useEnv();
  const design = useEditor((s) => s.design);
  const apply = useEditor((s) => s.apply);
  const select = useEditor((s) => s.select);
  const zone = findZone(design.root, zoneId)!;
  const box = result.zones.find((z) => z.id === zoneId)!.box;
  const front = zone.front;
  const kind = front?.kind ?? 'none';
  const mount: FrontMount = front && front.kind !== 'sliding' ? front.mount : 'overlay';
  const covering = coveringZone(design, zoneId);
  const hasInnerFronts = (z: typeof zone): boolean => !!z.split?.children.some((c) => c.front || hasInnerFronts(c));

  const put = (f: Front | undefined) => apply((d) => setFront(d, zoneId, f));
  const choose = (k: 'none' | 'door' | 'drawers' | 'sliding') => {
    if (k === 'none') put(undefined);
    else if (k === 'door') put({ kind: 'door', leaves: box.dx > mm(600) ? 2 : 1, hinge: 'left', mount });
    else if (k === 'sliding') put({ kind: 'sliding', leaves: box.dx > mm(1500) ? 3 : 2 });
    else put({ kind: 'drawers', mount, sizes: [null, null, null] });
  };

  const frontParts = result.parts.filter((p) => p.zoneId === zoneId && p.role === 'drawer-front');

  return (
    <Section title="Frente">
      <Segmented
        label="Qué cierra el hueco"
        value={kind}
        onChange={choose}
        options={[
          ['none', 'Abierto'],
          ['door', 'Puerta'],
          ['sliding', 'Corrediza'],
          ['drawers', 'Cajones'],
        ]}
      />
      {covering && (
        <p className="text-xs text-warning">
          Este hueco ya queda detrás del frente de «{labels.get(covering)?.full}». Si le pones uno aquí, se quita aquel.
        </p>
      )}
      {kind === 'none' && hasInnerFronts(zone) && <p className="text-xs text-muted">Los huecos de dentro tienen sus propios frentes.</p>}
      {kind === 'drawers' && zone.split && <p className="text-xs text-warning">Los cajones necesitan un hueco sin divisiones.</p>}

      {front?.kind === 'sliding' && (
        <>
          <Segmented
            label="Hojas"
            value={front.leaves}
            onChange={(n) => put({ ...front, leaves: n })}
            options={[
              [2, 'Dos hojas'],
              [3, 'Tres hojas'],
            ]}
          />
          <p className="text-xs text-muted">
            Las hojas van dentro del hueco, en dos rieles. El solape, las luces arriba y abajo y la distancia al frente salen del sistema corredizo (Mueble completo → Herrajes).
          </p>
        </>
      )}

      {front && front.kind !== 'sliding' && (
        <Segmented
          label="Montaje"
          value={mount}
          onChange={(m) => put({ ...front, mount: m })}
          options={[
            ['overlay', 'Superpuesto'],
            ['inset', 'Encastrado'],
          ]}
        />
      )}

      {front?.kind === 'door' && (
        <>
          <Segmented
            label="Hojas"
            value={front.leaves}
            onChange={(n) => put({ ...front, leaves: n })}
            options={[
              [1, 'Una hoja'],
              [2, 'Dos hojas'],
            ]}
          />
          {front.leaves === 1 && (
            <Segmented
              label="Bisagras"
              value={front.hinge}
              onChange={(hinge) => put({ ...front, hinge })}
              options={[
                ['left', 'Bisagras a la izquierda'],
                ['right', 'A la derecha'],
              ]}
            />
          )}
        </>
      )}

      {front?.kind === 'drawers' && (
        <>
          <Stepper label="Número de cajones" value={front.sizes.length} min={1} max={12} onChange={(n) => apply((d) => setDrawerCount(d, zoneId, n))} />
          <p className="text-xs text-muted">Altura de cada frente, de arriba abajo. Déjalo vacío para repartir.</p>
          <div className="space-y-2">
            {front.sizes.map((s, i) => {
              const p = frontParts.find((x) => x.key === `zone:${zoneId}/drawer${i}/front`);
              return (
                <MmField
                  key={i}
                  compact
                  label={`Cajón ${i + 1}${i === 0 ? ' (arriba)' : i === front.sizes.length - 1 ? ' (abajo)' : ''}`}
                  value={s}
                  allowEmpty
                  min={mm(40)}
                  placeholder={p ? `auto · ${fmtMm(p.width)}` : 'auto'}
                  onCommit={(v) => apply((d) => setDrawerSize(d, zoneId, i, v))}
                />
              );
            })}
          </div>
          <Button
            size="sm"
            disabled={front.sizes.every((s) => s === null)}
            onClick={() => put({ ...front, sizes: front.sizes.map(() => null) })}
          >
            Igualar alturas
          </Button>
        </>
      )}

      {front && (
        <div className="flex flex-wrap gap-2">
          {result.parts
            .filter((p) => p.zoneId === zoneId && (p.role === 'door' || p.role === 'drawer-front'))
            .slice(0, 4)
            .map((p) => (
              <Button key={p.key} size="sm" variant="ghost" onClick={() => select({ kind: 'part', key: p.key })}>
                {p.name}
              </Button>
            ))}
        </div>
      )}
    </Section>
  );
}

// ───────────────────────── pieza ─────────────────────────

function PartProps({ partKey }: { partKey: string }) {
  const { result, materials, labels } = useEnv();
  const design = useEditor((s) => s.design);
  const apply = useEditor((s) => s.apply);
  const select = useEditor((s) => s.select);
  const part = result.parts.find((p) => p.key === partKey);
  if (!part) return <Alert tone="info">Esta pieza ya no existe.</Alert>;

  const override = design.overrides?.[part.key];
  const panels = materials.filter((m) => m.kind === 'panel' && m.thickness === part.thickness);
  const edgeMats = materials.filter((m) => m.kind === 'edge');
  const edgeNames: [keyof Edges, string][] = [
    ['L1', 'L1 · largo (frente)'],
    ['L2', 'L2 · largo'],
    ['W1', 'A1 · extremo'],
    ['W2', 'A2 · extremo'],
  ];
  const isFront = part.role === 'door' || part.role === 'drawer-front';
  const isDrawerBox = part.assembly?.kind === 'drawer' && !isFront;
  const isDivision = part.role === 'shelf' || part.role === 'divider';
  const sameRole = result.parts.filter((p) => p.role === part.role);
  // Estante o divisor: hueco que divide y posición (la clave es zone:<id>/div<i>).
  const divIndex = isDivision ? Number(/\/div(\d+)$/.exec(part.key)?.[1] ?? -1) : -1;
  const parentZone = part.zoneId ? result.zones.find((z) => z.id === part.zoneId) : undefined;
  const levels = part.zoneId ? result.zones.filter((z) => z.parentId === part.zoneId).sort((a, b) => a.index - b.index) : [];

  /** Copia el material y los tapacantos de esta pieza a todas las de su mismo tipo. */
  const applyToAll = () =>
    apply((d) => {
      let next = d;
      for (const p of sameRole) {
        if (p.key === part.key) continue;
        const prev = d.overrides?.[p.key];
        next = setOverride(next, p.key, { ...prev, materialId: part.materialId, edges: { ...part.edges } });
      }
      return next;
    });

  return (
    <>
      <div>
        <p className="text-xs text-muted">Pieza · {ROLE_LABEL[part.role]}</p>
        <h2 className="text-lg font-semibold">{part.name}</h2>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Espesor</dt>
        <dd className="tabular">{fmtMm(part.thickness)} mm</dd>
        <dt className="text-muted">Medida acabada</dt>
        <dd className="tabular">{fmtDims(part.length, part.width)} mm</dd>
        <dt className="text-muted">Medida de corte</dt>
        <dd className="tabular font-medium">{fmtDims(part.cutLength, part.cutWidth)} mm</dd>
        <dt className="text-muted">Veta</dt>
        <dd>{part.grain === 'length' ? 'A lo largo' : 'Sin veta'}</dd>
      </dl>

      {isDivision && parentZone && (
        <Section title="Medidas de esta pieza">
          {part.role === 'shelf' && divIndex >= 0 && (
            <MmField
              compact
              label="Altura (desde el piso del hueco hasta la cara de abajo)"
              value={part.box.y - parentZone.box.y}
              min={mm(1)}
              max={parentZone.box.dy - part.thickness}
              hint="Los niveles de abajo quedan fijos con su medida actual."
              onCommit={(v) => v !== null && apply((d) => setShelfHeight(d, part.zoneId!, divIndex, v, part.thickness, levels.map((z) => z.box.dy)))}
            />
          )}
          <MmField
            compact
            label="Retranqueo del frente (vacío = el del método)"
            value={override?.frontSetback ?? null}
            allowEmpty
            min={0}
            max={parentZone.box.dz - mm(50)}
            placeholder={`método · ${fmtMm(parentZone.box.dz - part.box.dz)}`}
            onCommit={(v) => apply((d) => setOverride(d, part.key, { ...override, frontSetback: v ?? undefined }))}
          />
        </Section>
      )}

      {(part.key === 'top' || part.role === 'back') && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => apply((d) => setConstruction(d, part.role === 'back' ? { back: 'none' } : { top: 'none' }))}
        >
          Quitar {part.role === 'back' ? 'el fondo' : 'la tapa'} de este mueble
        </Button>
      )}

      <Section title="Material">
        <SelectField
          label={`Tablero (solo los de ${fmtMm(part.thickness)} mm)`}
          value={part.materialId}
          onChange={(e) => apply((d) => setOverride(d, part.key, { ...override, materialId: e.target.value }))}
        >
          {panels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </SelectField>
      </Section>

      <Section title="Cantos">
        <div className="grid grid-cols-2 gap-2">
          {edgeNames.map(([k, label]) => (
            <SelectField
              key={k}
              label={label}
              value={part.edges[k] ?? ''}
              onChange={(e) => apply((d) => setOverride(d, part.key, { ...override, edges: { ...override?.edges, [k]: e.target.value || null } }))}
            >
              <option value="">Sin canto</option>
              {edgeMats.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </SelectField>
          ))}
        </div>
        <p className="text-xs text-muted">Al cambiar un canto se recalcula la medida de corte.</p>
      </Section>

      {sameRole.length > 1 && (
        <Button size="sm" variant="ghost" onClick={applyToAll}>
          Usar este tablero y estos tapacantos en las {sameRole.length} piezas de tipo «{ROLE_LABEL[part.role].toLowerCase()}»
        </Button>
      )}

      {part.overridden && (
        <Alert tone="info" title="Esta pieza tiene cambios a mano">
          No sigue del todo el método de fabricación.{' '}
          <button type="button" className="font-medium underline" onClick={() => apply((d) => setOverride(d, part.key, undefined))}>
            Volver a lo del método
          </button>
        </Alert>
      )}

      {part.zoneId && (
        <Button size="sm" onClick={() => select({ kind: 'zone', id: part.zoneId! })}>
          {isFront ? 'Editar el frente' : isDrawerBox ? 'Editar los cajones' : 'Ver el hueco que divide'} ({labels.get(part.zoneId)?.short})
        </Button>
      )}
    </>
  );
}
