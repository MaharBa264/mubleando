import { describe, expect, it } from 'vitest';
import { compute, designSchema, PRESET_MATERIALS, PRESET_METHODS, REFERENCE_MATERIALS, REFERENCE_METHODS, TEMPLATES } from '../src';

let n = 0;
const gen = () => `t${++n}`;
const count = (parts: { role: string }[], role: string) => parts.filter((p) => p.role === role).length;

describe('plantillas', () => {
  it('los identificadores son únicos', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });

  for (const t of TEMPLATES) {
    describe(t.name, () => {
      const d = t.build(t.size, gen);

      it('el diseño es válido y conserva las medidas', () => {
        expect(designSchema.parse(d)).toEqual(d);
        expect(d.size).toEqual(t.size);
      });

      for (const [label, mats, methods] of [
        ['métodos argentinos', PRESET_MATERIALS, PRESET_METHODS],
        ['métodos de referencia', REFERENCE_MATERIALS, REFERENCE_METHODS],
      ] as const) {
        it(`se calcula sin avisos con los ${label}`, () => {
          for (const m of methods) {
            const r = compute(d, m, mats);
            expect(r.warnings, `${t.id} · ${m.id}`).toEqual([]);
            expect(r.parts.length).toBeGreaterThan(4);
          }
        });
      }
    });
  }

  it('cada plantilla trae lo que dice', () => {
    const parts = (id: string) => {
      const t = TEMPLATES.find((x) => x.id === id)!;
      return compute(t.build(t.size, gen), PRESET_METHODS[0]!, PRESET_MATERIALS).parts;
    };
    expect(count(parts('bajo-puertas'), 'door')).toBe(1);
    expect(count(parts('bajo-puertas'), 'shelf')).toBe(1);
    expect(count(parts('bajo-puertas'), 'plinth')).toBe(1);
    expect(count(parts('bajo-cajonera'), 'drawer-front')).toBe(3);
    expect(count(parts('bajo-mixto'), 'drawer-front')).toBe(1);
    expect(count(parts('bajo-mixto'), 'door')).toBe(1);
    expect(count(parts('bajo-pileta'), 'door')).toBe(2);
    expect(count(parts('bajo-pileta'), 'shelf')).toBe(0);
    expect(count(parts('alacena'), 'door')).toBe(2);
    expect(count(parts('alacena-abierta'), 'door')).toBe(0);
    expect(count(parts('columna'), 'door')).toBe(2);
    expect(count(parts('placard'), 'door')).toBe(2);
    expect(count(parts('placard'), 'divider')).toBe(1);
    expect(count(parts('estanteria'), 'shelf')).toBe(4);
    expect(parts('vacio').filter((p) => !['side', 'top', 'bottom', 'back'].includes(p.role))).toEqual([]);
  });

  it('se adaptan a otras medidas: un bajo de 900 lleva dos puertas', () => {
    const t = TEMPLATES.find((x) => x.id === 'bajo-puertas')!;
    const r = compute(t.build({ ...t.size, w: 90000 }, gen), PRESET_METHODS[0]!, PRESET_MATERIALS);
    expect(r.warnings).toEqual([]);
    expect(count(r.parts, 'door')).toBe(2);
  });
});
