/**
 * Plano de cortes: acomoda las piezas en placas enteras con cortes guillotina (de lado a lado, como
 * corta una seccionadora), respetando la veta, el espesor de la sierra y el refilado de los bordes.
 *
 * Ejes: x a lo largo del largo de la placa (el sentido de la veta), y a lo ancho. Las medidas son
 * enteras en 1/100 mm, como en el resto del motor. Puro y determinista.
 */
import type { Material } from './types';
import { mm, type Len } from './units';
import { groupedRows, type CutItem } from './cutlist';

export interface SheetSize {
  /** Largo de la placa: el sentido de la veta. */
  length: Len;
  width: Len;
}

export interface CuttingOptions {
  /** Espesor de la sierra: lo que se pierde en cada corte. */
  kerf: Len;
  /** Refilado: lo que se recorta de cada borde de la placa para sacar el canto de fábrica. */
  trim: Len;
}

export const DEFAULT_CUTTING: CuttingOptions = { kerf: mm(4), trim: mm(10) };

/**
 * Placa de partida según el espesor, cuando el material no tiene la suya: 2750 × 1830 (melamina y
 * aglomerado) o, hasta 6 mm, 2600 × 1830 (fibrofácil para fondos).
 */
export function defaultSheet(thickness: Len): SheetSize {
  return thickness <= mm(6) ? { length: mm(2600), width: mm(1830) } : { length: mm(2750), width: mm(1830) };
}

export const sheetOf = (m: Pick<Material, 'thickness' | 'sheet'>): SheetSize => m.sheet ?? defaultSheet(m.thickness);

export interface NestPiece {
  id: string;
  /** Lo que se escribe sobre la pieza en el dibujo (la referencia de la lista de corte). */
  label: string;
  /** Medida de corte a lo largo de la veta de la pieza. */
  length: Len;
  width: Len;
  /** Con veta: el largo de la pieza va siempre a lo largo de la placa (no se gira). */
  grain: boolean;
}

export interface Placed {
  id: string;
  label: string;
  /** Esquina de la pieza en la placa (incluye el refilado). */
  x: Len;
  y: Len;
  /** Lo que ocupa a lo largo (x) y a lo ancho (y) de la placa. */
  dx: Len;
  dy: Len;
  /** Girada 90°: su largo va a lo ancho de la placa. */
  rotated: boolean;
}

export interface NestSheet {
  placed: Placed[];
  /** Superficie de las piezas (1/100 mm al cuadrado). */
  usedArea: number;
}

export interface NestResult {
  sheet: SheetSize;
  sheets: NestSheet[];
  /** Piezas que no entran ni en una placa vacía. */
  unplaced: NestPiece[];
  usedArea: number;
  /** Superficie de todas las placas usadas. */
  sheetArea: number;
}

interface Free {
  x: number;
  y: number;
  w: number;
  h: number;
}

type SortRule = (a: NestPiece, b: NestPiece) => number;
const SORTS: SortRule[] = [
  (a, b) => b.length * b.width - a.length * a.width,
  (a, b) => Math.max(b.length, b.width) - Math.max(a.length, a.width),
  (a, b) => b.length - a.length || b.width - a.width,
  (a, b) => b.width - a.width || b.length - a.length,
];

/** Una pasada: piezas en un orden y con una regla de división del espacio libre. */
function pack(pieces: NestPiece[], sheet: SheetSize, o: CuttingOptions, splitShorter: boolean): { sheets: NestSheet[]; unplaced: NestPiece[] } {
  // Cada pieza ocupa su medida más una sierra; la placa útil, lo mismo (el último corte no hace falta).
  const W = sheet.length - 2 * o.trim + o.kerf;
  const H = sheet.width - 2 * o.trim + o.kerf;
  const bins: { free: Free[]; sheet: NestSheet }[] = [];
  const unplaced: NestPiece[] = [];

  const orientations = (p: NestPiece) => {
    const a = { w: p.length + o.kerf, h: p.width + o.kerf, rotated: false };
    if (p.grain || p.length === p.width) return [a];
    return [a, { w: p.width + o.kerf, h: p.length + o.kerf, rotated: true }];
  };

  const place = (bin: (typeof bins)[number], fi: number, p: NestPiece, w: number, h: number, rotated: boolean) => {
    const f = bin.free[fi]!;
    bin.free.splice(fi, 1);
    bin.sheet.placed.push({ id: p.id, label: p.label, x: f.x + o.trim, y: f.y + o.trim, dx: w - o.kerf, dy: h - o.kerf, rotated });
    bin.sheet.usedArea += p.length * p.width;
    // Corte guillotina: el sobrante se parte en dos rectángulos con un corte de lado a lado.
    const rw = f.w - w;
    const rh = f.h - h;
    const horizontal = splitShorter ? rw < rh : rw >= rh;
    const right: Free = { x: f.x + w, y: f.y, w: rw, h: horizontal ? h : f.h };
    const top: Free = { x: f.x, y: f.y + h, w: horizontal ? f.w : w, h: rh };
    if (right.w > o.kerf && right.h > o.kerf) bin.free.push(right);
    if (top.w > o.kerf && top.h > o.kerf) bin.free.push(top);
  };

  for (const p of pieces) {
    let best: { bin: number; fi: number; w: number; h: number; rotated: boolean; score: [number, number] } | null = null;
    for (let b = 0; b < bins.length && !best; b++) {
      bins[b]!.free.forEach((f, fi) => {
        for (const ori of orientations(p)) {
          if (ori.w > f.w || ori.h > f.h) continue;
          const short = Math.min(f.w - ori.w, f.h - ori.h);
          const long = Math.max(f.w - ori.w, f.h - ori.h);
          if (!best || short < best.score[0] || (short === best.score[0] && long < best.score[1])) {
            best = { bin: b, fi, w: ori.w, h: ori.h, rotated: ori.rotated, score: [short, long] };
          }
        }
      });
    }
    if (best) {
      const bb: { bin: number; fi: number; w: number; h: number; rotated: boolean } = best;
      place(bins[bb.bin]!, bb.fi, p, bb.w, bb.h, bb.rotated);
      continue;
    }
    const ori = orientations(p).find((x) => x.w <= W && x.h <= H);
    if (!ori) {
      unplaced.push(p);
      continue;
    }
    const bin = { free: [{ x: 0, y: 0, w: W, h: H }], sheet: { placed: [], usedArea: 0 } as NestSheet };
    bins.push(bin);
    place(bin, 0, p, ori.w, ori.h, ori.rotated);
  }
  return { sheets: bins.map((b) => b.sheet), unplaced };
}

/**
 * Acomoda las piezas en la menor cantidad de placas. Prueba varios órdenes y reglas de corte y se
 * queda con la que usa menos placas; a igualdad, la que deja la última placa más vacía (el
 * sobrante, junto, sirve como retazo).
 */
export function nest(pieces: readonly NestPiece[], sheet: SheetSize, options: CuttingOptions = DEFAULT_CUTTING): NestResult {
  let best: { sheets: NestSheet[]; unplaced: NestPiece[] } | null = null;
  for (const sort of SORTS) {
    const ordered = [...pieces].sort((a, b) => sort(a, b) || a.id.localeCompare(b.id));
    for (const splitShorter of [true, false]) {
      const r = pack(ordered, sheet, options, splitShorter);
      const lastUsed = (x: typeof r) => x.sheets.at(-1)?.usedArea ?? 0;
      if (!best || r.sheets.length < best.sheets.length || (r.sheets.length === best.sheets.length && lastUsed(r) < lastUsed(best))) best = r;
    }
  }
  const r = best ?? { sheets: [], unplaced: [] };
  const usedArea = r.sheets.reduce((s, x) => s + x.usedArea, 0);
  return { sheet, sheets: r.sheets, unplaced: r.unplaced, usedArea, sheetArea: r.sheets.length * sheet.length * sheet.width };
}

export interface CuttingPlanMaterial {
  materialId: string;
  name: string;
  thickness: Len;
  result: NestResult;
  /** Costo de las placas enteras (precio por m² × superficie de las placas). */
  costCents: number;
}

/**
 * Plano de cortes de una lista de piezas (las de un mueble o de todo un proyecto), por material.
 * Las piezas llevan la referencia de la lista de corte agrupada (G1, G2…), una por unidad.
 */
export function cuttingPlan(items: readonly CutItem[], materials: readonly Material[], options: CuttingOptions = DEFAULT_CUTTING): CuttingPlanMaterial[] {
  const mats = new Map(materials.map((m) => [m.id, m]));
  const byMat = new Map<string, NestPiece[]>();
  for (const row of groupedRows(items)) {
    // Los vidrios van a la vidriería: no se acomodan en placas.
    if (mats.get(row.materialId)?.kind === 'glass') continue;
    const list = byMat.get(row.materialId) ?? [];
    for (let i = 0; i < row.qty; i++) {
      list.push({ id: `${row.ref}-${i + 1}`, label: row.ref, length: row.cutLength, width: row.cutWidth, grain: row.grain === 'length' });
    }
    byMat.set(row.materialId, list);
  }
  return [...byMat].map(([id, pieces]) => {
    const m = mats.get(id);
    const thickness = m?.thickness ?? 0;
    const sheet = m ? sheetOf(m) : defaultSheet(thickness);
    const result = nest(pieces, sheet, options);
    return { materialId: id, name: m?.name ?? id, thickness, result, costCents: Math.round((result.sheetArea * (m?.priceCents ?? 0)) / 1e10) };
  });
}
