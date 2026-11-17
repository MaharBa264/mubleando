import { describe, expect, it } from 'vitest';
import { compute, mm, newDesign, PRESET_MATERIALS, PRESET_METHODS, setDivisions, setFront, setOverride, type Part } from '../src';

/**
 * Método de partida argentino (melamina 18, fondo de fibrofácil 3 en ranura de 8 a 15 mm del fondo,
 * holgura 1, tapacanto 0,45 que NO se descuenta, estantes retranqueados 20). Cifras calculadas a mano.
 */
let n = 0;
const gen = () => `a${++n}`;
const M = PRESET_MATERIALS;
const ar = PRESET_METHODS.find((m) => m.id === 'ar-18-ranura')!;
const mmOf = (v: number) => v / 100;
const dims = (p: Part) => [p.length, p.width, p.cutLength, p.cutWidth].map(mmOf);
const byKey = (parts: Part[], key: string) => parts.find((p) => p.key === key)!;

describe('bajo de 600 × 860 × 560 con el método argentino', () => {
  const d0 = newDesign({ w: mm(600), h: mm(860), d: mm(560) }, gen);
  const d = setFront(setDivisions(d0, d0.root.id, 'y', 1, gen), d0.root.id, { kind: 'door', leaves: 1, hinge: 'left', mount: 'overlay' });
  const r = compute(d, ar, M);

  it('sin avisos', () => expect(r.warnings).toEqual([]));

  it('costados 860 × 560: el tapacanto de 0,45 no cambia la medida de corte', () => {
    expect(dims(byKey(r.parts, 'side.left'))).toEqual([860, 560, 860, 560]);
    expect(byKey(r.parts, 'side.left').edges.L1).toBe('ar-tc-blanco-045');
  });

  it('tapa y base 564 × 560 (600 − 2 × 18)', () => {
    expect(dims(byKey(r.parts, 'top'))).toEqual([564, 560, 564, 560]);
  });

  it('fondo de fibrofácil 3 en ranura: entra 7 mm por lado → 838 × 578', () => {
    const b = byKey(r.parts, 'back');
    expect(dims(b)).toEqual([838, 578, 838, 578]);
    expect(b.box.z).toBe(mm(15));
  });

  it('estante 564 × 522 (fondo útil 560 − 18 − 20)', () => {
    const s = r.parts.find((p) => p.role === 'shelf')!;
    expect(dims(s)).toEqual([564, 522, 564, 522]);
    expect(s.box.y).toBe(mm(18 + 403));
  });

  it('puerta superpuesta 857 × 597, sin descontar el tapacanto', () => {
    expect(dims(r.parts.find((p) => p.role === 'door')!)).toEqual([857, 597, 857, 597]);
  });

  it('un tapacanto de 2 mm puesto a mano sí se descuenta (llega al mínimo de 1 mm)', () => {
    const r2 = compute(setOverride(d, 'top', { edges: { W1: 'ar-tc-blanco-2' } }), ar, M);
    expect(dims(byKey(r2.parts, 'top'))).toEqual([564, 560, 562, 560]);
  });

  it('con mínimo 0, también se descuenta el de 0,45', () => {
    const r2 = compute(d, { ...ar, edgeReduceMin: 0 }, M);
    expect(dims(byKey(r2.parts, 'side.left'))).toEqual([860, 560, 860, 559.55]);
  });

  it('cajón con correderas telescópicas: 12,5 mm por lado → caja de 539 de ancho', () => {
    const dc = setFront(d0, d0.root.id, { kind: 'drawers', mount: 'overlay', sizes: [null, null, null] });
    const rc = compute(dc, ar, M);
    expect(rc.warnings).toEqual([]);
    const back = rc.parts.find((p) => p.key.endsWith('drawer0/back'))!;
    expect(mmOf(back.length)).toBe(539 - 2 * 18);
  });
});
