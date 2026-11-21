import { describe, expect, it } from 'vitest';
import { compute, mm, newDesign, PRESET_HARDWARE, PRESET_MATERIALS, PRESET_METHODS, type LegOut } from '@mw/engine';
import { cabinetView, exportStl, exportToy, legTriangles, meshVolume, type V3 } from '../src';

const id = (p: V3): V3 => p;
const leg = (o: Partial<LegOut> = {}): LegOut => ({ top: { x: 0, z: 0 }, foot: { x: 0, z: 0 }, height: mm(150), topSize: mm(40), bottomSize: mm(40), section: 'square', plate: false, ...o });

describe('malla de una pata', () => {
  it('cuadrada recta de 40 × 40 × 150: 240.000 mm³, cerrada y con las normales hacia fuera', () => {
    const v = meshVolume(legTriangles(leg(), id)) / 1e6; // (1/100 mm)³ → mm³
    expect(v).toBeCloseTo(240_000, 3);
  });
  it('inclinada tiene el mismo volumen (corrimiento sin cambio de sección)', () => {
    const v = meshVolume(legTriangles(leg({ foot: { x: mm(40), z: mm(30) } }), id)) / 1e6;
    expect(v).toBeCloseTo(240_000, 3);
  });
  it('cónica cuadrada 40 → 20: tronco de pirámide h/3 (A + a + √(A a)) = 140.000 mm³', () => {
    const v = meshVolume(legTriangles(leg({ bottomSize: mm(20) }), id)) / 1e6;
    expect(v).toBeCloseTo((150 / 3) * (1600 + 400 + 800), 3);
  });
  it('redonda Ø 40 × 150: casi π r² h (24 lados: 1,1 % menos)', () => {
    const v = meshVolume(legTriangles(leg({ section: 'round' }), id)) / 1e6;
    const cyl = Math.PI * 20 * 20 * 150;
    expect(v / cyl).toBeGreaterThan(0.985);
    expect(v / cyl).toBeLessThan(1);
  });
  it('se engorda hasta el mínimo pedido', () => {
    const v = meshVolume(legTriangles(leg({ topSize: mm(5), bottomSize: mm(5) }), id, mm(10))) / 1e6;
    expect(v).toBeCloseTo(100 * 150, 3);
  });
});

describe('patas en los archivos', () => {
  let n = 0;
  const gen = () => 'p' + ++n;
  const d = { ...newDesign({ w: mm(800), h: mm(860), d: mm(560) }, gen), legs: { hardwareId: 'hw-pata-recta-cuadrada' } };
  const r = compute(d, PRESET_METHODS.find((m) => m.id === 'ar-18-ranura')!, PRESET_MATERIALS, PRESET_HARDWARE);

  it('STL montado: la caja y las 4 patas (16 triángulos cada una); el alto impreso sigue siendo 86 mm a 1:10', () => {
    const e = exportStl(r.parts, { mode: 'assembled', name: 'Bajo', legs: r.legs });
    const tris = new DataView(e.files[0]!.data.buffer).getUint32(80, true);
    expect(tris).toBe(r.parts.length * 12 + 4 * 16);
    expect(e.printedSize?.z).toBe(86);
  });
  it('STL pieza a pieza: un archivo de pata para imprimir 4 veces', () => {
    const e = exportStl(r.parts, { mode: 'pieces', name: 'Bajo', legs: r.legs });
    expect(e.files.map((f) => f.name)).toContain('pata-x4.stl');
    expect(e.readme).toContain('Imprimir 4 veces. Alto real 150 mm.');
  });
  it('juguete: las patas van en el archivo del mueble', () => {
    const sin = exportToy(r.parts, r.zones, d.size, { name: 'Bajo' });
    const con = exportToy(r.parts, r.zones, d.size, { name: 'Bajo', legs: r.legs });
    const count = (x: typeof sin) => new DataView(x.files[0]!.data.buffer).getUint32(80, true);
    expect(count(con) - count(sin)).toBe(4 * 16);
  });
  it('vista armada: las patas se dibujan; en la explotada, no', () => {
    const v = cabinetView(r.parts, { mode: 'closed', legs: r.legs });
    expect(new Set(v.polygons.map((p) => p.partKey)).has('leg0')).toBe(true);
    const e = cabinetView(r.parts, { mode: 'exploded', legs: r.legs });
    expect(new Set(e.polygons.map((p) => p.partKey)).has('leg0')).toBe(false);
  });
});

