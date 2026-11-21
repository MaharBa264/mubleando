import { describe, expect, it } from 'vitest';
import {
  compute,
  designSchema,
  findZone,
  methodSchema,
  mm,
  newDesign,
  normalizeMethod,
  REFERENCE_MATERIALS,
  REFERENCE_METHODS,
  setDivisions,
  setDrawerCount,
  setDrawerSize,
  setFront,
  setOverride,
  setPlinth,
  type Design,
  type Method,
  type Part,
} from '../src';

// Todas las cifras de este archivo están calculadas a mano en docs/motor.md (bajo de 600 × 720 × 560, método estándar).
let counter = 0;
const gen = () => `f${++counter}`;
const M = REFERENCE_MATERIALS;
const groove = REFERENCE_METHODS[0]!;
const clavada = REFERENCE_METHODS[1]!;
const base = (): Design => newDesign({ w: mm(600), h: mm(720), d: mm(560) }, gen);
const mmOf = (v: number) => v / 100;
const dims = (p: Part) => [p.length, p.width, p.cutLength, p.cutWidth].map(mmOf);
const byKey = (parts: Part[], key: string) => {
  const p = parts.find((x) => x.key === key);
  if (!p) throw new Error(`no hay pieza ${key}; hay ${parts.map((x) => x.key).join(', ')}`);
  return p;
};
const door = (mount: 'overlay' | 'inset' = 'overlay', leaves: 1 | 2 = 1) => ({ kind: 'door' as const, leaves, hinge: 'left' as const, mount });
const drawers = (n: number, mount: 'overlay' | 'inset' = 'overlay') => ({ kind: 'drawers' as const, mount, sizes: Array(n).fill(null) });

describe('puertas', () => {
  it('una puerta superpuesta tapa el mueble menos 1,5 mm por lado: 717 × 597, corte 715 × 595', () => {
    const d = base();
    const r = compute(setFront(d, d.root.id, door()), groove, M);
    expect(r.warnings).toEqual([]);
    const p = byKey(r.parts, `zone:${d.root.id}/door0`);
    expect(p.name).toBe('Puerta');
    expect(p.role).toBe('door');
    expect(dims(p)).toEqual([717, 597, 715, 595]);
    expect(p.edges).toEqual({ L1: 'pvc-blanco-1', L2: 'pvc-blanco-1', W1: 'pvc-blanco-1', W2: 'pvc-blanco-1' });
    expect(p.box).toEqual({ x: mm(1.5), y: mm(1.5), z: mm(560), dx: mm(597), dy: mm(717), dz: mm(19) });
  });

  it('dos hojas: 3 mm de holgura entre ellas, 297 mm cada una', () => {
    const d = base();
    const r = compute(setFront(d, d.root.id, door('overlay', 2)), groove, M);
    const doors = r.parts.filter((p) => p.role === 'door');
    expect(doors.map((p) => p.name)).toEqual(['Puerta 1 (izquierda)', 'Puerta 2 (derecha)']);
    expect(doors.map((p) => mmOf(p.width))).toEqual([297, 297]);
    expect(doors.map((p) => mmOf(p.box.x))).toEqual([1.5, 301.5]);
  });

  it('encastrada: dentro del hueco con 3 mm alrededor, enrasada con el frente', () => {
    const d = base();
    const r = compute(setFront(d, d.root.id, door('inset')), groove, M);
    const p = byKey(r.parts, `zone:${d.root.id}/door0`);
    expect(dims(p)).toEqual([676, 556, 674, 554]);
    expect(p.box).toEqual({ x: mm(22), y: mm(22), z: mm(541), dx: mm(556), dy: mm(676), dz: mm(19) });
  });

  it('junto a un divisor, cada puerta llega a la mitad del divisor menos media holgura', () => {
    let d = base();
    d = setDivisions(d, d.root.id, 'x', 1, gen);
    const [a, b] = d.root.split!.children;
    d = setFront(d, a!.id, door());
    d = setFront(d, b!.id, door());
    const r = compute(d, groove, M);
    const [pa, pb] = r.parts.filter((p) => p.role === 'door');
    expect([mmOf(pa!.box.x), mmOf(pa!.width)]).toEqual([1.5, 297]);
    expect([mmOf(pb!.box.x), mmOf(pb!.width)]).toEqual([301.5, 297]);
    // entre las dos puertas quedan exactamente 3 mm
    expect(pb!.box.x - (pa!.box.x + pa!.box.dx)).toBe(mm(3));
  });

  it('detrás de una puerta encastrada, los estantes se retranquean solos su espesor + 2 mm', () => {
    let d = base();
    d = setDivisions(d, d.root.id, 'y', 1, gen);
    d = setFront(d, d.root.id, door('inset'));
    const corto: Method = { ...groove, shelfFrontSetback: mm(10) };
    const r = compute(d, corto, M);
    expect(r.warnings).toEqual([]);
    const tf = r.parts.find((p) => p.role === 'door')!.thickness;
    const zone = r.zones.find((z) => z.id === d.root.id)!.box;
    const shelf = r.parts.find((p) => p.role === 'shelf')!;
    expect(zone.dz - shelf.width).toBe(tf + mm(2));
    expect(compute(d, groove, M).warnings).toEqual([]);
  });

  it('avisa, con el nombre del estante, si se le eligió a mano un retranqueo que choca con la puerta encastrada', () => {
    let d = base();
    d = setDivisions(d, d.root.id, 'y', 1, gen);
    d = setFront(d, d.root.id, door('inset'));
    d = setOverride(d, `zone:${d.root.id}/div0`, { frontSetback: mm(10) });
    const r = compute(d, groove, M);
    expect(r.warnings.map((w) => w.code)).toEqual(['front_collision']);
    expect(r.warnings[0]!.message).toMatch(/^Estante 1: con 10 mm de retranqueo choca con el frente encastrado/);
    const zone = r.zones.find((z) => z.id === d.root.id)!.box;
    expect(zone.dz - r.parts.find((p) => p.role === 'shelf')!.width).toBe(mm(10));
  });
});

describe('cajones', () => {
  const d0 = base();
  const d = setFront(d0, d0.root.id, drawers(3));
  const r = compute(d, groove, M);
  const id = d0.root.id;

  it('tres frentes iguales de 237 mm, de arriba abajo, con 3 mm entre ellos', () => {
    expect(r.warnings).toEqual([]);
    const fronts = r.parts.filter((p) => p.role === 'drawer-front');
    expect(fronts.map((p) => p.name)).toEqual(['Frente cajón 1', 'Frente cajón 2', 'Frente cajón 3']);
    expect(fronts.map((p) => mmOf(p.box.y))).toEqual([481.5, 241.5, 1.5]);
    expect(dims(fronts[0]!)).toEqual([597, 237, 595, 235]);
  });

  it('caja del cajón de arriba: 536 de ancho, 500 de fondo (múltiplo de 50), 184,5 de alto', () => {
    const k = `zone:${id}/drawer0`;
    expect(dims(byKey(r.parts, `${k}/side.left`))).toEqual([500, 184.5, 500, 183.5]);
    expect(dims(byKey(r.parts, `${k}/back`))).toEqual([504, 184.5, 504, 183.5]);
    expect(dims(byKey(r.parts, `${k}/inner-front`))).toEqual([504, 184.5, 504, 183.5]);
    const bottom = byKey(r.parts, `${k}/bottom`);
    expect(dims(bottom)).toEqual([484, 520, 484, 520]);
    expect(bottom.thickness).toBe(mm(3));
    expect(bottom.box.y).toBe(mm(506.5));
    const side = byKey(r.parts, `${k}/side.left`);
    expect(side.box).toEqual({ x: mm(32), y: mm(496.5), z: mm(60), dx: mm(16), dy: mm(184.5), dz: mm(500) });
  });

  it('el del medio, sin estructura arriba ni abajo, sale más alto: 202 mm', () => {
    expect(mmOf(byKey(r.parts, `zone:${id}/drawer1/side.left`).width)).toBe(202);
    expect(mmOf(byKey(r.parts, `zone:${id}/drawer2/side.left`).width)).toBe(184.5);
  });

  it('todas las piezas de un cajón, frente incluido, comparten conjunto', () => {
    const drawer0 = r.parts.filter((p) => p.assembly?.id === `${id}/drawer0`);
    expect(drawer0.map((p) => p.role).sort()).toEqual(['drawer-back', 'drawer-back', 'drawer-bottom', 'drawer-front', 'drawer-side', 'drawer-side']);
    expect(drawer0.every((p) => p.assembly!.name === 'Cajón 1')).toBe(true);
  });

  it('altura fija en un cajón: los demás reparten el resto', () => {
    const r2 = compute(setDrawerSize(d, id, 0, mm(150)), groove, M);
    const fronts = r2.parts.filter((p) => p.role === 'drawer-front').map((p) => mmOf(p.width));
    expect(fronts).toEqual([150, 280.5, 280.5]);
  });

  it('fondo clavado debajo: los laterales apoyan encima', () => {
    const r2 = compute(d, clavada, M);
    const k = `zone:${id}/drawer0`;
    const bottom = byKey(r2.parts, `${k}/bottom`);
    const side = byKey(r2.parts, `${k}/side.left`);
    expect([mmOf(bottom.length), mmOf(bottom.width)]).toEqual([500, 536]);
    expect(side.box.y).toBe(bottom.box.y + bottom.box.dy);
    expect(side.box.dy + bottom.box.dy).toBe(mm(184.5));
  });

  it('cajón demasiado bajo: avisa y no genera la caja', () => {
    const many = setFront(d0, id, drawers(8));
    const r2 = compute(many, groove, M);
    expect(r2.warnings.map((w) => w.code)).toContain('drawer_too_small');
    expect(r2.parts.filter((p) => p.role === 'drawer-front')).toHaveLength(8);
  });
});

describe('zócalo', () => {
  const d = setPlinth(base(), { height: mm(100), setback: mm(50) });
  const r = compute(d, groove, M);

  it('la base sube 100 mm y los costados siguen enteros', () => {
    expect(r.warnings).toEqual([]);
    expect(byKey(r.parts, 'bottom').box.y).toBe(mm(100));
    expect(mmOf(byKey(r.parts, 'side.left').length)).toBe(720);
  });

  it('tablero de zócalo entre costados, retranqueado 50 mm', () => {
    const p = byKey(r.parts, 'plinth');
    expect(dims(p)).toEqual([562, 100, 562, 100]);
    expect(p.box).toEqual({ x: mm(19), y: 0, z: mm(491), dx: mm(562), dy: mm(100), dz: mm(19) });
  });

  it('la trasera y el hueco interior empiezan encima de la base', () => {
    const back = byKey(r.parts, 'back');
    expect([mmOf(back.length), mmOf(back.box.y)]).toEqual([600, 110]);
    expect(r.zones[0]!.box).toMatchObject({ y: mm(119), dy: mm(582) });
  });

  it('una puerta superpuesta tapa la base pero no el zócalo', () => {
    const r2 = compute(setFront(d, d.root.id, door()), groove, M);
    const p = r2.parts.find((x) => x.role === 'door')!;
    expect([mmOf(p.box.y), mmOf(p.length)]).toEqual([101.5, 617]);
  });
});

describe('cambios por pieza', () => {
  it('otro tablero del mismo espesor', () => {
    const d = setOverride(base(), 'side.left', { materialId: 'mel-roble-19' });
    const p = byKey(compute(d, groove, M).parts, 'side.left');
    expect(p.materialId).toBe('mel-roble-19');
    expect(p.grain).toBe('length');
    expect(p.overridden).toBe(true);
  });

  it('un tablero de otro espesor se ignora y avisa', () => {
    const d = setOverride(base(), 'side.left', { materialId: 'mel-grafito-16' });
    const r = compute(d, groove, M);
    expect(byKey(r.parts, 'side.left').materialId).toBe('mel-blanco-19');
    expect(r.warnings.map((w) => w.code)).toEqual(['override_ignored']);
  });

  it('cantos a mano: la medida de corte se recalcula', () => {
    const d = setOverride(base(), 'top', { edges: { W1: 'abs-roble-2', L1: null } });
    const p = byKey(compute(d, groove, M).parts, 'top');
    expect(p.edges).toEqual({ L1: null, L2: null, W1: 'abs-roble-2', W2: null });
    expect(dims(p)).toEqual([562, 560, 560, 560]);
  });

  it('borrar el cambio deja el diseño sin overrides', () => {
    const d = setOverride(setOverride(base(), 'top', { materialId: 'mel-roble-19' }), 'top', undefined);
    expect(d.overrides).toBeUndefined();
  });
});

describe('edición de frentes', () => {
  it('poner un frente quita los de dentro y los de fuera', () => {
    let d = base();
    d = setDivisions(d, d.root.id, 'y', 1, gen);
    const child = d.root.split!.children[0]!.id;
    d = setFront(d, child, door());
    d = setFront(d, d.root.id, door());
    expect(findZone(d.root, child)!.front).toBeUndefined();
    d = setFront(d, child, door());
    expect(d.root.front).toBeUndefined();
    expect(findZone(d.root, child)!.front?.kind).toBe('door');
  });

  it('los cajones quitan las divisiones y dividir quita los cajones', () => {
    let d = base();
    d = setDivisions(d, d.root.id, 'y', 2, gen);
    d = setFront(d, d.root.id, drawers(2));
    expect(d.root.split).toBeUndefined();
    d = setDivisions(d, d.root.id, 'y', 1, gen);
    expect(d.root.front).toBeUndefined();
  });

  it('cambiar el número de cajones conserva las alturas fijas', () => {
    let d = base();
    d = setFront(d, d.root.id, drawers(2));
    d = setDrawerSize(d, d.root.id, 0, mm(140));
    d = setDrawerCount(d, d.root.id, 4);
    expect(d.root.front).toEqual({ kind: 'drawers', mount: 'overlay', sizes: [mm(140), null, null, null] });
  });

  it('el formato guardado acepta frentes, zócalo y cambios por pieza', () => {
    let d = base();
    d = setFront(d, d.root.id, drawers(3));
    d = setPlinth(d, { height: mm(100), setback: mm(50) });
    d = setOverride(d, 'side.left', { edges: { L2: 'pvc-blanco-1' } });
    expect(designSchema.parse(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
});

describe('métodos guardados', () => {
  it('un método antiguo sin frentes ni cajones se completa con los valores por defecto', () => {
    const { fronts: _f, drawer: _d, ...old } = groove;
    const m = normalizeMethod(old);
    expect(m.fronts.gap).toBe(mm(3));
    expect(m.drawer.depthStep).toBe(mm(50));
    expect(methodSchema.parse(m)).toEqual(m);
  });
});

describe('robustez', () => {
  it('un método sin frentes ni cajones no rompe el cálculo', () => {
    const { fronts: _f, drawer: _d, ...old } = groove;
    const d = base();
    const r = compute(setFront(d, d.root.id, drawers(2)), old as unknown as Method, M);
    expect(r.parts.filter((p) => p.role === 'drawer-front')).toHaveLength(2);
  });
});
