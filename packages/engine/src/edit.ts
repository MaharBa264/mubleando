import type { Design, Split, Zone } from './types';
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
