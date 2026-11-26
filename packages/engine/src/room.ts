import { z } from 'zod';
import { defaultIdGen, type IdGen } from './edit';
import { mm, toMm, type Len } from './units';

/**
 * Ambientes: la planta de una habitación (piso y paredes), sus aberturas y los muebles colocados.
 *
 * Coordenadas de la planta (vista cenital), en centésimas de mm como todo el motor:
 *   x hacia la derecha, y hacia abajo (como en la pantalla). El origen es la primera esquina.
 *
 * El perímetro es un polígono con las esquinas en la **cara interior** de las paredes, en orden.
 * Las esquinas pueden tener cualquier ángulo: un ambiente real casi nunca está a escuadra.
 * Las paredes se dibujan hacia fuera del polígono con su espesor.
 *
 * Pensado para crecer: hoy un proyecto tiene ambientes sueltos; más adelante, una casa entera
 * (varios ambientes que comparten paredes).
 */

// ───────────────────────── tipos ─────────────────────────

export interface RoomCorner {
  id: string;
  x: Len;
  y: Len;
}

export type OpeningKind = 'door' | 'window' | 'opening';

export interface RoomOpening {
  id: string;
  /** Pared donde está: el id de su esquina de inicio (la pared va de esa esquina a la siguiente). */
  wallId: string;
  kind: OpeningKind;
  /** Distancia desde el inicio de la pared hasta el borde de la abertura, por la cara interior. */
  offset: Len;
  width: Len;
  height: Len;
  /** Altura del antepecho (ventanas): desde el piso hasta el borde de abajo. 0 en puertas. */
  sill: Len;
}

/**
 * Un mueble colocado. El mismo mueble del proyecto se puede colocar varias veces.
 * (x, y) es la esquina **trasera izquierda** del mueble en la planta; `rotation` es el ángulo
 * (en grados, sentido horario en pantalla) de su ancho. Con 0°, el mueble mira hacia +y (abajo).
 */
export interface Placement {
  id: string;
  cabinetId: string;
  x: Len;
  y: Len;
  rotation: number;
  /** Altura desde el piso hasta la base del mueble: 0 en bajos y columnas, ~1450 mm en alacenas. */
  elevation: Len;
}
export type RoomBlockKind = 'box' | 'slope';
export type RoomBlockMaterial = 'masonry' | 'concrete' | 'countertop' | 'wood';

/** Geometría fija de obra (murete/pie de mampostería, mesada/isla o losa inclinada de bajo escalera). */
export interface RoomBlock {
  id: string;
  name: string;
  kind: RoomBlockKind;
  material: RoomBlockMaterial;
  x: Len;
  y: Len;
  rotation: number;
  elevation: Len;
  width: Len;
  depth: Len;
  /** Alto del prisma ('box') o espesor vertical de la losa inclinada ('slope'). */
  height: Len;
  /** Solo 'slope': altura libre bajo la losa en el extremo izquierdo (u = 0). */
  heightStart?: Len;
  /** Solo 'slope': altura libre bajo la losa en el extremo derecho (u = width). */
  heightEnd?: Len;
}

export interface RoomPlan {
  v: 1;
  corners: RoomCorner[];
  wallThickness: Len;
  wallHeight: Len;
  openings: RoomOpening[];
  placements: Placement[];
  blocks?: RoomBlock[];
  /**
   * Largo medido en obra de la última pared (la que cierra el polígono). Solo sirve para mostrar
   * el error de cierre: la diferencia con la que sale de las demás medidas.
   */
  closingMeasured?: Len;
}

const len = z.number().int();

export const roomPlanSchema: z.ZodType<RoomPlan> = z.object({
  v: z.literal(1),
  corners: z.array(z.object({ id: z.string().min(1), x: len, y: len })).min(3).max(64),
  wallThickness: len.positive(),
  wallHeight: len.positive(),
  openings: z.array(
    z.object({
      id: z.string().min(1),
      wallId: z.string().min(1),
      kind: z.enum(['door', 'window', 'opening']),
      offset: len.nonnegative(),
      width: len.positive(),
      height: len.positive(),
      sill: len.nonnegative(),
    }),
  ),
  placements: z.array(
    z.object({
      id: z.string().min(1),
      cabinetId: z.string().min(1),
      x: len,
      y: len,
      rotation: z.number().finite(),
      elevation: len.nonnegative(),
    }),
  ),
  blocks: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(120),
        kind: z.enum(['box', 'slope']),
        material: z.enum(['masonry', 'concrete', 'countertop', 'wood']),
        x: len,
        y: len,
        rotation: z.number().finite(),
        elevation: len.nonnegative(),
        width: len.positive(),
        depth: len.positive(),
        height: len.positive(),
        heightStart: len.nonnegative().optional(),
        heightEnd: len.nonnegative().optional(),
      }),
    )
    .optional(),
  closingMeasured: len.positive().optional(),
});

// ───────────────────────── geometría básica ─────────────────────────

type Pt = { x: number; y: number };
const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const cross = (a: Pt, b: Pt) => a.x * b.y - a.y * b.x;
const hypot = (a: Pt) => Math.hypot(a.x, a.y);
/** Ángulo en (−180, 180]. */
const norm180 = (a: number) => {
  let r = ((a % 360) + 360) % 360;
  if (r > 180) r -= 360;
  return r;
};

/** Dos veces el área con signo (fórmula del cordón). Positiva si las esquinas van en sentido horario en pantalla. */
export function signedArea2(pts: readonly Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s;
}

/** Superficie del piso en m². */
export const floorAreaM2 = (plan: RoomPlan) => Math.abs(signedArea2(plan.corners)) / 2 / 1e10;

export interface Wall {
  /** Id de la esquina de inicio: identifica la pared. */
  id: string;
  index: number;
  a: RoomCorner;
  b: RoomCorner;
  /** Largo por la cara interior. */
  length: Len;
  /** Dirección de la pared (grados, horario en pantalla). */
  heading: number;
  /** Vector unitario de a hacia b. */
  dir: Pt;
  /** Vector unitario hacia el interior del ambiente. */
  inward: Pt;
  /** Ángulo interior en la esquina de inicio (a), en grados. 90 = a escuadra. */
  angleAtStart: number;
}

/** Las paredes del ambiente, en orden, con su largo, dirección y ángulos. */
export function walls(plan: RoomPlan): Wall[] {
  const c = plan.corners;
  const n = c.length;
  const s = Math.sign(signedArea2(c)) || 1;
  const headings = c.map((a, i) => {
    const b = c[(i + 1) % n]!;
    return deg(Math.atan2(b.y - a.y, b.x - a.x));
  });
  return c.map((a, i) => {
    const b = c[(i + 1) % n]!;
    const d = sub(b, a);
    const L = hypot(d);
    const dir = L > 0 ? mul(d, 1 / L) : { x: 1, y: 0 };
    // En sentido horario (s > 0) el interior queda a la derecha de la marcha: (−dy, dx) rotado.
    const inward = s > 0 ? { x: -dir.y, y: dir.x } : { x: dir.y, y: -dir.x };
    const turn = norm180(headings[i]! - headings[(i - 1 + n) % n]!);
    return {
      id: a.id,
      index: i,
      a,
      b,
      length: Math.round(L),
      heading: headings[i]!,
      dir,
      inward,
      angleAtStart: 180 - s * turn,
    };
  });
}

// ───────────────────────── crear y editar la planta ─────────────────────────

/** Ambiente rectangular de `ancho` (x) por `largo` (y), con paredes de 15 cm y 2,60 m de alto. */
export function rectRoom(width: Len, depth: Len, idGen: IdGen = defaultIdGen, opts: { wallThickness?: Len; wallHeight?: Len } = {}): RoomPlan {
  return {
    v: 1,
    corners: [
      { id: idGen(), x: 0, y: 0 },
      { id: idGen(), x: width, y: 0 },
      { id: idGen(), x: width, y: depth },
      { id: idGen(), x: 0, y: depth },
    ],
    wallThickness: opts.wallThickness ?? mm(150),
    wallHeight: opts.wallHeight ?? mm(2600),
    openings: [],
    placements: [],
  };
}

/**
 * Rehace las esquinas como se mide en obra: desde la primera esquina, pared por pared, con el
 * largo de cada una y el ángulo interior de cada esquina. La última pared no se usa: cierra sola
 * de la última esquina a la primera (su largo y los dos ángulos que toca salen calculados).
 * `lengths` y `angles` tienen una entrada por pared / esquina; se ignoran lengths[n−1], angles[0]
 * y angles[n−1].
 */
export function fromMeasures(plan: RoomPlan, lengths: readonly Len[], angles: readonly number[]): RoomPlan {
  const n = plan.corners.length;
  const ws = walls(plan);
  const s = Math.sign(signedArea2(plan.corners)) || 1;
  const first = plan.corners[0]!;
  let h = ws[0]!.heading;
  let p: Pt = { x: first.x, y: first.y };
  const corners: RoomCorner[] = [first];
  for (let i = 0; i < n - 1; i++) {
    p = add(p, mul({ x: Math.cos(rad(h)), y: Math.sin(rad(h)) }, lengths[i] ?? ws[i]!.length));
    corners.push({ id: plan.corners[i + 1]!.id, x: Math.round(p.x), y: Math.round(p.y) });
    h += s * (180 - (angles[i + 1] ?? ws[i + 1]!.angleAtStart));
  }
  return { ...plan, corners };
}

/** Cambia el largo de una pared (no la última, que cierra sola). Las demás medidas se conservan. */
export function setWallLength(plan: RoomPlan, index: number, length: Len): RoomPlan {
  const ws = walls(plan);
  if (index < 0 || index >= ws.length - 1 || length <= 0) return plan;
  const lengths = ws.map((w, i) => (i === index ? length : w.length));
  return fromMeasures(plan, lengths, ws.map((w) => w.angleAtStart));
}

/** Cambia el ángulo interior de una esquina (no la primera ni la última, que salen del cierre). */
export function setCornerAngle(plan: RoomPlan, index: number, angle: number): RoomPlan {
  const ws = walls(plan);
  if (index <= 0 || index >= ws.length - 1 || !(angle > 0 && angle < 360)) return plan;
  const angles = ws.map((w, i) => (i === index ? angle : w.angleAtStart));
  return fromMeasures(plan, ws.map((w) => w.length), angles);
}

/** Parte una pared por la mitad con una esquina nueva (a 180°: no cambia la forma hasta que la muevas). */
export function splitWall(plan: RoomPlan, index: number, idGen: IdGen = defaultIdGen): RoomPlan {
  const n = plan.corners.length;
  if (index < 0 || index >= n || n >= 64) return plan;
  const a = plan.corners[index]!;
  const b = plan.corners[(index + 1) % n]!;
  const mid: RoomCorner = { id: idGen(), x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
  const corners = [...plan.corners.slice(0, index + 1), mid, ...plan.corners.slice(index + 1)];
  // Las aberturas de la segunda mitad pasan a la pared nueva.
  const half = Math.round(hypot(sub(b, a)) / 2);
  const openings = plan.openings.map((o) => (o.wallId === a.id && o.offset >= half ? { ...o, wallId: mid.id, offset: o.offset - half } : o));
  return { ...plan, corners, openings };
}

/** Quita una esquina (las dos paredes que toca pasan a ser una). Mínimo, tres esquinas. */
export function removeCorner(plan: RoomPlan, index: number): RoomPlan {
  const n = plan.corners.length;
  if (n <= 3 || index < 0 || index >= n) return plan;
  const gone = plan.corners[index]!;
  const prev = plan.corners[(index - 1 + n) % n]!;
  const corners = plan.corners.filter((_, i) => i !== index);
  // Las aberturas de la pared que desaparece pasan a la anterior (al final; el usuario las reubica).
  const prevLen = Math.round(hypot(sub(gone, prev)));
  const openings = plan.openings.map((o) => (o.wallId === gone.id ? { ...o, wallId: prev.id, offset: o.offset + prevLen } : o));
  return { ...plan, corners, openings };
}

/** Mueve una esquina a un punto (arrastrándola en la planta). */
/**
 * Desliza una abertura por su pared hasta `offset` (distancia desde el inicio de la pared). No se sale
 * de la pared ni se encima con otra abertura de la misma pared: si donde se pide no entra, queda en
 * el lugar libre más cercano (pegada al límite). Si no entra en ningún lado, el plano no cambia.
 */
export function slideOpening(plan: RoomPlan, id: string, offset: Len): RoomPlan {
  const o = plan.openings.find((x) => x.id === id);
  if (!o) return plan;
  const w = walls(plan).find((x) => x.id === o.wallId);
  if (!w) return plan;
  const others = plan.openings
    .filter((x) => x.wallId === o.wallId && x.id !== id)
    .map((x) => [x.offset, x.offset + x.width] as const)
    .sort((a, b) => a[0] - b[0]);
  // Tramos de la pared donde puede empezar la abertura: [desde, hasta].
  const free: [number, number][] = [];
  let start = 0;
  for (const [a, b] of others) {
    if (a - start >= o.width) free.push([start, a - o.width]);
    start = Math.max(start, b);
  }
  const end = Math.floor(w.length) - o.width;
  if (end >= start) free.push([start, end]);
  let best: number | null = null;
  for (const [lo, hi] of free) {
    const v = Math.min(Math.max(offset, lo), hi);
    if (best === null || Math.abs(v - offset) < Math.abs(best - offset)) best = v;
  }
  if (best === null) return plan;
  const next = Math.round(best);
  return next === o.offset ? plan : { ...plan, openings: plan.openings.map((x) => (x.id === id ? { ...x, offset: next } : x)) };
}

/** Distancia, a lo largo de la pared, desde su inicio hasta la proyección de un punto de la planta. */
export function alongWall(w: Pick<Wall, 'a' | 'dir'>, p: Pt): number {
  return (p.x - w.a.x) * w.dir.x + (p.y - w.a.y) * w.dir.y;
}

export function moveCorner(plan: RoomPlan, index: number, x: Len, y: Len): RoomPlan {
  if (index < 0 || index >= plan.corners.length) return plan;
  return { ...plan, corners: plan.corners.map((c, i) => (i === index ? { ...c, x: Math.round(x), y: Math.round(y) } : c)) };
}

/** ¿Se cruzan dos paredes que no son vecinas? (el polígono no sería válido). */
export function selfIntersects(plan: RoomPlan): boolean {
  const c = plan.corners;
  const n = c.length;
  const segs = c.map((a, i) => [a, c[(i + 1) % n]!] as const);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsCross(segs[i]![0], segs[i]![1], segs[j]![0], segs[j]![1])) return true;
    }
  }
  return false;
}

function segmentsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d1 = cross(sub(p4, p3), sub(p1, p3));
  const d2 = cross(sub(p4, p3), sub(p2, p3));
  const d3 = cross(sub(p2, p1), sub(p3, p1));
  const d4 = cross(sub(p2, p1), sub(p4, p1));
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// ───────────────────────── muebles colocados ─────────────────────────

export interface CabinetSize {
  w: Len;
  h: Len;
  d: Len;
  /**
   * Lo que sobresalen las patas de la huella, abajo (patas inclinadas), y su alto. Opcional: sin
   * esto, el mueble ocupa su rectángulo en toda su altura.
   */
  overhang?: { left: Len; right: Len; back: Len; front: Len };
  legHeight?: Len;
  /**
   * Puertas de bisagra, para saber si golpean algo al abrirse. x0 desde el costado izquierdo,
   * width = ancho de la hoja; y0 y y1 desde abajo del mueble. hinge 'top' / 'bottom': abre hacia
   * arriba / hacia abajo, hasta `angle` grados (90 si falta).
   */
  doors?: { x0: Len; width: Len; y0: Len; y1: Len; hinge: 'left' | 'right' | 'top' | 'bottom'; angle?: number }[];
}

/** Vectores del mueble en la planta: `u` a lo ancho (izquierda → derecha) y `f` hacia su frente. */
export function placementAxes(rotation: number) {
  const r = rad(rotation);
  const u = { x: Math.cos(r), y: Math.sin(r) };
  const f = { x: -Math.sin(r), y: Math.cos(r) };
  return { u, f };
}

/** Las cuatro esquinas del mueble en la planta: trasera izquierda, trasera derecha, delantera derecha, delantera izquierda. */
export function footprint(p: Placement, size: CabinetSize): [Pt, Pt, Pt, Pt] {
  const { u, f } = placementAxes(p.rotation);
  const bl = { x: p.x, y: p.y };
  const br = add(bl, mul(u, size.w));
  const fr = add(br, mul(f, size.d));
  const fl = add(bl, mul(f, size.d));
  return [bl, br, fr, fl];
}

/** Un volumen del mueble para buscar choques: su contorno en la planta y su alto (desde el piso). */
interface Solid {
  poly: Pt[];
  z0: Len;
  z1: Len;
}

/**
 * Volúmenes de un mueble colocado: la caja (su rectángulo en toda la altura) y, si tiene patas que
 * sobresalen, la franja de abajo con la huella agrandada.
 */
export function placementSolids(p: Placement, size: CabinetSize): Solid[] {
  const fp = footprint(p, size);
  const out: Solid[] = [{ poly: fp, z0: p.elevation, z1: p.elevation + size.h }];
  const o = size.overhang;
  if (o && size.legHeight && (o.left > 0 || o.right > 0 || o.back > 0 || o.front > 0)) {
    const { u, f } = placementAxes(p.rotation);
    const bl = add(add({ x: p.x, y: p.y }, mul(u, -o.left)), mul(f, -o.back));
    const W = size.w + o.left + o.right;
    const D = size.d + o.back + o.front;
    out.push({ poly: [bl, add(bl, mul(u, W)), add(add(bl, mul(u, W)), mul(f, D)), add(bl, mul(f, D))], z0: p.elevation, z1: p.elevation + size.legHeight });
  }
  return out;
}

/**
 * Zona que barre una puerta al abrirse, en la planta. Al costado (90°): un cuarto de círculo
 * (aproximado con 8 tramos). Hacia arriba o abajo: un rectángulo del ancho de la puerta que sale
 * del frente lo que mide la puerta de alto.
 */
export function doorSwing(p: Placement, size: CabinetSize, door: NonNullable<CabinetSize['doors']>[number]): Pt[] {
  const { u, f } = placementAxes(p.rotation);
  if (door.hinge === 'top' || door.hinge === 'bottom') {
    const h = door.y1 - door.y0;
    const a = Math.min(door.angle ?? 90, 90);
    const reach = h * Math.sin(rad(a));
    const fl = add(add({ x: p.x, y: p.y }, mul(u, door.x0)), mul(f, size.d));
    const fr = add(fl, mul(u, door.width));
    return [fl, fr, add(fr, mul(f, reach)), add(fl, mul(f, reach))];
  }
  const left = door.hinge === 'left';
  const hingeX = left ? door.x0 : door.x0 + door.width;
  const hp = add(add({ x: p.x, y: p.y }, mul(u, hingeX)), mul(f, size.d));
  const toward = mul(u, left ? 1 : -1);
  const pts: Pt[] = [hp];
  for (let i = 0; i <= 8; i++) {
    const a = (Math.PI / 2) * (i / 8);
    pts.push(add(hp, add(mul(toward, Math.cos(a) * door.width), mul(f, Math.sin(a) * door.width))));
  }
  return pts;
}

/**
 * Alto (desde el piso) que ocupa una puerta mientras se abre. Al costado, el de la puerta. Hacia
 * arriba, pasado los 90° sube por encima de la bisagra; hacia abajo, baja por debajo.
 */
export function doorSweepHeight(p: Placement, door: NonNullable<CabinetSize['doors']>[number]): { z0: Len; z1: Len } {
  const h = door.y1 - door.y0;
  const over = Math.max(0, h * Math.sin(rad((door.angle ?? 90) - 90)));
  const z0 = p.elevation + door.y0 - (door.hinge === 'bottom' ? over : 0);
  const z1 = p.elevation + door.y1 + (door.hinge === 'top' ? over : 0);
  return { z0: Math.round(z0), z1: Math.round(z1) };
}

const solidsOverlap = (A: Solid[], B: Solid[]) => A.some((a) => B.some((b) => a.z0 < b.z1 && b.z0 < a.z1 && convexOverlap(a.poly, b.poly)));

/**
 * ¿El mueble colocado `id` choca con otro (en la planta y a la misma altura) o se sale del
 * ambiente? Para bloquear el arrastre si se pide.
 */
export function placementCollides(plan: RoomPlan, id: string, sizes: Readonly<Record<string, CabinetSize>>): boolean {
  const me = plan.placements.find((x) => x.id === id);
  const size = me && sizes[me.cabinetId];
  if (!me || !size) return false;
  const mine = placementSolids(me, size);
  const ws = walls(plan);
  if (mine.some((s) => s.poly.some((q) => !pointInPolygon(q, plan.corners) && ws.every((w) => distToSegment(q, w.a, w.b) > 50)))) return true;
  return plan.placements.some((o) => {
    if (o.id === id) return false;
    const os = sizes[o.cabinetId];
    return !!os && solidsOverlap(mine, placementSolids(o, os));
  });
}

/**
 * Pega un mueble al de al lado: si está girado igual que otro (a la misma altura), con la espalda
 * casi en la misma línea y un costado a menos de `threshold` del costado del otro, lo junta costado
 * con costado y alinea las espaldas. Devuelve el mueble movido, o el mismo si no hay a cuál pegarlo.
 */
export function snapToNeighbor(plan: RoomPlan, p: Placement, sizes: Readonly<Record<string, CabinetSize>>, threshold: Len = mm(150)): Placement {
  const size = sizes[p.cabinetId];
  if (!size) return p;
  let best: { d: number; to: Placement } | null = null;
  for (const o of plan.placements) {
    if (o.id === p.id) continue;
    const os = sizes[o.cabinetId];
    if (!os) continue;
    const diff = Math.abs(((((p.rotation - o.rotation) % 360) + 540) % 360) - 180);
    if (diff > 1) continue;
    if (!(p.elevation < o.elevation + os.h && o.elevation < p.elevation + size.h)) continue;
    // Posición del mueble en los ejes del otro.
    const { u, f } = placementAxes(o.rotation);
    const rel = sub({ x: p.x, y: p.y }, { x: o.x, y: o.y });
    const lx = dot(rel, u);
    const ly = dot(rel, f);
    if (Math.abs(ly) > threshold) continue;
    for (const target of [os.w, -size.w]) {
      const d = Math.abs(lx - target);
      if (d <= threshold && (!best || d < best.d)) {
        const at = add({ x: o.x, y: o.y }, mul(u, target));
        best = { d, to: { ...p, rotation: o.rotation, x: Math.round(at.x), y: Math.round(at.y) } };
      }
    }
  }
  return best ? best.to : p;
}

/**
 * Arrima un mueble a una pared: lo gira para que la espalda quede contra la cara interior y el
 * frente mire al ambiente, y lo desliza sobre la pared hasta el punto más cercano a donde estaba,
 * sin pasarse de los extremos.
 */
export function snapToWall(plan: RoomPlan, p: Placement, size: CabinetSize, wallIndex: number): Placement {
  const w = walls(plan)[wallIndex];
  if (!w) return p;
  // El frente (f) tiene que apuntar hacia el interior: f = (−sin r, cos r) = inward.
  const rotation = Math.round(deg(Math.atan2(-w.inward.x, w.inward.y)) * 1000) / 1000;
  const { u } = placementAxes(rotation);
  const along = dot(u, w.dir) >= 0; // el ancho del mueble va en el sentido de la pared o al revés
  // Posición actual del centro trasero proyectada sobre la pared.
  const { u: u0 } = placementAxes(p.rotation);
  const backMid = add({ x: p.x, y: p.y }, mul(u0, size.w / 2));
  let t = dot(sub(backMid, w.a), w.dir) - size.w / 2;
  t = Math.max(0, Math.min(w.length - size.w, t));
  // t: distancia desde a hasta el extremo del mueble más cercano a a.
  const start = add(w.a, mul(w.dir, along ? t : t + size.w));
  return { ...p, rotation, x: Math.round(start.x), y: Math.round(start.y) };
}

/** Pared más cercana a un mueble (por su centro trasero). */
export function nearestWall(plan: RoomPlan, p: Placement, size: CabinetSize): number {
  const { u } = placementAxes(p.rotation);
  const q = add({ x: p.x, y: p.y }, mul(u, size.w / 2));
  let best = 0;
  let bestD = Infinity;
  walls(plan).forEach((w, i) => {
    const d = distToSegment(q, w.a, w.b);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function distToSegment(q: Pt, a: Pt, b: Pt): number {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(q, a), ab) / (dot(ab, ab) || 1)));
  return hypot(sub(q, add(a, mul(ab, t))));
}

/** Distancia con signo de q a la recta de la pared (positiva hacia el interior). */
function distToWallLine(q: Pt, w: Wall): number {
  return dot(sub(q, w.a), w.inward);
}

function pointInPolygon(q: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** ¿Se pisan dos cuadriláteros convexos? (teorema del eje separador). Tolerancia de 0,5 mm. */
function convexOverlap(A: readonly Pt[], B: readonly Pt[]): boolean {
  for (const poly of [A, B]) {
    for (let i = 0; i < poly.length; i++) {
      const e = sub(poly[(i + 1) % poly.length]!, poly[i]!);
      const axis = { x: -e.y, y: e.x };
      const L = hypot(axis) || 1;
      const proj = (P: readonly Pt[]) => P.map((q) => dot(q, axis) / L);
      const pa = proj(A);
      const pb = proj(B);
      if (Math.max(...pa) <= Math.min(...pb) + 50 || Math.max(...pb) <= Math.min(...pa) + 50) return false;
    }
  }
  return true;
}

// ───────────────────────── avisos ─────────────────────────

export interface RoomWarning {
  code: 'outside' | 'overlap' | 'out_of_square' | 'blocks_door' | 'blocks_window' | 'missing_cabinet' | 'self_intersection' | 'opening_too_wide' | 'door_swing';
  message: string;
  placementId?: string;
  openingId?: string;
  /** Solo 'out_of_square': separación con la pared atrás y adelante, en centésimas de mm. */
  gap?: { back: Len; front: Len };
}

const fmtMm = (v: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(v / 100);

/**
 * Revisa el ambiente y sus muebles colocados:
 * - muebles que se salen del ambiente o atraviesan una pared;
 * - muebles que se pisan entre sí (en planta y a la misma altura);
 * - esquinas fuera de escuadra: si el costado de un mueble queda cerca de una pared pero no
 *   paralelo, avisa la separación atrás y adelante (el relleno cónico que hace falta);
 * - muebles delante de una puerta o, si llegan a la altura del antepecho, de una ventana;
 * - puertas de los muebles que, al abrirse, golpean una pared u otro mueble;
 * - aberturas que no caben en su pared y paredes que se cruzan.
 * `sizes` da las medidas de cada mueble del proyecto por id; `names`, su nombre para los mensajes.
 */
export function analyzeRoom(plan: RoomPlan, sizes: Readonly<Record<string, CabinetSize>>, names: Readonly<Record<string, string>> = {}): RoomWarning[] {
  const out: RoomWarning[] = [];
  const ws = walls(plan);
  if (selfIntersects(plan)) out.push({ code: 'self_intersection', message: 'Hay paredes que se cruzan: revisá las medidas.' });

  for (const o of plan.openings) {
    const w = ws.find((x) => x.id === o.wallId);
    if (!w || o.offset + o.width > w.length) {
      out.push({ code: 'opening_too_wide', message: `Una ${OPENING_NAME[o.kind]} no entra en su pared.`, openingId: o.id });
    }
  }

  const placed = plan.placements
    .map((p) => ({ p, size: sizes[p.cabinetId], name: names[p.cabinetId] ?? 'Un mueble' }))
    .filter((x) => {
      if (!x.size) out.push({ code: 'missing_cabinet', message: 'Hay un mueble colocado que ya no existe en el proyecto.', placementId: x.p.id });
      return !!x.size;
    }) as { p: Placement; size: CabinetSize; name: string }[];

  const poly = plan.corners;
  for (const { p, size, name } of placed) {
    const fp = footprint(p, size);
    // Se admite medio milímetro de tolerancia hacia fuera (redondeos de un mueble arrimado). Con las patas que sobresalen.
    const outside = placementSolids(p, size).some((s) => s.poly.some((q) => !pointInPolygon(q, poly) && ws.every((w) => distToSegment(q, w.a, w.b) > 50)));
    if (outside) out.push({ code: 'outside', message: `${name} se sale del ambiente o atraviesa una pared.`, placementId: p.id });

    // Costados cerca de una pared: separación atrás y adelante.
    const sides: [string, Pt, Pt][] = [
      ['izquierdo', fp[0], fp[3]],
      ['derecho', fp[1], fp[2]],
    ];
    for (const [label, back, front] of sides) {
      for (const w of ws) {
        const db = distToWallLine(back, w);
        const df = distToWallLine(front, w);
        const near = Math.min(Math.abs(db), Math.abs(df)) < mm(150) && distToSegment(back, w.a, w.b) < mm(200);
        // La pared tiene que ir más o menos en el sentido del costado (no la pared de atrás del mueble).
        const sideDir = sub(front, back);
        const parallel = Math.abs(cross(sideDir, w.dir)) / (hypot(sideDir) || 1) < Math.sin(rad(15));
        if (!near || !parallel) continue;
        if (Math.abs(db - df) >= 100 || db < -50 || df < -50) {
          const where = (v: number) => (v >= 0 ? `a ${fmtMm(v)} mm de la pared` : `metido ${fmtMm(-v)} mm en la pared`);
          const fix = db < -50 || df < -50 ? 'Hay que separarlo o recortar el costado en cuña.' : 'Hace falta un relleno cónico o ajustar el mueble.';
          out.push({
            code: 'out_of_square',
            message: `Esquina fuera de escuadra: el costado ${label} de ${name} queda ${where(db)} atrás y ${where(df)} adelante. ${fix}`,
            placementId: p.id,
            gap: { back: Math.round(db), front: Math.round(df) },
          });
        }
      }
    }

    // Aberturas: el mueble contra la pared y solapado con el tramo de la abertura.
    for (const o of plan.openings) {
      const w = ws.find((x) => x.id === o.wallId);
      if (!w || o.kind === 'opening') continue;
      const ds = fp.map((q) => distToWallLine(q, w));
      if (Math.min(...ds) > mm(100)) continue; // no está contra esa pared
      const ts = fp.map((q) => dot(sub(q, w.a), w.dir));
      const lo = Math.min(...ts);
      const hi = Math.max(...ts);
      const overlaps = hi > o.offset + 50 && lo < o.offset + o.width - 50;
      if (!overlaps) continue;
      if (o.kind === 'door') {
        out.push({ code: 'blocks_door', message: `${name} queda delante de una puerta.`, placementId: p.id, openingId: o.id });
      } else if (p.elevation < o.sill + o.height && p.elevation + size.h > o.sill) {
        out.push({ code: 'blocks_window', message: `${name} tapa parte de una ventana.`, placementId: p.id, openingId: o.id });
      }
    }
  }

  // Muebles que se pisan (en planta y con alturas que se cruzan).
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const A = placed[i]!;
      const B = placed[j]!;
      const vertical = A.p.elevation < B.p.elevation + B.size.h && B.p.elevation < A.p.elevation + A.size.h;
      if (vertical && convexOverlap(footprint(A.p, A.size), footprint(B.p, B.size))) {
        out.push({ code: 'overlap', message: `${A.name} y ${B.name} se pisan.`, placementId: A.p.id });
      } else if (solidsOverlap(placementSolids(A.p, A.size), placementSolids(B.p, B.size))) {
        out.push({ code: 'overlap', message: `Las patas de ${A.name} o de ${B.name} se pisan con el otro mueble.`, placementId: A.p.id });
      }
    }
  }

  // Puertas que, al abrirse, golpean una pared u otro mueble (a la altura de la puerta).
  for (const A of placed) {
    for (const door of A.size.doors ?? []) {
      const swing = doorSwing(A.p, A.size, door);
      const { z0, z1 } = doorSweepHeight(A.p, door);
      const ceiling = door.hinge === 'top' && z1 > plan.wallHeight;
      const wall = swing.some((q) => !pointInPolygon(q, poly) && ws.every((w) => distToSegment(q, w.a, w.b) > 50));
      const other = placed.find((B) => B !== A && placementSolids(B.p, B.size).some((s) => s.z0 < z1 && z0 < s.z1 && convexOverlap(swing, s.poly)));
      if (ceiling || wall || other) {
        out.push({
          code: 'door_swing',
          message: ceiling
            ? `La puerta de ${A.name} golpea el techo al abrirse hacia arriba: le faltan ${Math.ceil(toMm(z1 - plan.wallHeight))} mm.`
            : `Una puerta de ${A.name} golpea ${wall ? 'la pared' : `a ${other!.name}`} al abrirse.`,
          placementId: A.p.id,
        });
        break; // un aviso por mueble
      }
    }
  }
  // Colisiones con geometrías de obra (muretes, mesadas y losas inclinadas de bajo escalera).
  for (const b of plan.blocks ?? []) {
    const bfp = blockFootprint(b);
    for (const A of placed) {
      const afp = footprint(A.p, A.size);
      if (!convexOverlap(afp, bfp)) continue;
      if (b.kind === 'box') {
        const vertical = A.p.elevation < b.elevation + b.height && b.elevation < A.p.elevation + A.size.h;
        if (vertical) {
          out.push({ code: 'overlap', message: `${A.name} choca con ${b.name}.`, placementId: A.p.id });
        }
        } else {
        const samples = [
          ...afp,
          { x: (afp[0].x + afp[1].x) / 2, y: (afp[0].y + afp[1].y) / 2 },
          { x: (afp[2].x + afp[3].x) / 2, y: (afp[2].y + afp[3].y) / 2 },
        ];
        let maxExcess = 0;
          for (const q of samples) {
          const clearZ = slopeHeightAt(b, q);
          if (clearZ === null) continue;
          const topZ = A.p.elevation + A.size.h;
          const slabTop = clearZ + b.height;
            if (topZ > clearZ + 50 && A.p.elevation < slabTop) {
            maxExcess = Math.max(maxExcess, topZ - clearZ);
          }
          }
        if (maxExcess > 0) {
          out.push({
            code: 'overlap',
            message: `${A.name} toca ${b.name} (sobresale ${Math.ceil(toMm(maxExcess))} mm por arriba de la pendiente).`,
            placementId: A.p.id,
            });
        }
      }
    }
    }
  return out;
}
/** Rectángulo en planta de un bloque de obra (mismo criterio que footprint). */
export function blockFootprint(b: Pick<RoomBlock, 'x' | 'y' | 'rotation' | 'width' | 'depth'>): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] {
  const { u, f } = placementAxes(b.rotation);
  const p0 = { x: b.x, y: b.y };
  const p1 = { x: b.x + u.x * b.width, y: b.y + u.y * b.width };
  const p2 = { x: p1.x + f.x * b.depth, y: p1.y + f.y * b.depth };
  const p3 = { x: b.x + f.x * b.depth, y: b.y + f.y * b.depth };
  return [p0, p1, p2, p3];
}

/** Altura libre bajo una losa inclinada ('slope') en un punto de planta, o null si está fuera. */
export function slopeHeightAt(b: RoomBlock, pt: { x: number; y: number }): number | null {
  if (b.kind !== 'slope') return null;
  const { u, f } = placementAxes(b.rotation);
  const dx = pt.x - b.x;
  const dy = pt.y - b.y;
  const lu = dx * u.x + dy * u.y;
  const lf = dx * f.x + dy * f.y;
  if (lu < -50 || lu > b.width + 50 || lf < -50 || lf > b.depth + 50) return null;
  const t = Math.min(1, Math.max(0, lu / (b.width || 1)));
  const h0 = b.elevation + (b.heightStart ?? 0);
  const h1 = b.elevation + (b.heightEnd ?? b.height);
  return h0 + (h1 - h0) * t;
}
  
export const OPENING_NAME: Record<OpeningKind, string> = { door: 'puerta', window: 'ventana', opening: 'abertura' };

// ───────────────────────── para dibujar: paredes con espesor ─────────────────────────

export type { Pt as PlanPoint };

/**
 * Esquinas exteriores de las paredes: cada esquina interior desplazada hacia fuera el espesor de
 * pared, con la unión a inglete (sirve para cualquier ángulo). En esquinas muy agudas el inglete
 * se limita a 4 veces el espesor para que no salga una punta enorme.
 */
export function outerCorners(plan: RoomPlan): Pt[] {
  const ws = walls(plan);
  const n = ws.length;
  const t = plan.wallThickness;
  return plan.corners.map((c, i) => {
    const n1 = mul(ws[(i - 1 + n) % n]!.inward, -1);
    const n2 = mul(ws[i]!.inward, -1);
    const k = 1 + dot(n1, n2);
    const m = add(n1, n2);
    const scale = k > 1e-6 ? t / k : 4 * t;
    const off = mul(m, scale);
    const L = hypot(off);
    const capped = L > 4 * t ? mul(off, (4 * t) / L) : off;
    return add(c, capped);
  });
}

/** Tramo macizo de pared para el 3D: un prisma de planta `quad` (interior a, interior b, exterior b, exterior a) entre dos alturas. */
export interface WallPiece {
  wallIndex: number;
  quad: [Pt, Pt, Pt, Pt];
  y0: Len;
  y1: Len;
}

/**
 * Trozos de pared alrededor de las aberturas: entre aberturas, pared entera; encima de cada
 * abertura, el dintel; debajo de cada ventana, el antepecho. Los extremos de cada pared usan las
 * esquinas exteriores a inglete.
 */
export function wallPieces(plan: RoomPlan): WallPiece[] {
  const ws = walls(plan);
  const outer = outerCorners(plan);
  const H = plan.wallHeight;
  const t = plan.wallThickness;
  const out: WallPiece[] = [];
  ws.forEach((w, i) => {
    const at = (s: number): [Pt, Pt] => {
      const inner = add(w.a, mul(w.dir, s));
      const o = s <= 0 ? outer[i]! : s >= w.length ? outer[(i + 1) % ws.length]! : add(inner, mul(w.inward, -t));
      return [inner, o];
    };
    const quad = (s: number, e: number): [Pt, Pt, Pt, Pt] => {
      const [ia, oa] = at(s);
      const [ib, ob] = at(e);
      return [ia, ib, ob, oa];
    };
    const ops = plan.openings
      .filter((o) => o.wallId === w.id)
      .map((o) => ({ s: Math.max(0, o.offset), e: Math.min(w.length, o.offset + o.width), top: Math.min(H, o.sill + o.height), sill: o.sill }))
      .filter((o) => o.e > o.s)
      .sort((a, b) => a.s - b.s);
    let cursor = 0;
    for (const o of ops) {
      if (o.s > cursor) out.push({ wallIndex: i, quad: quad(cursor, o.s), y0: 0, y1: H });
      if (o.top < H) out.push({ wallIndex: i, quad: quad(o.s, o.e), y0: o.top, y1: H });
      if (o.sill > 0) out.push({ wallIndex: i, quad: quad(o.s, o.e), y0: 0, y1: o.sill });
      cursor = Math.max(cursor, o.e);
    }
    if (cursor < w.length) out.push({ wallIndex: i, quad: quad(cursor, w.length), y0: 0, y1: H });
  });
  return out;
}
