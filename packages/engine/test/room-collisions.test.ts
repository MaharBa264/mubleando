import { describe, expect, it } from 'vitest';
import {
  analyzeRoom,
  compute,
  doorSwing,
  mm,
  newDesign,
  placementCollides,
  PRESET_HARDWARE,
  PRESET_MATERIALS,
  PRESET_METHODS,
  rectRoom,
  roomSize,
  setFront,
  snapToNeighbor,
  type CabinetSize,
  type Design,
  type Placement,
  type RoomPlan,
} from '../src';

/**
 * Choques en el ambiente. Planta de 3000 × 2500; con giro 0 el mueble tiene la espalda contra la
 * pared de arriba (y = 0) y mira hacia +y. Medidas en 1/100 mm.
 */
let n = 0;
const gen = () => 'c' + ++n;
const base = rectRoom(mm(3000), mm(2500), gen);
const BAJO: CabinetSize = { w: mm(600), h: mm(860), d: mm(560) };
const at = (id: string, x: number, y: number, o: Partial<Placement> = {}): Placement => ({ id, cabinetId: id, x: mm(x), y: mm(y), rotation: 0, elevation: 0, ...o });
const plan = (...placements: Placement[]): RoomPlan => ({ ...base, placements });
const codes = (pl: RoomPlan, sizes: Record<string, CabinetSize>) => analyzeRoom(pl, sizes).map((w) => w.code);

describe('pegar un mueble al de al lado', () => {
  const sizes = { a: BAJO, b: BAJO, alta: BAJO };
  const A = at('a', 0, 0);

  it('a 50 mm del costado y 30 mm corrido hacia adelante: se junta costado con costado y espalda con espalda', () => {
    const r = snapToNeighbor(plan(A, at('b', 650, 30)), at('b', 650, 30), sizes);
    expect([r.x, r.y, r.rotation]).toEqual([mm(600), 0, 0]);
  });
  it('del otro lado también (el que se mueve queda a la izquierda)', () => {
    const B = at('b', 1000, 0);
    const r = snapToNeighbor(plan(B, at('a', 380, 20)), at('a', 380, 20), sizes);
    expect([r.x, r.y]).toEqual([mm(400), 0]);
  });
  it('lejos (300 mm), girado distinto o a otra altura: no se pega', () => {
    expect(snapToNeighbor(plan(A, at('b', 900, 0)), at('b', 900, 0), sizes)).toEqual(at('b', 900, 0));
    expect(snapToNeighbor(plan(A, at('b', 650, 0, { rotation: 90 })), at('b', 650, 0, { rotation: 90 }), sizes).rotation).toBe(90);
    const high = at('alta', 650, 0, { elevation: mm(1400) });
    expect(snapToNeighbor(plan(A, high), high, sizes)).toEqual(high);
  });
});

describe('¿choca?', () => {
  const sizes = { a: BAJO, b: BAJO };
  it('pisando 50 mm al de al lado: sí; tocándolo: no', () => {
    expect(placementCollides(plan(at('a', 0, 0), at('b', 550, 0)), 'b', sizes)).toBe(true);
    expect(placementCollides(plan(at('a', 0, 0), at('b', 600, 0)), 'b', sizes)).toBe(false);
  });
  it('atravesando la pared: sí', () => {
    expect(placementCollides(plan(at('a', -100, 0)), 'a', sizes)).toBe(true);
  });
  it('una alacena a 1400 sobre un bajo de 860: no', () => {
    expect(placementCollides(plan(at('a', 0, 0), at('b', 0, 0, { elevation: mm(1400) })), 'b', sizes)).toBe(false);
  });
});

describe('patas inclinadas', () => {
  // Sobresalen 26,39 mm por lado (ver legs.test.ts), en los 200 mm de abajo.
  const LEGS: CabinetSize = { ...BAJO, overhang: { left: 2639, right: 2639, back: 2639, front: 2639 }, legHeight: mm(200) };

  it('dos muebles con patas inclinadas, costado con costado: las patas se pisan', () => {
    const w = analyzeRoom(plan(at('a', 100, 100), at('b', 700, 100)), { a: LEGS, b: LEGS });
    expect(w.map((x) => x.message)).toEqual(['Las patas de a o de b se pisan con el otro mueble.'.replace('a o de b', 'Un mueble o de Un mueble')]);
  });
  it('separados 60 mm (más que 2 × 26,39): no', () => {
    expect(codes(plan(at('a', 100, 100), at('b', 760, 100)), { a: LEGS, b: LEGS })).toEqual([]);
  });
  it('contra la pared, las patas la atraviesan; a 30 mm, no', () => {
    expect(codes(plan(at('a', 100, 0)), { a: LEGS })).toEqual(['outside']);
    expect(codes(plan(at('a', 100, 30)), { a: LEGS })).toEqual([]);
  });
  it('una alacena encima de las patas (a 1400) no choca con ellas', () => {
    expect(codes(plan(at('a', 100, 100), at('b', 700, 100, { elevation: mm(1400) })), { a: LEGS, b: LEGS })).toEqual([]);
  });
});

describe('puertas que golpean al abrirse', () => {
  // Bajo de 600 con una puerta de 597 (bisagras a la izquierda), de 3 a 720 de alto.
  const DOOR: CabinetSize = { ...BAJO, doors: [{ x0: 150, width: mm(597), y0: mm(3), y1: mm(720), hinge: 'left' }] };

  it('la zona que barre: un cuarto de círculo de radio 597 desde la bisagra, en el frente', () => {
    const s = doorSwing(at('a', 0, 0), DOOR, DOOR.doors![0]!);
    expect(s[0]).toEqual({ x: 150, y: mm(560) });
    expect(s[1]!.x).toBeCloseTo(150 + mm(597), 6); // cerrada: a lo ancho
    expect(s[9]!.y).toBeCloseTo(mm(560 + 597), 6); // abierta 90°: hacia adelante
  });
  it('en una planta de 2500 de fondo abre libre; en una de 1000, golpea la pared de enfrente (560 + 597 > 1000)', () => {
    expect(codes(plan(at('a', 0, 0)), { a: DOOR })).toEqual([]);
    const narrow = { ...rectRoom(mm(3000), mm(1000), gen), placements: [at('a', 0, 0)] };
    expect(analyzeRoom(narrow, { a: DOOR }, { a: 'Bajo' }).map((w) => w.message)).toEqual(['Una puerta de Bajo golpea la pared al abrirse.']);
  });
  it('un mueble a 900 delante golpea; si está colgado más arriba que la puerta (1400), no', () => {
    const w = analyzeRoom(plan(at('a', 0, 0), at('b', 0, 900, { rotation: 0 })), { a: DOOR, b: BAJO }, { a: 'Bajo', b: 'Isla' });
    expect(w.map((x) => x.message)).toContain('Una puerta de Bajo golpea a Isla al abrirse.');
    expect(codes(plan(at('a', 0, 0), at('b', 0, 900, { elevation: mm(1400) })), { a: DOOR, b: BAJO })).toEqual([]);
  });
});

describe('medidas para el ambiente a partir del motor', () => {
  const ar = PRESET_METHODS.find((m) => m.id === 'ar-18-ranura')!;
  it('patas que suman al alto (1010), su alto y una puerta por hoja (las de marco y vidrio, una sola)', () => {
    let d: Design = { ...newDesign({ w: mm(800), h: mm(860), d: mm(560) }, gen), legs: { hardwareId: 'hw-pata-recta-cuadrada', includeInHeight: false } };
    d = setFront(d, d.root.id, { kind: 'door', leaves: 2, hinge: 'left', mount: 'overlay', glass: { type: 'frame', glassId: 'ar-vidrio-incoloro-4', frameWidth: mm(60), rebate: mm(8), clearance: mm(1.5) } });
    const s = roomSize(d, compute(d, ar, PRESET_MATERIALS, PRESET_HARDWARE));
    expect([s.h, s.legHeight]).toEqual([mm(1010), mm(150)]);
    expect(s.overhang).toEqual({ left: 0, right: 0, back: 0, front: 0 });
    expect(s.doors!.map((x) => x.hinge)).toEqual(['left', 'right']);
  });
});
