import { describe, expect, it } from 'vitest';
import { compute, mm, newDesign, PRESET_HARDWARE, PRESET_MATERIALS, PRESET_METHODS, setDivisions, setFront, type Design } from '@mw/engine';
import { exportToy, trisToStl, tubeTris } from '../src';

let n = 0;
const gen = () => 't' + ++n;
const ar = PRESET_METHODS[0]!;
const M = PRESET_MATERIALS;

/** Triángulos de un STL binario. */
function read(data: Uint8Array) {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = v.getUint32(80, true);
  const tris: number[][][] = [];
  for (let t = 0; t < count; t++) {
    const o = 84 + t * 50 + 12;
    tris.push([0, 1, 2].map((k) => [0, 1, 2].map((j) => v.getFloat32(o + k * 12 + j * 4, true))));
  }
  return tris;
}
const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);
/** Volumen con signo: positivo y correcto solo si todas las caras miran hacia fuera. */
const volume = (tris: number[][][]) => tris.reduce((s, [a, b, c]) => s + dot(a!, cross(b!, c!)) / 6, 0);

const run = (d: Design, name = 'Bajo') => {
  const r = compute(d, ar, M, PRESET_HARDWARE);
  return exportToy(r.parts, r.zones, d.size, { name, scale: 0.1 });
};

describe('primitivas', () => {
  // Polígono de 32 lados: área = 16 · r² · sin(2π/32).
  const area = (r: number) => 16 * r * r * Math.sin((2 * Math.PI) / 32);

  it('cilindro macizo de radio 2 y 10 de alto: volumen exacto del polígono', () => {
    expect(volume(read(trisToStl(tubeTris(0, 0, 0, 10, 2))))).toBeCloseTo(area(2) * 10, 3);
  });

  it('tubo de radios 3 y 1: volumen de la corona (caras de dentro hacia el agujero)', () => {
    expect(volume(read(trisToStl(tubeTris(5, -4, 2, 12, 3, 1))))).toBeCloseTo((area(3) - area(1)) * 10, 3);
  });
});

describe('juguete', () => {
  it('cilindro y tubo cerrados, con las caras hacia fuera', async () => {
    // Se exporta un mueble vacío: solo cajas; su volumen tiene que ser positivo (caras bien orientadas).
    const d = newDesign({ w: mm(600), h: mm(860), d: mm(560) }, gen);
    const t = read(run(d).files[0]!.data);
    expect(volume(t)).toBeGreaterThan(0);
  });

  it('bajo con una puerta: un solo archivo con la puerta y su bisagra impresa', () => {
    const d0 = newDesign({ w: mm(600), h: mm(860), d: mm(560) }, gen);
    const d = setFront(d0, d0.root.id, { kind: 'door', leaves: 1, hinge: 'left', mount: 'overlay' });
    const r = run(d);
    expect(r.files.map((f) => f.name)).toEqual(['bajo-juguete.stl']);
    expect(r.warnings).toEqual([]);
    const plain = read(run(d0).files[0]!.data).length;
    const withDoor = read(r.files[0]!.data).length;
    // Puerta (12 triángulos) + perno + 3 nudillos y pestañas del mueble + 2 nudillos-tubo y uniones de la puerta.
    expect(withDoor).toBeGreaterThan(plain + 12 + 5 * 32);
    expect(r.readme).toContain('bisagras impresas en su lugar');
  });

  it('dos hojas: dos bisagras, una en cada costado', () => {
    const d0 = newDesign({ w: mm(900), h: mm(860), d: mm(560) }, gen);
    const r = run(setFront(d0, d0.root.id, { kind: 'door', leaves: 2, hinge: 'left', mount: 'overlay' }));
    expect(r.files).toHaveLength(1);
    expect(r.readme).toContain('2 puertas');
  });

  it('una puerta que no llega al costado del mueble va aparte, con aviso', () => {
    let d = newDesign({ w: mm(900), h: mm(860), d: mm(560) }, gen);
    d = setDivisions(d, d.root.id, 'x', 1, gen);
    const right = d.root.split!.children[1]!.id;
    d = setFront(d, right, { kind: 'door', leaves: 1, hinge: 'left', mount: 'overlay' });
    const r = run(d);
    expect(r.files.map((f) => f.name)).toEqual(['bajo-juguete.stl', 'bajo-puerta.stl']);
    expect(r.warnings[0]).toContain('no llega al costado');
  });

  it('cajonera: el mueble y un archivo por cajón', () => {
    const d0 = newDesign({ w: mm(450), h: mm(860), d: mm(560) }, gen);
    const r = run(setFront(d0, d0.root.id, { kind: 'drawers', mount: 'overlay', sizes: [null, null, null] }), 'Cajonera');
    expect(r.files.map((f) => f.name)).toEqual(['cajonera-juguete.stl', 'cajonera-cajon-1.stl', 'cajonera-cajon-2.stl', 'cajonera-cajon-3.stl']);
    for (const f of r.files) expect(volume(read(f.data))).toBeGreaterThan(0);
  });

  it('corrediza: rieles en el mueble y una hoja por archivo, más baja para poder encastrarla', () => {
    const d0 = newDesign({ w: mm(1200), h: mm(860), d: mm(560) }, gen);
    const r = run(setFront(d0, d0.root.id, { kind: 'sliding', leaves: 2 }), 'Bajo');
    expect(r.files.map((f) => f.name)).toEqual(['bajo-juguete.stl', 'bajo-corrediza-1.stl', 'bajo-corrediza-2.stl']);
    // Hueco de 82,4 mm de alto a 1:10: la hoja mide 82,4 − 0,4 − (2,4 − 1,2) − 0,4 = 80,4 mm.
    const leaf = read(r.files[1]!.data);
    const zs = leaf.flatMap((t) => t.map((v) => v[2]!));
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(80.4, 3);
  });

  it('el STL de triángulos queda apoyado en el origen', () => {
    const data = trisToStl([
      [
        [5, 5, 5],
        [6, 5, 5],
        [5, 6, 7],
      ],
    ]);
    const t = read(data);
    expect(Math.min(...t.flatMap((x) => x.map((v) => v[2]!)))).toBe(0);
  });
});
