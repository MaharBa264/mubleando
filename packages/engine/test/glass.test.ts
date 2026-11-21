import { describe, expect, it } from 'vitest';
import {
  compute,
  cuttingPlan,
  designSchema,
  glassRows,
  hardwareSchema,
  hingePositions,
  materialSchema,
  mm,
  newDesign,
  PRESET_HARDWARE,
  PRESET_MATERIALS,
  PRESET_METHODS,
  setFront,
  totals,
  type DoorGlass,
  type Hardware,
} from '../src';

/** Puertas con vidrio. Bajo de 600 × 720 × 560, método argentino, una puerta superpuesta. */
let n = 0;
const gen = () => 'g' + ++n;
const ar = PRESET_METHODS.find((m) => m.id === 'ar-18-ranura')!;
const M = PRESET_MATERIALS;
const HW = PRESET_HARDWARE;
const mmOf = (v: number) => Math.round(v) / 100;
const d0 = newDesign({ w: mm(600), h: mm(720), d: mm(560) }, gen);
const withDoor = (glass?: DoorGlass, leaves: 1 | 2 = 1) => setFront(d0, d0.root.id, { kind: 'door', leaves, hinge: 'left', mount: 'overlay', ...(glass ? { glass } : {}) });
const FRAME: DoorGlass = { type: 'frame', glassId: 'ar-vidrio-incoloro-4', frameWidth: mm(60), rebate: mm(8), clearance: mm(1.5) };

// Puerta de tablero de referencia: 597 × 717 (tapa el mueble menos 1,5 mm por lado).
const plain = compute(withDoor(), ar, M, HW).parts.find((p) => p.role === 'door')!;

describe('de partida', () => {
  it('cuatro vidrios (uno templado) y tres bisagras para vidrio, válidos', () => {
    const glass = M.filter((m) => m.kind === 'glass');
    expect(glass.map((m) => [m.name, mmOf(m.thickness), !!m.tempered])).toEqual([
      ['Vidrio incoloro 4', 4, false],
      ['Vidrio esmerilado 4', 4, false],
      ['Vidrio templado incoloro 5', 5, true],
      ['Espejo 4', 4, false],
    ]);
    for (const m of glass) expect(materialSchema.parse(m)).toEqual(m);
    const hinges = HW.filter((h): h is Extract<Hardware, { kind: 'hinge' }> => h.kind === 'hinge' && !!h.spec.forGlass);
    expect(hinges.map((h) => h.spec.forGlass!.mount)).toEqual(['drilled', 'glued', 'clamp']);
    for (const h of hinges) expect(hardwareSchema.parse(h)).toEqual(h);
  });
  it('el formato guardado acepta puertas con vidrio', () => {
    const d = withDoor(FRAME);
    expect(designSchema.parse(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
});

describe('puerta con marco y vidrio', () => {
  const r = compute(withDoor(FRAME), ar, M, HW);
  const door = r.parts.filter((p) => p.role === 'door');
  const glass = r.parts.find((p) => p.role === 'glass')!;

  it('referencia: la puerta de tablero mide 597 × 717', () => {
    expect([mmOf(plain.width), mmOf(plain.length)]).toEqual([597, 717]);
  });

  it('cuatro listones de 60: parantes de 717 y travesaños de 597 − 120 = 477', () => {
    expect(door.map((p) => [p.name, mmOf(p.length), mmOf(p.width)])).toEqual([
      ['Parante izquierdo de la puerta', 717, 60],
      ['Parante derecho de la puerta', 717, 60],
      ['Travesaño de abajo de la puerta', 477, 60],
      ['Travesaño de arriba de la puerta', 477, 60],
    ]);
    expect(r.warnings).toEqual([]);
  });

  it('vidrio = luz del marco + 2 × 8 − 2 × 1,5: 477 + 13 = 490 de ancho y 597 + 13 = 610 de alto, por detrás', () => {
    expect([mmOf(glass.width), mmOf(glass.length), mmOf(glass.thickness)]).toEqual([490, 610, 4]);
    expect(glass.box.z + glass.box.dz).toBe(door[0]!.box.z);
    // Entra 6,5 mm detrás de cada listón (8 de rebaje menos 1,5 de holgura).
    expect(mmOf(glass.box.x - (door[0]!.box.x + mm(60)))).toBe(-6.5);
  });

  it('las piezas de la puerta saben de qué puerta son (para girarla entera en el 3D)', () => {
    for (const p of [...door, glass]) expect(p.doorBox).toEqual(plain.box);
  });

  it('sigue llevando 2 bisagras de cazoleta 35; avisa si el parante es más angosto que la cazoleta', () => {
    expect(r.hardware.find((h) => h.kind === 'hinge')?.qty).toBe(2);
    const narrow = compute(withDoor({ ...FRAME, frameWidth: mm(35) }), ar, M, HW);
    expect(narrow.warnings.map((w) => w.message)).toEqual(['El parante mide 35 mm y la cazoleta de la bisagra necesita 39 mm desde el borde.']);
  });

  it('el vidrio no va en el plano de cortes ni en el tablero del resumen; va en la lista de la vidriería', () => {
    const items = r.parts.map((part) => ({ part }));
    expect(cuttingPlan(items, M).some((p) => p.materialId === 'ar-vidrio-incoloro-4')).toBe(false);
    const t = totals(items, M);
    expect(t.panels.some((p) => p.materialId === 'ar-vidrio-incoloro-4')).toBe(false);
    expect(t.glass.map((g) => [g.materialId, g.pieces])).toEqual([['ar-vidrio-incoloro-4', 1]]);
    expect(glassRows(items, M).map((g) => [g.ref, mmOf(g.length), mmOf(g.width), g.polished, g.holes.length])).toEqual([['V1', 610, 490, false, 0]]);
  });

  it('dos hojas: cada una con su marco y su vidrio, numeradas', () => {
    const r2 = compute(withDoor(FRAME, 2), ar, M, HW);
    expect(r2.parts.filter((p) => p.role === 'glass').map((p) => p.name)).toEqual(['Vidrio puerta 1 (izquierda)', 'Vidrio puerta 2 (derecha)']);
  });

  it('un marco que no deja lugar para el vidrio: puerta entera de tablero, con aviso', () => {
    const r2 = compute(withDoor({ ...FRAME, frameWidth: mm(300) }), ar, M, HW);
    expect(r2.parts.some((p) => p.role === 'glass')).toBe(false);
    expect(r2.warnings[0]!.message).toMatch(/no deja lugar para el vidrio/);
  });
});

describe('puerta entera de vidrio templado', () => {
  const T: DoorGlass = { type: 'frameless', glassId: 'ar-vidrio-templado-5', hingeId: 'hw-bisagra-vidrio-26' };
  const r = compute(withDoor(T), ar, M, HW);
  const g = r.parts.find((p) => p.role === 'glass')!;

  it('el vidrio mide lo que la puerta (597 × 717) y 5 mm de espesor', () => {
    expect([g.name, mmOf(g.width), mmOf(g.length), mmOf(g.thickness)]).toEqual(['Puerta de vidrio', 597, 717, 5]);
    expect(r.parts.some((p) => p.role === 'door')).toBe(false);
    expect(r.warnings).toEqual([]);
  });

  it('perforaciones de 26 a 4 + 13 = 17 mm del borde de las bisagras, a 100 y 617 desde abajo', () => {
    expect(g.holes!.map((h) => [mmOf(h.x), mmOf(h.y), mmOf(h.d)])).toEqual([
      [17, 100, 26],
      [17, 617, 26],
    ]);
    const right = compute(setFront(d0, d0.root.id, { kind: 'door', leaves: 1, hinge: 'right', mount: 'overlay', glass: T }), ar, M, HW);
    expect(mmOf(right.parts.find((p) => p.role === 'glass')!.holes![0]!.x)).toBe(597 - 17);
  });

  it('dos bisagras para vidrio en la lista de herrajes (no las de cazoleta 35)', () => {
    expect(r.hardware.filter((h) => h.kind === 'hinge').map((h) => [h.hardwareId, h.qty])).toEqual([['hw-bisagra-vidrio-26', 2]]);
  });

  it('en la lista de la vidriería: templado, cantos pulidos y con las perforaciones', () => {
    const row = glassRows([{ part: g }], M)[0]!;
    expect([row.tempered, row.polished, row.holes.length]).toEqual([true, true, 2]);
  });

  it('bisagras pegadas o de pinza: sin perforaciones', () => {
    const glued = compute(withDoor({ ...T, hingeId: 'hw-bisagra-vidrio-pegada' }), ar, M, HW).parts.find((p) => p.role === 'glass')!;
    expect(glued.holes).toBeUndefined();
  });

  it('avisa si el vidrio no es templado o no entra en el rango de la bisagra', () => {
    const notT = compute(withDoor({ ...T, glassId: 'ar-vidrio-incoloro-4' }), ar, M, HW);
    expect(notT.warnings.map((w) => w.message)).toEqual(['«Vidrio incoloro 4» no es templado: una puerta entera de vidrio tiene que ser de vidrio templado.']);
    const clamp = compute(withDoor({ ...T, glassId: 'ar-vidrio-incoloro-4', hingeId: 'hw-bisagra-vidrio-pinza' }), ar, M, HW);
    expect(clamp.warnings.map((w) => w.message)).toContain('El vidrio mide 4 mm y la bisagra «Bisagra de pinza para vidrio, sin perforar (vidrio de 5 a 8)» es para vidrio de 5 a 8 mm.');
  });

  it('posiciones de las bisagras: a 100 de las puntas y repartidas (3 en 1200: 100, 600, 1100)', () => {
    const spec = (HW.find((h) => h.id === 'hw-bisagra-vidrio-26') as Extract<Hardware, { kind: 'hinge' }>).spec;
    expect(hingePositions(spec, mm(1200)).map(mmOf)).toEqual([100, 600, 1100]);
    expect(hingePositions(spec, mm(300)).map(mmOf)).toEqual([75, 225]);
  });
});
