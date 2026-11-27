/**
 * Etiquetas para pegar en las piezas: PDF en hojas A4 autoadhesivas.
 *
 * Una etiqueta por unidad (si una pieza va 4 veces, salen 4), con el mueble, la pieza, la medida de
 * corte, el material, un dibujo de qué cantos lleva, la veta y de qué placa del plano de cortes sale.
 * Medidas de la hoja y de las etiquetas en mm (no en 1/100 mm como el motor).
 */
import { jsPDF } from 'jspdf';
import { cuttingPlan, groupedRows, toMm, type CutItem, type CuttingOptions, type Edges, type Material } from '@mw/engine';

export interface LabelFormat {
  id: string;
  name: string;
  cols: number;
  rows: number;
  /** Medida de cada etiqueta, en mm. */
  width: number;
  height: number;
  /** Margen de la hoja hasta la primera etiqueta, en mm. */
  marginTop: number;
  marginLeft: number;
  /** Separación entre etiquetas, en mm. */
  gapX: number;
  gapY: number;
}

export const A4 = { width: 210, height: 297 };

/** Formatos de hoja A4 más comunes. */
export const LABEL_FORMATS: LabelFormat[] = [
  { id: 'a4-3x8', name: '24 por hoja · 70 × 37 mm (3 × 8)', cols: 3, rows: 8, width: 70, height: 37, marginTop: 0.5, marginLeft: 0, gapX: 0, gapY: 0 },
  { id: 'a4-3x7', name: '21 por hoja · 63,5 × 38,1 mm (3 × 7, tipo L7160)', cols: 3, rows: 7, width: 63.5, height: 38.1, marginTop: 15.15, marginLeft: 7.2, gapX: 2.5, gapY: 0 },
  { id: 'a4-2x7', name: '14 por hoja · 99,1 × 38,1 mm (2 × 7, tipo L7163)', cols: 2, rows: 7, width: 99.1, height: 38.1, marginTop: 15.15, marginLeft: 4.65, gapX: 2.5, gapY: 0 },
  { id: 'a4-2x4', name: '8 por hoja · 105 × 74 mm (2 × 4)', cols: 2, rows: 4, width: 105, height: 74, marginTop: 0.5, marginLeft: 0, gapX: 0, gapY: 0 },
];

/** ¿Las etiquetas entran en la hoja A4? Devuelve el problema, o null si está bien. */
export function formatProblem(f: LabelFormat): string | null {
  if (f.cols < 1 || f.rows < 1 || f.width <= 0 || f.height <= 0) return 'Filas, columnas y medidas tienen que ser mayores que cero.';
  if (f.width < 30 || f.height < 15) return 'Las etiquetas tienen que medir al menos 30 × 15 mm.';
  const w = f.marginLeft + f.cols * f.width + (f.cols - 1) * f.gapX;
  const h = f.marginTop + f.rows * f.height + (f.rows - 1) * f.gapY;
  if (w > A4.width + 0.01) return `No entran a lo ancho: ocupan ${w.toFixed(1)} mm y la hoja tiene ${A4.width}.`;
  if (h > A4.height + 0.01) return `No entran a lo alto: ocupan ${h.toFixed(1)} mm y la hoja tiene ${A4.height}.`;
  return null;
}

export interface LabelData {
  /** Mueble de origen (en un proyecto) o el nombre del mueble. */
  cabinet: string;
  piece: string;
  /** Número de la lista agrupada (G1, G2…). */
  ref: string;
  /** Medida de corte, en mm. */
  length: number;
  width: number;
  thickness: number;
  material: string;
  /** Qué lados llevan canto: L1 (delantero), L2 (trasero), W1 y W2 (extremos). */
  edges: { L1: boolean; L2: boolean; W1: boolean; W2: boolean };
  grain: boolean;
  /** De qué placa sale: «Placa 2 de 4». */
  sheet: string | null;
}

const edgeSig = (e: Edges) => [e.L1, e.L2, e.W1, e.W2].map((v) => v ?? '-').join(',');

/**
 * Una etiqueta por unidad, en el orden de la lista agrupada. Si una fila junta piezas de varios
 * muebles, cada etiqueta lleva el suyo.
 */
export function labelsFromCutList(items: readonly CutItem[], materials: readonly Material[], opts: { title?: string; cutting?: CuttingOptions } = {}): LabelData[] {
  const mats = new Map(materials.map((m) => [m.id, m]));
  // De qué placa sale cada unidad: el plano usa los ids «G5-1», «G5-2»…
  const sheetOf = new Map<string, string>();
  for (const plan of cuttingPlan(items, materials, opts.cutting)) {
    plan.result.sheets.forEach((s, i) => {
      for (const p of s.placed) sheetOf.set(p.id, `Placa ${i + 1} de ${plan.result.sheets.length}`);
    });
  }
  const out: LabelData[] = [];
  for (const row of groupedRows(items)) {
    // Los vidrios van a la vidriería: no llevan etiqueta.
    if (mats.get(row.materialId)?.kind === 'glass') continue;
    // Las unidades de esta fila, con su mueble (misma firma que usa la lista agrupada).
    const units: { cabinet: string; piece: string }[] = [];
    for (const it of items) {
      const p = it.part;
      const same =
        p.materialId === row.materialId && p.thickness === row.thickness && p.cutLength === row.cutLength && p.cutWidth === row.cutWidth && p.grain === row.grain && edgeSig(p.edges) === edgeSig(row.edges);
      if (same) for (let i = 0; i < (it.qty ?? 1); i++) units.push({ cabinet: it.source ?? opts.title ?? '', piece: p.name });
    }
    units.forEach(({ cabinet, piece }, i) =>
      out.push({
        cabinet,
        piece,
        ref: row.ref,
        length: toMm(row.cutLength),
        width: toMm(row.cutWidth),
        thickness: toMm(row.thickness),
        material: mats.get(row.materialId)?.name ?? row.materialId,
        edges: { L1: !!row.edges.L1, L2: !!row.edges.L2, W1: !!row.edges.W1, W2: !!row.edges.W2 },
        grain: row.grain === 'length',
        sheet: sheetOf.get(`${row.ref}-${i + 1}`) ?? null,
      }),
    );
  }
  return out;
}

export interface LabelSlot {
  page: number;
  /** Esquina superior izquierda de la etiqueta en la hoja, en mm. */
  x: number;
  y: number;
}

/**
 * Dónde va cada etiqueta. `start` = cuántas etiquetas de la primera hoja ya se usaron (para
 * aprovechar una hoja empezada): la primera etiqueta va en la posición `start`.
 */
export function labelSlots(f: LabelFormat, count: number, start = 0): LabelSlot[] {
  const perPage = f.cols * f.rows;
  const first = Math.max(0, Math.min(start, perPage - 1));
  return Array.from({ length: count }, (_, i) => {
    const n = first + i;
    const page = Math.floor(n / perPage);
    const k = n % perPage;
    const col = k % f.cols;
    const row = Math.floor(k / f.cols);
    return { page, x: f.marginLeft + col * (f.width + f.gapX), y: f.marginTop + row * (f.height + f.gapY) };
  });
}

const num = (v: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(v);

/** Achica el texto hasta que entre en `maxW`; si ni así entra, lo corta con «…». */
function fit(doc: jsPDF, text: string, maxW: number, size: number, min: number): { text: string; size: number } {
  let s = size;
  doc.setFontSize(s);
  while (doc.getTextWidth(text) > maxW && s > min) {
    s -= 0.5;
    doc.setFontSize(s);
  }
  if (doc.getTextWidth(text) <= maxW) return { text, size: s };
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
  return { text: `${t.trimEnd()}…`, size: s };
}

function drawLabel(doc: jsPDF, l: LabelData, x: number, y: number, w: number, h: number, outline: boolean) {
  const k = Math.min(h / 37, w / 70, 1.6); // escala del contenido respecto de una etiqueta de 70 × 37
  const pad = 2.5 * k;
  const innerW = w - 2 * pad;
  const pt = (mm: number) => (mm * 72) / 25.4; // mm → puntos tipográficos
  if (outline) {
    doc.setDrawColor(200);
    doc.setLineWidth(0.1);
    doc.rect(x, y, w, h);
  }
  let cy = y + pad;
  const line = (text: string, sizeMm: number, opts: { bold?: boolean; gray?: boolean; right?: string } = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setTextColor(opts.gray ? 100 : 20);
    let avail = innerW;
    if (opts.right) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(pt(sizeMm * 1.1));
      const rw = doc.getTextWidth(opts.right);
      doc.text(opts.right, x + w - pad, cy + sizeMm * 0.8, { align: 'right' });
      avail -= rw + 2 * k;
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    }
    const f = fit(doc, text, avail, pt(sizeMm), pt(sizeMm) * 0.7);
    doc.setFontSize(f.size);
    doc.text(f.text, x + pad, cy + sizeMm * 0.8);
    cy += sizeMm * 1.25;
  };
  line(l.cabinet || ' ', 2.6 * k, { gray: true, right: l.ref });
  line(l.piece, 3.2 * k, { bold: true });
  line(`${num(l.length)} × ${num(l.width)} × ${num(l.thickness)}`, 4.2 * k, { bold: true });
  line(l.material, 2.5 * k, { gray: true });

  // Dibujo de la pieza abajo a la izquierda: lados con canto en trazo grueso; L1 abajo (delantero).
  const boxH = Math.min(h - (cy - y) - pad, 9 * k);
  if (boxH > 3) {
    const ratio = Math.max(1.2, Math.min(3.2, l.length / Math.max(l.width, 1)));
    const boxW = Math.min(boxH * ratio, innerW * 0.55);
    const bx = x + pad;
    const by = y + h - pad - boxH;
    doc.setDrawColor(150);
    doc.setLineWidth(0.15);
    doc.rect(bx, by, boxW, boxH);
    doc.setDrawColor(20);
    doc.setLineWidth(0.9 * k);
    if (l.edges.L1) doc.line(bx, by + boxH, bx + boxW, by + boxH);
    if (l.edges.L2) doc.line(bx, by, bx + boxW, by);
    if (l.edges.W1) doc.line(bx, by, bx, by + boxH);
    if (l.edges.W2) doc.line(bx + boxW, by, bx + boxW, by + boxH);
    if (l.grain) {
      // Flecha de la veta, a lo largo de la pieza.
      const ay = by + boxH / 2;
      doc.setLineWidth(0.25);
      doc.setDrawColor(90);
      doc.line(bx + boxW * 0.2, ay, bx + boxW * 0.8, ay);
      doc.line(bx + boxW * 0.8, ay, bx + boxW * 0.8 - 1.2 * k, ay - 0.9 * k);
      doc.line(bx + boxW * 0.8, ay, bx + boxW * 0.8 - 1.2 * k, ay + 0.9 * k);
    }
    // Abajo a la derecha: la placa de la que sale.
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90);
    const legend = [l.sheet, l.grain ? 'con veta' : null].filter(Boolean).join(' · ');
    if (legend) {
      const f = fit(doc, legend, innerW - boxW - 2 * k, pt(2.4 * k), pt(1.8 * k));
      doc.setFontSize(f.size);
      doc.text(f.text, x + w - pad, y + h - pad, { align: 'right' });
    }
  }
}

export interface LabelsPdfOptions {
  /** Etiquetas ya usadas en la primera hoja. */
  start?: number;
  /** Dibuja el borde de cada etiqueta (para probar en papel común). */
  outline?: boolean;
  title?: string;
}

/**
 * Agrega las hojas de etiquetas a un PDF. `newPage`: empezar en una hoja nueva (si el documento ya
 * tiene otras páginas); si no, la primera etiqueta va en la página actual.
 */
export function addLabelPages(doc: jsPDF, labels: readonly LabelData[], format: LabelFormat, opts: LabelsPdfOptions & { newPage?: boolean } = {}) {
  const problem = formatProblem(format);
  if (problem) throw new Error(problem);
  const slots = labelSlots(format, labels.length, opts.start ?? 0);
  if (opts.newPage) doc.addPage('a4', 'portrait');
  let page = 0;
  labels.forEach((l, i) => {
    const s = slots[i]!;
    while (s.page > page) {
      doc.addPage('a4', 'portrait');
      page++;
    }
    drawLabel(doc, l, s.x, s.y, format.width, format.height, opts.outline ?? false);
  });
}

/** PDF con las etiquetas. Devuelve los bytes y la cantidad de hojas. */
export function labelsPdf(labels: readonly LabelData[], format: LabelFormat, opts: LabelsPdfOptions = {}): { bytes: ArrayBuffer; pages: number } {
  const problem = formatProblem(format);
  if (problem) throw new Error(problem);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title: opts.title ? `Etiquetas · ${opts.title}` : 'Etiquetas', creator: 'Mueblando' });
  addLabelPages(doc, labels, format, opts);
  return { bytes: doc.output('arraybuffer'), pages: doc.getNumberOfPages() };
}
