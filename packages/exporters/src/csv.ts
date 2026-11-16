import { toMm, type CutRow, type Material } from '@mw/engine';

export interface CsvOptions {
  /** ';' abre bien en Excel con configuración española. */
  separator?: string;
  /** ',' para Excel en español, '.' para software CNC / optimizadores. */
  decimal?: ',' | '.';
  /** Añade BOM UTF-8 para que Excel lea bien las tildes. */
  bom?: boolean;
}

const HEADER = [
  'Ref',
  'Pieza',
  'Mueble',
  'Material',
  'Espesor (mm)',
  'Largo corte (mm)',
  'Ancho corte (mm)',
  'Cantidad',
  'Veta',
  'Canto L1',
  'Canto L2',
  'Canto A1',
  'Canto A2',
  'Largo acabado (mm)',
  'Ancho acabado (mm)',
];

export function cutListCsv(rows: readonly CutRow[], materials: readonly Material[], opts: CsvOptions = {}): string {
  const sep = opts.separator ?? ';';
  const dec = opts.decimal ?? ',';
  const names = new Map(materials.map((m) => [m.id, m.name]));
  const num = (l: number) => {
    const s = String(toMm(l));
    return dec === ',' ? s.replace('.', ',') : s;
  };
  const cell = (v: string | number) => {
    const s = String(v);
    return /["\n\r]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const edge = (id: string | null) => (id ? (names.get(id) ?? id) : '');

  const lines = [HEADER, ...rows.map((r) => [
    r.ref,
    r.name,
    r.sources.join(', '),
    names.get(r.materialId) ?? r.materialId,
    num(r.thickness),
    num(r.cutLength),
    num(r.cutWidth),
    r.qty,
    r.grain === 'length' ? 'Sí' : 'No',
    edge(r.edges.L1),
    edge(r.edges.L2),
    edge(r.edges.W1),
    edge(r.edges.W2),
    num(r.length),
    num(r.width),
  ])].map((cols) => cols.map(cell).join(sep));

  return (opts.bom === false ? '' : '﻿') + lines.join('\r\n') + '\r\n';
}
