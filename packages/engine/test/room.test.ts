import { describe, expect, it } from 'vitest';
import {
  analyzeRoom,
  floorAreaM2,
  footprint,
  mm,
  moveCorner,
  outerCorners,
  rectRoom,
  removeCorner,
  roomPlanSchema,
  selfIntersects,
  setCornerAngle,
  setWallLength,
  slideOpening,
  alongWall,
  snapToWall,
  splitWall,
  wallPieces,
  walls,
  type Placement,
  type RoomPlan,
} from '../src';

let n = 0;
const gen = () => 'r' + ++n;
/** Redondea y normaliza −0 a 0. */
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d + 0;
const mmOf = (v: number) => round(v / 100);
const BAJO = { w: mm(600), h: mm(860), d: mm(560) };

describe('planta rectangular', () => {
  const plan = rectRoom(mm(3000), mm(2500), gen);
  const ws = walls(plan);

  it('cuatro paredes a escuadra con su largo', () => {
    expect(ws.map((w) => mmOf(w.length))).toEqual([3000, 2500, 3000, 2500]);
    expect(ws.map((w) => round(w.angleAtStart))).toEqual([90, 90, 90, 90]);
    expect(floorAreaM2(plan)).toBeCloseTo(7.5, 9);
  });

  it('la normal de cada pared apunta hacia dentro', () => {
    expect(ws.map((w) => [round(w.inward.x), round(w.inward.y)])).toEqual([
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 0],
    ]);
  });

  it('el formato guardado lo acepta', () => {
    expect(roomPlanSchema.parse(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
  });
});

describe('ambiente fuera de escuadra, cargado como se mide en obra', () => {
  it('una esquina a 92°: las paredes medidas conservan su largo y la última cierra sola', () => {
    const p = setCornerAngle(rectRoom(mm(3000), mm(2500), gen), 1, 92);
    const ws = walls(p);
    expect(round(ws[1]!.angleAtStart)).toBe(92);
    expect(ws.slice(0, 3).map((w) => mmOf(w.length))).toEqual([3000, 2500, 3000]);
    // La pared 1 se abre 2° hacia fuera: su extremo se corre 2500 · sin(2°) = 87,25 mm.
    expect(mmOf(p.corners[2]!.x)).toBe(round(3000 + 2500 * Math.sin((2 * Math.PI) / 180)));
    // Los cuatro ángulos de un cuadrilátero suman 360°.
    expect(round(ws.reduce((s, w) => s + w.angleAtStart, 0), 1)).toBe(360);
  });

  it('cambiar el largo de una pared conserva las demás medidas tal como se midieron', () => {
    // Pared de arriba a 3200 y la de abajo sigue en 3000 (así se midió): el ambiente deja de ser
    // rectangular y la pared izquierda, que cierra, sale inclinada: √(2500² + 200²) = 2507,99 mm.
    const p = setWallLength(rectRoom(mm(3000), mm(2500), gen), 0, mm(3200));
    const ws = walls(p);
    expect(ws.map((w) => mmOf(w.length))).toEqual([3200, 2500, 3000, round(Math.hypot(2500, 200))]);
    expect(ws.slice(1, 3).map((w) => round(w.angleAtStart))).toEqual([90, 90]);
  });

  it('la última pared y la primera esquina no se editan: salen del cierre', () => {
    const p = rectRoom(mm(3000), mm(2500), gen);
    expect(setWallLength(p, 3, mm(1000))).toBe(p);
    expect(setCornerAngle(p, 0, 95)).toBe(p);
  });
});

describe('editar esquinas', () => {
  it('partir una pared agrega una esquina a 180° sin cambiar la forma', () => {
    const p = splitWall(rectRoom(mm(3000), mm(2500), gen), 0, gen);
    const ws = walls(p);
    expect(ws).toHaveLength(5);
    expect(ws.map((w) => mmOf(w.length))).toEqual([1500, 1500, 2500, 3000, 2500]);
    expect(round(ws[1]!.angleAtStart)).toBe(180);
    expect(floorAreaM2(p)).toBeCloseTo(7.5, 9);
  });

  it('una L: partir la pared de abajo dos veces y mover dos esquinas', () => {
    let p = splitWall(rectRoom(mm(4000), mm(3000), gen), 2, gen);
    p = splitWall(p, 2, gen);
    // Esquinas: (0,0) (4000,0) (4000,3000) (3000,3000) (2000,3000) (0,3000)
    p = moveCorner(p, 2, mm(4000), mm(1500));
    p = moveCorner(p, 3, mm(2000), mm(1500));
    // Queda: (0,0) (4000,0) (4000,1500) (2000,1500) (2000,3000) (0,3000)
    expect(selfIntersects(p)).toBe(false);
    expect(floorAreaM2(p)).toBeCloseTo(4 * 1.5 + 2 * 1.5, 9);
    expect(walls(p).map((w) => round(w.angleAtStart))).toEqual([90, 90, 90, 270, 90, 90]);
    // Quitar una esquina a 180° no cambia nada más.
    expect(walls(removeCorner(splitWall(p, 0, gen), 1))).toHaveLength(6);
  });

  it('detecta paredes que se cruzan (moño)', () => {
    let p = rectRoom(mm(3000), mm(2500), gen);
    p = moveCorner(p, 2, 0, mm(2500));
    p = moveCorner(p, 3, mm(3000), mm(2500));
    expect(selfIntersects(p)).toBe(true);
    expect(selfIntersects(rectRoom(mm(3000), mm(2500), gen))).toBe(false);
  });
});

describe('muebles colocados', () => {
  const plan = rectRoom(mm(3000), mm(2500), gen);
  const place = (over: Partial<Placement> = {}): Placement => ({ id: gen(), cabinetId: 'bajo', x: mm(500), y: mm(300), rotation: 0, elevation: 0, ...over });

  it('la huella de un bajo de 600 × 560 sin girar', () => {
    expect(footprint(place({ x: 0, y: 0 }), BAJO).map((q) => [mmOf(q.x), mmOf(q.y)])).toEqual([
      [0, 0],
      [600, 0],
      [600, 560],
      [0, 560],
    ]);
  });

  it('arrimar a la pared de arriba: espalda contra la pared, misma posición a lo largo', () => {
    const p = snapToWall(plan, place(), BAJO, 0);
    expect([mmOf(p.x), mmOf(p.y), p.rotation]).toEqual([500, 0, 0]);
  });

  it('arrimar a la pared derecha: gira 90° y queda dentro, sin pasarse del extremo', () => {
    const p = snapToWall(plan, place({ x: mm(2900), y: mm(2400) }), BAJO, 1);
    expect(p.rotation).toBe(90);
    expect(footprint(p, BAJO).map((q) => [mmOf(q.x), mmOf(q.y)])).toEqual([
      [3000, 1900],
      [3000, 2500],
      [2440, 2500],
      [2440, 1900],
    ]);
  });

  it('sin avisos si están bien colocados; los que se pisan, avisan', () => {
    const a = snapToWall(plan, place({ x: 0 }), BAJO, 0);
    const b = snapToWall(plan, place({ x: mm(600) }), BAJO, 0);
    expect(analyzeRoom({ ...plan, placements: [a, b] }, { bajo: BAJO })).toEqual([]);
    const bad: RoomPlan = { ...plan, placements: [a, { ...b, x: mm(400) }] };
    expect(analyzeRoom(bad, { bajo: BAJO }, { bajo: 'Bajo 600' }).map((w) => w.code)).toEqual(['overlap']);
  });

  it('una alacena encima de un bajo no se pisa con él', () => {
    const a = snapToWall(plan, place({ x: 0 }), BAJO, 0);
    const alacena = { ...a, id: gen(), cabinetId: 'alacena', elevation: mm(1450) };
    expect(analyzeRoom({ ...plan, placements: [a, alacena] }, { bajo: BAJO, alacena: { w: mm(600), h: mm(700), d: mm(320) } })).toEqual([]);
  });

  it('fuera del ambiente', () => {
    expect(analyzeRoom({ ...plan, placements: [place({ x: mm(-100) })] }, { bajo: BAJO }).map((w) => w.code)).toContain('outside');
  });

  it('mueble que ya no existe en el proyecto', () => {
    expect(analyzeRoom({ ...plan, placements: [place({ cabinetId: 'borrado' })] }, {}).map((w) => w.code)).toEqual(['missing_cabinet']);
  });
});

describe('esquina fuera de escuadra con un mueble', () => {
  // Pared izquierda inclinada: de (−50, 2500) abajo a (0, 0) arriba. A 560 mm de la pared de
  // arriba, la pared izquierda está 50 · 560 / 2500 = 11,2 mm más a la izquierda.
  const plan: RoomPlan = {
    ...rectRoom(mm(3000), mm(2500), gen),
    corners: [
      { id: 'c0', x: 0, y: 0 },
      { id: 'c1', x: mm(3000), y: 0 },
      { id: 'c2', x: mm(3000), y: mm(2500) },
      { id: 'c3', x: mm(-50), y: mm(2500) },
    ],
  };
  const bajo: Placement = { id: 'p', cabinetId: 'bajo', x: 0, y: 0, rotation: 0, elevation: 0 };

  it('avisa del relleno cónico: 0 mm atrás y 11,2 mm adelante', () => {
    const r = analyzeRoom({ ...plan, placements: [bajo] }, { bajo: BAJO }, { bajo: 'Bajo 600' });
    expect(r.map((w) => w.code)).toEqual(['out_of_square']);
    expect(mmOf(r[0]!.gap!.back)).toBe(0);
    expect(round(r[0]!.gap!.front / 100, 1)).toBe(11.2);
    expect(r[0]!.message).toContain('a 11,2 mm de la pared adelante');
  });

  it('si la pared se mete hacia dentro, el mueble la pisa adelante', () => {
    const inward: RoomPlan = { ...plan, corners: plan.corners.map((c) => (c.id === 'c3' ? { ...c, x: mm(50) } : c)) };
    const r = analyzeRoom({ ...inward, placements: [bajo] }, { bajo: BAJO }, { bajo: 'Bajo 600' });
    const oos = r.find((w) => w.code === 'out_of_square')!;
    expect(oos.message).toContain('metido 11,2 mm en la pared adelante');
    expect(r.map((w) => w.code)).toContain('outside');
  });
});

describe('aberturas', () => {
  const base = rectRoom(mm(3000), mm(2500), gen);
  const wall0 = base.corners[0]!.id;
  const bajo: Placement = { id: 'p', cabinetId: 'bajo', x: mm(1000), y: 0, rotation: 0, elevation: 0 };

  it('un bajo delante de una puerta', () => {
    const plan: RoomPlan = { ...base, openings: [{ id: 'o', wallId: wall0, kind: 'door', offset: mm(1200), width: mm(800), height: mm(2050), sill: 0 }], placements: [bajo] };
    expect(analyzeRoom(plan, { bajo: BAJO }).map((w) => w.code)).toEqual(['blocks_door']);
  });

  it('ventana con antepecho a 1 m: el bajo de 860 pasa por debajo; una columna la tapa', () => {
    const plan: RoomPlan = { ...base, openings: [{ id: 'o', wallId: wall0, kind: 'window', offset: mm(1200), width: mm(1000), height: mm(1100), sill: mm(1000) }], placements: [bajo] };
    expect(analyzeRoom(plan, { bajo: BAJO })).toEqual([]);
    expect(analyzeRoom(plan, { bajo: { ...BAJO, h: mm(2100) } }).map((w) => w.code)).toEqual(['blocks_window']);
  });

  it('una abertura más larga que su pared', () => {
    const plan: RoomPlan = { ...base, openings: [{ id: 'o', wallId: wall0, kind: 'window', offset: mm(2500), width: mm(1000), height: mm(1000), sill: mm(900) }] };
    expect(analyzeRoom(plan, {}).map((w) => w.code)).toEqual(['opening_too_wide']);
  });
});

describe('paredes con espesor', () => {
  it('esquinas exteriores a inglete: en un rectángulo, 15 cm hacia fuera en cada eje', () => {
    const plan = rectRoom(mm(3000), mm(2500), gen);
    expect(outerCorners(plan).map((q) => [mmOf(q.x), mmOf(q.y)])).toEqual([
      [-150, -150],
      [3150, -150],
      [3150, 2650],
      [-150, 2650],
    ]);
  });

  it('una esquina a 180° no se desplaza más que el espesor', () => {
    const plan = splitWall(rectRoom(mm(3000), mm(2500), gen), 0, gen);
    const q = outerCorners(plan)[1]!;
    expect([mmOf(q.x), mmOf(q.y)]).toEqual([1500, -150]);
  });

  it('trozos de pared: puerta (dintel) y ventana (dintel y antepecho)', () => {
    const base = rectRoom(mm(3000), mm(2500), gen);
    const plan: RoomPlan = {
      ...base,
      openings: [
        { id: 'v', wallId: base.corners[0]!.id, kind: 'window', offset: mm(1000), width: mm(1000), height: mm(1100), sill: mm(1000) },
        { id: 'p', wallId: base.corners[2]!.id, kind: 'door', offset: mm(500), width: mm(800), height: mm(2050), sill: 0 },
      ],
    };
    const pieces = wallPieces(plan);
    const wall0 = pieces.filter((p) => p.wallIndex === 0).map((p) => [mmOf(p.quad[0].x), mmOf(p.quad[1].x), mmOf(p.y0), mmOf(p.y1)]);
    expect(wall0).toEqual([
      [0, 1000, 0, 2600],
      [1000, 2000, 2100, 2600],
      [1000, 2000, 0, 1000],
      [2000, 3000, 0, 2600],
    ]);
    // Pared 2 (de derecha a izquierda): macizo, dintel de la puerta (sin antepecho) y macizo.
    expect(pieces.filter((p) => p.wallIndex === 2)).toHaveLength(3);
    expect(pieces.filter((p) => p.wallIndex === 1 || p.wallIndex === 3)).toHaveLength(2);
  });
});

describe('deslizar una abertura por su pared', () => {
  // Pared 0 de 3000; una puerta de 800 a 500 del inicio y una ventana de 1000 a 1800.
  const base = rectRoom(mm(3000), mm(2500), gen);
  const w0 = walls(base)[0]!;
  const plan: RoomPlan = {
    ...base,
    openings: [
      { id: 'p', wallId: w0.id, kind: 'door', offset: mm(500), width: mm(800), height: mm(2050), sill: 0 },
      { id: 'v', wallId: w0.id, kind: 'window', offset: mm(1800), width: mm(1000), height: mm(1000), sill: mm(900) },
    ],
  };
  const off = (pl: RoomPlan, id: string) => mmOf(pl.openings.find((o) => o.id === id)!.offset);

  it('se mueve a donde se pide si entra', () => {
    expect(off(slideOpening(plan, 'p', mm(700)), 'p')).toBe(700);
  });

  it('no sale de la pared: queda pegada al inicio o al final', () => {
    expect(off(slideOpening(plan, 'p', mm(-300)), 'p')).toBe(0);
    expect(off(slideOpening(plan, 'v', mm(2500)), 'v')).toBe(2000);
  });

  it('no se encima con otra abertura: queda pegada a ella', () => {
    // La puerta (800) no puede pasar de 1800 − 800 = 1000.
    expect(off(slideOpening(plan, 'p', mm(1300)), 'p')).toBe(1000);
    // La ventana no puede bajar de 500 + 800 = 1300.
    expect(off(slideOpening(plan, 'v', mm(1100)), 'v')).toBe(1300);
  });

  it('si se pide del otro lado de la vecina y ahí entra, salta al otro lado', () => {
    // Pidiendo 2100 para la puerta: el tramo libre después de la ventana empieza en 2800 y no entra
    // (3000 − 800 = 2200 < 2800); el lugar libre más cercano es 1000.
    expect(off(slideOpening(plan, 'p', mm(2100)), 'p')).toBe(1000);
    // La ventana, pidiendo 0: antes de la puerta no entra (500 < 1000); queda en 1300.
    expect(off(slideOpening(plan, 'v', 0), 'v')).toBe(1300);
    // Sin la ventana en el medio, la puerta sí puede ir al final.
    const solo = { ...plan, openings: plan.openings.filter((o) => o.id === 'p') };
    expect(off(slideOpening(solo, 'p', mm(2600)), 'p')).toBe(2200);
  });

  it('en una pared fuera de escuadra sigue la pared', () => {
    // Se corre la esquina 2 (fin de la pared 1): la pared 1 queda inclinada y más larga.
    const skew = moveCorner(base, 2, mm(3400), mm(2500));
    const w1 = walls(skew)[1]!;
    const pl: RoomPlan = { ...skew, openings: [{ id: 'x', wallId: w1.id, kind: 'window', offset: 0, width: mm(600), height: mm(1000), sill: mm(900) }] };
    const moved = slideOpening(pl, 'x', mm(5000));
    expect(moved.openings[0]!.offset).toBe(Math.floor(w1.length) - mm(600));
    expect(mmOf(w1.length)).toBeCloseTo(2531.8, 1);
    // Un punto sobre la pared a 1000 de su inicio se proyecta a 1000.
    const p = { x: w1.a.x + w1.dir.x * mm(1000), y: w1.a.y + w1.dir.y * mm(1000) };
    expect(mmOf(alongWall(w1, p))).toBe(1000);
  });

  it('una abertura que no existe no cambia nada', () => {
    expect(slideOpening(plan, 'nada', mm(100))).toBe(plan);
  });
});

