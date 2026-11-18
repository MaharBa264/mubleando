import { describe, expect, it } from 'vitest';
import {
  compute,
  designSchema,
  hardwareSchema,
  hingeCount,
  mm,
  newDesign,
  PRESET_HARDWARE,
  PRESET_MATERIALS,
  PRESET_METHODS,
  setDivisions,
  setFront,
  type Design,
  type Method,
  type Part,
} from '../src';

/**
 * Herrajes con el método argentino (melamina 18, fondo 3 en ranura a 15 mm: hueco interior de un
 * bajo de 600 × 860 × 560 = 564 × 824 × 542). Cifras calculadas a mano.
 */
let n = 0;
const gen = () => 'h' + ++n;
const M = PRESET_MATERIALS;
const HW = PRESET_HARDWARE;
const ar = PRESET_METHODS.find((m) => m.id === 'ar-18-ranura')!;
const mmOf = (v: number) => v / 100;
const with_ = (m: Method, hardware: Method['hardware']): Method => ({ ...m, hardware });
const bajo = (w = 600, d = 560): Design => newDesign({ w: mm(w), h: mm(860), d: mm(d) }, gen);
const drawers3 = (d: Design) => setFront(d, d.root.id, { kind: 'drawers', mount: 'overlay', sizes: [null, null, null] });
const get = (parts: Part[], suffix: string) => parts.filter((p) => p.key.endsWith(suffix));

describe('biblioteca', () => {
  it('los herrajes de partida son válidos y sus ids únicos', () => {
    for (const h of HW) expect(hardwareSchema.parse(h)).toEqual(h);
    expect(new Set(HW.map((h) => h.id)).size).toBe(HW.length);
  });

  it('cantidad de bisagras por alto de puerta', () => {
    const spec = (HW.find((h) => h.id === 'hw-bisagra-codo0')!.spec as { countByHeight: [number, number][] } & Parameters<typeof hingeCount>[0]);
    expect([mm(700), mm(900), mm(901), mm(1600), mm(2000), mm(2400), mm(3000)].map((h) => hingeCount(spec, h))).toEqual([2, 2, 3, 3, 4, 5, 5]);
  });

  it('sin biblioteca, el cálculo no lista herrajes (y no cambia nada)', () => {
    const d = drawers3(bajo());
    const r = compute(d, ar, M);
    expect(r.hardware).toEqual([]);
    expect(mmOf(get(r.parts, 'drawer0/back')[0]!.length)).toBe(539 - 36);
  });
});

describe('bisagras', () => {
  it('una puerta de 857 de alto lleva 2; dos hojas, 4', () => {
    const d0 = bajo();
    const r1 = compute(setFront(d0, d0.root.id, { kind: 'door', leaves: 1, hinge: 'left', mount: 'overlay' }), ar, M, HW);
    expect(r1.hardware.map((x) => [x.hardwareId, x.qty, x.unit])).toEqual([['hw-bisagra-codo0', 2, 'unidad']]);
    const r2 = compute(setFront(d0, d0.root.id, { kind: 'door', leaves: 2, hinge: 'left', mount: 'overlay' }), ar, M, HW);
    expect(r2.hardware[0]!.qty).toBe(4);
  });

  it('una columna con puerta de más de 900 de alto lleva 3', () => {
    const d0 = newDesign({ w: mm(600), h: mm(1200), d: mm(560) }, gen);
    const r = compute(setFront(d0, d0.root.id, { kind: 'door', leaves: 1, hinge: 'left', mount: 'overlay' }), ar, M, HW);
    expect(r.hardware[0]!.qty).toBe(3);
  });

  it('puerta encastrada con bisagra de codo 0: avisa; eligiendo la de codo 18 en el mueble, no', () => {
    const d0 = bajo();
    const d = setFront(d0, d0.root.id, { kind: 'door', leaves: 1, hinge: 'left', mount: 'inset' });
    expect(compute(d, ar, M, HW).warnings.map((w) => w.code)).toEqual(['hardware_mismatch']);
    const r = compute({ ...d, hardware: { hinge: 'hw-bisagra-codo18' } }, ar, M, HW);
    expect(r.warnings).toEqual([]);
    expect(r.hardware[0]!.hardwareId).toBe('hw-bisagra-codo18');
  });
});

describe('correderas', () => {
  it('telescópicas de bolas: 12,5 por lado, corredera de 500 (entra hasta 532), un par por cajón', () => {
    const r = compute(drawers3(bajo()), ar, M, HW);
    expect(r.warnings).toEqual([]);
    expect(mmOf(get(r.parts, 'drawer0/side.left')[0]!.length)).toBe(500);
    expect(mmOf(get(r.parts, 'drawer0/back')[0]!.length)).toBe(564 - 25 - 36);
    expect(r.hardware.map((x) => [x.hardwareId, x.qty, x.unit, x.note])).toEqual([['hw-corredera-bolas-45', 3, 'par', 'de 500 mm']]);
  });

  it('mueble de poco fondo: corredera de 250 (fondo libre 272)', () => {
    const r = compute(drawers3(bajo(600, 300)), ar, M, HW);
    expect(mmOf(get(r.parts, 'drawer0/side.left')[0]!.length)).toBe(250);
    expect(r.hardware[0]!.note).toBe('de 250 mm');
  });

  it('si no entra ninguna corredera, avisa y no hace la caja', () => {
    const r = compute(drawers3(bajo(600, 250)), ar, M, HW);
    expect(r.warnings[0]!.message).toContain('no entra ninguna');
    expect(get(r.parts, '/side.left')).toEqual([]);
  });

  it('oculta bajo cajón (tipo Tandem): ancho interior 564 − 42 = 522, caja centrada, largo 500 − 10; avisa laterales de 18 > 16', () => {
    const r = compute({ ...drawers3(bajo()), hardware: { slide: 'hw-corredera-oculta' } }, ar, M, HW);
    const left = get(r.parts, 'drawer0/side.left')[0]!;
    const back = get(r.parts, 'drawer0/back')[0]!;
    expect(mmOf(back.length)).toBe(522);
    expect(mmOf(left.box.x)).toBe(18 + (564 - 558) / 2);
    expect(mmOf(left.length)).toBe(490);
    expect(r.warnings.map((w) => w.code)).toContain('hardware_mismatch');
    // Con laterales de 15 mm, no avisa.
    const m15: Method = { ...ar, drawer: { ...ar.drawer, materialId: 'ar-mel-blanca-15' } };
    expect(compute({ ...drawers3(bajo()), hardware: { slide: 'hw-corredera-oculta' } }, m15, M, HW).warnings).toEqual([]);
  });

  it('cajón metálico: solo fondo (564 − 75 × 500 − 24) y trasera (564 − 87) de madera', () => {
    const r = compute({ ...drawers3(bajo()), hardware: { slide: 'hw-cajon-metalico' } }, ar, M, HW);
    expect(get(r.parts, 'drawer0/side.left')).toEqual([]);
    const bottom = get(r.parts, 'drawer0/bottom')[0]!;
    expect([mmOf(bottom.width), mmOf(bottom.length)]).toEqual([489, 476]);
    expect(mmOf(get(r.parts, 'drawer0/back')[0]!.length)).toBe(477);
  });
});

describe('puertas corredizas', () => {
  // Bajo de 1200: hueco interior 1164 × 824. Sistema de partida: solape 20, luces 10 arriba y abajo,
  // 5 mm del frente, 6 mm entre hojas.
  const d0 = newDesign({ w: mm(1200), h: mm(860), d: mm(560) }, gen);
  const sliding = setFront(d0, d0.root.id, { kind: 'sliding', leaves: 2 });

  it('dos hojas de 592 × 804 que se solapan 20 mm, en dos rieles', () => {
    const r = compute(sliding, ar, M, HW);
    expect(r.warnings).toEqual([]);
    const doors = r.parts.filter((p) => p.role === 'door');
    expect(doors.map((p) => [mmOf(p.length), mmOf(p.width), mmOf(p.box.x), mmOf(p.box.y), mmOf(p.box.z), p.track])).toEqual([
      [804, 592, 18, 28, 513, 'back'],
      [804, 592, 590, 28, 537, 'front'],
    ]);
    expect(r.hardware.map((x) => [x.hardwareId, x.qty, x.unit, x.note])).toEqual([['hw-corredizo-2', 1, 'juego', 'rieles de 1164 mm']]);
  });

  it('tres hojas: las de los extremos adelante; 3 × 401,34 de ancho', () => {
    const r = compute(setFront(d0, d0.root.id, { kind: 'sliding', leaves: 3 }), ar, M, HW);
    const doors = r.parts.filter((p) => p.role === 'door');
    expect(doors.map((p) => p.track)).toEqual(['front', 'back', 'front']);
    expect(doors.reduce((s, p) => s + p.width, 0)).toBe(mm(1164 + 40));
  });

  it('estantes retranqueados 20 chocan con las hojas (necesitan 47 mm): avisa', () => {
    const d = setFront(setDivisions(d0, d0.root.id, 'y', 1, gen), d0.root.id, { kind: 'sliding', leaves: 2 });
    const r = compute(d, ar, M, HW);
    expect(r.warnings.map((w) => w.code)).toEqual(['front_collision']);
    expect(r.warnings[0]!.message).toContain('47 mm');
  });

  it('el formato guardado acepta puertas corredizas y herrajes elegidos', () => {
    const d = { ...sliding, hardware: { sliding: 'hw-corredizo-3', hinge: 'hw-bisagra-codo9' } };
    expect(designSchema.parse(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it('sin biblioteca usa las medidas típicas y no lista herrajes', () => {
    const r = compute(sliding, with_(ar, undefined), M);
    expect(r.parts.filter((p) => p.role === 'door')).toHaveLength(2);
    expect(r.hardware).toEqual([]);
  });
});
