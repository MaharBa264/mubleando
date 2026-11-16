'use client';

import { useState } from 'react';
import {
  equalize,
  findParent,
  findZone,
  LIMITS,
  mm,
  setChildSize,
  setDivisions,
  setSize,
  type Edges,
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
      {selection.kind === 'part' && <PartProps partKey={selection.key} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
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

function CabinetProps() {
  const { methods, result } = useEnv();
  const design = useEditor((s) => s.design);
  const methodId = useEditor((s) => s.methodId);
  const quantity = useEditor((s) => s.quantity);
  const apply = useEditor((s) => s.apply);
  const setMeta = useEditor((s) => s.setMeta);
  const select = useEditor((s) => s.select);
  const { w, h, d } = design.size;

  return (
    <>
      <Section title="Medidas exteriores">
        <div className="grid grid-cols-3 gap-2">
          <MmField compact label="Ancho" value={w} min={LIMITS.w.min} max={LIMITS.w.max} onCommit={(v) => v !== null && apply((x) => setSize(x, { w: v }))} />
          <MmField compact label="Alto" value={h} min={LIMITS.h.min} max={LIMITS.h.max} onCommit={(v) => v !== null && apply((x) => setSize(x, { h: v }))} />
          <MmField compact label="Fondo" value={d} min={LIMITS.d.min} max={LIMITS.d.max} onCommit={(v) => v !== null && apply((x) => setSize(x, { d: v }))} />
        </div>
      </Section>
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
          {result.parts.length} piezas.{' '}
          <button type="button" className="font-medium text-accent underline" onClick={() => select({ kind: 'zone', id: design.root.id })}>
            Dividir el interior
          </button>
        </p>
      </Section>
      <Warnings />
    </>
  );
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

      {/* S05 · Añadir divisiones */}
      <Section title="Dividir">
        <div role="radiogroup" aria-label="Tipo de división" className="grid grid-cols-2 gap-1 rounded-s bg-surface-2 p-1">
          {(['y', 'x'] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={axis === a}
              onClick={() => setAxis(a)}
              className={`rounded-s px-2 py-1.5 text-sm ${axis === a ? 'bg-surface font-medium shadow-1' : 'text-muted hover:text-text'}`}
            >
              {a === 'y' ? 'Estantes' : 'Divisores verticales'}
            </button>
          ))}
        </div>
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

function PartProps({ partKey }: { partKey: string }) {
  const { result, materials, labels } = useEnv();
  const select = useEditor((s) => s.select);
  const part = result.parts.find((p) => p.key === partKey);
  if (!part) return <Alert tone="info">Esta pieza ya no existe.</Alert>;
  const matName = (id: string | null) => (id ? (materials.find((m) => m.id === id)?.name ?? id) : '—');
  const edgeNames: [keyof Edges, string][] = [
    ['L1', 'Largo 1 (frente)'],
    ['L2', 'Largo 2'],
    ['W1', 'Ancho 1'],
    ['W2', 'Ancho 2'],
  ];

  return (
    <>
      <div>
        <p className="text-xs text-muted">Pieza</p>
        <h2 className="text-lg font-semibold">{part.name}</h2>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Material</dt>
        <dd>{matName(part.materialId)}</dd>
        <dt className="text-muted">Espesor</dt>
        <dd className="tabular">{fmtMm(part.thickness)} mm</dd>
        <dt className="text-muted">Medida acabada</dt>
        <dd className="tabular">{fmtDims(part.length, part.width)} mm</dd>
        <dt className="text-muted">Medida de corte</dt>
        <dd className="tabular font-medium">{fmtDims(part.cutLength, part.cutWidth)} mm</dd>
        <dt className="text-muted">Veta</dt>
        <dd>{part.grain === 'length' ? 'A lo largo' : 'Sin veta'}</dd>
      </dl>
      <Section title="Cantos">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {edgeNames.map(([k, label]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd>{matName(part.edges[k])}</dd>
            </div>
          ))}
        </dl>
      </Section>
      {part.zoneId && (
        <Button size="sm" onClick={() => select({ kind: 'zone', id: part.zoneId! })}>
          Ver el hueco que divide ({labels.get(part.zoneId)?.short})
        </Button>
      )}
      <p className="text-xs text-muted">Materiales y cantos por pieza se podrán cambiar en la fase 2. Ahora salen del método.</p>
    </>
  );
}
