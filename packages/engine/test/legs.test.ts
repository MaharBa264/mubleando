import { describe, expect, it } from 'vitest';
import {
  compute,
  designSchema,
  hardwareSchema,
  legCount,
  legsOverhang,
  mm,
  newDesign,
  placeLegs,
  PRESET_HARDWARE,
  PRESET_MATERIALS,
  PRESET_METHODS,
  setPlinth,
  type Design,
  type Hardware,
  type LegSpec,
} from '../src';

/** Patas. Método argentino (melamina 18). Cifras calculadas a mano. */
let n = 0;
const gen = () => 'l' + ++n;
const ar = PRESET_METHODS.find((m) => m.id === 'ar-18-ranura')!;
const M = PRESET_MATERIALS;
const HW = PRESET_HARDWARE.map((h) => (h.id === 'hw-pata-recta-cuadrada' ? { ...h, priceCents: 250_000 } : h)) as Hardware[];
const spec = (id: string) => (PRESET_HARDWARE.find((h) => h.id === id)! as Extract<Hardware, { kind: 'leg' }>).spec;
const mmOf = (v: number) => Math.round(v) / 100;
const bajo = (w = 800, h = 860): Design => newDesign({ w: mm(w), h: mm(h), d: mm(560) }, gen);

describe('patas de partida', () => {
  it('cinco tipos, todos válidos', () => {
    const legs = PRESET_HARDWARE.filter((h) => h.kind === 'leg');
    expect(legs.map((h) => h.id)).toEqual(['hw-pata-regulable', 'hw-pata-recta-cuadrada', 'hw-pata-recta-redonda', 'hw-pata-conica', 'hw-pata-60']);
    for (const h of legs) expect(hardwareSchema.parse(h)).toEqual(h);
  });
  it('cantidad según el ancho: 4 hasta 1200, 6 hasta 2400, 8 más', () => {
    const s = spec('hw-pata-recta-cuadrada');
    expect([800, 1200, 1201, 2400, 3000].map((w) => legCount(s, mm(w)))).toEqual([4, 4, 6, 6, 8]);
  });
});

describe('un bajo de 800 con 4 patas rectas de 150', () => {
  const d = { ...bajo(), legs: { hardwareId: 'hw-pata-recta-cuadrada' } };
  const r = compute(d, ar, M, HW);

  it('el alto total sigue siendo 860: la caja mide 710 y empieza a 150 del piso', () => {
    const side = r.parts.find((p) => p.key === 'side.left')!;
    expect([mmOf(side.box.y), mmOf(side.box.dy), mmOf(side.box.y + side.box.dy)]).toEqual([150, 710, 860]);
    expect(Math.min(...r.parts.map((p) => p.box.y))).toBeGreaterThanOrEqual(mm(150) - mm(2));
    expect(r.warnings).toEqual([]);
  });

  it('cuatro patas en las esquinas, a 30 mm de los bordes (centro a 50 mm)', () => {
    expect(r.legs).toHaveLength(4);
    expect(r.legs.map((l) => [mmOf(l.top.x), mmOf(l.top.z), mmOf(l.height)])).toEqual([
      [50, 510, 150],
      [750, 510, 150],
      [50, 50, 150],
      [750, 50, 150],
    ]);
  });

  it('en la lista de herrajes: 4 unidades de $ 2.500 = $ 10.000', () => {
    const item = r.hardware.find((x) => x.kind === 'leg')!;
    expect([item.qty, item.unit, item.priceCents * item.qty, item.note]).toEqual([4, 'unidad', 1_000_000, '150 mm']);
  });

  it('con «el alto no incluye las patas», la caja mide 860 y el total 1010', () => {
    const r2 = compute({ ...d, legs: { hardwareId: 'hw-pata-recta-cuadrada', includeInHeight: false } }, ar, M, HW);
    const side = r2.parts.find((p) => p.key === 'side.left')!;
    expect([mmOf(side.box.dy), mmOf(side.box.y + side.box.dy)]).toEqual([860, 1010]);
  });
});

describe('patas regulables detrás de un zócalo', () => {
  it('el alto lo da el zócalo (100): la caja no se mueve y las patas miden 100', () => {
    const d = { ...setPlinth(bajo(), { height: mm(100), setback: mm(50) }), legs: { hardwareId: 'hw-pata-regulable' } };
    const r = compute(d, ar, M, HW);
    const sin = compute(setPlinth(bajo(), { height: mm(100), setback: mm(50) }), ar, M, HW);
    expect(r.parts.map((p) => p.box)).toEqual(sin.parts.map((p) => p.box));
    expect(r.legs.every((l) => l.height === mm(100))).toBe(true);
    expect(r.warnings).toEqual([]);
  });
  it('avisa si el zócalo queda fuera de lo que regulan (95 a 150)', () => {
    const d = { ...setPlinth(bajo(), { height: mm(180), setback: mm(50) }), legs: { hardwareId: 'hw-pata-regulable' } };
    expect(compute(d, ar, M, HW).warnings.map((w) => w.message)).toEqual(['El zócalo mide 180 mm y las patas regulan de 95 a 150 mm.']);
  });
});

describe('patas inclinadas', () => {
  // 200 mm de alto, 15° → el pie se corre 200 × tan 15° = 53,59 mm hacia afuera.
  // En una esquina, en diagonal: 53,59 / √2 = 37,89 mm en cada eje.
  const s: LegSpec = { ...spec('hw-pata-60'), height: mm(200), splay: 15, inset: 0, topSize: mm(45), bottomSize: mm(22) };

  it('el pie de una pata de esquina se corre 37,89 mm en x y en z', () => {
    const legs = placeLegs(s, mm(800), mm(560));
    const front = legs[0]!; // adelante a la izquierda
    expect(mmOf(front.top.x - front.foot.x)).toBeCloseTo(37.89, 1);
    expect(mmOf(front.foot.z - front.top.z)).toBeCloseTo(37.89, 1);
  });

  it('sobresale de la huella: 37,89 − 22,5 + 11 = 26,39 mm por lado', () => {
    const o = legsOverhang(placeLegs(s, mm(800), mm(560)), mm(800), mm(560));
    for (const side of ['left', 'right', 'back', 'front'] as const) expect(mmOf(o[side])).toBeCloseTo(26.39, 1);
  });

  it('las patas de partida estilo años 60 (12°, retiro 50) no sobresalen', () => {
    const o = legsOverhang(placeLegs(spec('hw-pata-60'), mm(800), mm(560)), mm(800), mm(560));
    expect(Math.max(o.left, o.right, o.back, o.front)).toBe(0);
  });

  it('con 6 patas, las del medio se abren solo hacia adelante o hacia atrás', () => {
    const legs = placeLegs({ ...s, countByWidth: [[mm(3000), 6]] }, mm(1600), mm(560));
    const mid = legs[1]!;
    expect(mid.foot.x).toBeCloseTo(mid.top.x, 6);
    expect(mid.foot.z).toBeGreaterThan(mid.top.z);
  });
});

describe('casos raros', () => {
  it('patas que no están en la biblioteca: sin patas y con aviso', () => {
    const r = compute({ ...bajo(), legs: { hardwareId: 'no-existe' } }, ar, M, HW);
    expect(r.legs).toEqual([]);
    expect(r.warnings[0]!.message).toMatch(/ya no están en la biblioteca/);
  });
  it('patas más altas que el mueble: sin patas y con aviso', () => {
    const r = compute({ ...bajo(800, 140), legs: { hardwareId: 'hw-pata-recta-cuadrada' } }, ar, M, HW);
    expect(r.legs).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toContain('zone_too_small');
  });
  it('el formato guardado acepta las patas', () => {
    const d = { ...bajo(), legs: { hardwareId: 'hw-pata-60', includeInHeight: false } };
    expect(designSchema.parse(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
});
