'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { glassRows, groupedRows, individualRows, totals, type CutItem, type HardwareItem, type LegOut, type Material } from '@mw/engine';
import { cutListCsv } from '@mw/exporters';
import { CuttingPlanView } from '@/components/CuttingPlanView';
import { DocumentDialog } from '@/components/DocumentDialog';
import { LabelsDialog } from '@/components/LabelsDialog';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { downloadBlob } from '@/lib/download';
import { fmtMm, fmtMoney, fmtNum } from '@/lib/format';

/** S24 · Lista de corte (agrupada o pieza a pieza), modo taller con checklist, filtros por tablero, totales y exportación. */
export function CutListView({
  items,
  materials,
  hardware = [],
  fileName,
  title = '',
  legs = {},
  warnings = [],
}: {
  items: CutItem[];
  materials: Material[];
  /** Herrajes del mueble o del proyecto (ya multiplicados por la cantidad de cada mueble). */
  hardware?: HardwareItem[];
  fileName: string;
  /** Nombre del mueble o proyecto (para las etiquetas). */
  title?: string;
  /** Patas de cada mueble (por nombre), para las vistas del PDF. */
  legs?: Record<string, LegOut[]>;
  warnings?: string[];
}) {
  const [mode, setMode] = useState<'grouped' | 'individual'>('grouped');
  const [decimal, setDecimal] = useState<',' | '.'>(',');
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [materialFilter, setMaterialFilter] = useState<string>('all');
  const [onlyPending, setOnlyPending] = useState(false);

  // Avance de piezas cortadas en taller (persistido en localStorage por despiece).
  const storageKey = `mw:cut-progress:${fileName}`;
  const [doneKeys, setDoneKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setDoneKeys(JSON.parse(raw) as Record<string, boolean>);
      else setDoneKeys({});
    } catch {
      setDoneKeys({});
    }
  }, [storageKey]);

  const persistDone = (next: Record<string, boolean>) => {
    setDoneKeys(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ignorar si el navegador bloquea almacenamiento local.
    }
  };

  // Los vidrios van aparte, a la vidriería: la lista de corte (y el CSV para la maderera) es de tablero.
  const woodItems = useMemo(() => items.filter((i) => materials.find((m) => m.id === i.part.materialId)?.kind !== 'glass'), [items, materials]);
  const glass = useMemo(() => glassRows(items, materials), [items, materials]);
  const rows = useMemo(() => (mode === 'grouped' ? groupedRows(woodItems) : individualRows(woodItems)), [woodItems, mode]);
  const sum = useMemo(() => totals(items, materials), [items, materials]);

  // Herrajes iguales (mismo herraje y mismo detalle) en una línea.
  const hw = useMemo(() => {
    const m = new Map<string, HardwareItem>();
    for (const h of hardware) {
      const k = `${h.hardwareId}|${h.note ?? ''}`;
      const prev = m.get(k);
      if (prev) m.set(k, { ...prev, qty: prev.qty + h.qty });
      else m.set(k, { ...h });
    }
    return [...m.values()];
  }, [hardware]);
  const hwCents = hw.reduce((s, h) => s + h.qty * h.priceCents, 0);
  const matName = (id: string | null) => (id ? (materials.find((m) => m.id === id)?.name ?? id) : '');
  const showSources = items.some((i) => i.source) && new Set(items.map((i) => i.source)).size > 1;
  const pieces = items.reduce((s, i) => s + (i.qty ?? 1), 0);
  const totalBoardM2 = sum.panels.reduce((s, p) => s + p.areaM2, 0);
  const diagonalItems = useMemo(() => items.filter((i) => i.part.diagonalCut), [items]);

  // Materiales de tablero presentes para el filtro rápido.
  const boardMaterials = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      counts.set(r.materialId, (counts.get(r.materialId) ?? 0) + r.qty);
    }
    return [...counts.entries()].map(([id, qty]) => ({ id, name: matName(id), qty }));
  }, [rows, materials]);

  // Si cambia el proyecto/despiece y el filtro ya no existe, volver a todos.
  useEffect(() => {
    if (materialFilter !== 'all' && !boardMaterials.some((m) => m.id === materialFilter)) {
      setMaterialFilter('all');
    }
  }, [boardMaterials, materialFilter]);

  const rowKey = (r: (typeof rows)[number]) => `${r.materialId}|${r.cutLength}x${r.cutWidth}|${r.keys.join(',')}`;

  const toggleRowDone = (key: string) => {
    const next = { ...doneKeys };
    if (next[key]) delete next[key];
    else next[key] = true;
    persistDone(next);
  };

  const woodPiecesTotal = useMemo(() => rows.reduce((s, r) => s + r.qty, 0), [rows]);
  const woodPiecesDone = useMemo(() => rows.reduce((s, r) => s + (doneKeys[rowKey(r)] ? r.qty : 0), 0), [rows, doneKeys]);
  const progressPct = woodPiecesTotal > 0 ? Math.round((woodPiecesDone / woodPiecesTotal) * 100) : 0;

  const visibleRows = useMemo(
    () =>
      rows.filter((r) => {
        if (materialFilter !== 'all' && r.materialId !== materialFilter) return false;
        if (onlyPending && doneKeys[rowKey(r)]) return false;
        return true;
      }),
    [rows, materialFilter, onlyPending, doneKeys],
  );

  // Materiales usados que no tienen precio cargado: el total saldría incompleto.
  const unpriced = useMemo(() => {
    const used = new Set<string>();
    for (const { part } of items) {
      used.add(part.materialId);
      for (const e of Object.values(part.edges)) if (e) used.add(e);
    }
    return materials.filter((m) => used.has(m.id) && m.priceCents === 0);
  }, [items, materials]);

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

      {/* Resumen superior compacto */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-card border border-border bg-surface px-3 py-2.5 shadow-1 sm:px-4">
          <p className="text-xs text-muted">Piezas totales</p>
          <p className="tabular mt-0.5 text-lg font-semibold sm:text-xl">{pieces}</p>
        </div>
        <div className="rounded-card border border-border bg-surface px-3 py-2.5 shadow-1 sm:px-4">
          <p className="text-xs text-muted">Superficie tablero</p>
          <p className="tabular mt-0.5 text-lg font-semibold sm:text-xl">{fmtNum(totalBoardM2, 2)} m²</p>
        </div>
        <div className="rounded-card border border-border bg-accent-soft px-3 py-2.5 text-accent sm:px-4">
          <p className="text-xs opacity-85">Costo estimado</p>
          <p className="tabular mt-0.5 text-lg font-semibold sm:text-xl">{fmtMoney(sum.totalCents + hwCents)}</p>
        </div>
      </div>

      {/* Barra de modo y exportaciones */}
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div role="radiogroup" aria-label="Tipo de lista" className="inline-flex gap-1 rounded-control bg-surface-2 p-1">
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
              className={`rounded-control px-3 py-1.5 text-sm ${mode === k ? 'bg-surface font-medium shadow-1' : 'text-muted hover:text-text'}`}
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
              className="h-8 rounded-control border border-border bg-surface px-2 text-sm text-text"
            >
              <option value=",">coma (Excel)</option>
              <option value=".">punto (CNC / optimizador)</option>
            </select>
          </label>
          <Button size="sm" onClick={() => window.print()} title="Imprimir la lista y el plano de cortes, o guardarlos como PDF">
            Imprimir
          </Button>
          <Button size="sm" onClick={() => setLabelsOpen(true)} title="PDF con una etiqueta por pieza, para hojas A4 autoadhesivas">
            Etiquetas
          </Button>
          <Button size="sm" onClick={() => setDocOpen(true)} title="Un PDF con lista de corte, plano de cortes, vistas del mueble y etiquetas, a elección">
            PDF
          </Button>
          <Button size="sm" variant="primary" onClick={download}>
            Descargar CSV
          </Button>
        </div>
      </div>

      {/* Modo taller: progreso de cortes + filtros por tablero */}
      {rows.length > 0 && (
        <div className="no-print space-y-3 rounded-card border border-border bg-surface p-3.5 shadow-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-sm">
              <span className="font-medium">Avance de corte en taller</span>
              <span className={`tabular rounded-full px-2.5 py-0.5 text-xs font-medium ${progressPct === 100 ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted'}`}>
                {woodPiecesDone} / {woodPiecesTotal} piezas ({progressPct}%)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex cursor-pointer items-center gap-1.5 text-muted hover:text-text">
                <input
                  type="checkbox"
                  checked={onlyPending}
                  onChange={(e) => setOnlyPending(e.target.checked)}
                  className="h-4 w-4 rounded accent-[var(--accent)]"
                />
                Solo pendientes
              </label>
              {woodPiecesDone > 0 && (
                <button
                  type="button"
                  onClick={() => persistDone({})}
                  className="font-medium text-muted underline hover:text-text"
                >
                  Reiniciar tildes
                </button>
              )}
            </div>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div
              className={`h-full rounded-full transition-[width] duration-200 ${progressPct === 100 ? 'bg-success' : 'bg-accent'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {boardMaterials.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1" role="group" aria-label="Filtrar por tablero">
              <button
                type="button"
                onClick={() => setMaterialFilter('all')}
                aria-pressed={materialFilter === 'all'}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  materialFilter === 'all' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted hover:text-text'
                }`}
              >
                Todos ({woodPiecesTotal})
              </button>
              {boardMaterials.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMaterialFilter(m.id)}
                  aria-pressed={materialFilter === m.id}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    materialFilter === m.id ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted hover:text-text'
                  }`}
                >
                  {m.name} ({m.qty})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {visibleRows.length === 0 ? (
        <div className="rounded-card border border-dashed border-border-strong bg-surface px-5 py-8 text-center text-sm text-muted">
          {onlyPending && woodPiecesDone === woodPiecesTotal ? (
            <p className="font-medium text-success">¡Todas las piezas de tablero ya están marcadas como cortadas!</p>
          ) : (
            <p>No hay piezas que coincidan con el filtro actual.</p>
          )}
        </div>
      ) : (
        <>
          {/* Móvil: tarjetas con medida grande y casilla táctil para taller */}
          <ul className="space-y-2 sm:hidden print:hidden" aria-label="Lista de corte">
            {visibleRows.map((r) => {
              const key = rowKey(r);
              const done = Boolean(doneKeys[key]);
              const edges = (['L1', 'L2', 'W1', 'W2'] as const).filter((k) => r.edges[k]);
              return (
                <li
                  key={r.ref + r.keys.join()}
                  className={`rounded-card border bg-surface p-3 shadow-1 transition-opacity ${
                    done ? 'border-success/40 opacity-65' : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleRowDone(key)}
                      aria-label={`Marcar ${r.name} como cortada`}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-[var(--accent)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`min-w-0 text-sm ${done ? 'line-through' : ''}`}>
                          <span className="mr-1 text-muted">{r.ref}</span>
                          {r.name}
                        </p>
                        <span className="tabular shrink-0 rounded-control bg-surface-2 px-2 py-0.5 text-sm font-semibold">×{r.qty}</span>
                      </div>
                      <p className={`tabular mt-1 text-xl font-semibold ${done ? 'line-through' : ''}`}>
                        {fmtMm(r.cutLength)} × {fmtMm(r.cutWidth)} <span className="text-sm font-normal text-muted">mm</span>
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {matName(r.materialId)} · {fmtMm(r.thickness)} mm{r.grain === 'length' ? ' · con veta' : ''}
                        {showSources && ` · ${r.sources.join(', ')}`}
                      </p>
                      {edges.length > 0 && (
                        <p className="mt-1 text-xs text-muted">Cantos: {edges.map((k) => `${k.replace('W', 'A')} ${matName(r.edges[k])}`).join(' · ')}</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Escritorio e impresión: tabla completa */}
          <div className="hidden overflow-x-auto rounded-card border border-border bg-surface shadow-1 sm:block print:block">
            <table className="tabular w-full min-w-[740px] text-sm">
              <caption className="sr-only">Lista de corte, medidas en milímetros</caption>
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="no-print w-10 px-3 py-2 text-center font-medium" aria-label="Cortada">
                    ✓
                  </th>
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
                {visibleRows.map((r) => {
                  const key = rowKey(r);
                  const done = Boolean(doneKeys[key]);
                  const edges = (['L1', 'L2', 'W1', 'W2'] as const).filter((k) => r.edges[k]);
                  return (
                    <tr key={r.ref + r.keys.join()} className={`hover:bg-surface-2 ${done ? 'opacity-60' : ''}`}>
                      <td className="no-print px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => toggleRowDone(key)}
                          aria-label={`Marcar ${r.name} como cortada`}
                          className="h-4 w-4 cursor-pointer rounded accent-[var(--accent)]"
                        />
                      </td>
                      <td className="px-3 py-2 text-muted">{r.ref}</td>
                      <td className={`max-w-[16rem] px-3 py-2 ${done ? 'line-through' : ''}`}>{r.name}</td>
                      {showSources && (
                        <td className="max-w-[12rem] truncate px-3 py-2 text-muted" title={r.sources.join(', ')}>
                          {r.sources.join(', ')}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        {matName(r.materialId)}
                        {r.grain === 'length' && <span className="ml-1 text-xs text-muted">(veta)</span>}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${done ? 'line-through' : ''}`}>{fmtMm(r.cutLength)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${done ? 'line-through' : ''}`}>{fmtMm(r.cutWidth)}</td>
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
        </>
      )}

      <p className="text-xs text-muted">
        Medidas de corte en mm, ya descontado el espesor del canto. L1 es el canto delantero; A1 y A2 son los cantos de los extremos.
      </p>
      {diagonalItems.length > 0 && (
        <section aria-labelledby="diagonal-cuts" className="rounded-card border border-warning/40 bg-surface p-4 shadow-1">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 id="diagonal-cuts" className="text-sm font-semibold text-text">
              Cortes en ángulo en taller (bajo escalera / techo inclinado)
            </h3>
            <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">
              {diagonalItems.length} {diagonalItems.length === 1 ? 'pieza' : 'piezas'}
            </span>
          </div>
          <p className="mb-3 text-xs text-muted">
            La lista de corte y el CSV piden a la maderera el <strong>rectángulo completo (con el triángulo de más)</strong>. En el taller, apoyá cada pieza vista de frente, marcá estas alturas desde el borde inferior y cortá la diagonal:
          </p>
          <ul className="space-y-2 text-sm">
            {diagonalItems.map(({ part, qty, source }, idx) => {
              const d = part.diagonalCut!;
              return (
                <li key={`${part.key}-${idx}`} className="tabular flex flex-wrap items-baseline justify-between gap-2 rounded-control bg-surface-2 px-3 py-2">
                  <span className="font-medium text-text">
                    {part.name}
                    {source && showSources ? ` (${source})` : ''}
                    {(qty ?? 1) > 1 ? ` ×${qty}` : ''}
                  </span>
                  <span className="text-xs text-muted">
                    Placa maderera: <strong className="text-text">{fmtMm(part.cutLength)} × {fmtMm(part.cutWidth)} mm</strong> · Corte: <strong className="text-text">{fmtMm(d.heightLeft)} → {fmtMm(d.heightRight)} mm</strong> · Diagonal {fmtMm(d.diagonalLength)} mm ({d.angleDeg}°)
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="totals" className="grid gap-4 md:grid-cols-2">
        <h2 id="totals" className="sr-only">
          Totales
        </h2>
        <div className="rounded-card border border-border bg-surface p-4 shadow-1">
          <h3 className="mb-3 text-sm font-semibold">Tablero</h3>
          <ul className="space-y-1 text-sm">
            {sum.panels.map((p) => (
              <li key={p.materialId} className="tabular flex justify-between gap-3">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-muted">
                  {p.pieces} pzs · {fmtNum(p.areaM2, 2)} m² · {p.costCents > 0 ? fmtMoney(p.costCents) : 'sin precio'}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-card border border-border bg-surface p-4 shadow-1">
          <h3 className="mb-3 text-sm font-semibold">Canto</h3>
          {sum.edges.length === 0 ? (
            <p className="text-sm text-muted">Sin canto.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {sum.edges.map((e) => (
                <li key={e.materialId} className="tabular flex justify-between gap-3">
                  <span className="truncate">{e.name}</span>
                  <span className="shrink-0 text-muted">
                    {fmtNum(e.lengthMl, 2)} m · {e.costCents > 0 ? fmtMoney(e.costCents) : 'sin precio'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {unpriced.length > 0 && (
          <div className="no-print md:col-span-2">
            <Alert tone="info" title={unpriced.length === 1 ? 'Un material no tiene precio' : `${unpriced.length} materiales no tienen precio`}>
              {unpriced.map((m) => m.name).join(', ')}. El total no los incluye.{' '}
              <Link href="/bibliotecas" className="font-medium underline">
                Cargá los precios en Bibliotecas
              </Link>
              .
            </Alert>
          </div>
        )}
        {glass.length > 0 && (
          <div className="rounded-card border border-border bg-surface p-4 shadow-1 md:col-span-2">
            <h3 className="mb-1 text-sm font-semibold">Vidriería</h3>
            <p className="mb-3 text-xs text-muted">Alto × ancho en mm, vistos de frente. Los templados no se cortan ni se perforan después: se piden a medida, con las perforaciones.</p>
            <ul className="space-y-2 text-sm">
              {glass.map((g) => (
                <li key={g.ref} className="tabular">
                  <span className="font-medium">
                    {g.ref} · {g.qty} × {fmtMm(g.length)} × {fmtMm(g.width)}
                  </span>{' '}
                  <span className="text-muted">
                    · {matName(g.materialId)}
                    {g.tempered ? ' · templado' : ''} · {g.polished ? 'cantos pulidos' : 'cantos sin pulir (van dentro del marco)'} · {g.name}
                  </span>
                  {g.holes.length > 0 && (
                    <span className="block text-xs text-muted">
                      Perforaciones Ø {fmtMm(g.holes[0]!.d)}: centro a {fmtMm(Math.min(g.holes[0]!.x, g.width - g.holes[0]!.x))} del borde {g.holes[0]!.x < g.width / 2 ? 'izquierdo' : 'derecho'}, a{' '}
                      {g.holes.map((h) => fmtMm(h.y)).join(', ')} desde abajo.
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {sum.glass.some((x) => x.costCents > 0) && (
              <p className="tabular mt-2 text-sm text-muted">
                {fmtNum(sum.glass.reduce((t, x) => t + x.areaM2, 0), 2)} m² · {fmtMoney(sum.glass.reduce((t, x) => t + x.costCents, 0))}
              </p>
            )}
          </div>
        )}
        {hw.length > 0 && (
          <div className="rounded-card border border-border bg-surface p-4 shadow-1 md:col-span-2">
            <h3 className="mb-3 text-sm font-semibold">Herrajes</h3>
            <ul className="space-y-1 text-sm">
              {hw.map((h) => (
                <li key={h.hardwareId + (h.note ?? '')} className="tabular flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {h.qty} {h.unit === 'par' ? (h.qty === 1 ? 'par' : 'pares') : h.unit === 'juego' ? (h.qty === 1 ? 'juego' : 'juegos') : h.qty === 1 ? 'unidad' : 'unidades'} · {h.name}
                    {h.note && <span className="text-muted"> · {h.note}</span>}
                  </span>
                  <span className="shrink-0 text-muted">{h.priceCents > 0 ? fmtMoney(h.qty * h.priceCents) : 'sin precio'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-baseline justify-between rounded-card bg-accent-soft px-4 py-3 text-accent md:col-span-2">
          <span className="text-sm font-medium">
            {pieces} piezas · material{hw.length > 0 ? ' y herrajes' : ''} estimado (sin mermas ni mano de obra)
          </span>
          <span className="tabular text-xl font-semibold">{fmtMoney(sum.totalCents + hwCents)}</span>
        </div>
        <p className="text-xs text-muted md:col-span-2">
          El tablero se cuenta por m² de pieza. Las placas enteras que hay que comprar, con su costo, están en el plano de cortes de abajo.
        </p>
      </section>

      <CuttingPlanView items={items} materials={materials} />
      {docOpen && (
        <DocumentDialog
          open
          onClose={() => setDocOpen(false)}
          items={items}
          materials={materials}
          title={title || fileName}
          legs={legs}
          fileName={fileName}
          cost={sum.totalCents + hwCents > 0 ? fmtMoney(sum.totalCents + hwCents) : undefined}
        />
      )}
      {labelsOpen && <LabelsDialog open onClose={() => setLabelsOpen(false)} items={items} materials={materials} title={title} fileName={fileName} />}
    </div>
  );
}
