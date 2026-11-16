import { z } from 'zod';
import type { Len } from './units';

// ───────────────────────── documento de diseño (lo que se guarda) ─────────────────────────

export interface Split {
  /** 'y' = estantes (apila de abajo arriba) · 'x' = divisores verticales (de izquierda a derecha) */
  axis: 'x' | 'y';
  /**
   * Altura / anchura libre de cada hueco hijo. `null` = automático (reparte lo que sobra).
   * Siempre tiene la misma longitud que `children`.
   */
  sizes: (Len | null)[];
  children: Zone[];
}

export interface Zone {
  id: string;
  split?: Split;
}

export interface Design {
  v: 1;
  shape: 'rect';
  size: { w: Len; h: Len; d: Len };
  root: Zone;
}

const lenSchema = z.number().int();

const zoneSchema: z.ZodType<Zone> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    split: z
      .object({
        axis: z.enum(['x', 'y']),
        sizes: z.array(lenSchema.nonnegative().nullable()),
        children: z.array(zoneSchema).min(2),
      })
      .refine((s) => s.sizes.length === s.children.length, 'sizes y children deben tener la misma longitud')
      .optional(),
  }),
);

export const designSchema: z.ZodType<Design> = z.object({
  v: z.literal(1),
  shape: z.literal('rect'),
  size: z.object({ w: lenSchema.positive(), h: lenSchema.positive(), d: lenSchema.positive() }),
  root: zoneSchema,
});

// ───────────────────────── bibliotecas ─────────────────────────

export interface Material {
  id: string;
  name: string;
  kind: 'panel' | 'edge';
  thickness: Len;
  /** 'length' = la veta va a lo largo de la pieza; no se puede girar al optimizar. */
  grain: 'none' | 'length';
  /** Precio en céntimos por m² (tableros) o por metro lineal (cantos). */
  priceCents: number;
  /** Color para el visor 3D, como token o valor CSS. */
  color: string;
}

export interface Method {
  id: string;
  name: string;
  /** Tablero de costados, tapa, base, estantes y divisores. */
  carcassMaterialId: string;
  back: {
    mode: 'groove' | 'overlay' | 'none';
    materialId: string;
    /** Profundidad de la ranura en costados, tapa y base (solo 'groove'). */
    grooveDepth: Len;
    /** Distancia desde el canto trasero del mueble hasta la ranura (solo 'groove'). */
    inset: Len;
    /** Holgura por lado entre la trasera y el fondo de la ranura (solo 'groove'). */
    clearance: Len;
  };
  /** Retranqueo de los estantes respecto al frente. */
  shelfFrontSetback: Len;
  /** Retranqueo de los divisores verticales respecto al frente. */
  dividerFrontSetback: Len;
  /** Canto del frente visible. `null` = sin canto. */
  frontEdgeMaterialId: string | null;
  /** Si el espesor del canto se descuenta de la medida de corte. */
  edgeReducesCut: boolean;
}

// ───────────────────────── salida del motor ─────────────────────────

export type PartRole = 'side' | 'top' | 'bottom' | 'back' | 'shelf' | 'divider';

/** Caja en coordenadas del mueble: x a la derecha, y hacia arriba, z hacia el frente. Origen en la esquina trasera inferior izquierda. */
export interface Box {
  x: Len;
  y: Len;
  z: Len;
  dx: Len;
  dy: Len;
  dz: Len;
}

/** Cantos: L1/L2 a lo largo del largo, W1/W2 a lo largo del ancho. L1 es siempre el canto frontal si lo hay. */
export interface Edges {
  L1: string | null;
  L2: string | null;
  W1: string | null;
  W2: string | null;
}

export interface Part {
  /** Clave estable entre recálculos (sirve para overrides futuros). */
  key: string;
  role: PartRole;
  name: string;
  materialId: string;
  thickness: Len;
  /** Medida acabada (con canto). */
  length: Len;
  width: Len;
  /** Medida de corte del tablero. */
  cutLength: Len;
  cutWidth: Len;
  edges: Edges;
  grain: 'none' | 'length';
  box: Box;
  /** Hueco que crea o que divide esta pieza. */
  zoneId?: string;
  /**
   * Conjunto al que pertenece la pieza, si no es parte de la estructura fija.
   * Lo usarán los cajones (fase 2): todas las piezas de un mismo cajón comparten `id`.
   * Las exportaciones (por ejemplo STL) lo usan para separar o integrar ese conjunto.
   */
  assembly?: PartAssembly;
}

export interface PartAssembly {
  id: string;
  kind: 'drawer';
  /** Nombre visible, por ejemplo "Cajón 2". */
  name: string;
}

export interface ZoneOut {
  id: string;
  parentId: string | null;
  depth: number;
  box: Box;
  isLeaf: boolean;
  /** Posición dentro del padre (0 = primero). */
  index: number;
}

export interface Warning {
  code: 'zone_too_small' | 'fixed_sizes_exceed' | 'groove_too_deep' | 'material_missing' | 'size_out_of_range';
  message: string;
  zoneId?: string;
}

export interface ComputeResult {
  parts: Part[];
  zones: ZoneOut[];
  warnings: Warning[];
}
