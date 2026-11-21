import { describe, expect, it } from 'vitest';
import { compute, cuttingPlan, groupedRows, mm, PRESET_MATERIALS, PRESET_METHODS, TEMPLATES } from '@mw/engine';
import { cabinetPdf, cabinetView, convexHull, hullsOverlap, insidePolygon, project, type DocInclude, type Pt2 } from '../src';

const r4 = (v: number) => Math.round(v * 1e4) / 1e4 + 0;

describe('proyección isométrica', () => {
  it('ejes a mano: x a la derecha y abajo, y hacia arriba, z a la izquierda y abajo', () => {
    // R = (√½, 0, −√½); U = (−1, 2, −1)/√6.
    expect(project([1, 0, 0]).map(r4)).toEqual([0.7071, -0.4082]);
    expect(project([0, 1, 0]).map(r4)).toEqual([0, 0.8165]);
    expect(project([0, 0, 1]).map(r4)).toEqual([-0.7071, -0.4082]);
  });
});

describe('geometría del papel', () => {
  const sq: Pt2[] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];
  it('contorno convexo', () => {
    expect(convexHull([...sq, [5, 5], [3, 7]])).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
  });
  it('punto dentro / fuera', () => {
    expect(insidePolygon([5, 5], sq)).toBe(true);
    expect(insidePolygon([15, 5], sq)).toBe(false);
  });
  it('superposición: tocarse en un borde no cuenta', () => {
    const move = (dx: number) => sq.map(([x, y]) => [x + dx, y] as Pt2);
    expect(hullsOverlap(sq, move(5))).toBe(true);
    expect(hullsOverlap(sq, move(10))).toBe(false);
  });
});

describe('vistas de un bajo con cajón y puertas', () => {
  let n = 0;
  const gen = () => 'v' + ++n;
  const d = TEMPLATES.find((t) => t.id === 'bajo-mixto')!.build({ w: mm(800), h: mm(860), d: mm(560) }, gen);
  const parts = compute(d, PRESET_METHODS.find((m) => m.id === 'ar-18-ranura')!, PRESET_MATERIALS).parts;
  const key = (name: string) => parts.find((p) => p.name === name)!.key;
  const order = (v: ReturnType<typeof cabinetView>) => [...new Set(v.polygons.map((q) => q.partKey))];

  it('cerrado: el lateral del cajón (dentro) se dibuja antes que el costado derecho, y las puertas al final', () => {
    const o = order(cabinetView(parts, { mode: 'closed' }));
    expect(o.indexOf(key('Lateral derecho cajón 1'))).toBeLessThan(o.indexOf(key('Costado derecho')));
    expect(o.indexOf(key('Base'))).toBeLessThan(o.indexOf(key('Puerta 1 (izquierda)')));
    expect(o.indexOf(key('Trasera'))).toBeLessThan(o.indexOf(key('Estante 1')));
  });

  it('solo se dibujan las caras que miran al observador (como mucho 3 por pieza)', () => {
    const v = cabinetView(parts, { mode: 'closed' });
    for (const p of parts) expect(v.polygons.filter((q) => q.partKey === p.key).length).toBeLessThanOrEqual(3);
  });

  it('abierto: el dibujo crece hacia adelante (puertas giradas 95° y cajón afuera)', () => {
    const c = cabinetView(parts, { mode: 'closed' }).bounds;
    const o = cabinetView(parts, { mode: 'open' }).bounds;
    // Adelante = hacia la izquierda y abajo en el papel.
    expect(o.minX).toBeLessThan(c.minX);
    expect(o.minY).toBeLessThan(c.minY);
  });

  it('explotado: las piezas se separan y cada una lleva su número de la lista', () => {
    const refs = new Map<string, string>();
    for (const row of groupedRows(parts.map((part) => ({ part })))) for (const k of row.keys) refs.set(k, row.ref);
    const v = cabinetView(parts, { mode: 'exploded', labels: refs });
    expect(v.labels).toHaveLength(parts.length);
    expect(new Set(v.labels.map((l) => l.partKey)).size).toBe(parts.length);
    const c = cabinetView(parts, { mode: 'closed' }).bounds;
    expect(v.bounds.maxX - v.bounds.minX).toBeGreaterThan(c.maxX - c.minX);
  });

  describe('documento PDF', () => {
    const none: DocInclude = { cutList: false, plan: false, closed: false, open: false, exploded: false, labels: false };
    const base = { title: 'Bajo 800', date: '21 nov 2026', items: parts.map((part) => ({ part })), materials: PRESET_MATERIALS, cabinets: [{ name: 'Bajo 800', parts }] };
    const pages = (include: Partial<DocInclude>) => cabinetPdf({ ...base, include: { ...none, ...include } }).pages;

    it('solo portada: 1 página', () => {
      expect(pages({})).toBe(1);
    });
    it('cada vista suma una página por mueble', () => {
      expect(pages({ closed: true, open: true, exploded: true })).toBe(4);
      expect(cabinetPdf({ ...base, cabinets: [base.cabinets[0]!, { name: 'Otro', parts }], include: { ...none, exploded: true } }).pages).toBe(3);
    });
    it('el plano de cortes va de a dos placas por página, cada material aparte', () => {
      const plan = cuttingPlan(base.items, PRESET_MATERIALS);
      const expected = plan.reduce((s, p) => s + Math.ceil(p.result.sheets.length / 2), 0);
      expect(pages({ plan: true })).toBe(1 + expected);
    });
    it('lista de corte y etiquetas (16 piezas: una hoja de 24)', () => {
      expect(pages({ cutList: true })).toBe(2);
      expect(pages({ labels: true })).toBe(2);
    });
    it('es un PDF con el título del mueble', () => {
      const text = new TextDecoder('latin1').decode(cabinetPdf({ ...base, include: none }).bytes);
      expect(text.startsWith('%PDF-')).toBe(true);
      expect(text).toContain('Bajo 800');
    });
  });
});
