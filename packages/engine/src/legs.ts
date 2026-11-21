/**
 * Patas: dónde van y qué forma tienen. Las usa `compute` (que sube la caja el alto de la pata) y
 * las vistas, el 3D y el STL para dibujarlas. Medidas en 1/100 mm, en los ejes del mueble
 * (x a lo ancho, y a lo alto, z hacia el frente; el piso en y = 0).
 */
import type { LegSpec } from './hardware';
import type { Len } from './units';

export interface LegOut {
  /** Centro de la pata arriba (donde se atornilla, en la cara de abajo del mueble). */
  top: { x: number; z: number };
  /** Centro de la pata en el piso (distinto del de arriba si es inclinada). */
  foot: { x: number; z: number };
  height: Len;
  topSize: Len;
  bottomSize: Len;
  section: LegSpec['section'];
  /** Lleva placa de montaje (las de estilo años 60). */
  plate: boolean;
}

/** Cuántas patas lleva un mueble de este ancho. */
export function legCount(spec: LegSpec, width: Len): number {
  const sorted = [...spec.countByWidth].sort((a, b) => a[0] - b[0]);
  for (const [upTo, n] of sorted) if (width <= upTo) return n;
  return sorted[sorted.length - 1]![1];
}

/**
 * Patas de un mueble de `w × d`: la mitad adelante y la mitad atrás, repartidas a lo ancho, con
 * su borde a `inset` de los bordes del mueble. Las inclinadas se abren hacia afuera: las de las
 * esquinas en diagonal, las del medio hacia adelante o hacia atrás.
 */
export function placeLegs(spec: LegSpec, w: Len, d: Len, height: Len = spec.height): LegOut[] {
  const n = Math.max(2, legCount(spec, w));
  const perRow = Math.max(1, Math.ceil(n / 2));
  const half = spec.topSize / 2;
  const x0 = spec.inset + half;
  const x1 = w - spec.inset - half;
  const zBack = spec.inset + half;
  const zFront = d - spec.inset - half;
  const out = Math.tan((spec.splay * Math.PI) / 180) * height;
  const legs: LegOut[] = [];
  for (const [z, sz] of [
    [zFront, 1],
    [zBack, -1],
  ] as const) {
    for (let i = 0; i < perRow; i++) {
      const x = perRow === 1 ? w / 2 : x0 + ((x1 - x0) * i) / (perRow - 1);
      const sx = perRow > 1 && i === 0 ? -1 : perRow > 1 && i === perRow - 1 ? 1 : 0;
      const len = Math.hypot(sx, sz);
      legs.push({
        top: { x, z },
        foot: { x: x + (out * sx) / len, z: z + (out * sz) / len },
        height,
        topSize: spec.topSize,
        bottomSize: spec.bottomSize,
        section: spec.section,
        plate: spec.style === 'midcentury',
      });
    }
  }
  return legs.slice(0, n);
}

/**
 * Cuánto sobresalen las patas de la huella del mueble (de 0 a `w` y de 0 a `d`), en cada lado.
 * Sirve para el ambiente: una pata inclinada ocupa piso fuera del mueble.
 */
export function legsOverhang(legs: readonly LegOut[], w: Len, d: Len) {
  const o = { left: 0, right: 0, back: 0, front: 0 };
  for (const l of legs) {
    const r = l.bottomSize / 2;
    o.left = Math.max(o.left, r - l.foot.x);
    o.right = Math.max(o.right, l.foot.x + r - w);
    o.back = Math.max(o.back, r - l.foot.z);
    o.front = Math.max(o.front, l.foot.z + r - d);
  }
  return o;
}
