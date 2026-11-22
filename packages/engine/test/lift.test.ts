import { describe, expect, it } from 'vitest';
import {
  analyzeRoom,
  compute,
  designSchema,
  hardwareSchema,
  mm,
  newDesign,
  PRESET_HARDWARE,
  PRESET_MATERIALS,
  PRESET_METHODS,
  rectRoom,
  roomSize,
  setFront,
  weightPerM2,
  type DoorFront,
  type Hardware,
} from '../src';

/**
 * Puertas que abren hacia arriba (alacenas, con pistón o brazo) o hacia abajo (tapas de escritorio,
 * con compás). Método argentino: melamina de 18 (12,6 kg/m² estimado por el espesor) y 3 mm de
 * holgura entre frentes, así que la puerta mide el mueble menos 3 mm.
 */
let n = 0;
const gen = () => 'l' + ++n;
const ar = PRESET_METHODS.find((m) => m.id === 'ar-18-ranura')!;
const M = PRESET_MATERIALS;
const HW = PRESET_HARDWARE;
const mmOf = (v: number) => Math.round(v) / 100;
const cab = (w: number, h: number, d: number, front: Partial<DoorFront>) => {
  const d0 = newDesign({ w: mm(w), h: mm(h), d: mm(d) }, gen);
  return setFront(d0, d0.root.id, { kind: 'door', leaves: 1, hinge: 'left', mount: 'overlay', ...front });
};
const lifts = (r: ReturnType<typeof compute>) => r.hardware.filter((h) => h.kind === 'lift').map((h) => [h.hardwareId, h.qty, h.note]);

describe('de partida', () => {
  it('cuatro pistones (60 a 120 N), un brazo con freno y un compás, válidos', () => {
    const l = HW.filter((h): h is Extract<Hardware, { kind: 'lift' }> => h.kind === 'lift');
    expect(l.map((h) => [h.id, h.spec.type, h.spec.direction, h.spec.minWeight, h.spec.maxWeight])).toEqual([
      ['hw-piston-60', 'gas', 'up', 1.5, 3],
      ['hw-piston-80', 'gas', 'up', 3, 4.5],
      ['hw-piston-100', 'gas', 'up', 4.5, 6],
      ['hw-piston-120', 'gas', 'up', 6, 7.5],
      ['hw-brazo-freno', 'stay', 'up', 1, 6],
      ['hw-compas-freno', 'flap', 'down', 0.5, 8],
    ]);
    for (const h of l) expect(hardwareSchema.parse(h)).toEqual(h);
  });
  it('el formato guardado acepta puertas que abren hacia arriba, con herraje elegido', () => {
    const d = cab(900, 400, 330, { opens: 'up', liftId: 'hw-brazo-freno' });
    expect(designSchema.parse(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it('peso por m²: el cargado o 0,7 kg por mm de tablero y 2,5 por mm de vidrio', () => {
    expect(weightPerM2({ kind: 'panel', thickness: mm(18) })).toBeCloseTo(12.6, 6);
    expect(weightPerM2({ kind: 'glass', thickness: mm(4) })).toBeCloseTo(10, 6);
    expect(weightPerM2({ kind: 'panel', thickness: mm(18), weight: 11 })).toBe(11);
  });
});

describe('alacena de 900 × 400 con puerta hacia arriba', () => {
  const r = compute(cab(900, 400, 330, { opens: 'up' }), ar, M, HW);
  const door = r.parts.find((p) => p.role === 'door')!;

  it('una sola puerta de 897 × 397, con las bisagras arriba (2, por el ancho de 897)', () => {
    expect([mmOf(door.width), mmOf(door.length), door.hinge]).toEqual([897, 397, 'top']);
    expect(r.hardware.find((h) => h.kind === 'hinge')?.qty).toBe(2);
  });
  it('pesa 0,897 × 0,397 × 12,6 = 4,49 → 4,5 kg: el par de pistones de 80 N (3 a 4,5 kg), sin avisos', () => {
    expect(lifts(r)).toEqual([['hw-piston-80', 2, 'puerta de 4,5 kg']]);
    expect(r.warnings).toEqual([]);
  });
  it('aunque se pida de dos hojas, hacia arriba va una sola', () => {
    const r2 = compute(cab(900, 400, 330, { opens: 'up', leaves: 2 }), ar, M, HW);
    expect(r2.parts.filter((p) => p.role === 'door').length).toBe(1);
  });
  it('con una melamina cargada de 20 kg/m², pesa 7,1 kg: el de 120 N', () => {
    const heavy = M.map((m) => (m.id === 'ar-mel-blanca-18' ? { ...m, weight: 20 } : m));
    expect(lifts(compute(cab(900, 400, 330, { opens: 'up' }), ar, heavy, HW))).toEqual([['hw-piston-120', 2, 'puerta de 7,1 kg']]);
  });
  it('el herraje elegido se respeta; si no la aguanta o es para abrir hacia abajo, avisa', () => {
    expect(lifts(compute(cab(900, 400, 330, { opens: 'up', liftId: 'hw-brazo-freno' }), ar, M, HW))).toEqual([['hw-brazo-freno', 2, 'puerta de 4,5 kg']]);
    const small = compute(cab(900, 400, 330, { opens: 'up', liftId: 'hw-piston-60' }), ar, M, HW);
    expect(small.warnings.map((w) => w.message)).toEqual(['La puerta pesa 4,5 kg y mide 397 mm de alto: «Pistón a gas 60 N» es para puertas de 1,5 a 3 kg y de 250 a 500 mm.']);
    const wrong = compute(cab(900, 400, 330, { opens: 'up', liftId: 'hw-compas-freno' }), ar, M, HW);
    expect(wrong.warnings.map((w) => w.message)).toEqual(['«Compás con freno para tapa que baja» es para puertas que abren hacia abajo y esta abre hacia arriba.']);
  });
  it('un mueble de 200 de fondo es poco para el pistón (pide 250)', () => {
    const r2 = compute(cab(900, 400, 200, { opens: 'up' }), ar, M, HW);
    expect(r2.warnings.map((w) => w.message)).toEqual(['«Pistón a gas 80 N» necesita un mueble de al menos 250 mm de fondo.']);
  });
  it('1200 × 600: 1,197 × 0,597 × 12,6 = 9 kg y 597 de alto: no hay herraje que la aguante', () => {
    const r2 = compute(cab(1200, 600, 330, { opens: 'up' }), ar, M, HW);
    expect(lifts(r2)).toEqual([]);
    expect(r2.warnings.map((w) => w.message)).toEqual(['La puerta pesa 9 kg y mide 597 mm de alto: ningún herraje de la biblioteca para abrir hacia arriba la aguanta.']);
  });
  it('de vidrio templado: perforaciones a 100 y 797 del costado, a 397 − 17 = 380 desde abajo', () => {
    const g = compute(cab(900, 400, 330, { opens: 'up', glass: { type: 'frameless', glassId: 'ar-vidrio-templado-5', hingeId: 'hw-bisagra-vidrio-26' } }), ar, M, HW);
    const glass = g.parts.find((p) => p.role === 'glass')!;
    expect(glass.holes!.map((h) => [mmOf(h.x), mmOf(h.y)])).toEqual([
      [100, 380],
      [797, 380],
    ]);
    // 0,897 × 0,397 × 12,5 (5 mm de vidrio) = 4,45 → 4,5 kg.
    expect(lifts(g)).toEqual([['hw-piston-80', 2, 'puerta de 4,5 kg']]);
  });
});

describe('tapa que baja', () => {
  it('escritorio de 800 × 400: bisagras abajo y un par de compases, 0,797 × 0,397 × 12,6 = 4 kg', () => {
    const r = compute(cab(800, 400, 400, { opens: 'down' }), ar, M, HW);
    expect(r.parts.find((p) => p.role === 'door')!.hinge).toBe('bottom');
    expect(lifts(r)).toEqual([['hw-compas-freno', 2, 'puerta de 4 kg']]);
  });
});

describe('en el ambiente', () => {
  // La puerta va de 1,5 a 398,5 mm desde abajo del mueble; el pistón abre a 100°: pasa la bisagra
  // 397 × sen 10° = 68,9 mm. Techo de 2600.
  const d = cab(900, 400, 330, { opens: 'up' });
  const size = roomSize(d, compute(d, ar, M, HW), HW);
  const at = (elevation: number) => ({ ...rectRoom(mm(3000), mm(2500), gen), placements: [{ id: 'a', cabinetId: 'a', x: 0, y: 0, rotation: 0, elevation: mm(elevation) }] });

  it('las medidas para el ambiente traen la puerta hacia arriba con el ángulo del pistón', () => {
    expect(size.doors).toEqual([{ x0: 150, width: mm(897), y0: 150, y1: mm(398.5), hinge: 'top', angle: 100 }]);
  });
  it('colgada a 2170 (arriba a 2570) golpea el techo: 2170 + 398,5 + 68,9 = 2637,4, le faltan 38 mm', () => {
    expect(analyzeRoom(at(2170), { a: size }, { a: 'Alacena' }).map((w) => w.message)).toEqual(['La puerta de Alacena golpea el techo al abrirse hacia arriba: le faltan 38 mm.']);
  });
  it('a 2100, no', () => {
    expect(analyzeRoom(at(2100), { a: size }).filter((w) => w.code === 'door_swing')).toEqual([]);
  });
});
