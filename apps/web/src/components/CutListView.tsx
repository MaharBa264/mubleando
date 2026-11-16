'use client';

import { useMemo, useState } from 'react';
import { groupedRows, individualRows, totals, type CutItem, type Material } from '@mw/engine';
import { cutListCsv } from '@mw/exporters';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { downloadBlob } from '@/lib/download';
import { fmtMm, fmtMoney, fmtNum } from '@/lib/format';

/** S24 · Lista de corte (agrupada o pieza a pieza), totales y descarga CSV. */
export function CutListView({
  items,
  materials,
  fileName,
  warnings = [],
}: {
  items: CutItem[];
  materials: Material[];
  fileName: string;
  warnings?: string[];
}) {
  const [mode, setMode] = useState<'grouped' | 'individual'>('grouped');
  const [decimal, setDecimal] = useState<',' | '.'>(',');
  const rows = useMemo(() => (mode === 'grouped' ? groupedRows(items) : individualRows(items)), [items, mode]);
  const sum = useMemo(() => totals(items, materials), [items, materials]);
  const matName = (id: string | null) => (id ? (materials.find((m) => m.id === id)?.name ?? id) : '');
  const showSources = items.some((i) => i.source) && new Set(items.map((i) => i.source)).size > 1;
  const pieces = items.reduce((s, i) => s + (i.qty ?? 1), 0);

  if (items.length === 0) {
    return <EmptyState title="No hay piezas">Añade muebles al proyecto para ver su lista de corte.</EmptyState>;
  }

  const download = () => {
    const csv = cutListCsv(rows, materials, { decimal });
    downloadBlob(csv, `${fileName}-${mode === 'grouped' ? 'agrupada' : 'piezas'}.csv`, 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-6">
      {warnings.length > 0 && (
        <Alert tone="warning" title="Revisa el diseño antes de cortar">
          <ul className="list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div role="radiogroup" aria-label="Tipo de lista" className="inline-flex gap-1 rounded-s bg-surface-2 p-1">
          {(
            [
              ['grouped', 'Agrupada'],
              ['individual', 'Pieza a pieza'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={mode === k}
              onClick={() => setMode(k)}
              className={`rounded-s px-3 py-1.5 text-sm ${mode === k ? 'bg-surface font-medium shadow-1' : 'text-muted hover:text-text'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            Decimales
            <select
              value={decimal}
              onChange={(e) => setDecimal(e.target.value as ',' | '.')}
              className="h-8 rounded-s border border-border bg-surface px-2 text-sm text-text"
            >
              <option value=",">coma (Excel)</option>
              <option value=".">punto (CNC / optimizador)</option>
            </select>
          </label>
          <Button size="sm" onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button size="sm" variant="primary" onClick={download}>
            Descargar CSV
          </Button>
        </div>
      </div>

      {/* Móvil: tarjetas con la medida de corte bien visible */}
      <ul className="space-y-2 sm:hidden print:hidden" aria-label="Lista de corte">
        {rows.map((r) => {
          const edges = (['L1', 'L2', 'W1', 'W2'] as const).filter((k) => r.edges[k]);
          return (
            <li key={r.ref + r.keys.join()} className="rounded-m border border-border bg-surface p-3 shadow-1">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm">
                  <span className="mr-1 text-muted">{r.ref}</span>
                  {r.name}
                </p>
                <span className="tabular shrink-0 rounded-s bg-surface-2 px-2 py-0.5 text-sm font-semibold">×{r.qty}</span>
              </div>
              <p className="tabular mt-1 text-xl font-semibold">
                {fmtMm(r.cutLength)} × {fmtMm(r.cutWidth)} <span className="text-sm font-normal text-muted">mm</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {matName(r.materialId)} · {fmtMm(r.thickness)} mm{r.grain === 'length' ? ' · con veta' : ''}
                {showSources && ` · ${r.sources.join(', ')}`}
              </p>
              {edges.length > 0 && (
                <p className="mt-1 text-xs text-muted">Cantos: {edges.map((k) => `${k.replace('W', 'A')} ${matName(r.edges[k])}`).join(' · ')}</p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rounded-m border border-border bg-surface shadow-1 sm:block print:block">
        <table className="tabular w-full min-w-[720px] text-sm">
          <caption className="sr-only">Lista de corte, medidas en milímetros</caption>
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Ref</th>
              <th scope="col" className="px-3 py-2 font-medium">Pieza</th>
              {showSources && <th scope="col" className="px-3 py-2 font-medium">Mueble</th>}
              <th scope="col" className="px-3 py-2 font-medium">Material</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Largo</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Ancho</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Esp.</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Cant.</th>
              <th scope="col" className="px-3 py-2 font-medium">Cantos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const edges = (['L1', 'L2', 'W1', 'W2'] as const).filter((k) => r.edges[k]);
              return (
                <tr key={r.ref + r.keys.join()} className="hover:bg-surface-2">
                  <td className="px-3 py-2 text-muted">{r.ref}</td>
                  <td className="max-w-[16rem] px-3 py-2">{r.name}</td>
                  {showSources && <td className="max-w-[12rem] truncate px-3 py-2 text-muted" title={r.sources.join(', ')}>{r.sources.join(', ')}</td>}
                  <td className="px-3 py-2">
                    {matName(r.materialId)}
                    {r.grain === 'length' && <span className="ml-1 text-xs text-muted">(veta)</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{fmtMm(r.cutLength)}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtMm(r.cutWidth)}</td>
                  <td className="px-3 py-2 text-right">{fmtMm(r.thickness)}</td>
                  <td className="px-3 py-2 text-right">{r.qty}</td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {edges.length === 0 ? '—' : edges.map((k) => `${k.replace('W', 'A')}: ${matName(r.edges[k])}`).join(' · ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Medidas de corte en mm, ya descontado el espesor del canto. L1 es el canto delantero; A1 y A2 son los cantos de los extremos.
      </p>

      <section aria-labelledby="totals" className="grid gap-4 md:grid-cols-2">
        <h2 id="totals" className="sr-only">
          Totales
        </h2>
        <div className="rounded-m border border-border bg-surface p-4 shadow-1">
          <h3 className="mb-3 text-sm font-semibold">Tablero</h3>
          <ul className="space-y-1 text-sm">
            {sum.panels.map((p) => (
              <li key={p.materialId} className="tabular flex justify-between gap-3">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-muted">
                  {p.pieces} pzs · {fmtNum(p.areaM2, 2)} m² · {fmtMoney(p.costCents)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-m border border-border bg-surface p-4 shadow-1">
          <h3 className="mb-3 text-sm font-semibold">Canto</h3>
          {sum.edges.length === 0 ? (
            <p className="text-sm text-muted">Sin canto.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {sum.edges.map((e) => (
                <li key={e.materialId} className="tabular flex justify-between gap-3">
                  <span className="truncate">{e.name}</span>
                  <span className="shrink-0 text-muted">
                    {fmtNum(e.lengthMl, 2)} m · {fmtMoney(e.costCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-baseline justify-between rounded-m bg-accent-soft px-4 py-3 text-accent md:col-span-2">
          <span className="text-sm font-medium">
            {pieces} piezas · material estimado (sin mermas ni mano de obra)
          </span>
          <span className="tabular text-xl font-semibold">{fmtMoney(sum.totalCents)}</span>
        </div>
      </section>
    </div>
  );
}
