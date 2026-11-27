import { describe, expect, it } from 'vitest';
import { compute, mm, newDesign, PRESET_HARDWARE, PRESET_MATERIALS, PRESET_METHODS, roomSize, setDivisions, setPlinth, templateById } from '../src';

const MAT = PRESET_MATERIALS;
const MET = PRESET_METHODS[0]!;
const HW = PRESET_HARDWARE;
let seq = 0;
const idGen = () => `c${++seq}`;

describe('esquinero ciego con mecanismo (#12)', () => {
  it('esquinero de 1000 con puerta de 450 y rinconero extraíble: panel ciego de 550, mecanismo en herrajes y sin estantes', () => {
    let d = setPlinth(newDesign({ w: mm(1000), h: mm(860), d: mm(560) }, idGen), { height: mm(100), setback: mm(50) });
    d = setDivisions(d, d.root.id, 'y', 1, idGen);
    d = { ...d, blindCorner: { blindSide: 'left', doorWidth: mm(450), hardwareId: 'hw-rinconero-extraible-450' } };

    const r = compute(d, MET, MAT, HW);
    const blind = r.parts.find((p) => p.role === 'blind-panel');
    const door = r.parts.find((p) => p.role === 'door');
    const shelves = r.parts.filter((p) => p.role === 'shelf');
    const cornerHw = r.hardware.find((h) => h.kind === 'corner');

    expect(blind).toBeDefined();
    expect(blind!.width).toBe(mm(550));
    expect(blind!.box.x).toBe(0);
    expect(door).toBeDefined();
    expect(door!.hinge).toBe('right');
    expect(shelves).toHaveLength(0);
    expect(cornerHw).toBeDefined();
    expect(cornerHw!.qty).toBe(1);
    expect(cornerHw!.unit).toBe('juego');
    expect(r.cornerMechanism?.type).toBe('pull-out');
    expect(r.cornerMechanism?.blindSide).toBe('left');
  });

  it('avisa si el mueble es más angosto que el mínimo del mecanismo o la puerta es chica', () => {
    const d = {
      ...setPlinth(newDesign({ w: mm(800), h: mm(860), d: mm(560) }, idGen), { height: mm(100), setback: mm(50) }),
      blindCorner: { blindSide: 'right' as const, doorWidth: mm(400), hardwareId: 'hw-rinconero-extraible-450' },
    };
    const r = compute(d, MET, MAT, HW);
    const hwWarnings = r.warnings.filter((w) => w.code === 'hardware_mismatch');
    expect(hwWarnings.some((w) => w.message.includes('900'))).toBe(true);
    expect(hwWarnings.some((w) => w.message.includes('450'))).toBe(true);
  });

  it('en ambiente, solo registra la puerta y no el panel ciego como hoja abatible', () => {
    const tpl = templateById('bajo-esquinero-ciego')!;
    const d = tpl.build(tpl.size, idGen);
    const r = compute(d, MET, MAT, HW);
    const sz = roomSize(d, r, HW);
    expect(sz.doors).toHaveLength(1);
    expect(sz.doors![0]!.hinge).toBe('right');
    expect(sz.doors![0]!.x0).toBeGreaterThan(mm(500));
  });
});
