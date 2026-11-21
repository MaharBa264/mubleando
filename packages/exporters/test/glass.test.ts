import { describe, expect, it } from 'vitest';
import { compute, mm, newDesign, PRESET_HARDWARE, PRESET_MATERIALS, PRESET_METHODS, setFront, type DoorGlass } from '@mw/engine';
import { cabinetPdf, cabinetView, exportToy, labelsFromCutList } from '../src';

let n = 0;
const gen = () => 'x' + ++n;
const d0 = newDesign({ w: mm(600), h: mm(720), d: mm(560) }, gen);
const ar = PRESET_METHODS.find((m) => m.id === 'ar-18-ranura')!;
const run = (glass: DoorGlass) => compute(setFront(d0, d0.root.id, { kind: 'door', leaves: 1, hinge: 'left', mount: 'overlay', glass }), ar, PRESET_MATERIALS, PRESET_HARDWARE);
const framed = run({ type: 'frame', glassId: 'ar-vidrio-incoloro-4', frameWidth: mm(60), rebate: mm(8), clearance: mm(1.5) });
const tempered = run({ type: 'frameless', glassId: 'ar-vidrio-templado-5', hingeId: 'hw-bisagra-vidrio-26' });

describe('vidrios en las exportaciones', () => {
  it('las etiquetas no incluyen vidrios (van a la vidriería)', () => {
    const labels = labelsFromCutList(framed.parts.map((part) => ({ part })), PRESET_MATERIALS);
    expect(labels.some((l) => l.material.startsWith('Vidrio'))).toBe(false);
    expect(labels.filter((l) => l.piece.startsWith('Parante'))).toHaveLength(2);
  });

  it('juguete: la puerta con marco y vidrio sale como una sola puerta con su bisagra impresa', () => {
    const toy = exportToy(framed.parts, framed.zones, d0.size, { name: 'Bajo' });
    const plain = compute(setFront(d0, d0.root.id, { kind: 'door', leaves: 1, hinge: 'left', mount: 'overlay' }), ar, PRESET_MATERIALS, PRESET_HARDWARE);
    const toyPlain = exportToy(plain.parts, plain.zones, d0.size, { name: 'Bajo' });
    expect(toy.files.map((f) => f.name)).toEqual(toyPlain.files.map((f) => f.name));
    const tris = (x: typeof toy) => new DataView(x.files[0]!.data.buffer).getUint32(80, true);
    expect(tris(toy)).toBe(tris(toyPlain));
  });

  it('vista abierta: el marco y el vidrio giran juntos sobre las bisagras de la puerta', () => {
    const v = cabinetView(framed.parts, { mode: 'open' });
    const glassKey = framed.parts.find((p) => p.role === 'glass')!.key;
    const stileKey = framed.parts.find((p) => p.name.startsWith('Parante izquierdo'))!.key;
    const minX = (k: string) => Math.min(...v.polygons.filter((p) => p.partKey === k).flatMap((p) => p.points.map((q) => q[0])));
    const c = cabinetView(framed.parts, { mode: 'closed' });
    const minXc = (k: string) => Math.min(...c.polygons.filter((p) => p.partKey === k).flatMap((p) => p.points.map((q) => q[0])));
    // Abierta hacia adelante: en el papel, hacia la izquierda (las dos piezas).
    expect(minX(glassKey)).toBeLessThan(minXc(glassKey));
    expect(minX(stileKey)).toBeLessThan(minXc(stileKey) + 1);
  });

  it('el PDF suma la hoja de la vidriería cuando va la lista de corte', () => {
    const base = { title: 'Bajo', date: 'hoy', materials: PRESET_MATERIALS, include: { cutList: true, plan: false, closed: false, open: false, exploded: false, labels: false } };
    const withGlass = cabinetPdf({ ...base, items: tempered.parts.map((part) => ({ part })), cabinets: [{ name: 'Bajo', parts: tempered.parts }] });
    // Portada, lista de corte y vidriería (el texto va comprimido en el PDF: se cuentan las páginas).
    expect(withGlass.pages).toBe(3);
    const noGlass = cabinetPdf({ ...base, items: framed.parts.filter((p) => p.role !== 'glass').map((part) => ({ part })), cabinets: [{ name: 'Bajo', parts: framed.parts }] });
    expect(noGlass.pages).toBe(2);
  });
});
