import type { Edges, Material, Part } from './types';
import { toM2, toMl, type Len } from './units';

export interface CutItem {
  part: Part;
  /** Veces que se fabrica (cantidad del mueble). */
  qty?: number;
  /** Mueble de origen, para la lista agrupada de un proyecto. */
  source?: string;
}

export interface CutRow {
  ref: string;
  name: string;
  sources: string[];
  materialId: string;
  thickness: Len;
  length: Len;
  width: Len;
  cutLength: Len;
  cutWidth: Len;
  edges: Edges;
  grain: Part['grain'];
  qty: number;
  keys: string[];
}

const edgeSig = (e: Edges) => [e.L1, e.L2, e.W1, e.W2].map((v) => v ?? '-').join(',');

/** Una fila por pieza. */
export function individualRows(items: readonly CutItem[]): CutRow[] {
  return items.map((it, i) => toRow(`P${i + 1}`, [it]));
}

/** Piezas iguales (material, espesor, medidas de corte y cantos) en una sola fila con su cantidad. */
export function groupedRows(items: readonly CutItem[]): CutRow[] {
  const groups = new Map<string, CutItem[]>();
  for (const it of items) {
    const p = it.part;
    const sig = [p.materialId, p.thickness, p.cutLength, p.cutWidth, p.grain, edgeSig(p.edges)].join('|');
    const g = groups.get(sig);
    if (g) g.push(it);
    else groups.set(sig, [it]);
  }
  const rows = [...groups.values()].map((g) => toRow('', g));
  rows.sort(
    (a, b) =>
      a.materialId.localeCompare(b.materialId) ||
      b.thickness - a.thickness ||
      b.cutLength - a.cutLength ||
      b.cutWidth - a.cutWidth,
  );
  rows.forEach((r, i) => (r.ref = `G${i + 1}`));
  return rows;
}

function toRow(ref: string, g: CutItem[]): CutRow {
  const p = g[0]!.part;
  const names = [...new Set(g.map((it) => it.part.name))];
  const sources = [...new Set(g.map((it) => it.source).filter((s): s is string => !!s))];
  return {
    ref,
    name: names.join(' / '),
    sources,
    materialId: p.materialId,
    thickness: p.thickness,
    length: p.length,
    width: p.width,
    cutLength: p.cutLength,
    cutWidth: p.cutWidth,
    edges: p.edges,
    grain: p.grain,
    qty: g.reduce((s, it) => s + (it.qty ?? 1), 0),
    keys: g.map((it) => it.part.key),
  };
}

export interface Totals {
  panels: { materialId: string; name: string; pieces: number; areaM2: number; costCents: number }[];
  /** Vidrios: van a la vidriería, aparte de la maderera. */
  glass: { materialId: string; name: string; pieces: number; areaM2: number; costCents: number }[];
  edges: { materialId: string; name: string; lengthMl: number; costCents: number }[];
  totalCents: number;
}

/** Superficie de tablero (medida de corte), metros de canto y costo. */
export function totals(items: readonly CutItem[], materials: readonly Material[]): Totals {
  const mats = new Map(materials.map((m) => [m.id, m]));
  const area = new Map<string, { a: number; n: number }>();
  const edge = new Map<string, number>();

  for (const { part: p, qty = 1 } of items) {
    const cur = area.get(p.materialId) ?? { a: 0, n: 0 };
    cur.a += p.cutLength * p.cutWidth * qty;
    cur.n += qty;
    area.set(p.materialId, cur);
    const add = (id: string | null, len: Len) => id && edge.set(id, (edge.get(id) ?? 0) + len * qty);
    add(p.edges.L1, p.length);
    add(p.edges.L2, p.length);
    add(p.edges.W1, p.width);
    add(p.edges.W2, p.width);
  }

  const isGlass = (id: string) => mats.get(id)?.kind === 'glass';
  const toRowM = ([id, { a, n }]: [string, { a: number; n: number }]) => ({
    materialId: id,
    name: mats.get(id)?.name ?? id,
    pieces: n,
    areaM2: toM2(a),
    costCents: Math.round((a * (mats.get(id)?.priceCents ?? 0)) / 1e10),
  });
  const panels = [...area].filter(([id]) => !isGlass(id)).map(toRowM);
  const glass = [...area].filter(([id]) => isGlass(id)).map(toRowM);
  const edges = [...edge].map(([id, len]) => ({
    materialId: id,
    name: mats.get(id)?.name ?? id,
    lengthMl: toMl(len),
    costCents: Math.round((len * (mats.get(id)?.priceCents ?? 0)) / 100_000),
  }));
  const totalCents = [...panels, ...glass, ...edges].reduce((s, r) => s + r.costCents, 0);
  return { panels, glass, edges, totalCents };
}

export interface GlassRow {
  /** V1, V2… */
  ref: string;
  name: string;
  sources: string[];
  materialId: string;
  thickness: Len;
  /** Alto × ancho del vidrio, vistos de frente. */
  length: Len;
  width: Len;
  qty: number;
  tempered: boolean;
  /** Perforaciones (vistas de frente, desde abajo a la izquierda). */
  holes: NonNullable<CutItem['part']['holes']>;
  /** Los templados de puertas enteras llevan los cantos pulidos (quedan a la vista). */
  polished: boolean;
}

/** Lista para la vidriería: los vidrios iguales (material, medidas y perforaciones) en una fila. */
export function glassRows(items: readonly CutItem[], materials: readonly Material[]): GlassRow[] {
  const mats = new Map(materials.map((m) => [m.id, m]));
  const groups = new Map<string, GlassRow>();
  for (const it of items) {
    const p = it.part;
    const m = mats.get(p.materialId);
    if (m?.kind !== 'glass') continue;
    const holes = p.holes ?? [];
    const sig = [p.materialId, p.length, p.width, holes.map((h) => `${h.x},${h.y},${h.d}`).join(';')].join('|');
    const g = groups.get(sig);
    if (g) {
      g.qty += it.qty ?? 1;
      if (!g.name.split(' / ').includes(p.name)) g.name += ` / ${p.name}`;
      if (it.source && !g.sources.includes(it.source)) g.sources.push(it.source);
    } else {
      groups.set(sig, {
        ref: '',
        name: p.name,
        sources: it.source ? [it.source] : [],
        materialId: p.materialId,
        thickness: p.thickness,
        length: p.length,
        width: p.width,
        qty: it.qty ?? 1,
        tempered: !!m.tempered,
        holes,
        polished: !p.doorBox || p.role === 'glass' && p.box.dx === p.doorBox.dx,
      });
    }
  }
  const rows = [...groups.values()].sort((a, b) => a.materialId.localeCompare(b.materialId) || b.length - a.length || b.width - a.width);
  rows.forEach((r, i) => (r.ref = `V${i + 1}`));
  return rows;
}
