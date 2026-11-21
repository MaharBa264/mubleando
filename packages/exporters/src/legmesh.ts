/**
 * Malla de una pata para los STL: un tronco de pirámide (sección cuadrada) o de cono (redonda),
 * con la cara de arriba en la base del mueble y la de abajo en el piso, inclinado si la pata se
 * abre hacia afuera. Triángulos con las normales hacia fuera.
 */
import type { LegOut } from '@mw/engine';

export type V3 = [number, number, number];
export type Tri3 = [V3, V3, V3];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Triángulo ordenado para que su normal apunte hacia `out`. */
function oriented(a: V3, b: V3, c: V3, out: V3): Tri3 {
  return dot(cross(sub(b, a), sub(c, a)), out) >= 0 ? [a, b, c] : [a, c, b];
}

/**
 * Triángulos de una pata. `map` pasa de los ejes del motor (1/100 mm; y hacia arriba) a los del
 * archivo; `minSize` engorda la pata hasta ese lado o diámetro (en unidades del motor) para que se
 * pueda imprimir a escala.
 */
export function legTriangles(leg: LegOut, map: (p: V3) => V3, minSize = 0): Tri3[] {
  const square = leg.section === 'square';
  const n = square ? 4 : 24;
  // El cuadrado se arma con 4 lados girados 45°: radio = lado / √2.
  const k = square ? Math.SQRT1_2 : 0.5;
  const rTop = Math.max(leg.topSize, minSize) * k;
  const rBot = Math.max(leg.bottomSize, minSize) * k;
  const phase = square ? Math.PI / 4 : 0;
  const ring = (cx: number, y: number, cz: number, r: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (2 * Math.PI * i) / n;
      return map([cx + r * Math.cos(a), y, cz + r * Math.sin(a)]);
    });
  const top = ring(leg.top.x, leg.height, leg.top.z, rTop);
  const bot = ring(leg.foot.x, 0, leg.foot.z, rBot);
  const cTop = map([leg.top.x, leg.height, leg.top.z]);
  const cBot = map([leg.foot.x, 0, leg.foot.z]);
  const mid: V3 = [(cTop[0] + cBot[0]) / 2, (cTop[1] + cBot[1]) / 2, (cTop[2] + cBot[2]) / 2];
  const up = sub(cTop, cBot);
  const down = sub(cBot, cTop);
  const tris: Tri3[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const fc: V3 = [(top[i]![0] + top[j]![0] + bot[i]![0] + bot[j]![0]) / 4, (top[i]![1] + top[j]![1] + bot[i]![1] + bot[j]![1]) / 4, (top[i]![2] + top[j]![2] + bot[i]![2] + bot[j]![2]) / 4];
    const out = sub(fc, mid);
    tris.push(oriented(bot[i]!, bot[j]!, top[j]!, out), oriented(bot[i]!, top[j]!, top[i]!, out));
    tris.push(oriented(cTop, top[i]!, top[j]!, up), oriented(cBot, bot[i]!, bot[j]!, down));
  }
  return tris;
}

/** Volumen de una malla cerrada (para las pruebas: positivo si las normales miran hacia fuera). */
export function meshVolume(tris: readonly Tri3[]): number {
  return tris.reduce((s, [a, b, c]) => s + dot(a, cross(b, c)) / 6, 0);
}
