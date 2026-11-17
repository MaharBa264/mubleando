import { describe, expect, it } from 'vitest';
import { compute, mm, newDesign, REFERENCE_MATERIALS, REFERENCE_METHODS, setDivisions, type Part } from '@mw/engine';
import { binaryStl, boxTriangles, crc32, exportStl, slug, zip } from '../src';

let i = 0;
const gen = () => `s${++i}`;
const d0 = newDesign({ w: mm(600), h: mm(720), d: mm(560) }, gen);
const d = setDivisions(d0, d0.root.id, 'y', 1, gen);
const parts = compute(d, REFERENCE_METHODS[0]!, REFERENCE_MATERIALS).parts;

/** Lee un STL binario: devuelve los triángulos como [normal, a, b, c]. */
function readStl(data: Uint8Array) {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const n = v.getUint32(80, true);
  expect(data.byteLength).toBe(84 + n * 50);
  const tris: number[][][] = [];
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50;
    const vec = (k: number) => [0, 1, 2].map((j) => v.getFloat32(o + k * 12 + j * 4, true));
    tris.push([vec(0), vec(1), vec(2), vec(3)]);
  }
  return tris;
}

const sub = (a: number[], b: number[]) => a.map((x, k) => x - b[k]!);
const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
const dot = (a: number[], b: number[]) => a.reduce((s, x, k) => s + x * b[k]!, 0);

/** Volumen con signo (teorema de la divergencia): solo sale positivo si todas las caras miran hacia fuera. */
function volume(tris: number[][][]) {
  return tris.reduce((s, [, a, b, c]) => s + dot(a!, cross(b!, c!)) / 6, 0);
}

function bounds(tris: number[][][]) {
  const pts = tris.flatMap((t) => t.slice(1));
  return [0, 1, 2].map((k) => [Math.min(...pts.map((p) => p[k]!)), Math.max(...pts.map((p) => p[k]!))]);
}

describe('STL', () => {
  it('cada caja tiene 12 triángulos con la normal hacia fuera', () => {
    const box = { x0: 0, y0: 0, z0: 0, x1: 2, y1: 3, z1: 4 };
    const tris = boxTriangles(box);
    expect(tris).toHaveLength(12);
    for (const [n, a, b, c] of tris) {
      expect(dot(cross(sub(b, a), sub(c, a)), n)).toBeGreaterThan(0);
    }
    expect(volume(readStl(binaryStl([box])))).toBeCloseTo(24, 5);
  });

  it('mueble completo a 1:10: tamaño impreso, apoyado en z = 0 y volumen igual a la suma de piezas', () => {
    const r = exportStl(parts, { mode: 'assembled', scale: 0.1, minThicknessMm: 0, name: 'Bajo 600' });
    expect(r.files.map((f) => f.name)).toEqual(['bajo-600.stl']);
    expect(r.printedSize).toEqual({ x: 60, y: 56, z: 72 });
    const tris = readStl(r.files[0]!.data);
    expect(tris).toHaveLength(parts.length * 12);
    const [bx, by, bz] = bounds(tris);
    expect(bx![0]).toBeCloseTo(0, 4);
    expect(by![0]).toBeCloseTo(0, 4);
    expect(bz![0]).toBeCloseTo(0, 4);
    expect(bz![1]).toBeCloseTo(72, 4);
    // 1/100 mm → mm a escala 1:10 = /1000 en cada eje
    const expected = parts.reduce((s, p) => s + (p.box.dx / 1000) * (p.box.dy / 1000) * (p.box.dz / 1000), 0);
    expect(volume(tris)).toBeCloseTo(expected, 1);
  });

  it('el frente del mueble mira hacia −Y y la trasera queda en la Y más alta', () => {
    const back = parts.find((p) => p.role === 'back')!;
    const r = exportStl([back, ...parts.filter((p) => p.role === 'side')], { mode: 'assembled', scale: 0.1, minThicknessMm: 0, name: 'x' });
    const tris = readStl(r.files[0]!.data).slice(0, 12); // la trasera es la primera caja
    const [, by] = bounds(tris);
    // la trasera está a 10 mm del fondo (inset): a 1:10, su cara trasera queda 1 mm por delante del fondo (Y = 56 − 1)
    expect(by![1]).toBeCloseTo(56 - back.box.z / 1000, 4);
  });

  it('engorda las piezas demasiado finas y avisa', () => {
    // trasera de DM 8 a 1:20 = 0,4 mm → sube a 0,8 mm
    const r = exportStl(parts, { mode: 'pieces', scale: 0.05, minThicknessMm: 0.8, name: 'x' });
    const back = r.files.find((f) => f.name.includes('trasera'))!;
    const [, , bz] = bounds(readStl(back.data));
    expect(bz![1]! - bz![0]!).toBeCloseTo(0.8, 4);
    expect(r.warnings.join(' ')).toMatch(/1 pieza quedaba por debajo de 0,8 mm/);
  });

  it('pieza a pieza: tumbadas, un archivo por medida distinta y la cantidad en el nombre', () => {
    const r = exportStl(parts, { mode: 'pieces', scale: 1, minThicknessMm: 0, name: 'x' });
    const sides = r.files.filter((f) => f.name.includes('costado'));
    expect(sides).toHaveLength(1);
    expect(sides[0]!.name).toBe('01-costado-izquierdo-x2-720x560x19.stl');
    const [bx, by, bz] = bounds(readStl(sides[0]!.data));
    expect(bx![1]).toBeCloseTo(720, 3);
    expect(by![1]).toBeCloseTo(560, 3);
    expect(bz![1]).toBeCloseTo(19, 3);
    expect(r.readme).toContain('Imprimir 2 veces. Medida real 720 x 560 x 19 mm.');
    expect(r.readme).toContain('Piezas: Costado izquierdo, Costado derecho.');
    expect(r.printedSize).toBeNull();
    expect(r.warnings.join(' ')).not.toMatch(/no cabe/);
  });

  it('avisa si el mueble completo es demasiado grande para imprimir', () => {
    const r = exportStl(parts, { mode: 'assembled', scale: 1, name: 'x' });
    expect(r.warnings.join(' ')).toMatch(/no cabe/);
  });

  describe('cajones', () => {
    // El motor todavía no genera cajones (fase 2): se simulan dos piezas de un cajón.
    const base = parts[0]!;
    const drawer = (key: string, name: string, box: Part['box']): Part => ({
      ...base,
      key,
      name,
      box,
      assembly: { id: 'dr1', kind: 'drawer', name: 'Cajón 1' },
    });
    const withDrawer = [
      ...parts,
      drawer('dr1/front', 'Frente', { x: 2000, y: 2000, z: 54000, dx: 50000, dy: 15000, dz: 1900 }),
      drawer('dr1/bottom', 'Fondo cajón', { x: 4000, y: 3000, z: 5000, dx: 46000, dy: 1000, dz: 48000 }),
    ];

    it('integrados: todo en un archivo', () => {
      const r = exportStl(withDrawer, { mode: 'assembled', drawers: 'integrated', scale: 0.1, name: 'm' });
      expect(r.files).toHaveLength(1);
      expect(readStl(r.files[0]!.data)).toHaveLength(withDrawer.length * 12);
    });

    it('aparte: el mueble sin el cajón y el cajón montado en otro archivo', () => {
      const r = exportStl(withDrawer, { mode: 'assembled', drawers: 'separate', scale: 0.1, name: 'm' });
      expect(r.files.map((f) => f.name)).toEqual(['m.stl', 'm-cajon-1.stl']);
      expect(readStl(r.files[0]!.data)).toHaveLength(parts.length * 12);
      const drawerTris = readStl(r.files[1]!.data);
      expect(drawerTris).toHaveLength(24);
      expect(bounds(drawerTris)[2]![0]).toBeCloseTo(0, 4);
    });

    it('por piezas: el mueble montado y las piezas del cajón sueltas', () => {
      const r = exportStl(withDrawer, { mode: 'assembled', drawers: 'pieces', scale: 0.1, name: 'm' });
      expect(r.files.map((f) => f.name)).toEqual(['m.stl', 'cajon-1-01-frente-500x150x19.stl', 'cajon-1-02-fondo-cajon-480x460x10.stl']);
    });
  });

  it('slug quita tildes y signos', () => {
    expect(slug('Cajón  nº 2 / Despensa')).toBe('cajon-n-2-despensa');
    expect(slug('***')).toBe('pieza');
  });

  it('rechaza una escala no válida', () => {
    expect(() => exportStl(parts, { mode: 'pieces', scale: 0, name: 'x' })).toThrow(/escala/);
  });
});

describe('ZIP', () => {
  it('CRC-32 de referencia', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('estructura: cabeceras locales, directorio central y registro final', () => {
    const z = zip([
      { name: 'léeme.txt', data: 'hola' },
      { name: 'a.stl', data: new Uint8Array([1, 2, 3]) },
    ]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const end = z.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    const cdOffset = v.getUint32(end + 16, true);
    expect(v.getUint32(cdOffset, true)).toBe(0x02014b50);
    const nameLen = v.getUint16(26, true);
    expect(new TextDecoder().decode(z.subarray(30, 30 + nameLen))).toBe('léeme.txt');
  });
});
