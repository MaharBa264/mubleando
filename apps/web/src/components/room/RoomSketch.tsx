'use client';

import { footprint, outerCorners, type CabinetSize, type RoomPlan } from '@mw/engine';

/** Miniatura de la planta de un ambiente: paredes, piso y la huella de los muebles colocados. */
export function RoomSketch({ plan, sizes, className = '' }: { plan: RoomPlan; sizes: Readonly<Record<string, CabinetSize>>; className?: string }) {
  const outer = outerCorners(plan);
  const xs = outer.map((p) => p.x);
  const ys = outer.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  const pts = (ps: readonly { x: number; y: number }[]) => ps.map((p) => `${p.x},${p.y}`).join(' ');
  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} className={className} role="img" aria-label="Planta del ambiente" preserveAspectRatio="xMidYMid meet">
      <polygon points={pts(outer)} fill="var(--text)" fillOpacity={0.55} />
      <polygon points={pts(plan.corners)} fill="var(--surface)" />
      {plan.placements.map((p) => {
        const size = sizes[p.cabinetId];
        if (!size) return null;
        return <polygon key={p.id} points={pts(footprint(p, size))} fill={p.elevation > 0 ? 'none' : 'var(--accent-soft)'} stroke="var(--accent)" strokeWidth={1} vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  );
}
