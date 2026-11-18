import { describe, expect, it } from 'vitest';
import {
  compute,
  designSchema,
  mm,
  newDesign,
  PRESET_MATERIALS,
  PRESET_METHODS,
  setConstruction,
  setDivisions,
  setFront,
  setOverride,
  setPlinth,
  setShelfHeight,
  type Design,
  type Part,
} from '../src';

/**
 * Cómo se arma la caja (tapa, base, fondo, travesaños) y cambios de una pieza suelta.
 * Bajo de 600 × 860 × 560 con el método argentino (melamina 18, fondo 3 en ranura de 8 a 15 mm,
 * holgura 1, tapacanto 0,45 sin descontar). Cifras calculadas a mano.
 */
let n = 0;
const gen = () => `c${++n}`;
const M = PRESET_MATERIALS;
const ar = PRESET_METHODS.find((m) => m.id === 'ar-18-ranura')!;
const mmOf = (v: number) => v / 100;
const base = (): Design => newDesign({ w: mm(600), h: mm(860), d: mm(560) }, gen);
const get = (parts: Part[], key: string) => parts.find((p) => p.key === key);
const box = (p: Part | undefined) => (p ? [p.box.x, p.box.y, p.box.dx, p.box.dy].map(mmOf) : null);
const run = (d: Design) => {
  const r = compute(d, ar, M);
  expect(r.warnings).toEqual([]);
  return r;
};

describe('tapa', () => {
  it('por defecto, entre los costados: tapa 564 y costados enteros de 860', () => {
    const r = run(base());
    expect(mmOf(get(r.parts, 'top')!.length)).toBe(564);
    expect(box(get(r.parts, 'side.left'))).toEqual([0, 0, 18, 860]);
  });

  it('encima de los costados: tapa de 600 con tapacanto en las puntas, costados de 842', () => {
    const r = run(setConstruction(base(), { top: 'over' }));
    const top = get(r.parts, 'top')!;
    expect(box(top)).toEqual([0, 842, 600, 18]);
    expect([mmOf(top.cutLength), mmOf(top.cutWidth)]).toEqual([600, 560]);
    expect(top.edges).toEqual({ L1: 'ar-tc-blanco-045', L2: null, W1: 'ar-tc-blanco-045', W2: 'ar-tc-blanco-045' });
    expect(box(get(r.parts, 'side.right'))).toEqual([582, 0, 18, 842]);
  });

  it('travesaños: dos piezas de 564 × 100 en lugar de tapa; solo la delantera con tapacanto', () => {
    const r = run(setConstruction(base(), { top: 'rails' }));
    expect(get(r.parts, 'top')).toBeUndefined();
    const front = get(r.parts, 'top.rail.front')!;
    const rear = get(r.parts, 'top.rail.back')!;
    expect([mmOf(front.length), mmOf(front.width)]).toEqual([564, 100]);
    expect(front.box.z).toBe(mm(460));
    expect(front.edges.L1).toBe('ar-tc-blanco-045');
    expect(rear.box.z).toBe(0);
    expect(rear.edges.L1).toBeNull();
    // el hueco interior sigue terminando debajo de los travesaños
    expect(r.zones[0]!.box.dy).toBe(mm(824));
  });

  it('travesaños de otro ancho', () => {
    const r = run(setConstruction(base(), { top: 'rails', railWidth: mm(80) }));
    expect(mmOf(get(r.parts, 'top.rail.front')!.width)).toBe(80);
  });

  it('sin tapa: el fondo solo entra en la ranura de la base (849 de alto) y la puerta queda 1,5 mm por debajo del borde', () => {
    const plain = setConstruction(base(), { top: 'none' });
    const withDoor = setFront(plain, plain.root.id, { kind: 'door', leaves: 1, hinge: 'left', mount: 'overlay' });
    const r = run(withDoor);
    expect(r.parts.some((p) => p.role === 'top')).toBe(false);
    const back = get(r.parts, 'back')!;
    expect([mmOf(back.length), mmOf(back.box.y)]).toEqual([849, 11]);
    expect(r.zones[0]!.box.dy).toBe(mm(842));
    const door = r.parts.find((p) => p.role === 'door')!;
    expect([mmOf(door.box.y), mmOf(door.length)]).toEqual([1.5, 857]);
  });
});

describe('base', () => {
  it('debajo de los costados: base de 600 en el piso, costados desde 18', () => {
    const r = run(setConstruction(base(), { bottom: 'under' }));
    expect(box(get(r.parts, 'bottom'))).toEqual([0, 0, 600, 18]);
    expect(box(get(r.parts, 'side.left'))).toEqual([0, 18, 18, 842]);
    expect(r.zones[0]!.box.y).toBe(mm(18));
  });

  it('tapa encima y base debajo: costados de 824', () => {
    const r = run(setConstruction(base(), { top: 'over', bottom: 'under' }));
    expect(box(get(r.parts, 'side.left'))).toEqual([0, 18, 18, 824]);
  });

  it('con zócalo y base debajo: la base sube a 100, los costados empiezan en 118 y el zócalo va de lado a lado', () => {
    const r = run(setConstruction(setPlinth(base(), { height: mm(100), setback: mm(50) }), { bottom: 'under' }));
    expect(box(get(r.parts, 'bottom'))).toEqual([0, 100, 600, 18]);
    expect(box(get(r.parts, 'side.left'))).toEqual([0, 118, 18, 742]);
    expect(box(get(r.parts, 'plinth'))).toEqual([0, 0, 600, 100]);
  });
});

describe('fondo', () => {
  it('sin fondo: no hay pieza y el hueco llega hasta atrás (estante de 540)', () => {
    const d0 = setConstruction(base(), { back: 'none' });
    const r = run(setDivisions(d0, d0.root.id, 'y', 1, gen));
    expect(get(r.parts, 'back')).toBeUndefined();
    expect(r.zones[0]!.box.z).toBe(0);
    expect(mmOf(r.parts.find((p) => p.role === 'shelf')!.width)).toBe(540);
  });
});

describe('pieza suelta', () => {
  it('retranqueo propio de un estante: 50 mm → 492 de fondo; los demás siguen con el del método', () => {
    const d0 = base();
    const d1 = setDivisions(d0, d0.root.id, 'y', 2, gen);
    const d = setOverride(d1, `zone:${d0.root.id}/div0`, { frontSetback: mm(50) });
    const r = run(d);
    const [s1, s2] = r.parts.filter((p) => p.role === 'shelf');
    expect(mmOf(s1!.width)).toBe(492);
    expect(mmOf(s2!.width)).toBe(522);
    expect(s1!.overridden).toBe(true);
  });

  it('estante a una altura exacta: el segundo de tres niveles, a 500 mm del piso del hueco', () => {
    const d0 = base();
    const d1 = setDivisions(d0, d0.root.id, 'y', 2, gen);
    const before = run(d1);
    const current = before.zones.filter((z) => z.parentId === d0.root.id).sort((a, b) => a.index - b.index).map((z) => z.box.dy);
    expect(current).toEqual([26267, 26267, 26266]);
    const d = setShelfHeight(d1, d0.root.id, 1, mm(500), mm(18), current);
    expect(d.root.split!.sizes).toEqual([26267, 21933, null]);
    const r = run(d);
    const shelf2 = r.parts.filter((p) => p.role === 'shelf')[1]!;
    expect(shelf2.box.y - r.zones[0]!.box.y).toBe(mm(500));
  });
});

describe('edición', () => {
  it('volver a lo habitual quita la construcción del diseño; el formato la acepta', () => {
    const d = setConstruction(base(), { top: 'rails', railWidth: mm(90), bottom: 'under', back: 'none' });
    expect(designSchema.parse(JSON.parse(JSON.stringify(d)))).toEqual(d);
    const back = setConstruction(setConstruction(d, { top: 'between', bottom: 'between' }), { back: 'method' });
    expect(back.construction).toBeUndefined();
  });

  it('el ancho de travesaño se olvida si ya no hay travesaños', () => {
    const d = setConstruction(setConstruction(base(), { top: 'rails', railWidth: mm(90) }), { top: 'over' });
    expect(d.construction).toEqual({ top: 'over' });
  });
});
