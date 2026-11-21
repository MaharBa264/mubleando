import { describe, expect, it } from 'vitest';
import { compute, mm, newDesign, PRESET_MATERIALS, PRESET_METHODS, setDivisions, type CutItem } from '@mw/engine';
import { formatProblem, LABEL_FORMATS, labelSlots, labelsFromCutList, labelsPdf, type LabelData, type LabelFormat } from '../src';

const F24 = LABEL_FORMATS.find((f) => f.id === 'a4-3x8')!;
const F14 = LABEL_FORMATS.find((f) => f.id === 'a4-2x7')!;

describe('formatos de hoja', () => {
  it('todos los de partida entran en una hoja A4', () => {
    for (const f of LABEL_FORMATS) expect(formatProblem(f), f.id).toBeNull();
  });
  it('avisa si no entran', () => {
    const big: LabelFormat = { ...F24, cols: 4 };
    expect(formatProblem(big)).toMatch(/a lo ancho: ocupan 280\.0 mm/);
    expect(formatProblem({ ...F24, rows: 9 })).toMatch(/a lo alto/);
    expect(formatProblem({ ...F24, width: 20 })).toMatch(/al menos 30 × 15/);
  });
});

describe('posiciones', () => {
  it('de izquierda a derecha y de arriba abajo; 24 por hoja', () => {
    const s = labelSlots(F24, 26);
    expect(s.slice(0, 4)).toEqual([
      { page: 0, x: 0, y: 0.5 },
      { page: 0, x: 70, y: 0.5 },
      { page: 0, x: 140, y: 0.5 },
      { page: 0, x: 0, y: 37.5 },
    ]);
    expect(s[23]).toEqual({ page: 0, x: 140, y: 0.5 + 7 * 37 });
    expect(s[24]).toEqual({ page: 1, x: 0, y: 0.5 });
  });
  it('con separación y márgenes (tipo L7163)', () => {
    expect(labelSlots(F14, 3)).toEqual([
      { page: 0, x: 4.65, y: 15.15 },
      { page: 0, x: 4.65 + 99.1 + 2.5, y: 15.15 },
      { page: 0, x: 4.65, y: 15.15 + 38.1 },
    ]);
  });
  it('empezar en una hoja usada: la primera etiqueta va en la posición pedida', () => {
    const s = labelSlots(F24, 3, 22);
    expect(s.map((x) => x.page)).toEqual([0, 0, 1]);
    expect(s[0]).toEqual({ page: 0, x: 70, y: 0.5 + 7 * 37 });
  });
});

describe('etiquetas de un mueble', () => {
  let n = 0;
  const gen = () => 'e' + ++n;
  const d0 = newDesign({ w: mm(600), h: mm(860), d: mm(560) }, gen);
  const d = setDivisions(d0, d0.root.id, 'y', 2, gen);
  const ar = PRESET_METHODS.find((m) => m.id === 'ar-18-ranura')!;
  const parts = compute(d, ar, PRESET_MATERIALS).parts;

  it('una por unidad, con su placa, su número de la lista y el mueble', () => {
    const items: CutItem[] = parts.map((part) => ({ part, qty: 2 }));
    const labels = labelsFromCutList(items, PRESET_MATERIALS, { title: 'Bajo 600' });
    expect(labels).toHaveLength(parts.length * 2);
    expect(labels.every((l) => l.cabinet === 'Bajo 600' && /^G\d+$/.test(l.ref) && /^Placa \d+ de \d+$/.test(l.sheet ?? ''))).toBe(true);
    // Los dos estantes iguales (× 2 muebles) son 4 etiquetas con el mismo número.
    const shelves = labels.filter((l) => l.piece.startsWith('Estante'));
    expect(shelves).toHaveLength(4);
    expect(new Set(shelves.map((l) => l.ref)).size).toBe(1);
    // Medida de corte en mm y cantos de la pieza.
    // Cada etiqueta, su pieza: los dos costados comparten fila pero no nombre.
    expect(labels.filter((l) => l.piece.startsWith('Costado')).map((l) => l.piece)).toEqual(['Costado izquierdo', 'Costado izquierdo', 'Costado derecho', 'Costado derecho']);
    const side = labels.find((l) => l.piece.startsWith('Costado'))!;
    expect(side.thickness).toBe(18);
    expect(side.edges.L1).toBe(true);
  });

  it('en un proyecto, cada etiqueta lleva su mueble aunque la fila los junte', () => {
    const items: CutItem[] = [...parts.map((part) => ({ part, source: 'Bajo A' })), ...parts.map((part) => ({ part, source: 'Bajo B' }))];
    const shelves = labelsFromCutList(items, PRESET_MATERIALS).filter((l) => l.piece.startsWith('Estante'));
    expect(shelves.map((l) => l.cabinet)).toEqual(['Bajo A', 'Bajo A', 'Bajo B', 'Bajo B']);
  });
});

describe('PDF', () => {
  const label: LabelData = {
    cabinet: 'Un nombre de mueble larguísimo que no entra de ninguna manera en la etiqueta',
    piece: 'Costado izquierdo',
    ref: 'G12',
    length: 860,
    width: 542,
    thickness: 18,
    material: 'Melamina blanca 18',
    edges: { L1: true, L2: false, W1: true, W2: false },
    grain: true,
    sheet: 'Placa 2 de 4',
  };

  it('una hoja por cada 24 etiquetas (y una más si se empieza en una hoja usada)', () => {
    expect(labelsPdf(Array(24).fill(label), F24).pages).toBe(1);
    expect(labelsPdf(Array(25).fill(label), F24).pages).toBe(2);
    expect(labelsPdf(Array(3).fill(label), F24, { start: 22 }).pages).toBe(2);
  });

  it('es un PDF de verdad, con título', () => {
    const { bytes } = labelsPdf([label], F14, { title: 'Cocina', outline: true });
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text).toContain('Etiquetas');
  });

  it('un formato que no entra en la hoja no genera nada', () => {
    expect(() => labelsPdf([label], { ...F24, cols: 4 })).toThrow(/a lo ancho/);
  });
});
