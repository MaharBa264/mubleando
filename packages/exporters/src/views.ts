/**
 * Vistas del mueble para imprimir: isométrica armada (frentes cerrados o abiertos) y explotada.
 *
 * Se dibujan como polígonos a partir de las piezas que calcula el motor (no son capturas del 3D):
 * nítidas a cualquier tamaño. Ejes del motor: x a lo ancho (a la derecha), y a lo alto, z hacia el
 * frente. Se mira desde adelante, a la derecha y arriba, en isométrica. Puro y determinista.
 */
import type { LegOut, Part } from '@mw/engine';

export type Vec3 = [number, number, number];
export type Pt2 = [number, number];

export interface ViewPolygon {
  points: Pt2[];
  /** Color de relleno, #rrggbb. */
  fill: string;
  partKey: string;
}

export interface ViewLabel {
  x: number;
  y: number;
  text: string;
  partKey: string;
}

export interface CabinetView {
  polygons: ViewPolygon[];
  labels: ViewLabel[];
  /** Rectángulo que ocupa el dibujo (y hacia arriba, como en un plano). */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export type FrontsMode = 'closed' | 'open';

/** Ángulo de apertura de las puertas (como en el visor 3D). */
const DOOR_OPEN = (95 * Math.PI) / 180;
/** Fracción del fondo que salen los cajones abiertos. */
const DRAWER_OUT = 0.6;

const R: Vec3 = [Math.SQRT1_2, 0, -Math.SQRT1_2];
const U: Vec3 = [-1 / Math.sqrt(6), 2 / Math.sqrt(6), -1 / Math.sqrt(6)];
/** Hacia el observador (adelante, a la derecha y arriba). */
const V: Vec3 = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Proyección isométrica: x a la derecha y y hacia arriba en el papel. */
export const project = (p: Vec3): Pt2 => [dot(p, R), dot(p, U)];

/** Las ocho esquinas de la caja de una pieza, en el orden x, y, z (0 = mínimo, 1 = máximo). */
function corners(p: Part): Vec3[] {
  const b = p.box;
  const out: Vec3[] = [];
  for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) out.push([b.x + i * b.dx, b.y + j * b.dy, b.z + k * b.dz]);
  return out;
}
const idx = (i: number, j: number, k: number) => i * 4 + j * 2 + k;
/** Caras de la caja: índices de esquinas (en orden alrededor) y normal antes de girar. */
const FACES: { c: number[]; n: Vec3 }[] = [
  { c: [idx(1, 0, 0), idx(1, 1, 0), idx(1, 1, 1), idx(1, 0, 1)], n: [1, 0, 0] },
  { c: [idx(0, 0, 0), idx(0, 0, 1), idx(0, 1, 1), idx(0, 1, 0)], n: [-1, 0, 0] },
  { c: [idx(0, 1, 0), idx(0, 1, 1), idx(1, 1, 1), idx(1, 1, 0)], n: [0, 1, 0] },
  { c: [idx(0, 0, 0), idx(1, 0, 0), idx(1, 0, 1), idx(0, 0, 1)], n: [0, -1, 0] },
  { c: [idx(0, 0, 1), idx(1, 0, 1), idx(1, 1, 1), idx(0, 1, 1)], n: [0, 0, 1] },
  { c: [idx(0, 0, 0), idx(0, 1, 0), idx(1, 1, 0), idx(1, 0, 0)], n: [0, 0, -1] },
];

/** Transformación de una pieza: giro sobre un eje vertical y luego traslado. */
interface Xf {
  pivot?: Vec3;
  angle?: number;
  move: Vec3;
}
function apply(p: Vec3, t: Xf): Vec3 {
  let [x, y, z] = p;
  if (t.pivot && t.angle) {
    const c = Math.cos(t.angle);
    const s = Math.sin(t.angle);
    const dx = x - t.pivot[0];
    const dz = z - t.pivot[2];
    x = t.pivot[0] + dx * c + dz * s;
    z = t.pivot[2] - dx * s + dz * c;
  }
  return [x + t.move[0], y + t.move[1], z + t.move[2]];
}
const rotN = (n: Vec3, t: Xf): Vec3 => {
  if (!t.angle) return n;
  const c = Math.cos(t.angle);
  const s = Math.sin(t.angle);
  return [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c];
};

const COLORS: Partial<Record<Part['role'], string>> = {
  door: '#d9c8a9',
  'drawer-front': '#d9c8a9',
  back: '#c8c0b2',
  plinth: '#bdb5a7',
};
const BASE = '#ece5d7';
const DRAWER_BOX = '#e3dac8';

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)))
    .toString(16)
    .padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/** Cuánto se mueve cada pieza en la vista explotada: hacia afuera, en la dirección en que se arma. */
function explodeMove(p: Part, size: { w: number; h: number; d: number }): Vec3 {
  const b = p.box;
  const cx = b.x + b.dx / 2;
  const gap = Math.max(size.w, size.h, size.d) * 0.22;
  switch (p.role) {
    case 'side':
      return [cx < size.w / 2 ? -gap : gap, 0, 0];
    case 'top':
      return [0, gap, 0];
    case 'bottom':
      return [0, -gap * 0.6, 0];
    case 'plinth':
      return [0, -gap * 1.1, gap * 0.6];
    case 'back':
      return [0, 0, -gap * 1.2];
    case 'shelf':
    case 'divider':
      return [0, 0, gap * 0.9];
    case 'door':
    case 'drawer-front':
      return [0, 0, gap * 2.2];
    default:
      // Piezas de los cajones: salen con el cajón y un poco separadas entre sí.
      if (p.assembly?.kind === 'drawer') return [0, 0, gap * 1.6];
      return [0, 0, gap * 0.5];
  }
}

/** Fondo de cada cajón (lo que sale al abrirlo). */
function drawerDepths(parts: readonly Part[]) {
  const m = new Map<string, number>();
  for (const p of parts) if (p.assembly?.kind === 'drawer') m.set(p.assembly.id, Math.max(m.get(p.assembly.id) ?? 0, p.box.dz));
  return m;
}

function transformFor(p: Part, mode: FrontsMode | 'exploded', depths: Map<string, number>, size: { w: number; h: number; d: number }): Xf {
  if (mode === 'exploded') return { move: explodeMove(p, size) };
  if (mode === 'closed') return { move: [0, 0, 0] };
  if (p.role === 'door' && p.track) return { move: [(p.box.dx / 2) * (p.track === 'front' ? -1 : 1), 0, 0] };
  if (p.role === 'door') {
    const left = p.hinge !== 'right';
    return { pivot: [left ? p.box.x : p.box.x + p.box.dx, 0, p.box.z], angle: left ? -DOOR_OPEN : DOOR_OPEN, move: [0, 0, 0] };
  }
  if (p.assembly?.kind === 'drawer') return { move: [0, 0, (depths.get(p.assembly.id) ?? 0) * DRAWER_OUT] };
  return { move: [0, 0, 0] };
}

interface Solid {
  part: Part;
  pts: Vec3[];
  min: Vec3;
  max: Vec3;
  /** Rectángulo proyectado, para descartar rápido las que no se tapan. */
  rect: [number, number, number, number];
  /** Contorno proyectado (polígono convexo), para saber si dos piezas se tapan de verdad. */
  hull: Pt2[];
  depth: number;
}

/** ¿El punto está dentro del polígono? (cruce de rayos) */
export function insidePolygon(p: Pt2, poly: readonly Pt2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Contorno convexo de unos puntos (cadena monótona), en sentido antihorario. */
export function convexHull(points: readonly Pt2[]): Pt2[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Pt2, a: Pt2, b: Pt2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt2[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * ¿Dos polígonos convexos se superponen (más que tocarse en un borde)? Teorema del eje separador:
 * si en la dirección de algún lado sus sombras no se pisan, no se tapan.
 */
export function hullsOverlap(a: readonly Pt2[], b: readonly Pt2[], eps = 1): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      const nx = q[1] - p[1];
      const ny = p[0] - q[0];
      const len = Math.hypot(nx, ny);
      if (len === 0) continue;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const r of a) {
        const d = (r[0] * nx + r[1] * ny) / len;
        minA = Math.min(minA, d);
        maxA = Math.max(maxA, d);
      }
      for (const r of b) {
        const d = (r[0] * nx + r[1] * ny) / len;
        minB = Math.min(minB, d);
        maxB = Math.max(maxB, d);
      }
      if (maxA <= minB + eps || maxB <= minA + eps) return false;
    }
  }
  return true;
}

/**
 * Orden de dibujo (del fondo al frente). Dos piezas que se tapan en el papel y están separadas
 * en algún eje: primero la que queda más lejos del observador en ese eje. Si no hay manera de
 * decidir (piezas que se cruzan, como un fondo metido en la ranura), por la profundidad del centro.
 */
function drawOrder(solids: Solid[]): Solid[] {
  const n = solids.length;
  const before: number[][] = Array.from({ length: n }, () => []);
  const indeg = new Array<number>(n).fill(0);
  const eps = 0.5;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = solids[i]!;
      const b = solids[j]!;
      if (a.rect[2] <= b.rect[0] || b.rect[2] <= a.rect[0] || a.rect[3] <= b.rect[1] || b.rect[3] <= a.rect[1]) continue;
      if (!hullsOverlap(a.hull, b.hull)) continue;
      let first: number | null = null;
      for (let k = 0; k < 3 && first === null; k++) {
        if (a.max[k]! <= b.min[k]! + eps) first = i;
        else if (b.max[k]! <= a.min[k]! + eps) first = j;
      }
      if (first === null) first = a.depth <= b.depth ? i : j;
      const second = first === i ? j : i;
      before[first]!.push(second);
      indeg[second]!++;
    }
  }
  const out: Solid[] = [];
  const done = new Array<boolean>(n).fill(false);
  while (out.length < n) {
    // De las que no tienen nada pendiente detrás, la más lejana; si hay un ciclo, la más lejana de todas.
    let pick = -1;
    for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0 && (pick < 0 || solids[i]!.depth < solids[pick]!.depth)) pick = i;
    if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || solids[i]!.depth < solids[pick]!.depth)) pick = i;
    done[pick] = true;
    out.push(solids[pick]!);
    for (const k of before[pick]!) indeg[k]!--;
  }
  return out;
}

export interface ViewOptions {
  mode: FrontsMode | 'exploded';
  /** Número de cada pieza (por ejemplo, el de la lista agrupada), para rotularla. */
  labels?: ReadonlyMap<string, string>;
  /** Patas del mueble: se dibujan como prismas a plomo, con su sección media. */
  legs?: readonly LegOut[];
}

/** Las patas como piezas de dibujo: un prisma vertical por pata, en el punto medio entre arriba y el piso. */
function legParts(legs: readonly LegOut[]): Part[] {
  return legs.map((l, i) => {
    const size = (l.topSize + l.bottomSize) / 2;
    const cx = (l.top.x + l.foot.x) / 2;
    const cz = (l.top.z + l.foot.z) / 2;
    return {
      key: `leg${i}`,
      role: 'plinth',
      name: `Pata ${i + 1}`,
      materialId: '',
      thickness: size,
      length: l.height,
      width: size,
      cutLength: l.height,
      cutWidth: size,
      edges: { L1: null, L2: null, W1: null, W2: null },
      grain: 'none',
      box: { x: cx - size / 2, y: 0, z: cz - size / 2, dx: size, dy: l.height, dz: size },
    } as Part;
  });
}

/** Vista de un mueble: polígonos en orden de dibujo y, si se piden, los rótulos de las piezas. */
export function cabinetView(partsIn: readonly Part[], opts: ViewOptions): CabinetView {
  // En la explotada, las patas no se dibujan (son herrajes, no piezas que se cortan).
  const parts = opts.legs?.length && opts.mode !== 'exploded' ? [...partsIn, ...legParts(opts.legs)] : partsIn;
  const size = { w: 0, h: 0, d: 0 };
  for (const p of parts) {
    size.w = Math.max(size.w, p.box.x + p.box.dx);
    size.h = Math.max(size.h, p.box.y + p.box.dy);
    size.d = Math.max(size.d, p.box.z + p.box.dz);
  }
  const depths = drawerDepths(parts);
  const solids: Solid[] = parts.map((part) => {
    const t = transformFor(part, opts.mode, depths, size);
    const pts = corners(part).map((c) => apply(c, t));
    const min: Vec3 = [Infinity, Infinity, Infinity];
    const max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const q of pts) for (let k = 0; k < 3; k++) (min[k] = Math.min(min[k]!, q[k]!)), (max[k] = Math.max(max[k]!, q[k]!));
    const pp = pts.map(project);
    const xs = pp.map((q) => q[0]);
    const ys = pp.map((q) => q[1]);
    const c: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    return { part, pts, min, max, rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], hull: convexHull(pp), depth: dot(c, V) };
  });

  const polygons: ViewPolygon[] = [];
  /** Lugares posibles para el número de cada pieza: puntos de sus caras visibles, la más grande primero. */
  const spots = new Map<string, Pt2[]>();
  for (const s of drawOrder(solids)) {
    const p = s.part;
    const t = transformFor(p, opts.mode, depths, size);
    const base = COLORS[p.role] ?? (p.assembly ? DRAWER_BOX : BASE);
    const faces: { area: number; pts: Pt2[] }[] = [];
    for (const f of FACES) {
      const n = rotN(f.n, t);
      const facing = dot(n, V);
      if (facing <= 1e-9) continue;
      const pts = f.c.map((i) => project(s.pts[i]!));
      // Arriba más claro, los costados más oscuros: se lee el volumen sin líneas de más.
      const k = n[1] > 0.5 ? 1.04 : n[2] > 0.5 ? 0.94 : 0.82;
      polygons.push({ points: pts, fill: shade(base, k), partKey: p.key });
      let area = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % pts.length]!;
        area += a[0] * b[1] - b[0] * a[1];
      }
      faces.push({ area: Math.abs(area) / 2, pts });
    }
    if (opts.labels?.has(p.key)) {
      faces.sort((a, b) => b.area - a.area);
      const cand: Pt2[] = [];
      for (const f of faces) {
        // Puntos repartidos por la cara (centro primero), sin tocar los bordes.
        const [a, b, , d] = f.pts as [Pt2, Pt2, Pt2, Pt2];
        for (const [u, v] of [[0.5, 0.5], [0.3, 0.3], [0.7, 0.7], [0.3, 0.7], [0.7, 0.3], [0.5, 0.2], [0.5, 0.8], [0.2, 0.5], [0.8, 0.5]] as const) {
          cand.push([a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * v, a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * v]);
        }
      }
      spots.set(p.key, cand);
    }
  }
  // Cada número va en el primer lugar de su pieza que no tape otra pieza dibujada encima.
  const labels: ViewLabel[] = [];
  const firstOf = new Map<string, number>();
  polygons.forEach((q, i) => firstOf.has(q.partKey) || firstOf.set(q.partKey, i));
  for (const [key, cand] of spots) {
    const text = opts.labels!.get(key)!;
    const after = polygons.slice(firstOf.get(key) ?? 0).filter((q) => q.partKey !== key);
    const free = cand.find((c) => !after.some((q) => insidePolygon(c, q.points)));
    const at = free ?? cand[0];
    if (at) labels.push({ x: at[0], y: at[1], text, partKey: key });
  }
  const all = polygons.flatMap((p) => p.points);
  const bounds = all.length
    ? { minX: Math.min(...all.map((q) => q[0])), minY: Math.min(...all.map((q) => q[1])), maxX: Math.max(...all.map((q) => q[0])), maxY: Math.max(...all.map((q) => q[1])) }
    : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { polygons, labels, bounds };
}
