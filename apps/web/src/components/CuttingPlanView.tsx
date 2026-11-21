'use client';

import { useEffect, useMemo, useState } from 'react';
import { cuttingPlan, DEFAULT_CUTTING, mm, type CutItem, type CuttingOptions, type CuttingPlanMaterial, type Material, type NestSheet, type SheetSize } from '@mw/engine';
import { Alert } from '@/components/ui/feedback';
import { MmField } from '@/components/ui/fields';
import { fmtMm, fmtMoney, fmtNum } from '@/lib/format';

const KEY = 'mw-plano-de-cortes';

/** Sierra y refilado elegidos en este navegador (si se puede leer). */
export function readCuttingOptions(): CuttingOptions {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<CuttingOptions> | null;
    if (v && Number.isInteger(v.kerf) && Number.isInteger(v.trim)) return { kerf: v.kerf!, trim: v.trim! };
  } catch {
    /* sin almacenamiento: los de partida */
  }
  return DEFAULT_CUTTING;
}

const pct = (x: number) => `${fmtNum(x * 100, 0)} %`;
const m2 = (a: number) => a / 1e10;

/**
 * Plano de cortes: cada material en sus placas, con las piezas numeradas como en la lista agrupada
 * (G1, G2…), el aprovechamiento y el costo de las placas enteras.
 */
export function CuttingPlanView({ items, materials }: { items: CutItem[]; materials: Material[] }) {
  const [options, setOptions] = useState<CuttingOptions>(DEFAULT_CUTTING);
  useEffect(() => setOptions(readCuttingOptions()), []);
  const update = (patch: Partial<CuttingOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* solo por esta vez */
    }
  };
  const plan = useMemo(() => cuttingPlan(items, materials, options), [items, materials, options]);
  const sheets = plan.reduce((s, p) => s + p.result.sheets.length, 0);
  const cost = plan.reduce((s, p) => s + p.costCents, 0);

  return (
    <section aria-labelledby="placas" className="space-y-5 print:break-before-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 id="placas" className="text-lg font-semibold">
            Plano de cortes
          </h2>
          <p className="mt-1 text-sm text-muted">
            Cuántas placas comprar y cómo salen las piezas, con cortes de lado a lado como los de una seccionadora. La maderera puede optimizar con su propio programa: esto sirve para
            saber cuántas placas y cuánto cuestan antes de pedir. Los números son los de la lista agrupada.
          </p>
        </div>
        <div className="no-print grid w-full grid-cols-2 gap-3 sm:w-72">
          <MmField compact label="Sierra" value={options.kerf} min={0} max={mm(10)} onCommit={(v) => v !== null && update({ kerf: v })} hint="Lo que se pierde por corte." />
          <MmField compact label="Refilado" value={options.trim} min={0} max={mm(50)} onCommit={(v) => v !== null && update({ trim: v })} hint="Por cada borde." />
        </div>
      </div>

      <p className="tabular rounded-card bg-surface-2 px-4 py-3 text-sm">
        <strong>{sheets === 1 ? '1 placa' : `${sheets} placas`}</strong> en total
        {cost > 0 && (
          <>
            {' '}
            · <strong>{fmtMoney(cost)}</strong> en placas enteras
          </>
        )}
        <span className="text-muted">
          {' '}
          · sierra {fmtMm(options.kerf)} mm, refilado {fmtMm(options.trim)} mm
        </span>
      </p>

      {plan.map((p) => (
        <MaterialPlan key={p.materialId} plan={p} grain={materials.find((m) => m.id === p.materialId)?.grain === 'length'} />
      ))}
    </section>
  );
}

function MaterialPlan({ plan, grain }: { plan: CuttingPlanMaterial; grain: boolean }) {
  const r = plan.result;
  const used = r.sheetArea ? r.usedArea / r.sheetArea : 0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-semibold">
          {plan.name} <span className="font-normal text-muted">· placa de {fmtMm(r.sheet.length)} × {fmtMm(r.sheet.width)}</span>
        </h3>
        <p className="tabular text-sm text-muted">
          {r.sheets.length === 1 ? '1 placa' : `${r.sheets.length} placas`} · aprovechamiento {pct(used)} · sobrante {fmtNum(m2(r.sheetArea - r.usedArea), 2)} m²
          {plan.costCents > 0 ? ` · ${fmtMoney(plan.costCents)}` : ' · sin precio'}
        </p>
      </div>
      {r.unplaced.length > 0 && (
        <Alert tone="danger" title="Piezas más grandes que la placa">
          {[...new Set(r.unplaced.map((u) => u.label))].join(', ')} no entran en una placa de {fmtMm(r.sheet.length)} × {fmtMm(r.sheet.width)}. Revisá sus medidas o la medida de la placa en Bibliotecas.
        </Alert>
      )}
      <ol className="grid gap-4 lg:grid-cols-2">
        {r.sheets.map((s, i) => (
          <li key={i} className="break-inside-avoid rounded-card border border-border bg-surface p-3">
            <p className="tabular mb-2 flex justify-between text-xs text-muted">
              <span className="font-medium text-text">
                Placa {i + 1} de {r.sheets.length}
              </span>
              <span>
                {s.placed.length} piezas · {pct(s.usedArea / (r.sheet.length * r.sheet.width))}
              </span>
            </p>
            <SheetDrawing sheet={r.sheet} data={s} grain={grain} title={`${plan.name}, placa ${i + 1}`} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Dibujo de una placa con sus piezas. Medidas del dibujo en 1/100 mm, como el motor. */
function SheetDrawing({ sheet, data, grain, title }: { sheet: SheetSize; data: NestSheet; grain: boolean; title: string }) {
  const L = sheet.length;
  const W = sheet.width;
  const font = W / 26;
  return (
    <svg viewBox={`0 0 ${L} ${W}`} className="h-auto w-full" role="img" aria-label={`${title}: ${data.placed.map((p) => p.label).join(', ')}`}>
      <rect x={0} y={0} width={L} height={W} fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {grain && (
        <g opacity={0.25} stroke="var(--text-muted)" strokeWidth={1} vectorEffect="non-scaling-stroke">
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1={0} x2={L} y1={(W * (i + 1)) / 10} y2={(W * (i + 1)) / 10} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      )}
      {data.placed.map((p) => {
        const small = Math.min(p.dx, p.dy);
        const f = Math.min(font, small / 2.6, p.dx / 4);
        const showDims = p.dy > f * 3.2 && p.dx > f * 7;
        // Medidas de la pieza (largo × ancho), aunque esté girada en la placa.
        const [len, wid] = p.rotated ? [p.dy, p.dx] : [p.dx, p.dy];
        return (
          <g key={p.id}>
            <rect x={p.x} y={p.y} width={p.dx} height={p.dy} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={p.x + p.dx / 2} y={p.y + p.dy / 2} dy={showDims ? -f * 0.35 : 0} fontSize={f} textAnchor="middle" dominantBaseline="middle" fill="var(--text)" fontWeight={600}>
              {p.label}
            </text>
            {showDims && (
              <text x={p.x + p.dx / 2} y={p.y + p.dy / 2} dy={f * 0.85} fontSize={f * 0.75} textAnchor="middle" dominantBaseline="middle" fill="var(--text-muted)" className="tabular">
                {fmtMm(len)} × {fmtMm(wid)}
                {p.rotated ? ' ↻' : ''}
              </text>
            )}
            <title>{`${p.label}: ${fmtMm(len)} × ${fmtMm(wid)} mm${p.rotated ? ', girada' : ''}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
