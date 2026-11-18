'use client';

import { useMemo, useRef } from 'react';
import {
  footprint,
  moveCorner,
  nearestWall,
  outerCorners,
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
  | { kind: 'placement'; id: string; from: PlanPoint; x0: number; y0: number; before: RoomPlan; moved: boolean }
  | { kind: 'corner'; index: number; before: RoomPlan; moved: boolean };

/**
 * Vista cenital (planta) del ambiente: paredes con su espesor, aberturas, medidas de cada pared,
 * ángulo de cada esquina y muebles colocados. Los muebles se arrastran (se pegan a la pared al
 * soltarlos cerca) y las esquinas también, para copiar un ambiente fuera de escuadra.
 */
export function PlanView({
  store,
  plan,
  selection,
  sizes,
  names,
  flagged,
}: {
  store: RoomStore;
  plan: RoomPlan;
  selection: RoomSelection;
  sizes: Readonly<Record<string, CabinetSize>>;
  names: Readonly<Record<string, string>>;
  /** Muebles colocados con algún aviso: se dibujan en rojo. */
  flagged: ReadonlySet<string>;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const ws = useMemo(() => walls(plan), [plan]);
  const outer = useMemo(() => outerCorners(plan), [plan]);
  const t = plan.wallThickness;

  // Encuadre: las paredes por fuera más 70 cm para las cotas.
  const box = useMemo(() => {
    const xs = outer.map((p) => p.x);
    const ys = outer.map((p) => p.y);
    const pad = 70000;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    return { minX, minY, w: Math.max(...xs) - minX + pad, h: Math.max(...ys) - minY + pad };
  }, [outer]);
  // Tamaño de letra y radios en unidades de la planta: proporcionales al encuadre.
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
      store.getState().preview((p) => ({ ...p, placements: p.placements.map((pl) => (pl.id === d.id ? { ...pl, x, y } : pl)) }));
    } else {
      store.getState().preview((p) => moveCorner(p, d.index, snap(q.x), snap(q.y)));
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    if (d.kind === 'placement') {
      // Imán: si quedó cerca de una pared, se arrima a ella.
      store.getState().preview((p) => {
        const pl = p.placements.find((x) => x.id === d.id);
        const size = pl && sizes[pl.cabinetId];
        if (!pl || !size) return p;
        const wi = nearestWall(p, pl, size);
        const w = walls(p)[wi]!;
        const fp = footprint(pl, size);
        const back = { x: (fp[0].x + fp[1].x) / 2, y: (fp[0].y + fp[1].y) / 2 };
        const dist = (back.x - w.a.x) * w.inward.x + (back.y - w.a.y) * w.inward.y;
        if (Math.abs(dist) > MAGNET) return p;
        const snapped = snapToWall(p, pl, size, wi);
        return { ...p, placements: p.placements.map((x) => (x.id === d.id ? snapped : x)) };
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
    drag.current = { kind: 'placement', id, from: toPlan(e), x0: pl.x, y0: pl.y, before: plan, moved: false };
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
      {/* piso */}
      <polygon points={pts(plan.corners)} fill="var(--surface)" />

      {/* paredes con espesor (contorno exterior menos interior) */}
      <path d={`M${pts(outer)}Z M${pts(plan.corners)}Z`} fillRule="evenodd" fill="var(--text)" fillOpacity={0.62} />

      {/* zonas para tocar cada pared */}
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

      {/* aberturas */}
      {plan.openings.map((o) => {
        const w = ws.find((x) => x.id === o.wallId);
        if (!w) return null;
        const p0 = { x: w.a.x + w.dir.x * o.offset, y: w.a.y + w.dir.y * o.offset };
        const p1 = { x: p0.x + w.dir.x * o.width, y: p0.y + w.dir.y * o.width };
        const out = (p: PlanPoint) => ({ x: p.x - w.inward.x * t, y: p.y - w.inward.y * t });
        const active = sel.kind === 'opening' && sel.id === o.id;
        // Puerta: hoja abierta 90° hacia dentro, con el arco de giro.
        const leafEnd = { x: p0.x + w.inward.x * o.width, y: p0.y + w.inward.y * o.width };
        return (
          <g
            key={o.id}
            className="cursor-pointer"
            onPointerDown={(e) => {
              e.stopPropagation();
              store.getState().select({ kind: 'opening', id: o.id });
            }}
          >
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

      {/* cotas de cada pared, por fuera */}
      {ws.map((w) => {
        const mid = { x: (w.a.x + w.b.x) / 2 - w.inward.x * (t + 25000), y: (w.a.y + w.b.y) / 2 - w.inward.y * (t + 25000) };
        const closing = w.index === ws.length - 1;
        return (
          <text key={w.id} x={mid.x} y={mid.y} fontSize={fontSize} textAnchor="middle" dominantBaseline="middle" fill={closing ? 'var(--text-muted)' : 'var(--text)'} className="tabular">
            {fmt(w.length)}
          </text>
        );
      })}

      {/* ángulo de cada esquina, por dentro */}
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

      {/* muebles colocados: primero los de piso, encima los colgados */}
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
              {/* frente del mueble: línea más gruesa */}
              <line x1={fp[3].x} y1={fp[3].y} x2={fp[2].x} y2={fp[2].y} stroke={stroke} strokeWidth={active ? 4 : 3} vectorEffect="non-scaling-stroke" />
              <text x={c.x} y={c.y} fontSize={fontSize * 0.8} textAnchor="middle" dominantBaseline="middle" fill="var(--text)" pointerEvents="none">
                {names[pl.cabinetId] ?? 'Mueble'}
              </text>
            </g>
          );
        })}

      {/* esquinas arrastrables */}
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

/** Sentido de giro del polígono, para dibujar el arco de la puerta hacia dentro. */
function crossSign(w: { dir: PlanPoint; inward: PlanPoint }) {
  return w.dir.x * w.inward.y - w.dir.y * w.inward.x;
}
