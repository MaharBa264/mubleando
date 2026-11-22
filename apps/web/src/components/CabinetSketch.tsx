'use client';

import { useMemo } from 'react';
import { compute, type Design, type Material, type Method, type Part } from '@mw/engine';

/**
 * Dibujo del frente de un mueble (alzado), en SVG, a partir de las piezas que calcula el motor.
 * Sirve de miniatura en la galería de plantillas y en la lista de muebles.
 * Se dibuja de atrás hacia delante, así que las puertas y frentes tapan el interior, como en la realidad.
 */
export function CabinetSketch({
  design,
  method,
  materials,
  className = '',
  title,
}: {
  design: Design;
  method: Method;
  materials: Material[];
  className?: string;
  title?: string;
}) {
  const parts = useMemo(() => compute(design, method, materials).parts, [design, method, materials]);
  const { w, h } = design.size;
  const pad = Math.max(w, h) * 0.04;
  const sorted = [...parts].sort((a, b) => a.box.z + a.box.dz - (b.box.z + b.box.dz));

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`}
      className={className}
      role="img"
      aria-label={title ?? 'Dibujo del frente del mueble'}
      preserveAspectRatio="xMidYMid meet"
    >
      {sorted.map((p) => (
        <PartRect key={p.key} p={p} h={h} />
      ))}
    </svg>
  );
}

const FILL: Partial<Record<Part['role'], string>> = {
  back: 'var(--surface-2)',
  door: 'var(--surface)',
  'drawer-front': 'var(--surface)',
  plinth: 'var(--border)',
};

function PartRect({ p, h }: { p: Part; h: number }) {
  // Las piezas de dentro del cajón no se ven de frente: se omiten para que el dibujo quede limpio.
  if (p.role === 'drawer-side' || p.role === 'drawer-back' || p.role === 'drawer-bottom') return null;
  const x = p.box.x;
  const y = h - (p.box.y + p.box.dy);
  const isFront = p.role === 'door' || p.role === 'drawer-front';
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={p.box.dx}
        height={p.box.dy}
        fill={FILL[p.role] ?? 'var(--border-strong)'}
        stroke="var(--text)"
        strokeOpacity={isFront ? 0.55 : 0.25}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {isFront && <Handle p={p} y={y} />}
    </g>
  );
}

/** Tirador: en las puertas, junto al lado contrario a las bisagras; en los cajones, centrado arriba. */
function Handle({ p, y }: { p: Part; y: number }) {
  const { dx, dy } = p.box;
  if (p.role === 'drawer-front') {
    const len = Math.min(dx * 0.35, 25000);
    return <line x1={p.box.x + dx / 2 - len / 2} x2={p.box.x + dx / 2 + len / 2} y1={y + dy * 0.28} y2={y + dy * 0.28} stroke="var(--text)" strokeOpacity={0.6} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" />;
  }
  if (p.hinge === 'top' || p.hinge === 'bottom') {
    // Hacia arriba: tirador abajo; hacia abajo: arriba. Horizontal y centrado.
    const len = Math.min(dx * 0.3, 25000);
    const ty = p.hinge === 'top' ? y + dy * 0.88 : y + dy * 0.12;
    return <line x1={p.box.x + dx / 2 - len / 2} x2={p.box.x + dx / 2 + len / 2} y1={ty} y2={ty} stroke="var(--text)" strokeOpacity={0.6} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" />;
  }
  const hx = p.hinge === 'right' ? p.box.x + dx * 0.1 : p.box.x + dx * 0.9;
  const len = Math.min(dy * 0.15, 20000);
  return <line x1={hx} x2={hx} y1={y + dy * 0.5 - len / 2} y2={y + dy * 0.5 + len / 2} stroke="var(--text)" strokeOpacity={0.6} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" />;
}
