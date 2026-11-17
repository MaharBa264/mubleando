import { describe, expect, it } from 'vitest';
import { mm } from '@mw/engine';
import { fmtDims, fmtMoney, parseCents, parseMm } from './format';

describe('formato argentino', () => {
  it('pesos con punto de miles y coma decimal', () => {
    expect(fmtMoney(1234567).replace(/\s/g, ' ')).toBe('$ 12.345,67');
    expect(fmtMoney(0).replace(/\s/g, ' ')).toBe('$ 0,00');
  });

  it('medidas en mm con coma decimal', () => {
    expect(fmtDims(mm(2400), mm(599.5))).toBe('2.400 × 599,5');
  });

  it('lee precios escritos a la manera argentina', () => {
    expect(parseCents('20000')).toBe(2_000_000);
    expect(parseCents('20.000')).toBe(2_000_000);
    expect(parseCents('1.234.567')).toBe(123_456_700);
    expect(parseCents('20.000,50')).toBe(2_000_050);
    expect(parseCents('20000,5')).toBe(2_000_050);
    expect(parseCents('20000.50')).toBe(2_000_050);
    expect(parseCents('$ 25.000')).toBe(2_500_000);
    expect(parseCents('')).toBe(0);
  });

  it('rechaza lo que no es un precio', () => {
    for (const bad of ['abc', '-5', '20,505', '2.00.0', '1,2,3', '20.0000']) expect(parseCents(bad), bad).toBeNull();
  });

  it('las medidas siguen aceptando coma o punto', () => {
    expect(parseMm('600,5')).toBe(mm(600.5));
    expect(parseMm('600.5')).toBe(mm(600.5));
  });
});
