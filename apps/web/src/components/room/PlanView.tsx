'use client';

import { useMemo, useRef } from 'react';
import {
  alongWall,
  blockFootprint,
  doorSwing,
  footprint,
  moveCorner,
  nearestWall,
  OPENING_NAME,
  outerCorners,
  placementCollides,
  slideOpening,
  snapToNeighbor,
  snapToWall,
  walls,
  type CabinetSize,
  type PlanPoint,
  type RoomPlan,
} from '@mw/engine';
import type { RoomSelection, RoomStore } from './roomStore';

/** Paso de la cuadrícula al arrastrar: 10 mm. */
const SNAP = 1000;
/** Distancia a la que un mueble se pega solo a la pared al soltarlo: 15 cm. */
const MAGNET = 15000;

const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const fmt = (len: number, digits = 0) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(len / 100);
const pts = (ps: readonly PlanPoint[]) => ps.map((p) => `${p.x},${p.y}`).join(' ');

type Drag =
  | { kind: 'placement'; id: string; from: PlanPoint; x0: number; y0: number; before: RoomPlan; moved: boolean; free: { x: number; y: number; rotation: number } }
  | { kind: 'block'; id: string; from: PlanPoint; x0: number; y0: number; before: RoomPlan; moved: boolean }
  | { kind: 'corner'; index: number; before: RoomPlan; moved: boolean }
  | { kind: 'opening'; id: string; from: PlanPoint; offset0: number; before: RoomPlan; moved: boolean };

/**
 * Vista cenital (planta) del ambiente: paredes con su espesor, aberturas, geometrías de obra,
 * medidas de cada pared, ángulo de cada esquina y muebles colocados.
 */
export function PlanView({
  store,
  plan,
  selection,
  sizes,
  names,
  flagged,
  block = false,
}: {
  store: RoomStore;
  plan: RoomPlan;
  selection: RoomSelection;
  sizes: Readonly<Record<string, CabinetSize>>;
  names: Readonly<Record<string, string>>;
  flagged: ReadonlySet<string>;
  block?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const ws = useMemo(() => walls(plan), [plan]);
  const outer = useMemo(() => outerCorners(plan), [plan]);
  const t = plan.wallThickness;

  const box = useMemo(() => {
    const xs = outer.map((p) => p.x);
    const ys = outer.map((p) => p.y);
    const pad = 70000;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    return { minX, minY, w: Math.max(...xs) - minX + pad, h: Math.max(...ys) - minY + pad };
  }, [outer]);
  const k = Math.max(box.w, box.h) / 700;

  const toPlan = (e: { clientX: number; clientY: number }): PlanPoint => {
    const el = svg.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const q = toPlan(e);
    d.moved = true;
    if (d.kind === 'placement') {
      const x = snap(d.x0 + q.x - d.from.x);
      const y = snap(d.y0 + q.y - d.from.y);
      store.getState().preview((p) => {
        const next = { ...p, placements: p.placements.map((pl) => (pl.id === d.id ? { ...pl, x, y } : pl)) };
        if (!placementCollides(next, d.id, sizes)) {
          const pl = next.placements.find((z) => z.id === d.id)!;
          d.free = { x: pl.x, y: pl.y, rotation: pl.rotation };
        }
        return next;
      });
    } else if (d.kind === 'block') {
      const x = snap(d.x0 + q.x - d.from.x);
      const y = snap(d.y0 + q.y - d.from.y);
      store.getState().preview((p) => ({
        ...p,
        blocks: (p.blocks ?? []).map((b) => (b.id === d.id ? { ...b, x, y } : b)),
      }));
    } else if (d.kind === 'opening') {
      store.getState().preview((p) => {
        const o = p.openings.find((x) => x.id === d.id);
        const w = o && walls(p).find((x) => x.id === o.wallId);
        if (!w) return p;
        return slideOpening(p, d.id, snap(d.offset0 + alongWall(w, q) - alongWall(w, d.from)));
      });
    } else {
      store.getState().preview((p) => moveCorner(p, d.index, snap(q.x), snap(q.y)));
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    if (d.kind === 'placement') {
      store.getState().preview((p) => {
        const pl = p.placements.find((x) => x.id === d.id);
        const size = pl && sizes[pl.cabinetId];
        if (!pl || !size) return p;
        const wi = nearestWall(p, pl, size);
        const w = walls(p)[wi]!;
        const fp = footprint(pl, size);
        const back = { x: (fp[0].x + fp[1].x) / 2, y: (fp[0].y + fp[1].y) / 2 };
        const dist = (back.x - w.a.x) * w.inward.x + (back.y - w.a.y) * w.inward.y;
        let moved = Math.abs(dist) > MAGNET ? pl : snapToWall(p, pl, size, wi);
        moved = snapToNeighbor(p, moved, sizes, MAGNET);
        let next = { ...p, placements: p.placements.map((x) => (x.id === d.id ? moved : x)) };
        if (block && placementCollides(next, d.id, sizes)) {
          next = { ...p, placements: p.placements.map((x) => (x.id === d.id ? { ...x, ...d.free } : x)) };
        }
        return next;
      });
    }
    store.getState().commit(d.before);
  };

  const startPlacement = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const pl = plan.placements.find((p) => p.id === id);
    if (!pl) return;
    store.getState().select({ kind: 'placement', id });
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind: 'placement', id, from: toPlan(e), x0: pl.x, y0: pl.y, before: plan, moved: false, free: { x: pl.x, y: pl.y, rotation: pl.rotation } };
  };

  const startBlock = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const b = (plan.blocks ?? []).find((x) => x.id === id);
    if (!b) return;
    store.getState().select({ kind: 'block', id });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind: 'block', id, from: toPlan(e), x0: b.x, y0: b.y, before: plan, moved: false };
  };

  const startOpening = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    const o = plan.openings.find((x) => x.id === id);
    if (!o) return;
    store.getState().select({ kind: 'opening', id });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind: 'opening', id, from: toPlan(e), offset0: o.offset, before: plan, moved: false };
  };

  const startCorner = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind: 'corner', index, before: plan, moved: false };
  };

  const sel = selection;
  const fontSize = 13 * k;

  return (
    <svg
      ref={svg}
      viewBox={`${box.minX} ${box.minY} ${box.w} ${box.h}`}
      className="h-full w-full touch-none select-none"
      role="img"
      aria-label="Planta del ambiente"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerDown={() => store.getState().select({ kind: 'none' })}
    >
      <polygon points={pts(plan.corners)} fill="var(--surface)" />
      <path d={`M${pts(outer)}Z M${pts(plan.corners)}Z`} fillRule="evenodd" fill="var(--text)" fillOpacity={0.62} />

      {ws.map((w) => {
        const a = { x: w.a.x - (w.inward.x * t) / 2, y: w.a.y - (w.inward.y * t) / 2 };
        const b = { x: w.b.x - (w.inward.x * t) / 2, y: w.b.y - (w.inward.y * t) / 2 };
        const active = sel.kind === 'wall' && sel.index === w.index;
        return (
          <line
            key={w.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={active ? 'var(--sel)' : 'transparent'}
            strokeOpacity={active ? 0.7 : 1}
            strokeWidth={t}
            className="cursor-pointer"
            onPointerDown={(e) => {
              e.stopPropagation();
              store.getState().select({ kind: 'wall', index: w.index });
            }}
          >
            <title>{`Pared ${w.index + 1}: ${fmt(w.length)} mm`}</title>
          </line>
        );
      })}

      {plan.openings.map((o) => {
        const w = ws.find((x) => x.id === o.wallId);
        if (!w) return null;
        const p0 = { x: w.a.x + w.dir.x * o.offset, y: w.a.y + w.dir.y * o.offset };
        const p1 = { x: p0.x + w.dir.x * o.width, y: p0.y + w.dir.y * o.width };
        const out = (p: PlanPoint) => ({ x: p.x - w.inward.x * t, y: p.y - w.inward.y * t });
        const active = sel.kind === 'opening' && sel.id === o.id;
        const leafEnd = { x: p0.x + w.inward.x * o.width, y: p0.y + w.inward.y * o.width };
        return (
          <g key={o.id} className="cursor-move" onPointerDown={(e) => startOpening(e, o.id)}>
            <title>{`${OPENING_NAME[o.kind][0]!.toUpperCase()}${OPENING_NAME[o.kind].slice(1)}: arrastrala por la pared para moverla (o elegila y usá las flechas)`}</title>
            <polygon
              points={pts([
                { x: p0.x + w.inward.x * t * 0.6, y: p0.y + w.inward.y * t * 0.6 },
                { x: p1.x + w.inward.x * t * 0.6, y: p1.y + w.inward.y * t * 0.6 },
                { x: p1.x - w.inward.x * t * 1.6, y: p1.y - w.inward.y * t * 1.6 },
                { x: p0.x - w.inward.x * t * 1.6, y: p0.y - w.inward.y * t * 1.6 },
              ])}
              fill="transparent"
            />
            <polygon points={pts([p0, p1, out(p1), out(p0)])} fill={active ? 'var(--accent-soft)' : 'var(--bg)'} stroke={active ? 'var(--sel)' : 'none'} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            {o.kind === 'window' && (
              <>
                <line x1={p0.x - w.inward.x * t * 0.4} y1={p0.y - w.inward.y * t * 0.4} x2={p1.x - w.inward.x * t * 0.4} y2={p1.y - w.inward.y * t * 0.4} stroke="var(--text)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <line x1={p0.x - w.inward.x * t * 0.6} y1={p0.y - w.inward.y * t * 0.6} x2={p1.x - w.inward.x * t * 0.6} y2={p1.y - w.inward.y * t * 0.6} stroke="var(--text)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              </>
            )}
            {o.kind === 'door' && (
              <>
                <line x1={p0.x} y1={p0.y} x2={leafEnd.x} y2={leafEnd.y} stroke="var(--text)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                <path
                  d={`M${leafEnd.x},${leafEnd.y} A${o.width},${o.width} 0 0 ${crossSign(w) > 0 ? 0 : 1} ${p1.x},${p1.y}`}
                  fill="none"
                  stroke="var(--text)"
                  strokeOpacity={0.5}
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
          </g>
        );
      })}

      {/* geometrías de obra (mampostería, mesadas, losa inclinada de bajo escalera) */}
      {(plan.blocks ?? []).map((b) => {
        const fp = blockFootprint(b);
        const active = sel.kind === 'block' && sel.id === b.id;
        const c = { x: (fp[0].x + fp[2].x) / 2, y: (fp[0].y + fp[2].y) / 2 };
        const isSlope = b.kind === 'slope';
        const leftMid = { x: (fp[0].x + fp[3].x) / 2, y: (fp[0].y + fp[3].y) / 2 };
        const rightMid = { x: (fp[1].x + fp[2].x) / 2, y: (fp[1].y + fp[2].y) / 2 };
        const asc = (b.heightEnd ?? b.height) >= (b.heightStart ?? 0);
        return (
          <g key={b.id} className="cursor-move" onPointerDown={(e) => startBlock(e, b.id)}>
            <title>{`${b.name} (${fmt(b.width)} × ${fmt(b.depth)} mm)`}</title>
            <polygon
              points={pts(fp)}
              fill={isSlope ? 'var(--surface-2)' : 'var(--border)'}
              fillOpacity={isSlope ? 0.5 : 0.85}
              stroke={active ? 'var(--sel)' : 'var(--text-muted)'}
              strokeWidth={active ? 2.5 : 1.5}
              strokeDasharray={isSlope ? '6 4' : undefined}
              vectorEffect="non-scaling-stroke"
            />
            {isSlope && (
              <line
                x1={asc ? leftMid.x : rightMid.x}
                y1={asc ? leftMid.y : rightMid.y}
                x2={asc ? rightMid.x : leftMid.x}
                y2={asc ? rightMid.y : leftMid.y}
                stroke={active ? 'var(--sel)' : 'var(--text-muted)'}
                strokeWidth={1.25}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
            <text x={c.x} y={c.y} fontSize={fontSize * 0.78} textAnchor="middle" dominantBaseline="middle" fill="var(--text)" pointerEvents="none">
              {b.name}
            </text>
          </g>
        );
      })}

      {ws.map((w) => {
        const mid = { x: (w.a.x + w.b.x) / 2 - w.inward.x * (t + 25000), y: (w.a.y + w.b.y) / 2 - w.inward.y * (t + 25000) };
        const closing = w.index === ws.length - 1;
        return (
          <text key={w.id} x={mid.x} y={mid.y} fontSize={fontSize} textAnchor="middle" dominantBaseline="middle" fill={closing ? 'var(--text-muted)' : 'var(--text)'} className="tabular">
            {fmt(w.length)}
          </text>
        );
      })}

      {ws.map((w) => {
        const prev = ws[(w.index - 1 + ws.length) % ws.length]!;
        const bis = { x: w.inward.x + prev.inward.x, y: w.inward.y + prev.inward.y };
        const L = Math.hypot(bis.x, bis.y) || 1;
        const pos = { x: w.a.x + (bis.x / L) * 30000, y: w.a.y + (bis.y / L) * 30000 };
        const a = w.angleAtStart;
        const square = [90, 180, 270].some((v) => Math.abs(a - v) < 0.05);
        if (Math.abs(a - 180) < 0.05) return null;
        return (
          <text key={`ang-${w.id}`} x={pos.x} y={pos.y} fontSize={fontSize * 0.85} textAnchor="middle" dominantBaseline="middle" fill={square ? 'var(--text-muted)' : 'var(--warning)'} fontWeight={square ? 400 : 600}>
            {new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(a)}°
          </text>
        );
      })}

      {[...plan.placements]
        .sort((a, b) => a.elevation - b.elevation)
        .map((pl) => {
          const size = sizes[pl.cabinetId];
          if (!size) return null;
          const fp = footprint(pl, size);
          const active = sel.kind === 'placement' && sel.id === pl.id;
          const bad = flagged.has(pl.id);
          const hung = pl.elevation > 0;
          const c = { x: (fp[0].x + fp[2].x) / 2, y: (fp[0].y + fp[2].y) / 2 };
          const stroke = active ? 'var(--sel)' : bad ? 'var(--danger)' : 'var(--accent)';
          return (
            <g key={pl.id} className="cursor-move" onPointerDown={(e) => startPlacement(e, pl.id)}>
              <polygon
                points={pts(fp)}
                fill={hung ? 'var(--surface)' : 'var(--accent-soft)'}
                fillOpacity={hung ? 0.55 : 0.9}
                stroke={stroke}
                strokeWidth={active ? 2.5 : 1.5}
                strokeDasharray={hung ? '6 4' : undefined}
                vectorEffect="non-scaling-stroke"
              />
              {(size.doors ?? []).map((door, i) => (
                <polygon
                  key={i}
                  points={pts(doorSwing(pl, size, door))}
                  fill="none"
                  stroke={bad ? 'var(--danger)' : 'var(--text-muted)'}
                  strokeOpacity={0.6}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              ))}
              <line x1={fp[3].x} y1={fp[3].y} x2={fp[2].x} y2={fp[2].y} stroke={stroke} strokeWidth={active ? 4 : 3} vectorEffect="non-scaling-stroke" />
              <text x={c.x} y={c.y} fontSize={fontSize * 0.8} textAnchor="middle" dominantBaseline="middle" fill="var(--text)" pointerEvents="none">
                {names[pl.cabinetId] ?? 'Mueble'}
              </text>
            </g>
          );
        })}

      {sel.kind === 'opening' &&
        (() => {
          const o = plan.openings.find((x) => x.id === sel.id);
          const w = o && ws.find((x) => x.id === o.wallId);
          if (!o || !w) return null;
          const inset = 22 * k;
          const at = (d: number) => ({ x: w.a.x + w.dir.x * d + w.inward.x * inset, y: w.a.y + w.dir.y * d + w.inward.y * inset });
          const after = w.length - o.offset - o.width;
          const label = (d0: number, d1: number) => {
            const m = at((d0 + d1) / 2);
            const a = at(d0);
            const b = at(d1);
            return (
              <g pointerEvents="none">
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--sel)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                <text x={m.x} y={m.y} dy={-4 * k} fontSize={fontSize * 0.85} textAnchor="middle" fill="var(--sel)" fontWeight={600} stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" vectorEffect="non-scaling-stroke" className="tabular">
                  {fmt(d1 - d0)}
                </text>
              </g>
            );
          };
          return (
            <>
              {o.offset > 0 && label(0, o.offset)}
              {after > 0 && label(o.offset + o.width, w.length)}
            </>
          );
        })()}

      {plan.corners.map((c, i) => (
        <circle
          key={c.id}
          cx={c.x}
          cy={c.y}
          r={7 * k}
          fill="var(--surface)"
          stroke="var(--accent)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          className="cursor-grab"
          onPointerDown={(e) => startCorner(e, i)}
        >
          <title>{`Esquina ${i + 1}: arrastrala para moverla`}</title>
        </circle>
      ))}
    </svg>
  );
}

function crossSign(w: { dir: PlanPoint; inward: PlanPoint }) {
  return w.dir.x * w.inward.y - w.dir.y * w.inward.x;
}
