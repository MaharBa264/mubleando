'use client';

import { useMemo, useState } from 'react';
import { blockFootprint, footprint, walls, type CabinetSize, type RoomPlan } from '@mw/engine';
import type { RoomSelection, RoomStore } from './roomStore';

const fmt = (len: number, digits = 0) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(len / 100);

/** Profundidad máxima desde la pared cuando el filtro "Cercanos" está activo: 1,20 m. */
const NEAR_DEPTH = 120000;

/**
 * Vista de alzado (lateral/frontal 2D ortogonal) de una pared específica.
 * Proyecta aberturas, geometrías de obra (mampostería, mesadas y pendiente de bajo escalera)
 * y los muebles apoyados frente a esa pared, con cotas de altura libre en mm.
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
  const [onlyNear, setOnlyNear] = useState(true);
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

  // Convierte altura z (desde el piso) a coordenada SVG Y (piso abajo, techo arriba).
  const toY = (z: number) => H - z;

  // Proyecta un punto de planta sobre la pared: u = distancia desde w.a, d = distancia hacia dentro.
  const proj = (pt: { x: number; y: number }) => {
    const dx = pt.x - w.a.x;
    const dy = pt.y - w.a.y;
    return {
      u: dx * w.dir.x + dy * w.dir.y,
      d: dx * w.inward.x + dy * w.inward.y,
    };
  };

  // Grilla cada 500 mm (50000 en centésimas de mm).
  const hTicks: number[] = [];
  for (let z = 0; z <= H; z += 50000) hTicks.push(z);
  if (hTicks[hTicks.length - 1] !== H) hTicks.push(H);

  const vTicks: number[] = [];
  for (let u = 0; u <= W; u += 50000) vTicks.push(u);

  const wallOpenings = plan.openings.filter((o) => o.wallId === w.id);

  // Bloques de obra proyectados sobre esta pared.
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
      // Para rampas ('slope'), proyectamos los extremos u=0 (p0/p3) y u=width (p1/p2).
      const uStart = (ps[0]!.u + ps[3]!.u) / 2;
      const uEnd = (ps[1]!.u + ps[2]!.u) / 2;
      return { b, uMin, uMax, uStart, uEnd, minD };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.minD - a.minD);

  // Muebles proyectados sobre esta pared.
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
      {/* Selector rápido de pared y filtro de profundidad */}
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
      </div>

      <svg
        viewBox={`${-padL} ${-padT} ${vbW} ${vbH}`}
        className="h-full w-full select-none"
        role="img"
        aria-label={`Alzado de la pared ${safeIndex + 1}`}
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

        {/* Aberturas en esta pared */}
        {wallOpenings.map((o) => {
          const active = selection.kind === 'opening' && selection.id === o.id;
          const yTop = toY(o.sill + o.height);
          const yBot = toY(o.sill);
          return (
            <g
              key={o.id}
              className="cursor-pointer"
              onPointerDown={(e) => {
                e.stopPropagation();
                store.getState().select({ kind: 'opening', id: o.id });
              }}
            >
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

        {/* Muebles proyectados */}
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
              className="cursor-pointer"
              onPointerDown={(e) => {
                e.stopPropagation();
                store.getState().select({ kind: 'placement', id: pl.id });
              }}
            >
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
                {fmt(size.w)} × {fmt(size.h)} mm
              </text>
            </g>
          );
        })}

        {/* Geometrías de obra proyectadas (mampostería, mesadas y losa inclinada de bajo escalera) */}
        {projectedBlocks.map(({ b, uMin, uMax, uStart, uEnd }) => {
          const active = selection.kind === 'block' && selection.id === b.id;
          const stroke = active ? 'var(--sel)' : 'var(--text)';
          if (b.kind === 'box') {
            const yTop = toY(b.elevation + b.height);
            const yBot = toY(b.elevation);
            const width = Math.max(1, uMax - uMin);
            const height = Math.max(1, yBot - yTop);
            return (
              <g
                key={b.id}
                className="cursor-pointer"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  store.getState().select({ kind: 'block', id: b.id });
                }}
              >
                <rect x={uMin} y={yTop} width={width} height={height} fill="var(--border)" fillOpacity={0.65} />
                <rect x={uMin} y={yTop} width={width} height={height} fill="url(#mw-masonry)" stroke={stroke} strokeWidth={active ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" />
                <text x={uMin + width / 2} y={yTop + height / 2} fontSize={fontSize * 0.8} fontWeight={500} textAnchor="middle" dominantBaseline="middle" fill="var(--text)" pointerEvents="none">
                  {b.name}
                </text>
              </g>
            );
          }

          // Losa inclinada (bajo escalera): diagonal exacta + cotas de altura libre debajo.
          const z0 = b.elevation + (b.heightStart ?? 0);
          const z1 = b.elevation + (b.heightEnd ?? b.height);
          const zMid = (z0 + z1) / 2;
          const uMid = (uStart + uEnd) / 2;
          const thick = b.height;
          const polyPts = `${uStart},${toY(z0)} ${uEnd},${toY(z1)} ${uEnd},${toY(z1 + thick)} ${uStart},${toY(z0 + thick)}`;

          return (
            <g
              key={b.id}
              className="cursor-pointer"
              onPointerDown={(e) => {
                e.stopPropagation();
                store.getState().select({ kind: 'block', id: b.id });
              }}
            >
              <polygon points={polyPts} fill="var(--border)" fillOpacity={0.75} />
              <polygon points={polyPts} fill="url(#mw-masonry)" stroke={stroke} strokeWidth={active ? 2.5 : 1.75} vectorEffect="non-scaling-stroke" />
              {/* Línea de cota de altura libre en el punto medio de la rampa */}
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
