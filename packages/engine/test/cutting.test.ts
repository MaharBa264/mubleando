import { describe, expect, it } from 'vitest';
import {
  compute,
  cuttingPlan,
  defaultSheet,
  DEFAULT_CUTTING,
  mm,
  nest,
  newDesign,
  PRESET_MATERIALS,
  PRESET_METHODS,
  setDivisions,
  type CuttingOptions,
  type NestPiece,
  type NestResult,
  type SheetSize,
} from '../src';

/** Plano de cortes. Placa de 2750 × 1830, refilado 10 y sierra 4: útil 2730 × 1810. */
const SHEET: SheetSize = { length: mm(2750), width: mm(1830) };
const O = DEFAULT_CUTTING;
const piece = (id: string, l: number, w: number, grain = false): NestPiece => ({ id, label: id, length: mm(l), width: mm(w), grain });

/** Ninguna pieza sale de la zona útil ni se toca con otra (con la sierra entre medio). */
function checkValid(r: NestResult, o: CuttingOptions = O) {
  const max = { x: r.sheet.length - o.trim, y: r.sheet.width - o.trim };
  for (const s of r.sheets) {
    for (const p of s.placed) {
      expect(p.x).toBeGreaterThanOrEqual(o.trim);
      expect(p.y).toBeGreaterThanOrEqual(o.trim);
      expect(p.x + p.dx).toBeLessThanOrEqual(max.x);
      expect(p.y + p.dy).toBeLessThanOrEqual(max.y);
    }
    for (let i = 0; i < s.placed.length; i++) {
      for (let j = i + 1; j < s.placed.length; j++) {
        const a = s.placed[i]!;
        const b = s.placed[j]!;
        const apart = a.x + a.dx + o.kerf <= b.x || b.x + b.dx + o.kerf <= a.x || a.y + a.dy + o.kerf <= b.y || b.y + b.dy + o.kerf <= a.y;
        expect(apart, `${a.id} y ${b.id} se superponen`).toBe(true);
      }
    }
  }
}

describe('una placa', () => {
  it('cuatro piezas que la llenan justo (2 × 1363 + sierra = 2730; 2 × 903 + sierra = 1810): una sola placa', () => {
    const r = nest([1, 2, 3, 4].map((i) => piece(`p${i}`, 1363, 903)), SHEET);
    expect(r.sheets).toHaveLength(1);
    expect(r.unplaced).toEqual([]);
    checkValid(r);
    // Las piezas empiezan en el refilado y la segunda fila, después de la sierra.
    expect(r.sheets[0]!.placed.map((p) => [p.x, p.y]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)).toEqual([
      [mm(10), mm(10)],
      [mm(10), mm(917)],
      [mm(1377), mm(10)],
      [mm(1377), mm(917)],
    ]);
  });

  it('1 mm más y ya no entran las cuatro: dos placas', () => {
    const r = nest([1, 2, 3, 4].map((i) => piece(`p${i}`, 1364, 903)), SHEET);
    expect(r.sheets).toHaveLength(2);
    checkValid(r);
  });

  it('una pieza más grande que la placa no se acomoda y se informa', () => {
    const r = nest([piece('larga', 2800, 400, true), piece('ok', 500, 400)], SHEET);
    expect(r.unplaced.map((p) => p.id)).toEqual(['larga']);
    expect(r.sheets).toHaveLength(1);
  });

  it('sin veta, una pieza se gira si así entra; con veta, no', () => {
    // 1800 de largo × 2700 de ancho: solo entra girada (2700 a lo largo de la placa).
    expect(nest([piece('a', 1800, 2700)], SHEET).sheets[0]!.placed[0]!.rotated).toBe(true);
    expect(nest([piece('a', 1800, 2700, true)], SHEET).unplaced).toHaveLength(1);
  });
});

describe('veta', () => {
  it('las piezas con veta nunca se giran', () => {
    const pieces = Array.from({ length: 30 }, (_, i) => piece(`v${i}`, 300 + ((i * 37) % 500), 200 + ((i * 53) % 300), true));
    const r = nest(pieces, SHEET);
    checkValid(r);
    for (const s of r.sheets) for (const p of s.placed) expect(p.rotated).toBe(false);
  });
});

describe('casos al azar', () => {
  // Generador determinista (mulberry32), para que la prueba sea siempre la misma.
  const rng = (seed: number) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  it('200 listas al azar: ninguna superposición, todo dentro, ninguna pieza perdida, y no peor que el área', () => {
    const rand = rng(42);
    for (let c = 0; c < 200; c++) {
      const n = 1 + Math.floor(rand() * 40);
      const pieces = Array.from({ length: n }, (_, i) => piece(`r${i}`, 50 + Math.floor(rand() * 2000), 50 + Math.floor(rand() * 900), rand() < 0.4));
      const o: CuttingOptions = { kerf: mm(Math.floor(rand() * 6)), trim: mm(Math.floor(rand() * 20)) };
      const r = nest(pieces, SHEET, o);
      checkValid(r, o);
      const placed = r.sheets.flatMap((s) => s.placed.map((p) => p.id));
      expect(new Set(placed).size).toBe(placed.length);
      expect(placed.length + r.unplaced.length).toBe(n);
      const area = pieces.reduce((s, p) => s + p.length * p.width, 0);
      expect(r.sheets.length).toBeGreaterThanOrEqual(Math.ceil(area / (SHEET.length * SHEET.width)));
    }
  });

  it('determinista: la misma lista da el mismo plano', () => {
    const pieces = Array.from({ length: 25 }, (_, i) => piece(`d${i}`, 200 + i * 31, 150 + ((i * 17) % 400)));
    expect(nest(pieces, SHEET)).toEqual(nest([...pieces].reverse(), SHEET));
  });
});

describe('plano de un mueble', () => {
  it('placa de partida: 2750 × 1830; hasta 6 mm, 2600 × 1830', () => {
    expect(defaultSheet(mm(18))).toEqual({ length: mm(2750), width: mm(1830) });
    expect(defaultSheet(mm(3))).toEqual({ length: mm(2600), width: mm(1830) });
  });

  it('un bajo de 600 con dos estantes: cada material en su placa, una pieza por unidad, costo = placas × m² × precio', () => {
    let n = 0;
    const gen = () => 'c' + ++n;
    const d0 = newDesign({ w: mm(600), h: mm(860), d: mm(560) }, gen);
    const d = setDivisions(d0, d0.root.id, 'y', 2, gen);
    const ar = PRESET_METHODS.find((m) => m.id === 'ar-18-ranura')!;
    const parts = compute(d, ar, PRESET_MATERIALS).parts;
    const mats = PRESET_MATERIALS.map((m) => ({ ...m, priceCents: 1_000_000 })); // $ 10.000 el m²
    const plan = cuttingPlan(parts.map((part) => ({ part, qty: 2 })), mats);
    const pieces = (id: string) => plan.find((p) => p.materialId === id)!.result.sheets.flatMap((s) => s.placed).length;
    const byMat = new Map<string, number>();
    for (const p of parts) byMat.set(p.materialId, (byMat.get(p.materialId) ?? 0) + 2);
    expect(plan.map((p) => p.materialId).sort()).toEqual([...byMat.keys()].sort());
    for (const [id, count] of byMat) expect(pieces(id)).toBe(count);
    for (const p of plan) {
      expect(p.result.unplaced).toEqual([]);
      const s = p.result.sheet;
      // 2750 × 1830 = 5,0325 m² → $ 50.325 por placa.
      expect(p.costCents).toBe(Math.round(p.result.sheets.length * (s.length / 100_000) * (s.width / 100_000) * 1_000_000));
    }
  });
});
