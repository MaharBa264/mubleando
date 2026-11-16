/**
 * Todas las longitudes del motor son enteros en centésimas de milímetro (1 mm = 100).
 * Así una lista de corte nunca arrastra errores de coma flotante.
 */
export type Len = number;

/** mm → Len (redondea a la centésima). */
export const mm = (v: number): Len => Math.round(v * 100);

/** Len → mm (para mostrar o exportar). */
export const toMm = (l: Len): number => l / 100;

/** Área en Len² → m². */
export const toM2 = (a: number): number => a / 1e10;

/** Len → metros lineales. */
export const toMl = (l: Len): number => l / 100_000;

/**
 * Reparte `total` en `parts` enteros que suman exactamente `total`.
 * El resto (centésimas sobrantes) va a las primeras partes, de forma determinista.
 */
export function distribute(total: Len, parts: number): Len[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  let rest = total - base * parts;
  const out: Len[] = [];
  for (let i = 0; i < parts; i++) {
    out.push(base + (rest > 0 ? 1 : 0));
    if (rest > 0) rest--;
  }
  return out;
}
