import type { Design, Zone } from '@mw/engine';

/** Nombre legible de cada hueco: "Interior", "Nivel 2", "Columna 1 › Nivel 3"… */
export function zoneLabels(design: Design): Map<string, { short: string; full: string }> {
  const out = new Map<string, { short: string; full: string }>();
  const walk = (z: Zone, path: string[]) => {
    const short = path.length === 0 ? 'Interior' : path[path.length - 1]!;
    out.set(z.id, { short, full: path.length === 0 ? 'Interior' : path.join(' › ') });
    z.split?.children.forEach((c, i) => {
      // Los estantes apilan de abajo arriba: el nivel 1 es el de abajo.
      const name = z.split!.axis === 'y' ? `Nivel ${i + 1}` : `Columna ${i + 1}`;
      walk(c, [...path, name]);
    });
  };
  walk(design.root, []);
  return out;
}
