/**
 * Medidas de un mueble para el ambiente, a partir de lo que calcula el motor: el alto real (con
 * las patas, si suman), lo que sobresalen las patas inclinadas y sus puertas de bisagra.
 */
import { legsOverhang } from './legs';
import type { CabinetSize } from './room';
import { PRESET_HARDWARE, type Hardware } from './hardware';
import type { ComputeResult, Design } from './types';

export function roomSize(design: Design, result: Pick<ComputeResult, 'parts' | 'legs'> & Partial<Pick<ComputeResult, 'hardware'>>, hardwareLib: readonly Hardware[] = []): CabinetSize {
  const { w, d } = design.size;
  const h = Math.max(design.size.h, ...result.parts.map((p) => p.box.y + p.box.dy));
  const size: CabinetSize = { w, h, d };
  if (result.legs.length) {
    size.overhang = legsOverhang(result.legs, w, d);
    size.legHeight = Math.max(...result.legs.map((l) => l.height));
  }
  // Ángulo de las puertas que abren hacia arriba o abajo: el del herraje de apertura que llevan.
  const liftId = result.hardware?.find((h) => h.kind === 'lift')?.hardwareId;
  const lift = liftId ? [...hardwareLib, ...PRESET_HARDWARE].find((h) => h.id === liftId && h.kind === 'lift') : undefined;
  const angle = lift?.kind === 'lift' ? lift.spec.angle : 90;
  // Puertas de bisagra: una por hoja (las de marco y vidrio, por el rectángulo de la puerta entera).
  const seen = new Set<string>();
  const doors: NonNullable<CabinetSize['doors']> = [];
  for (const p of result.parts) {
    if (p.track || !p.hinge || !(p.role === 'door' || p.doorBox)) continue;
    const b = p.doorBox ?? p.box;
    const k = `${b.x},${b.y}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const vertical = p.hinge === 'top' || p.hinge === 'bottom';
    doors.push({ x0: b.x, width: b.dx, y0: b.y, y1: b.y + b.dy, hinge: p.hinge, ...(vertical ? { angle } : {}) });
  }
  if (doors.length) size.doors = doors;
  return size;
}
