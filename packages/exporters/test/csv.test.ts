import { describe, expect, it } from 'vitest';
import { compute, groupedRows, mm, newDesign, PRESET_MATERIALS, PRESET_METHODS, setDivisions } from '@mw/engine';
import { cutListCsv } from '../src';

describe('CSV de lista de corte', () => {
  let i = 0;
  const gen = () => `z${++i}`;
  const d0 = newDesign({ w: mm(600), h: mm(720), d: mm(560) }, gen);
  const d = setDivisions(d0, d0.root.id, 'y', 1, gen);
  const r = compute(d, PRESET_METHODS[0]!, PRESET_MATERIALS);
  const rows = groupedRows(r.parts.map((part) => ({ part, source: 'Bajo; 600 "A"' })));

  it('cabecera, separador ; y decimales con coma', () => {
    const csv = cutListCsv(rows, PRESET_MATERIALS);
    expect(csv.startsWith('﻿Ref;Pieza;Mueble;Material')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(rows.length + 1);
    const shelf = lines.find((l) => l.includes('Estante 1'))!;
    expect(shelf).toContain(';562;521;1;No;Canto PVC blanco 1;');
    // el nombre de mueble con ; y comillas va entrecomillado
    expect(shelf).toContain('"Bajo; 600 ""A"""');
  });

  it('decimales con punto y sin BOM para software de taller', () => {
    const one = groupedRows([{ part: { ...r.parts[0]!, cutLength: mm(700.5) } }]);
    const csv = cutListCsv(one, PRESET_MATERIALS, { decimal: '.', bom: false });
    expect(csv.startsWith('Ref;')).toBe(true);
    expect(csv).toContain(';700.5;');
  });
});
