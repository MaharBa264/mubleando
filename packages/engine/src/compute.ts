import type { Box, ComputeResult, Design, Edges, Material, Method, Part, PartRole, Warning, Zone, ZoneOut } from './types';
import { distribute, mm, toMm, type Len } from './units';

export const LIMITS = {
  w: { min: mm(100), max: mm(3000) },
  h: { min: mm(100), max: mm(3000) },
  d: { min: mm(100), max: mm(1200) },
} as const;

const FALLBACK_THICKNESS = mm(19);

/** Roles que llevan canto en el frente (L1) cuando el método define canto frontal. */
const FRONT_EDGED: ReadonlySet<PartRole> = new Set(['side', 'top', 'bottom', 'shelf', 'divider']);

const NO_EDGES: Edges = { L1: null, L2: null, W1: null, W2: null };

/**
 * Convierte un diseño en piezas. Función pura y determinista:
 * la misma entrada da siempre la misma salida, en el navegador o en el servidor.
 */
export function compute(design: Design, method: Method, materials: readonly Material[]): ComputeResult {
  const mats = new Map(materials.map((m) => [m.id, m]));
  const warnings: Warning[] = [];
  const parts: Part[] = [];
  const zones: ZoneOut[] = [];

  const thicknessOf = (id: string, what: string): Len => {
    const m = mats.get(id);
    if (!m) {
      warnings.push({ code: 'material_missing', message: `Falta el material de ${what}; se usa ${toMm(FALLBACK_THICKNESS)} mm.` });
      return FALLBACK_THICKNESS;
    }
    return m.thickness;
  };
  const edgeThickness = (id: string | null): Len => (id ? (mats.get(id)?.thickness ?? 0) : 0);
  const grainOf = (id: string) => mats.get(id)?.grain ?? 'none';

  const { w: W, h: H, d: D } = design.size;
  for (const k of ['w', 'h', 'd'] as const) {
    const v = design.size[k];
    if (v < LIMITS[k].min || v > LIMITS[k].max) {
      warnings.push({
        code: 'size_out_of_range',
        message: `${{ w: 'El ancho', h: 'El alto', d: 'El fondo' }[k]} debe estar entre ${toMm(LIMITS[k].min)} y ${toMm(LIMITS[k].max)} mm.`,
      });
    }
  }

  const t = thicknessOf(method.carcassMaterialId, 'la estructura');
  const frontEdge = method.frontEdgeMaterialId;
  if (frontEdge && !mats.has(frontEdge)) {
    warnings.push({ code: 'material_missing', message: 'Falta el material del canto frontal; las piezas salen sin canto.' });
  }

  const addPart = (p: {
    key: string;
    role: PartRole;
    name: string;
    materialId: string;
    thickness: Len;
    length: Len;
    width: Len;
    box: Box;
    zoneId?: string;
  }) => {
    const edges: Edges =
      frontEdge && mats.has(frontEdge) && FRONT_EDGED.has(p.role) ? { ...NO_EDGES, L1: frontEdge } : { ...NO_EDGES };
    const reduce = method.edgeReducesCut;
    const cutWidth = p.width - (reduce ? edgeThickness(edges.L1) + edgeThickness(edges.L2) : 0);
    const cutLength = p.length - (reduce ? edgeThickness(edges.W1) + edgeThickness(edges.W2) : 0);
    parts.push({ ...p, cutLength, cutWidth, edges, grain: grainOf(p.materialId) });
  };

  // ── trasera ──
  const back = method.back;
  let carcassZ0: Len = 0;
  let innerZ0: Len = 0;
  let backPart: Parameters<typeof addPart>[0] | null = null;

  if (back.mode !== 'none') {
    const tb = thicknessOf(back.materialId, 'la trasera');
    if (back.mode === 'overlay') {
      carcassZ0 = tb;
      innerZ0 = tb;
      backPart = {
        key: 'back',
        role: 'back',
        name: 'Trasera',
        materialId: back.materialId,
        thickness: tb,
        length: H,
        width: W,
        box: { x: 0, y: 0, z: 0, dx: W, dy: H, dz: tb },
      };
    } else {
      if (back.grooveDepth >= t) {
        warnings.push({ code: 'groove_too_deep', message: 'La ranura de la trasera es tan profunda como el tablero o más.' });
      }
      const into = back.grooveDepth - back.clearance; // lo que entra la trasera en cada ranura
      innerZ0 = back.inset + tb;
      const bw = W - 2 * t + 2 * into;
      const bh = H - 2 * t + 2 * into;
      backPart = {
        key: 'back',
        role: 'back',
        name: 'Trasera',
        materialId: back.materialId,
        thickness: tb,
        length: bh,
        width: bw,
        box: { x: t - into, y: t - into, z: back.inset, dx: bw, dy: bh, dz: tb },
      };
    }
  }

  const carcassDz = D - carcassZ0;

  // ── caja: los costados van enteros; tapa y base entre costados ──
  addPart({
    key: 'side.left',
    role: 'side',
    name: 'Costado izquierdo',
    materialId: method.carcassMaterialId,
    thickness: t,
    length: H,
    width: carcassDz,
    box: { x: 0, y: 0, z: carcassZ0, dx: t, dy: H, dz: carcassDz },
  });
  addPart({
    key: 'side.right',
    role: 'side',
    name: 'Costado derecho',
    materialId: method.carcassMaterialId,
    thickness: t,
    length: H,
    width: carcassDz,
    box: { x: W - t, y: 0, z: carcassZ0, dx: t, dy: H, dz: carcassDz },
  });

  const innerW = W - 2 * t;
  const innerH = H - 2 * t;
  if (innerW <= 0 || innerH <= 0) {
    warnings.push({ code: 'zone_too_small', message: 'El mueble es más estrecho o más bajo que dos tableros.' });
    return { parts, zones, warnings };
  }

  addPart({
    key: 'top',
    role: 'top',
    name: 'Tapa',
    materialId: method.carcassMaterialId,
    thickness: t,
    length: innerW,
    width: carcassDz,
    box: { x: t, y: H - t, z: carcassZ0, dx: innerW, dy: t, dz: carcassDz },
  });
  addPart({
    key: 'bottom',
    role: 'bottom',
    name: 'Base',
    materialId: method.carcassMaterialId,
    thickness: t,
    length: innerW,
    width: carcassDz,
    box: { x: t, y: 0, z: carcassZ0, dx: innerW, dy: t, dz: carcassDz },
  });
  if (backPart) addPart(backPart);

  // ── huecos interiores ──
  const inner: Box = { x: t, y: t, z: innerZ0, dx: innerW, dy: innerH, dz: D - innerZ0 };

  const layout = (zone: Zone, box: Box, parentId: string | null, depth: number, index: number) => {
    zones.push({ id: zone.id, parentId, depth, box, isLeaf: !zone.split, index });
    const split = zone.split;
    if (!split) return;

    const n = split.children.length;
    const along: 'dx' | 'dy' = split.axis === 'x' ? 'dx' : 'dy';
    const avail = box[along] - (n - 1) * t;
    const sizes = resolveSizes(split.sizes, avail, zone.id, warnings);

    let pos = split.axis === 'x' ? box.x : box.y;
    split.children.forEach((child, i) => {
      const size = Math.max(0, sizes[i] ?? 0);
      const childBox: Box = split.axis === 'x' ? { ...box, x: pos, dx: size } : { ...box, y: pos, dy: size };
      layout(child, childBox, zone.id, depth + 1, i);
      pos += size;
      if (i < n - 1) {
        if (split.axis === 'y') {
          const dz = box.dz - method.shelfFrontSetback;
          addPart({
            key: `zone:${zone.id}/div${i}`,
            role: 'shelf',
            name: 'Estante',
            materialId: method.carcassMaterialId,
            thickness: t,
            length: box.dx,
            width: dz,
            box: { x: box.x, y: pos, z: box.z, dx: box.dx, dy: t, dz },
            zoneId: zone.id,
          });
        } else {
          const dz = box.dz - method.dividerFrontSetback;
          addPart({
            key: `zone:${zone.id}/div${i}`,
            role: 'divider',
            name: 'Divisor',
            materialId: method.carcassMaterialId,
            thickness: t,
            length: box.dy,
            width: dz,
            box: { x: pos, y: box.y, z: box.z, dx: t, dy: box.dy, dz },
            zoneId: zone.id,
          });
        }
        pos += t;
      }
    });
  };
  layout(design.root, inner, null, 0, 0);

  // Numeración legible: Estante 1, 2... Divisor 1, 2...
  const counters: Partial<Record<PartRole, number>> = {};
  for (const p of parts) {
    if (p.role === 'shelf' || p.role === 'divider') {
      counters[p.role] = (counters[p.role] ?? 0) + 1;
      p.name = `${p.name} ${counters[p.role]}`;
    }
  }

  return { parts, zones, warnings };
}

/**
 * Tamaños de los huecos hijos. Los fijos se respetan; los `null` se reparten lo que sobra.
 * Si todos son fijos, el último absorbe la diferencia para que la suma cuadre siempre.
 */
export function resolveSizes(requested: readonly (Len | null)[], avail: Len, zoneId: string, warnings: Warning[]): Len[] {
  const fixed = requested.reduce<number>((s, v) => s + (v ?? 0), 0);
  const autoCount = requested.filter((v) => v === null).length;
  let remaining = avail - fixed;

  if (remaining < 0) {
    warnings.push({
      code: 'fixed_sizes_exceed',
      message: `Las medidas fijas suman ${toMm(fixed)} mm y solo caben ${toMm(Math.max(avail, 0))} mm.`,
      zoneId,
    });
  }

  let sizes: Len[];
  if (autoCount > 0) {
    const auto = distribute(Math.max(remaining, 0), autoCount);
    let k = 0;
    sizes = requested.map((v) => (v === null ? (auto[k++] ?? 0) : v));
  } else {
    sizes = [...requested] as Len[];
    const last = sizes.length - 1;
    sizes[last] = (sizes[last] ?? 0) + remaining;
    remaining = 0;
  }

  if (sizes.some((s) => s <= 0)) {
    warnings.push({ code: 'zone_too_small', message: 'Hay huecos sin espacio: quita divisiones o reduce las medidas fijas.', zoneId });
  }
  return sizes;
}
