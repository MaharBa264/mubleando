import type { Construction, Design, Front, PartOverride, Plinth, Split, Zone } from './types';
import type { Len } from './units';

export type IdGen = () => string;

export const defaultIdGen: IdGen = () => globalThis.crypto.randomUUID().slice(0, 8);

export function newDesign(size: Design['size'], idGen: IdGen = defaultIdGen): Design {
  return { v: 1, shape: 'rect', size: { ...size }, root: { id: idGen() } };
}

export function findZone(root: Zone, id: string): Zone | undefined {
  if (root.id === id) return root;
  for (const c of root.split?.children ?? []) {
    const hit = findZone(c, id);
    if (hit) return hit;
  }
  return undefined;
}

/** Devuelve el padre de un hueco y su posición, o undefined si es la raíz o no existe. */
export function findParent(root: Zone, id: string): { parent: Zone; index: number } | undefined {
  const children = root.split?.children ?? [];
  for (let i = 0; i < children.length; i++) {
    const c = children[i]!;
    if (c.id === id) return { parent: root, index: i };
    const hit = findParent(c, id);
    if (hit) return hit;
  }
  return undefined;
}

function mapZone(zone: Zone, id: string, fn: (z: Zone) => Zone): Zone {
  if (zone.id === id) return fn(zone);
  if (!zone.split) return zone;
  const children = zone.split.children.map((c) => mapZone(c, id, fn));
  return children.every((c, i) => c === zone.split!.children[i]) ? zone : { ...zone, split: { ...zone.split, children } };
}

export function updateZone(design: Design, id: string, fn: (z: Zone) => Zone): Design {
  const root = mapZone(design.root, id, fn);
  return root === design.root ? design : { ...design, root };
}

export function setSize(design: Design, size: Partial<Design['size']>): Design {
  return { ...design, size: { ...design.size, ...size } };
}

/**
 * Pone `panels` estantes (axis 'y') o divisores (axis 'x') en un hueco, que queda partido en `panels + 1`.
 * Si el hueco ya estaba partido en el mismo eje, conserva los huecos existentes (y lo que tengan dentro)
 * y solo añade o quita por el final. Si estaba partido en el otro eje, lo sustituye.
 */
export function setDivisions(design: Design, zoneId: string, axis: Split['axis'], panels: number, idGen: IdGen = defaultIdGen): Design {
  const count = Math.max(0, Math.floor(panels)) + 1;
  return updateZone(design, zoneId, (z) => {
    if (count < 2) {
      const { split: _drop, ...rest } = z;
      return rest;
    }
    const prev = z.split?.axis === axis ? z.split : undefined;
    // Un hueco dividido no puede llevar cajones (sí una puerta que tape las divisiones).
    if (z.front?.kind === 'drawers') {
      const { front: _f, ...rest } = z;
      z = rest;
    }
    const children: Zone[] = [];
    const sizes: (Len | null)[] = [];
    for (let i = 0; i < count; i++) {
      const keep = prev?.children[i];
      children.push(keep ?? { id: idGen() });
      sizes.push(keep ? (prev!.sizes[i] ?? null) : null);
    }
    return { ...z, split: { axis, sizes, children } };
  });
}

export function removeDivisions(design: Design, zoneId: string): Design {
  return setDivisions(design, zoneId, 'y', 0);
}

/** Fija (o vuelve a automático con `null`) el tamaño libre de un hueco hijo. */
export function setChildSize(design: Design, parentZoneId: string, index: number, size: Len | null): Design {
  return updateZone(design, parentZoneId, (z) => {
    if (!z.split || index < 0 || index >= z.split.sizes.length) return z;
    const sizes = [...z.split.sizes];
    sizes[index] = size;
    return { ...z, split: { ...z.split, sizes } };
  });
}

/** Todos los huecos fijos a la vez vuelven a automático (reparto igual). */
export function equalize(design: Design, parentZoneId: string): Design {
  return updateZone(design, parentZoneId, (z) =>
    z.split ? { ...z, split: { ...z.split, sizes: z.split.sizes.map(() => null) } } : z,
  );
}

// ───────────────────────── frentes ─────────────────────────

function dropFronts(zone: Zone): Zone {
  const { front: _f, ...rest } = zone;
  if (!rest.split) return rest;
  return { ...rest, split: { ...rest.split, children: rest.split.children.map(dropFronts) } };
}

/** Ids de los huecos que contienen a `id` (de la raíz hacia abajo, sin incluirlo). */
function ancestors(root: Zone, id: string): string[] {
  const path: string[] = [];
  const walk = (z: Zone): boolean => {
    if (z.id === id) return true;
    for (const c of z.split?.children ?? []) {
      if (walk(c)) {
        path.unshift(z.id);
        return true;
      }
    }
    return false;
  };
  walk(root);
  return path;
}

/**
 * Pone (o quita, con `undefined`) el frente de un hueco.
 * Un frente tapa todo el hueco, así que se quitan los frentes de los huecos de dentro y de los que lo contienen.
 * Los cajones solo van en huecos sin divisiones: si el hueco está dividido, se quitan las divisiones.
 */
export function setFront(design: Design, zoneId: string, front: Front | undefined): Design {
  if (!findZone(design.root, zoneId)) return design;
  let d = design;
  for (const a of ancestors(design.root, zoneId)) {
    d = updateZone(d, a, (z) => {
      if (!z.front) return z;
      const { front: _f, ...rest } = z;
      return rest;
    });
  }
  return updateZone(d, zoneId, (z) => {
    const inner = dropFronts(z);
    if (!front) return inner;
    if (front.kind === 'drawers') {
      const { split: _s, ...leaf } = inner;
      return { ...leaf, front };
    }
    return { ...inner, front };
  });
}

/** Cambia el número de cajones de un hueco, conservando las alturas fijas de los que ya había. */
export function setDrawerCount(design: Design, zoneId: string, count: number): Design {
  const n = Math.min(12, Math.max(1, Math.floor(count)));
  return updateZone(design, zoneId, (z) => {
    if (z.front?.kind !== 'drawers') return z;
    const prev = z.front.sizes;
    const sizes = Array.from({ length: n }, (_, i) => prev[i] ?? null);
    return { ...z, front: { ...z.front, sizes } };
  });
}

/** Fija (o vuelve a automática con `null`) la altura del frente de un cajón. `index` 0 = el de arriba. */
export function setDrawerSize(design: Design, zoneId: string, index: number, size: Len | null): Design {
  return updateZone(design, zoneId, (z) => {
    if (z.front?.kind !== 'drawers' || index < 0 || index >= z.front.sizes.length) return z;
    const sizes = [...z.front.sizes];
    sizes[index] = size;
    return { ...z, front: { ...z.front, sizes } };
  });
}

// ───────────────────────── zócalo y cambios por pieza ─────────────────────────

export function setPlinth(design: Design, plinth: Plinth | undefined): Design {
  if (!plinth) {
    const { plinth: _p, ...rest } = design;
    return rest;
  }
  return { ...design, plinth: { ...plinth } };
}

/**
 * Guarda el cambio a mano de una pieza (material o cantos). `undefined` lo borra y la pieza vuelve a seguir el método.
 * Un cambio vacío (`{}`) también se borra.
 */
export function setOverride(design: Design, partKey: string, override: PartOverride | undefined): Design {
  const next = { ...(design.overrides ?? {}) };
  const empty =
    !override ||
    (override.materialId === undefined && override.frontSetback === undefined && (!override.edges || Object.keys(override.edges).length === 0));
  if (empty) delete next[partKey];
  else next[partKey] = override;
  if (Object.keys(next).length === 0) {
    const { overrides: _o, ...rest } = design;
    return rest;
  }
  return { ...design, overrides: next };
}

/** Cambia cómo se arma la caja (tapa, base, fondo, travesaños). Los valores habituales se quitan del diseño. */
export function setConstruction(design: Design, patch: Partial<Construction>): Design {
  const next: Construction = { ...design.construction, ...patch };
  if (next.top === 'between') delete next.top;
  if (next.bottom === 'between') delete next.bottom;
  if (next.back === 'method') delete next.back;
  if (next.top !== 'rails') delete next.railWidth;
  if (Object.keys(next).length === 0) {
    const { construction: _c, ...rest } = design;
    return rest;
  }
  return { ...design, construction: next };
}

/**
 * Pone el estante `index` de un hueco dividido en estantes a una altura exacta: `y` es la
 * distancia desde el piso del hueco hasta la cara de abajo del estante.
 *
 * `current` son las alturas que tienen ahora los niveles (las calcula el motor: `ZoneOut.box.dy`).
 * Para que el estante quede exactamente ahí aunque cambien las demás medidas, se fijan los niveles
 * de debajo con su altura actual y el nivel justo debajo del estante con la que haga falta.
 * Los niveles de encima siguen como estaban (si eran automáticos, se reparten lo que quede).
 */
export function setShelfHeight(design: Design, zoneId: string, index: number, y: Len, thickness: Len, current: readonly Len[]): Design {
  const zone = findZone(design.root, zoneId);
  const split = zone?.split;
  if (!split || split.axis !== 'y' || index < 0 || index >= split.children.length - 1) return design;
  let d = design;
  let start = 0;
  for (let k = 0; k < index; k++) {
    const size = split.sizes[k] ?? current[k] ?? 0;
    d = setChildSize(d, zoneId, k, size);
    start += size + thickness;
  }
  return setChildSize(d, zoneId, index, Math.max(1, y - start));
}
