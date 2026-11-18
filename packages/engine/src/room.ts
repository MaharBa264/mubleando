import { z } from 'zod';
import { defaultIdGen, type IdGen } from './edit';
import { mm, type Len } from './units';

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

export interface RoomPlan {
  v: 1;
  corners: RoomCorner[];
  wallThickness: Len;
  wallHeight: Len;
  openings: RoomOpening[];
  placements: Placement[];
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
  code: 'outside' | 'overlap' | 'out_of_square' | 'blocks_door' | 'blocks_window' | 'missing_cabinet' | 'self_intersection' | 'opening_too_wide';
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
    // Se admite medio milímetro de tolerancia hacia fuera (redondeos de un mueble arrimado).
    const outside = fp.some((q) => !pointInPolygon(q, poly) && ws.every((w) => distToSegment(q, w.a, w.b) > 50));
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
      }
    }
  }
  return out;
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
