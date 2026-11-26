/**
 * Documento PDF del mueble o del proyecto: portada, lista de corte, plano de cortes, vistas
 * (armado con frentes cerrados o abiertos, y explotada) y etiquetas, cada parte opcional.
 * Todo dibujado como vectores en A4.
 */
import { jsPDF } from 'jspdf';
import { cuttingPlan, glassRows, groupedRows, toMm, type CutItem, type CuttingOptions, type LegOut, type Material, type Part } from '@mw/engine';
import { addLabelPages, LABEL_FORMATS, labelsFromCutList, type LabelFormat } from './labels';
import { cabinetView, type CabinetView } from './views';

export interface DocCabinet {
  name: string;
  parts: Part[];
  legs?: LegOut[];
}

export interface DocInclude {
  cutList: boolean;
  plan: boolean;
  /** Vista armada con los frentes cerrados. */
  closed: boolean;
  /** Vista armada con los frentes abiertos. */
  open: boolean;
  exploded: boolean;
  labels: boolean;
}

export interface DocOptions {
  title: string;
  /** Debajo del título: medidas, método, cantidad de muebles… */
  subtitle?: string;
  /** Fecha ya escrita, por ejemplo «21 nov 2026». */
  date: string;
  /** Costo estimado ya escrito, por ejemplo «$ 152.300». */
  cost?: string;
  items: readonly CutItem[];
  materials: readonly Material[];
  cabinets: readonly DocCabinet[];
  include: DocInclude;
  cutting?: CuttingOptions;
  labelFormat?: LabelFormat;
  labelStart?: number;
}

const PAGE = { w: 210, h: 297, m: 15 };
const num = (v: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(v);

function heading(doc: jsPDF, text: string, sub?: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20);
  doc.text(text, PAGE.m, PAGE.m + 5);
  if (sub) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(sub, PAGE.m, PAGE.m + 11);
  }
  return PAGE.m + (sub ? 17 : 12);
}

function footer(doc: jsPDF, title: string) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140);
    doc.text(title, PAGE.m, PAGE.h - 7);
    doc.text(`${i} / ${n}`, PAGE.w - PAGE.m, PAGE.h - 7, { align: 'right' });
  }
}

/** Polígono cerrado con relleno y borde fino. */
function polygon(doc: jsPDF, pts: [number, number][], fill: string) {
  if (pts.length < 3) return;
  const [x0, y0] = pts[0]!;
  const segs: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) segs.push([pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]]);
  doc.setFillColor(fill);
  doc.lines(segs, x0, y0, [1, 1], 'FD', true);
}

/** Dibuja una vista dentro de un rectángulo, centrada y a la mayor escala que entre. */
function drawView(doc: jsPDF, v: CabinetView, box: { x: number; y: number; w: number; h: number }) {
  const bw = v.bounds.maxX - v.bounds.minX || 1;
  const bh = v.bounds.maxY - v.bounds.minY || 1;
  const k = Math.min(box.w / bw, box.h / bh);
  const ox = box.x + (box.w - bw * k) / 2;
  const oy = box.y + (box.h - bh * k) / 2;
  // En el papel, y crece hacia abajo: se invierte.
  const map = (p: [number, number]): [number, number] => [ox + (p[0] - v.bounds.minX) * k, oy + (v.bounds.maxY - p[1]) * k];
  doc.setDrawColor(70);
  doc.setLineWidth(0.12);
  for (const p of v.polygons) polygon(doc, p.points.map(map), p.fill);
  if (v.labels.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    for (const l of v.labels) {
      const [x, y] = map([l.x, l.y]);
      const w = doc.getTextWidth(l.text) + 1.6;
      doc.setFillColor('#ffffff');
      doc.setDrawColor(120);
      doc.roundedRect(x - w / 2, y - 1.9, w, 3.8, 0.8, 0.8, 'FD');
      doc.setTextColor(20);
      doc.text(l.text, x, y + 0.9, { align: 'center' });
    }
    doc.setDrawColor(70);
  }
}

function coverPage(doc: jsPDF, o: DocOptions) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(20);
  doc.text(doc.splitTextToSize(o.title, PAGE.w - 2 * PAGE.m) as string[], PAGE.m, PAGE.m + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(90);
  let y = PAGE.m + 22;
  for (const line of [o.subtitle, o.date].filter(Boolean) as string[]) {
    doc.text(line, PAGE.m, y);
    y += 6;
  }
  if (o.cost) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20);
    doc.text(`Costo estimado del material: ${o.cost}`, PAGE.m, y + 2);
    y += 8;
  }
  const parts: string[] = [];
  const hasDiagonal = o.items.some((it) => !!it.part.diagonalCut);
  if (o.include.cutList) parts.push(hasDiagonal ? 'Lista de corte y croquis de cortes en ángulo' : 'Lista de corte');
  if (o.include.plan) parts.push('Plano de cortes');
  if (o.include.closed || o.include.open) parts.push('Vista del mueble armado');
  if (o.include.exploded) parts.push('Vista explotada');
  if (o.include.labels) parts.push('Etiquetas (al final, para imprimir en hojas autoadhesivas)');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(90);
  doc.text(`Contenido: ${parts.join(' · ')}`, PAGE.m, y + 2, { maxWidth: PAGE.w - 2 * PAGE.m });
  // Una vista armada del primer mueble, si hay alguna vista elegida (o siempre, si no hay otra cosa que mostrar).
  const first = o.cabinets[0];
  if (first && first.parts.length) {
    drawView(doc, cabinetView(first.parts, { mode: 'closed', legs: first.legs }), { x: PAGE.m + 10, y: y + 18, w: PAGE.w - 2 * PAGE.m - 20, h: PAGE.h - y - 50 });
  }
}

function cutListPages(doc: jsPDF, o: DocOptions) {
  const mats = new Map(o.materials.map((m) => [m.id, m]));
  const rows = groupedRows(o.items).filter((r) => mats.get(r.materialId)?.kind !== 'glass');
  doc.addPage('a4', 'portrait');
  let y = heading(doc, 'Lista de corte', 'Medidas de corte en mm, ya descontado el canto. Cantos: L1 delantero, L2 trasero, A1 y A2 los extremos.');
  const cols = [
    { t: 'Ref', w: 11 },
    { t: 'Pieza', w: 50 },
    { t: 'Material', w: 38 },
    { t: 'Largo', w: 14, r: true },
    { t: 'Ancho', w: 14, r: true },
    { t: 'Esp.', w: 10, r: true },
    { t: 'Cant.', w: 10, r: true },
    { t: 'Cantos', w: 33 },
  ];
  const head = () => {
    doc.setFillColor('#ece7de');
    doc.rect(PAGE.m, y - 4, PAGE.w - 2 * PAGE.m, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(60);
    let x = PAGE.m + 1;
    for (const c of cols) {
      doc.text(c.t, c.r ? x + c.w - 2 : x, y, { align: c.r ? 'right' : 'left' });
      x += c.w;
    }
    y += 6;
  };
  head();
  doc.setFont('helvetica', 'normal');
  for (const r of rows) {
    if (y > PAGE.h - 20) {
      doc.addPage('a4', 'portrait');
      y = heading(doc, 'Lista de corte (sigue)');
      head();
      doc.setFont('helvetica', 'normal');
    }
    const edges = (['L1', 'L2', 'W1', 'W2'] as const)
      .filter((k) => r.edges[k])
      .map((k) => k.replace('W', 'A'))
      .join(' ');
    const cells = [r.ref, r.name, mats.get(r.materialId)?.name ?? r.materialId, num(toMm(r.cutLength)), num(toMm(r.cutWidth)), num(toMm(r.thickness)), String(r.qty), edges || '—'];
    doc.setFontSize(8);
    doc.setTextColor(20);
    let x = PAGE.m + 1;
    let lines = 1;
    cells.forEach((v, i) => {
      const c = cols[i]!;
      const wrapped = doc.splitTextToSize(v, c.w - 2) as string[];
      lines = Math.max(lines, Math.min(wrapped.length, 3));
      doc.setFont('helvetica', i === 0 || (i >= 3 && i <= 4) ? 'bold' : 'normal');
      doc.text(wrapped.slice(0, 3), c.r ? x + c.w - 2 : x, y, { align: c.r ? 'right' : 'left' });
      x += c.w;
    });
    y += 3.6 * lines + 1.4;
    doc.setDrawColor(225);
    doc.setLineWidth(0.1);
    doc.line(PAGE.m, y - 3.4, PAGE.w - PAGE.m, y - 3.4);
  }
}


/** Croquis acotados para los cortes diagonales en taller (bajo escalera / techos inclinados). */
function diagonalCutPages(doc: jsPDF, o: DocOptions) {
  const mats = new Map(o.materials.map((m) => [m.id, m]));
  const bySig = new Map<string, string>();
  for (const row of groupedRows(o.items)) bySig.set(sigOf(row), row.ref);

  type DiagEntry = { ref: string; name: string; material: string; thickness: number; width: number; heightMax: number; qty: number; dc: NonNullable<Part['diagonalCut']> };
  const map = new Map<string, DiagEntry>();
  for (const it of o.items) {
    const p = it.part;
    if (!p.diagonalCut) continue;
    const dc = p.diagonalCut;
    const ref = bySig.get(sigOf(p)) ?? '—';
    const key = `${ref}|${p.name}|${dc.heightLeft}|${dc.heightRight}|${p.box.dx}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += 1;
    } else {
      map.set(key, {
        ref,
        name: it.source && o.cabinets.length > 1 ? `${it.source} · ${p.name}` : p.name,
        material: mats.get(p.materialId)?.name ?? p.materialId,
        thickness: p.thickness,
        width: p.box.dx,
        heightMax: Math.max(p.box.dy, dc.heightLeft, dc.heightRight),
        qty: 1,
        dc,
      });
    }
  }
  const entries = [...map.values()];
  if (!entries.length) return;

  doc.addPage('a4', 'portrait');
  let y = heading(
    doc,
    'Cortes en ángulo en taller',
    'La maderera entrega el rectángulo completo (con el triángulo sobrante). Trazá y cortá cada diagonal en taller con estas cotas.',
  );

  for (const e of entries) {
    const blockH = 82;
    if (y + blockH > PAGE.h - 18) {
      doc.addPage('a4', 'portrait');
      y = heading(doc, 'Cortes en ángulo en taller (sigue)');
    }
    const wMm = toMm(e.width);
    const hMaxMm = toMm(e.heightMax);
    const hLMm = toMm(e.dc.heightLeft);
    const hRMm = toMm(e.dc.heightRight);
    const diagMm = toMm(e.dc.diagonalLength);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text(`${e.ref} · ${e.name}${e.qty > 1 ? ` (× ${e.qty})` : ''}`, PAGE.m, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80);
    doc.text(
      `${e.material} (${num(toMm(e.thickness))} mm) · Pedir a maderera: ${num(wMm)} × ${num(hMaxMm)} mm · Diagonal: ${num(diagMm)} mm (${num(e.dc.angleDeg)}°)`,
      PAGE.m,
      y + 4.8,
    );

    // Croquis vectorial a escala (izquierda) + pasos de taller (derecha)
    const boxX = PAGE.m + 14;
    const boxY = y + 10;
    const maxW = 68;
    const maxH = 52;
    const k = Math.min(maxW / Math.max(wMm, 1), maxH / Math.max(hMaxMm, 1));
    const rw = wMm * k;
    const rh = hMaxMm * k;
    const ox = boxX + (maxW - rw) / 2;
    const oy = boxY + (maxH - rh) / 2;
    const yBottom = oy + rh;
    const yTopL = yBottom - hLMm * k;
    const yTopR = yBottom - hRMm * k;

    // 1) Triángulo de descarte (rectángulo completo de maderera)
    doc.setFillColor('#f8e5d8');
    doc.setDrawColor(190, 150, 125);
    doc.setLineWidth(0.2);
    doc.rect(ox, oy, rw, rh, 'FD');

    // 2) Pieza útil (trapecio)
    doc.setDrawColor(60, 100, 170);
    doc.setLineWidth(0.35);
    polygon(
      doc,
      [
        [ox, yBottom],
        [ox + rw, yBottom],
        [ox + rw, yTopR],
        [ox, yTopL],
      ],
      '#dde7f6',
    );

    // 3) Línea de corte diagonal destacada
    doc.setDrawColor(194, 94, 26);
    doc.setLineWidth(0.6);
    doc.line(ox, yTopL, ox + rw, yTopR);

    // 4) Cotas en el croquis
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30);
    doc.text(`${num(hLMm)} mm`, ox - 2, (yBottom + yTopL) / 2 + 1, { align: 'right' });
    doc.text(`${num(hRMm)} mm`, ox + rw + 2, (yBottom + yTopR) / 2 + 1, { align: 'left' });
    doc.text(`${num(wMm)} mm`, ox + rw / 2, yBottom + 4.5, { align: 'center' });
    doc.setTextColor(194, 94, 26);
    doc.text(`${num(diagMm)} mm · ${num(e.dc.angleDeg)}°`, ox + rw / 2, Math.min(yTopL, yTopR) - 2, { align: 'center' });

    // Instrucciones paso a paso a la derecha
    const tx = PAGE.m + 100;
    const tw = PAGE.w - PAGE.m - tx;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30);
    doc.text('Cómo cortar en taller (vista de frente):', tx, boxY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60);
    const steps = [
      `1. Apoyá la placa de ${num(wMm)} × ${num(hMaxMm)} mm con la cara vista hacia arriba.`,
      `2. Medí ${num(hLMm)} mm desde la base en el borde izquierdo y ${num(hRMm)} mm en el derecho.`,
      `3. Uní ambas marcas (diagonal de ${num(diagMm)} mm a ${num(e.dc.angleDeg)}°) y retirá el triángulo sombreado.`,
      '4. Si lleva tapacanto en el borde superior, pegalo después de hacer el corte.',
    ];
    let sy = boxY + 10;
    for (const st of steps) {
      const wrapped = doc.splitTextToSize(st, tw) as string[];
      doc.text(wrapped, tx, sy);
      sy += wrapped.length * 3.8 + 2.2;
    }

    y += blockH - 6;
    doc.setDrawColor(225);
    doc.setLineWidth(0.1);
    doc.line(PAGE.m, y - 3, PAGE.w - PAGE.m, y - 3);
    y += 3;
  }
}

/** Lista para la vidriería: medidas, espesor, tipo, cantos y, en los templados, las perforaciones acotadas. */
function glassPages(doc: jsPDF, o: DocOptions) {
  const rows = glassRows(o.items, o.materials);
  if (!rows.length) return;
  const mats = new Map(o.materials.map((m) => [m.id, m]));
  doc.addPage('a4', 'portrait');
  let y = heading(doc, 'Lista para la vidriería', 'Medidas en mm: alto × ancho, vistos de frente. Los templados no se cortan ni se perforan después de templar.');
  for (const r of rows) {
    const drill = r.holes.length > 0;
    const need = drill ? 70 : 16;
    if (y + need > PAGE.h - 20) {
      doc.addPage('a4', 'portrait');
      y = heading(doc, 'Lista para la vidriería (sigue)');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text(`${r.ref} · ${r.qty} × ${num(toMm(r.length))} × ${num(toMm(r.width))} mm`, PAGE.m, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80);
    const what = [mats.get(r.materialId)?.name ?? r.materialId, `${num(toMm(r.thickness))} mm`, r.tempered ? 'templado' : null, r.polished ? 'cantos pulidos' : 'cantos sin pulir (van dentro del marco)', r.name].filter(Boolean).join(' · ');
    doc.text(doc.splitTextToSize(what, PAGE.w - 2 * PAGE.m) as string[], PAGE.m, y + 4.5);
    y += 10;
    if (drill) {
      // Dibujo del vidrio con las perforaciones acotadas desde abajo y desde el borde.
      const H = 52;
      const k = H / r.length;
      const W = r.width * k;
      const x0 = PAGE.m + 20;
      const y0 = y + 2;
      doc.setDrawColor(60);
      doc.setLineWidth(0.25);
      doc.setFillColor('#e7f1f5');
      doc.rect(x0, y0, W, H, 'FD');
      doc.setFontSize(7.5);
      doc.setTextColor(40);
      for (const h of r.holes) {
        const cx = x0 + h.x * k;
        const cy = y0 + H - h.y * k;
        doc.setFillColor('#ffffff');
        doc.circle(cx, cy, Math.max(0.8, (h.d / 2) * k), 'FD');
        doc.text(`Ø ${num(toMm(h.d))} · a ${num(toMm(h.y))} desde abajo`, x0 + W + 4, cy + 1);
      }
      const h0 = r.holes[0]!;
      doc.text(`Centro a ${num(toMm(Math.min(h0.x, r.width - h0.x)))} del borde ${h0.x < r.width / 2 ? 'izquierdo' : 'derecho'} (visto de frente)`, x0, y0 + H + 5);
      y += H + 12;
    }
    doc.setDrawColor(225);
    doc.setLineWidth(0.1);
    doc.line(PAGE.m, y - 3, PAGE.w - PAGE.m, y - 3);
    y += 3;
  }
}

function planPages(doc: jsPDF, o: DocOptions) {
  const plan = cuttingPlan(o.items, o.materials, o.cutting);
  const W = PAGE.w - 2 * PAGE.m;
  for (const p of plan) {
    const r = p.result;
    const s = r.sheet;
    const h = (W * s.width) / s.length;
    const sub = `Placa de ${num(toMm(s.length))} × ${num(toMm(s.width))} · ${r.sheets.length === 1 ? '1 placa' : `${r.sheets.length} placas`} · aprovechamiento ${num((r.usedArea / (r.sheetArea || 1)) * 100)} %`;
    r.sheets.forEach((sheet, i) => {
      // Dos placas por página.
      if (i % 2 === 0) doc.addPage('a4', 'portrait');
      const top = i % 2 === 0 ? heading(doc, `Plano de cortes · ${p.name}`, sub) : PAGE.m + 17 + h + 16;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(40);
      doc.text(`Placa ${i + 1} de ${r.sheets.length} · ${sheet.placed.length} piezas`, PAGE.m, top + 2);
      const y0 = top + 5;
      const k = W / s.length;
      doc.setFillColor('#f1ede6');
      doc.setDrawColor(150);
      doc.setLineWidth(0.2);
      doc.rect(PAGE.m, y0, W, h, 'FD');
      doc.setLineWidth(0.12);
      for (const q of sheet.placed) {
        const x = PAGE.m + q.x * k;
        const y = y0 + q.y * k;
        const w = q.dx * k;
        const hh = q.dy * k;
        doc.setFillColor('#dde7f6');
        doc.setDrawColor(60, 100, 170);
        doc.rect(x, y, w, hh, 'FD');
        const f = Math.max(4, Math.min(8, Math.min(w, hh) * 1.6));
        doc.setFontSize(f);
        doc.setTextColor(20);
        doc.setFont('helvetica', 'bold');
        const [len, wid] = q.rotated ? [q.dy, q.dx] : [q.dx, q.dy];
        if (hh > 7 && w > 16) {
          doc.text(q.label, x + w / 2, y + hh / 2 - 0.6, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(f * 0.8);
          doc.setTextColor(80);
          doc.text(`${num(toMm(len))} × ${num(toMm(wid))}${q.rotated ? ' (girada)' : ''}`, x + w / 2, y + hh / 2 + f * 0.38, { align: 'center' });
        } else if (w > 4 && hh > 2.5) {
          doc.text(q.label, x + w / 2, y + hh / 2 + f * 0.13, { align: 'center' });
        }
      }
    });
    if (r.unplaced.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(180, 30, 30);
      doc.text(`No entran en la placa: ${[...new Set(r.unplaced.map((u) => u.label))].join(', ')}`, PAGE.m, PAGE.h - 15);
    }
  }
}

/** Firma de una pieza en la lista agrupada (las mismas piezas iguales comparten número). */
const sigOf = (p: Pick<Part, 'materialId' | 'thickness' | 'cutLength' | 'cutWidth' | 'grain' | 'edges'>) =>
  [p.materialId, p.thickness, p.cutLength, p.cutWidth, p.grain, p.edges.L1 ?? '-', p.edges.L2 ?? '-', p.edges.W1 ?? '-', p.edges.W2 ?? '-'].join('|');

function viewPages(doc: jsPDF, o: DocOptions) {
  // Número de la lista agrupada por firma: sirve para las piezas de cualquier mueble del proyecto.
  const bySig = new Map<string, string>();
  for (const row of groupedRows(o.items)) bySig.set(sigOf(row), row.ref);
  const views: { mode: 'closed' | 'open' | 'exploded'; name: string; note: string }[] = [];
  if (o.include.closed) views.push({ mode: 'closed', name: 'Armado, frentes cerrados', note: '' });
  if (o.include.open) views.push({ mode: 'open', name: 'Armado, frentes abiertos', note: '' });
  if (o.include.exploded) views.push({ mode: 'exploded', name: 'Explotado', note: 'Cada pieza, separada en la dirección en que se arma, con su número de la lista de corte.' });
  for (const c of o.cabinets) {
    const refs = new Map<string, string>();
    for (const p of c.parts) {
      const ref = bySig.get(sigOf(p));
      if (ref) refs.set(p.key, ref);
    }
    for (const v of views) {
      doc.addPage('a4', 'portrait');
      const top = heading(doc, c.name, `${v.name}${v.note ? ` · ${v.note}` : ''}`);
      drawView(doc, cabinetView(c.parts, { mode: v.mode, labels: v.mode === 'exploded' ? refs : undefined, legs: c.legs }), {
        x: PAGE.m,
        y: top + 4,
        w: PAGE.w - 2 * PAGE.m,
        h: PAGE.h - top - 25,
      });
    }
  }
}

/** Arma el documento. Devuelve los bytes y la cantidad de páginas. */
export function cabinetPdf(o: DocOptions): { bytes: ArrayBuffer; pages: number } {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title: o.title, creator: 'mubleando' });
  coverPage(doc, o);
  if (o.include.cutList) {
    cutListPages(doc, o);
    diagonalCutPages(doc, o);
  }
  if (o.include.plan) planPages(doc, o);
  if (o.include.cutList) glassPages(doc, o);
  if (o.include.closed || o.include.open || o.include.exploded) viewPages(doc, o);
  // El pie va antes de las etiquetas: esas hojas se imprimen en papel autoadhesivo y no llevan nada más.
  footer(doc, o.title);
  if (o.include.labels) {
    const labels = labelsFromCutList(o.items, o.materials, { title: o.cabinets.length === 1 ? o.cabinets[0]!.name : o.title, cutting: o.cutting });
    addLabelPages(doc, labels, o.labelFormat ?? LABEL_FORMATS[0]!, { start: o.labelStart ?? 0, newPage: true });
  }
  return { bytes: doc.output('arraybuffer'), pages: doc.getNumberOfPages() };
}
