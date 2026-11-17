import { describe, expect, it } from 'vitest';
import {
  compute,
  designSchema,
  groupedRows,
  mm,
  newDesign,
  REFERENCE_MATERIALS,
  REFERENCE_METHODS,
  setChildSize,
  setDivisions,
  totals,
  type Box,
  type Design,
  type Method,
  type Part,
} from '../src';

// Un contador único para todo el archivo: dos generadores distintos nunca repiten id.
let counter = 0;
const seq = () => () => `z${++counter}`;
const groove = REFERENCE_METHODS[0]!;
const overlay = REFERENCE_METHODS[1]!;
const M = REFERENCE_MATERIALS;
const byKey = (parts: Part[], key: string) => {
  const p = parts.find((x) => x.key === key);
  if (!p) throw new Error(`no part ${key}`);
  return p;
};
const dims = (p: Part) => [p.length / 100, p.width / 100, p.cutLength / 100, p.cutWidth / 100];

/** Bajo de cocina típico: 600 × 720 × 560, melamina 19, trasera DM 8 en ranura de 10 (holgura 1), canto PVC 1 al frente. */
function base600(): Design {
  return newDesign({ w: mm(600), h: mm(720), d: mm(560) }, seq());
}

describe('caja básica, trasera en ranura', () => {
  const r = compute(base600(), groove, M);

  it('no da avisos', () => expect(r.warnings).toEqual([]));

  it('costados enteros: 720 × 560, corte 720 × 559 (canto 1 al frente)', () => {
    expect(dims(byKey(r.parts, 'side.left'))).toEqual([720, 560, 720, 559]);
    expect(dims(byKey(r.parts, 'side.right'))).toEqual([720, 560, 720, 559]);
  });

  it('tapa y base entre costados: 562 × 560, corte 562 × 559', () => {
    expect(dims(byKey(r.parts, 'top'))).toEqual([562, 560, 562, 559]);
    expect(dims(byKey(r.parts, 'bottom'))).toEqual([562, 560, 562, 559]);
  });

  it('trasera entra 9 mm en cada ranura: 700 × 580, sin canto', () => {
    const b = byKey(r.parts, 'back');
    expect(dims(b)).toEqual([700, 580, 700, 580]);
    expect(b.thickness).toBe(mm(8));
    expect(b.box).toEqual({ x: mm(10), y: mm(10), z: mm(10), dx: mm(580), dy: mm(700), dz: mm(8) });
  });

  it('el hueco interior empieza delante de la trasera', () => {
    expect(r.zones[0]!.box).toEqual({ x: mm(19), y: mm(19), z: mm(18), dx: mm(562), dy: mm(682), dz: mm(542) });
  });
});

describe('trasera clavada', () => {
  const r = compute(base600(), overlay, M);
  it('la trasera cubre todo y acorta el fondo de la caja', () => {
    expect(dims(byKey(r.parts, 'back'))).toEqual([720, 600, 720, 600]);
    expect(dims(byKey(r.parts, 'side.left'))).toEqual([720, 557, 720, 556]);
    expect(r.zones[0]!.box.dz).toBe(mm(557));
  });
});

describe('estantes', () => {
  it('un estante reparte el hueco en dos iguales y va retranqueado 20 mm', () => {
    const d = base600();
    const r = compute(setDivisions(d, d.root.id, 'y', 1, seq()), groove, M);
    const s = r.parts.filter((p) => p.role === 'shelf');
    expect(s).toHaveLength(1);
    expect(s[0]!.name).toBe('Estante 1');
    expect(dims(s[0]!)).toEqual([562, 522, 562, 521]);
    // (682 − 19) / 2 = 331,5 → el estante empieza en 19 + 331,5
    expect(s[0]!.box.y).toBe(mm(350.5));
    const kids = r.zones.filter((z) => z.parentId === d.root.id);
    expect(kids.map((z) => z.box.dy)).toEqual([mm(331.5), mm(331.5)]);
  });

  it('reparte las centésimas sobrantes sin perder ninguna', () => {
    const d = base600();
    const r = compute(setDivisions(d, d.root.id, 'x', 2, seq()), groove, M);
    const kids = r.zones.filter((z) => z.parentId === d.root.id).map((z) => z.box.dx);
    // 562 − 2·19 = 524 → 174,67 + 174,67 + 174,66
    expect(kids).toEqual([17467, 17467, 17466]);
    expect(kids.reduce((a, b) => a + b, 0) + 2 * mm(19)).toBe(mm(562));
    expect(r.parts.filter((p) => p.role === 'divider').map(dims)).toEqual([
      [682, 542, 682, 541],
      [682, 542, 682, 541],
    ]);
  });

  it('respeta una medida fija y reparte el resto', () => {
    const d0 = base600();
    let d = setDivisions(d0, d0.root.id, 'y', 1, seq());
    d = setChildSize(d, d0.root.id, 0, mm(200));
    const r = compute(d, groove, M);
    expect(r.zones.filter((z) => z.parentId === d0.root.id).map((z) => z.box.dy)).toEqual([mm(200), mm(463)]);
    expect(r.warnings).toEqual([]);
  });

  it('si todas son fijas y no cuadran, el último hueco absorbe la diferencia', () => {
    const d0 = base600();
    let d = setDivisions(d0, d0.root.id, 'y', 1, seq());
    d = setChildSize(d, d0.root.id, 0, mm(200));
    d = setChildSize(d, d0.root.id, 1, mm(300));
    const r = compute(d, groove, M);
    expect(r.zones.filter((z) => z.parentId === d0.root.id).map((z) => z.box.dy)).toEqual([mm(200), mm(463)]);
  });

  it('avisa si las medidas fijas no caben', () => {
    const d0 = base600();
    let d = setDivisions(d0, d0.root.id, 'y', 1, seq());
    d = setChildSize(d, d0.root.id, 0, mm(700));
    const codes = compute(d, groove, M).warnings.map((w) => w.code);
    expect(codes).toContain('fixed_sizes_exceed');
    expect(codes).toContain('zone_too_small');
  });
});

describe('anidado: divisor y luego estantes en cada lado', () => {
  const gen = seq();
  const d0 = newDesign({ w: mm(900), h: mm(2000), d: mm(580) }, gen);
  let d = setDivisions(d0, d0.root.id, 'x', 1, gen);
  const [left, right] = d.root.split!.children;
  d = setDivisions(d, left!.id, 'y', 4, gen);
  d = setDivisions(d, right!.id, 'y', 2, gen);
  const r = compute(d, groove, M);

  it('cuenta las piezas', () => {
    expect(r.parts.filter((p) => p.role === 'shelf')).toHaveLength(6);
    expect(r.parts.filter((p) => p.role === 'divider')).toHaveLength(1);
    expect(r.parts).toHaveLength(5 + 7);
  });

  it('los estantes de cada lado miden el ancho de su hueco', () => {
    const inner = 900 - 38 - 19; // 843 a repartir entre dos huecos
    const widths = r.parts.filter((p) => p.role === 'shelf').map((p) => p.length / 100);
    expect(widths.slice(0, 4).every((w) => w === inner / 2)).toBe(true);
    expect(widths.slice(4).every((w) => w === inner / 2)).toBe(true);
  });

  it('ninguna pieza se solapa con otra ni sale del mueble', () => {
    const overlap = (a: Box, b: Box) =>
      a.x < b.x + b.dx && b.x < a.x + a.dx && a.y < b.y + b.dy && b.y < a.y + a.dy && a.z < b.z + b.dz && b.z < a.z + a.dz;
    const ps = r.parts;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i]!.box;
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.z).toBeGreaterThanOrEqual(0);
      expect(a.x + a.dx).toBeLessThanOrEqual(mm(900));
      expect(a.y + a.dy).toBeLessThanOrEqual(mm(2000));
      expect(a.z + a.dz).toBeLessThanOrEqual(mm(580));
      for (let j = i + 1; j < ps.length; j++) {
        // La trasera vive en la ranura de costados/tapa/base: ese solape es intencionado.
        if (ps[i]!.role === 'back' || ps[j]!.role === 'back') continue;
        expect(overlap(a, ps[j]!.box), `${ps[i]!.key} × ${ps[j]!.key}`).toBe(false);
      }
    }
  });

  it('es determinista', () => {
    expect(compute(d, groove, M)).toEqual(r);
  });

  it('el diseño pasa la validación', () => {
    expect(designSchema.safeParse(d).success).toBe(true);
  });
});

describe('edición', () => {
  it('cambiar el número de estantes conserva lo que hay dentro de los huecos existentes', () => {
    const gen = seq();
    const d0 = base600();
    let d = setDivisions(d0, d0.root.id, 'y', 1, gen);
    const first = d.root.split!.children[0]!;
    d = setDivisions(d, first.id, 'x', 1, gen);
    d = setDivisions(d, d0.root.id, 'y', 3, gen);
    expect(d.root.split!.children).toHaveLength(4);
    expect(d.root.split!.children[0]!.split?.axis).toBe('x');
    d = setDivisions(d, d0.root.id, 'y', 0, gen);
    expect(d.root.split).toBeUndefined();
  });

  it('avisa de medidas fuera de rango', () => {
    const r = compute(newDesign({ w: mm(50), h: mm(720), d: mm(560) }, seq()), groove, M);
    expect(r.warnings.map((w) => w.code)).toContain('size_out_of_range');
  });

  it('avisa si falta un material', () => {
    const m: Method = { ...groove, carcassMaterialId: 'no-existe' };
    expect(compute(base600(), m, M).warnings.map((w) => w.code)).toContain('material_missing');
  });
});

describe('lista de corte y totales', () => {
  const d0 = base600();
  const d = setDivisions(d0, d0.root.id, 'y', 2, seq());
  const r = compute(d, groove, M);
  const items = r.parts.map((part) => ({ part, qty: 2, source: 'Bajo 600' }));

  it('agrupa piezas iguales', () => {
    const rows = groupedRows(items);
    const sides = rows.find((x) => x.name === 'Costado izquierdo / Costado derecho')!;
    expect(sides.qty).toBe(4);
    const topBottom = rows.find((x) => x.name === 'Tapa / Base')!;
    expect(topBottom.qty).toBe(4);
    const shelves = rows.find((x) => x.name === 'Estante 1 / Estante 2')!;
    expect(shelves.qty).toBe(4);
    expect(rows.reduce((s, x) => s + x.qty, 0)).toBe(r.parts.length * 2);
  });

  it('suma superficie, canto y coste', () => {
    // Los materiales de partida no traen precio: se le pone uno para probar la cuenta.
    const priced = M.map((m) => (m.id === 'mel-blanco-19' ? { ...m, priceCents: 1150 } : m.id === 'pvc-blanco-1' ? { ...m, priceCents: 45 } : m));
    const t = totals(items, priced);
    const mel = t.panels.find((p) => p.materialId === 'mel-blanco-19')!;
    const area = 2 * (2 * 720 * 559 + 2 * 562 * 559 + 2 * 562 * 521); // mm²
    expect(mel.areaM2).toBeCloseTo(area / 1e6, 9);
    expect(mel.costCents).toBe(Math.round((area / 1e6) * 1150));
    const edge = t.edges.find((e) => e.materialId === 'pvc-blanco-1')!;
    expect(edge.lengthMl).toBeCloseTo((2 * (2 * 720 + 2 * 562 + 2 * 562)) / 1000, 9);
    expect(t.totalCents).toBe(t.panels.reduce((s, p) => s + p.costCents, 0) + t.edges.reduce((s, e) => s + e.costCents, 0));
  });
});
