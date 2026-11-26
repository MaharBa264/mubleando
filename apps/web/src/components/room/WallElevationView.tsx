'use client';

import { useMemo, useRef, useState } from 'react';
import { blockFootprint, footprint, slideOpening, walls, type CabinetSize, type RoomPlan } from '@mw/engine';
import type { RoomSelection, RoomStore } from './roomStore';

/** Paso al arrastrar en alzado: 10 mm. */
const SNAP = 1000;
/** Umbral mínimo de movimiento para fijar el eje (horizontal o vertical): 20 mm. */
const AXIS_LOCK_THRESHOLD = 2000;
/** Profundidad máxima desde la pared cuando el filtro "Cercanos" está activo: 1,20 m. */
const NEAR_DEPTH = 120000;

const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const fmt = (len: number, digits = 0) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(len / 100);

type DragAxis = 'pending' | 'h' | 'v';

type ElevationDrag =
  | {
      kind: 'placement';
      id: string;
      axis: DragAxis;
      fromU: number;
      fromZ: number;
      x0: number;
      y0: number;
      elev0: number;
      maxElev: number;
      before: RoomPlan;
      moved: boolean;
    }
  | {
      kind: 'block';
      id: string;
      axis: DragAxis;
      fromU: number;
      fromZ: number;
      x0: number;
      y0: number;
      elev0: number;
      maxElev: number;
      before: RoomPlan;
      moved: boolean;
    }
  | {
      kind: 'opening';
      id: string;
      canVertical: boolean;
      axis: DragAxis;
      fromU: number;
      fromZ: number;
      offset0: number;
      sill0: number;
      maxSill: number;
      before: RoomPlan;
      moved: boolean;
    };

/**
 * Vista de alzado (lateral/frontal 2D ortogonal) de una pared específica.
 * Permite arrastrar muebles, aberturas y geometrías de obra con bloqueo estricto de eje
 * (solo horizontal o solo vertical por gesto) y muestra cotas de altura libre en mm.
 */
export function WallElevationView({
  store,
  plan,
  wallIndex,
  selection,
  sizes,
  names,
  flagged,
}: {
  store: RoomStore;
  plan: RoomPlan;
  wallIndex: number;
  selection: RoomSelection;
  sizes: Readonly<Record<string, CabinetSize>>;
  names: Readonly<Record<string, string>>;
  flagged: ReadonlySet<string>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<ElevationDrag | null>(null);
  const [onlyNear, setOnlyNear] = useState(true);
  const [activeAxis, setActiveAxis] = useState<'h' | 'v' | null>(null);

  const ws = useMemo(() => walls(plan), [plan]);
  const safeIndex = ws.length > 0 ? Math.min(Math.max(0, wallIndex), ws.length - 1) : 0;
  const w = ws[safeIndex];

  if (!w) return null;

  const W = w.length;
  const H = plan.wallHeight;
  const padL = Math.max(42000, W * 0.12);
  const padR = Math.max(24000, W * 0.06);
  const padT = Math.max(26000, H * 0.1);
  const padB = Math.max(38000, H * 0.14);
  const vbW = W + padL + padR;
  const vbH = H + padT + padB;
  const k = Math.max(vbW, vbH) / 760;
  const fontSize = 12 * k;

  const toY = (z: number) => H - z;

  const toWallCoords = (e: { clientX: number; clientY: number }) => {
    const el = svgRef.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return { u: 0, z: 0 };
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { u: pt.x, z: H - pt.y };
  };

  const proj = (pt: { x: number; y: number }) => {
    const dx = pt.x - w.a.x;
    const dy = pt.y - w.a.y;
    return {
      u: dx * w.dir.x + dy * w.dir.y,
      d: dx * w.inward.x + dy * w.inward.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const cur = toWallCoords(e);
    const rawDu = cur.u - d.fromU;
    const rawDz = cur.z - d.fromZ;

    // Bloqueo de eje: fija horizontal o vertical según el movimiento inicial.
    if (d.axis === 'pending') {
      if (Math.max(Math.abs(rawDu), Math.abs(rawDz)) < AXIS_LOCK_THRESHOLD) return;
      if (d.kind === 'opening' && !d.canVertical) {
        d.axis = 'h';
      } else {
        d.axis = Math.abs(rawDu) >= Math.abs(rawDz) ? 'h' : 'v';
      }
      setActiveAxis(d.axis);
    }

    d.moved = true;

    if (d.kind === 'placement') {
      if (d.axis === 'h') {
        const du = snap(rawDu);
        const x = Math.round(d.x0 + w.dir.x * du);
        const y = Math.round(d.y0 + w.dir.y * du);
        store.getState().preview((p) => ({
          ...p,
          placements: p.placements.map((pl) => (pl.id === d.id ? { ...pl, x, y } : pl)),
        }));
      } else {
        const elevation = Math.max(0, Math.min(d.maxElev, snap(d.elev0 + rawDz)));
        store.getState().preview((p) => ({
          ...p,
          placements: p.placements.map((pl) => (pl.id === d.id ? { ...pl, elevation } : pl)),
        }));
      }
    } else if (d.kind === 'block') {
      if (d.axis === 'h') {
        const du = snap(rawDu);
        const x = Math.round(d.x0 + w.dir.x * du);
        const y = Math.round(d.y0 + w.dir.y * du);
        store.getState().preview((p) => ({
          ...p,
          blocks: (p.blocks ?? []).map((b) => (b.id === d.id ? { ...b, x, y } : b)),
        }));
      } else {
        const elevation = Math.max(0, Math.min(d.maxElev, snap(d.elev0 + rawDz)));
        store.getState().preview((p) => ({
          ...p,
          blocks: (p.blocks ?? []).map((b) => (b.id === d.id ? { ...b, elevation } : b)),
        }));
      }
    } else {
      if (d.axis === 'h') {
        const offset = snap(d.offset0 + rawDu);
        store.getState().preview((p) => slideOpening(p, d.id, offset));
      } else if (d.canVertical) {
        const sill = Math.max(0, Math.min(d.maxSill, snap(d.sill0 + rawDz)));
        store.getState().preview((p) => ({
          ...p,
          openings: p.openings.map((o) => (o.id === d.id ? { ...o, sill } : o)),
        }));
      }
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setActiveAxis(null);
    if (!d || !d.moved) return;
    store.getState().commit(d.before);
  };

  const startPlacement = (e: React.PointerEvent, id: string, size: CabinetSize) => {
    e.stopPropagation();
    const pl = plan.placements.find((x) => x.id === id);
    if (!pl) return;
    store.getState().select({ kind: 'placement', id });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const start = toWallCoords(e);
    dragRef.current = {
      kind: 'placement',
      id,
      axis: 'pending',
      fromU: start.u,
      fromZ: start.z,
      x0: pl.x,
      y0: pl.y,
      elev0: pl.elevation,
      maxElev: Math.max(0, H - size.h),
      before: plan,
      moved: false,
    };
  };

  const startBlock = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const b = (plan.blocks ?? []).find((x) => x.id === id);
    if (!b) return;
    store.getState().select({ kind: 'block', id });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const start = toWallCoords(e);
    dragRef.current = {
      kind: 'block',
      id,
      axis: 'pending',
      fromU: start.u,
      fromZ: start.z,
      x0: b.x,
      y0: b.y,
      elev0: b.elevation,
      maxElev: H,
      before: plan,
      moved: false,
    };
  };

  const startOpening = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const o = plan.openings.find((x) => x.id === id);
    if (!o) return;
    store.getState().select({ kind: 'opening', id });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const start = toWallCoords(e);
    dragRef.current = {
      kind: 'opening',
      id,
      canVertical: o.kind === 'window',
      axis: 'pending',
      fromU: start.u,
      fromZ: start.z,
      offset0: o.offset,
      sill0: o.sill,
      maxSill: Math.max(0, H - o.height),
      before: plan,
      moved: false,
    };
  };

  const hTicks: number[] = [];
  for (let z = 0; z <= H; z += 50000) hTicks.push(z);
  if (hTicks[hTicks.length - 1] !== H) hTicks.push(H);

  const vTicks: number[] = [];
  for (let u = 0; u <= W; u += 50000) vTicks.push(u);

  const wallOpenings = plan.openings.filter((o) => o.wallId === w.id);

  const projectedBlocks = (plan.blocks ?? [])
    .map((b) => {
      const fp = blockFootprint(b);
      const ps = fp.map(proj);
      const minD = Math.min(...ps.map((p) => p.d));
      const maxD = Math.max(...ps.map((p) => p.d));
      const uMin = Math.min(...ps.map((p) => p.u));
      const uMax = Math.max(...ps.map((p) => p.u));
      if (uMax < -1000 || uMin > W + 1000) return null;
      if (onlyNear && minD > NEAR_DEPTH) return null;
      if (maxD < -5000) return null;
      const uStart = (ps[0]!.u + ps[3]!.u) / 2;
      const uEnd = (ps[1]!.u + ps[2]!.u) / 2;
      return { b, uMin, uMax, uStart, uEnd, minD };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.minD - a.minD);

  const projectedCabinets = plan.placements
    .map((pl) => {
      const size = sizes[pl.cabinetId];
      if (!size) return null;
      const fp = footprint(pl, size);
      const ps = fp.map(proj);
      const minD = Math.min(...ps.map((p) => p.d));
      const maxD = Math.max(...ps.map((p) => p.d));
      const uMin = Math.min(...ps.map((p) => p.u));
      const uMax = Math.max(...ps.map((p) => p.u));
      if (uMax < -1000 || uMin > W + 1000) return null;
      if (onlyNear && minD > NEAR_DEPTH) return null;
      if (maxD < -5000) return null;
      return { pl, size, uMin, uMax, minD };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.minD - a.minD);

  return (
    <div className="relative h-full w-full">
      {/* Selector rápido de pared, filtro de profundidad e indicador de eje bloqueado */}
      <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 lg:max-w-[calc(100%-410px)]">
        <div className="flex flex-wrap gap-1 rounded-full border border-border bg-surface/95 p-1 shadow-float backdrop-blur" role="tablist" aria-label="Elegir pared">
          {ws.map((wall) => {
            const active = wall.index === safeIndex;
            return (
              <button
                key={wall.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  store.getState().setElevationWall(wall.index);
                  store.getState().select({ kind: 'wall', index: wall.index });
                }}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  active ? 'bg-accent text-accent-contrast shadow-1' : 'text-muted hover:bg-surface-2 hover:text-text'
                }`}
              >
                Pared {wall.index + 1}
              </button>
            );
          })}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs text-muted shadow-float backdrop-blur hover:text-text">
          <input
            type="checkbox"
            checked={onlyNear}
            onChange={(e) => setOnlyNear(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          Solo cercanos (&lt; 1,2 m)
        </label>
        {activeAxis && (
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-contrast shadow-float">
            {activeAxis === 'h' ? '↔ Eje bloqueado: horizontal' : '↕ Eje bloqueado: vertical'}
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`${-padL} ${-padT} ${vbW} ${vbH}`}
        className="h-full w-full touch-none select-none"
        role="img"
        aria-label={`Alzado de la pared ${safeIndex + 1}`}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerDown={() => store.getState().select({ kind: 'wall', index: safeIndex })}
      >
        <defs>
          <pattern id="mw-masonry" width={14 * k} height={14 * k} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2={14 * k} stroke="var(--text-muted)" strokeOpacity="0.28" strokeWidth={1.5 * k} />
          </pattern>
        </defs>

        {/* Cara interior de la pared */}
        <rect x={0} y={0} width={W} height={H} fill="var(--surface)" stroke="var(--border-strong)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

        {/* Grilla de referencia cada 500 mm */}
        {hTicks.map((z) => (
          <g key={`hz-${z}`}>
            <line x1={0} y1={toY(z)} x2={W} y2={toY(z)} stroke="var(--border)" strokeWidth={0.8} strokeDasharray={z === 0 || z === H ? undefined : '4 4'} vectorEffect="non-scaling-stroke" />
            <text x={-10 * k} y={toY(z)} fontSize={fontSize * 0.85} textAnchor="end" dominantBaseline="middle" fill="var(--text-muted)" className="tabular">
              {fmt(z)}
            </text>
          </g>
        ))}
        {vTicks.map((u) => (
          <line key={`vu-${u}`} x1={u} y1={0} x2={u} y2={H} stroke="var(--border)" strokeOpacity={0.6} strokeWidth={0.7} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        ))}

        {/* Línea de piso remarcada */}
        <line x1={-12 * k} y1={H} x2={W + 12 * k} y2={H} stroke="var(--text)" strokeWidth={2} vectorEffect="non-scaling-stroke" />

        {/* Aberturas en esta pared (arrastrables con eje bloqueado) */}
        {wallOpenings.map((o) => {
          const active = selection.kind === 'opening' && selection.id === o.id;
          const yTop = toY(o.sill + o.height);
          const yBot = toY(o.sill);
          return (
            <g
              key={o.id}
              className="cursor-move"
              onPointerDown={(e) => startOpening(e, o.id)}
            >
              <title>{o.kind === 'window' ? 'Arrastrá en horizontal o vertical (eje bloqueado)' : 'Arrastrá en horizontal a lo largo de la pared'}</title>
              <rect
                x={o.offset}
                y={yTop}
                width={o.width}
                height={Math.max(1, yBot - yTop)}
                fill={active ? 'var(--accent-soft)' : 'var(--bg)'}
                stroke={active ? 'var(--sel)' : 'var(--text-muted)'}
                strokeWidth={active ? 2.5 : 1.5}
                vectorEffect="non-scaling-stroke"
              />
              {o.kind === 'window' && (
                <line x1={o.offset} y1={(yTop + yBot) / 2} x2={o.offset + o.width} y2={(yTop + yBot) / 2} stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
              )}
              <text x={o.offset + o.width / 2} y={(yTop + yBot) / 2} fontSize={fontSize * 0.85} textAnchor="middle" dominantBaseline="middle" fill="var(--text-muted)" className="tabular" pointerEvents="none">
                {fmt(o.width)} × {fmt(o.height)}
              </text>
            </g>
          );
        })}

        {/* Muebles proyectados (arrastrables en horizontal o en altura con eje bloqueado) */}
        {projectedCabinets.map(({ pl, size, uMin, uMax }) => {
          const active = selection.kind === 'placement' && selection.id === pl.id;
          const bad = flagged.has(pl.id);
          const yTop = toY(pl.elevation + size.h);
          const yBot = toY(pl.elevation);
          const stroke = active ? 'var(--sel)' : bad ? 'var(--danger)' : 'var(--accent)';
          const width = Math.max(1, uMax - uMin);
          const height = Math.max(1, yBot - yTop);
          return (
            <g
              key={pl.id}
              className="cursor-move"
              onPointerDown={(e) => startPlacement(e, pl.id, size)}
            >
              <title>Arrastrá en horizontal a lo largo de la pared o en vertical para cambiar su altura (eje bloqueado)</title>
              <rect
                x={uMin}
                y={yTop}
                width={width}
                height={height}
                fill={bad ? 'var(--danger-soft)' : 'var(--accent-soft)'}
                fillOpacity={0.85}
                stroke={stroke}
                strokeWidth={active ? 2.5 : 1.5}
                vectorEffect="non-scaling-stroke"
              />
              <text x={uMin + width / 2} y={yTop + height / 2 - 7 * k} fontSize={fontSize * 0.85} fontWeight={600} textAnchor="middle" dominantBaseline="middle" fill="var(--text)" pointerEvents="none">
                {names[pl.cabinetId] ?? 'Mueble'}
              </text>
              <text x={uMin + width / 2} y={yTop + height / 2 + 8 * k} fontSize={fontSize * 0.75} textAnchor="middle" dominantBaseline="middle" fill="var(--text-muted)" className="tabular" pointerEvents="none">
                {fmt(size.w)} × {fmt(size.h)} mm{pl.elevation > 0 ? ` · h=${fmt(pl.elevation)}` : ''}
              </text>
            </g>
          );
        })}

        {/* Geometrías de obra proyectadas (arrastrables con eje bloqueado) */}
        {projectedBlocks.map(({ b, uMin, uMax, uStart, uEnd }) => {
          const active = selection.kind === 'block' && selection.id === b.id;
          const stroke = active ? 'var(--sel)' : 'var(--text)';
          if (b.kind === 'box') {
            const yTop = toY(b.elevation + b.height);
            const yBot = toY(b.elevation);
            const width = Math.max(1, uMax - uMin);
            const height = Math.max(1, yBot - yTop);
            return (
              <g key={b.id} className="cursor-move" onPointerDown={(e) => startBlock(e, b.id)}>
                <title>Arrastrá en horizontal o vertical (eje bloqueado)</title>
                <rect x={uMin} y={yTop} width={width} height={height} fill="var(--border)" fillOpacity={0.65} />
                <rect x={uMin} y={yTop} width={width} height={height} fill="url(#mw-masonry)" stroke={stroke} strokeWidth={active ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" />
                <text x={uMin + width / 2} y={yTop + height / 2} fontSize={fontSize * 0.8} fontWeight={500} textAnchor="middle" dominantBaseline="middle" fill="var(--text)" pointerEvents="none">
                  {b.name}
                </text>
              </g>
            );
          }

          const z0 = b.elevation + (b.heightStart ?? 0);
          const z1 = b.elevation + (b.heightEnd ?? b.height);
          const zMid = (z0 + z1) / 2;
          const uMid = (uStart + uEnd) / 2;
          const thick = b.height;
          const polyPts = `${uStart},${toY(z0)} ${uEnd},${toY(z1)} ${uEnd},${toY(z1 + thick)} ${uStart},${toY(z0 + thick)}`;

          return (
            <g key={b.id} className="cursor-move" onPointerDown={(e) => startBlock(e, b.id)}>
              <title>Arrastrá en horizontal o vertical (eje bloqueado)</title>
              <polygon points={polyPts} fill="var(--border)" fillOpacity={0.75} />
              <polygon points={polyPts} fill="url(#mw-masonry)" stroke={stroke} strokeWidth={active ? 2.5 : 1.75} vectorEffect="non-scaling-stroke" />
              {zMid > 15000 && (
                <g pointerEvents="none">
                  <line x1={uMid} y1={toY(0)} x2={uMid} y2={toY(zMid)} stroke="var(--warning)" strokeWidth={1.25} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                  <text
                    x={uMid}
                    y={toY(zMid / 2)}
                    fontSize={fontSize * 0.85}
                    fontWeight={600}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--warning)"
                    stroke="var(--surface)"
                    strokeWidth={3}
                    paintOrder="stroke"
                    vectorEffect="non-scaling-stroke"
                    className="tabular"
                  >
                    libre {fmt(zMid)} mm
                  </text>
                </g>
              )}
              <text
                x={uMid}
                y={toY(zMid + thick / 2)}
                fontSize={fontSize * 0.8}
                fontWeight={600}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--text)"
                pointerEvents="none"
              >
                {b.name} ({fmt(z0)} → {fmt(z1)} mm)
              </text>
            </g>
          );
        })}

        {/* Cota total de largo de la pared abajo */}
        <line x1={0} y1={H + 18 * k} x2={W} y2={H + 18 * k} stroke="var(--text-muted)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <text x={W / 2} y={H + 30 * k} fontSize={fontSize} fontWeight={600} textAnchor="middle" fill="var(--text)" className="tabular">
          Pared {safeIndex + 1} · {fmt(W)} mm de largo × {fmt(H)} mm de alto
        </text>
      </svg>
    </div>
  );
}