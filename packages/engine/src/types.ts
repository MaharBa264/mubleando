import { z } from 'zod';
import { hardwareChoiceSchema, type HardwareChoice, type HardwareItem } from './hardware';
import type { LegOut } from './legs';
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

/**
 * Cómo va montado un frente (puerta o frente de cajón):
 * - 'overlay' (superpuesto): tapa el canto de los tableros que rodean el hueco.
 * - 'inset' (encastrado): queda dentro del hueco, enrasado con el frente del mueble.
 */
export type FrontMount = 'overlay' | 'inset';

export interface DoorFront {
  kind: 'door';
  /** Una hoja o dos. */
  leaves: 1 | 2;
  /** Lado de las bisagras si es de una hoja. */
  hinge: 'left' | 'right';
  mount: FrontMount;
}

export interface DrawerFront {
  kind: 'drawers';
  mount: FrontMount;
  /**
   * Altura visible de cada frente de cajón, **de arriba abajo** (el índice 0 es el cajón de arriba).
   * `null` = automático (reparte lo que sobra). Su longitud es el número de cajones.
   */
  sizes: (Len | null)[];
}

/** Puertas corredizas: hojas en dos rieles, dentro del hueco. Las medidas salen del sistema corredizo elegido. */
export interface SlidingFront {
  kind: 'sliding';
  leaves: 2 | 3;
}

export type Front = DoorFront | DrawerFront | SlidingFront;

export interface Zone {
  id: string;
  split?: Split;
  /** Puerta(s) o cajones que cierran este hueco. */
  front?: Front;
}

export interface Plinth {
  /** Altura del zócalo (la base del mueble sube esta medida). */
  height: Len;
  /** Retranqueo del tablero de zócalo respecto al frente de los costados. */
  setback: Len;
}

/** Cambios hechos a mano a una pieza concreta, por su clave estable. */
export interface PartOverride {
  /** Otro tablero del mismo espesor. */
  materialId?: string;
  /** Cantos por lado. `null` = sin canto en ese lado; ausente = el del método. */
  edges?: Partial<Edges>;
  /** Solo estantes y divisores: retranqueo respecto al frente, en lugar del del método. */
  frontSetback?: Len;
}

/**
 * Cómo se arma la caja. Todo es opcional: lo que falta es lo habitual (tapa y base entre
 * costados, con el fondo del método).
 */
export interface Construction {
  /**
   * - 'between': entre los costados (los costados van enteros).
   * - 'over': encima de los costados, de lado a lado (los costados son más cortos).
   * - 'rails': dos travesaños (delantero y trasero) en lugar de tapa, típico de bajo mesada.
   * - 'none': sin tapa.
   */
  top?: 'between' | 'over' | 'rails' | 'none';
  /** 'between': entre los costados · 'under': debajo de los costados, de lado a lado. */
  bottom?: 'between' | 'under';
  /** 'method': el fondo que diga el método · 'none': sin fondo. */
  back?: 'method' | 'none';
  /** Ancho (fondo) de cada travesaño. Por defecto 100 mm. */
  railWidth?: Len;
}

export interface Design {
  v: 1;
  shape: 'rect';
  size: { w: Len; h: Len; d: Len };
  root: Zone;
  /** Zócalo. Ausente = el mueble apoya directamente en la base. */
  plinth?: Plinth;
  /** Cambios por pieza: clave de la pieza → cambio. */
  overrides?: Record<string, PartOverride>;
  /** Cómo se unen tapa, base y fondo. Ausente = lo habitual. */
  construction?: Construction;
  /** Herrajes elegidos para este mueble. Lo que falta sale del método de fabricación. */
  hardware?: HardwareChoice;
  /**
   * Patas (herraje de la biblioteca). Sin zócalo, el mueble sube el alto de la pata; con zócalo,
   * las patas van ocultas detrás (las regulables de cocina) y el alto lo da el zócalo.
   */
  legs?: Legs;
}

export interface Legs {
  hardwareId: string;
  /** El alto del mueble incluye las patas (por defecto). Si no, el mueble mide su alto más las patas. */
  includeInHeight?: boolean;
}

const lenSchema = z.number().int();

const frontSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('door'),
    leaves: z.union([z.literal(1), z.literal(2)]),
    hinge: z.enum(['left', 'right']),
    mount: z.enum(['overlay', 'inset']),
  }),
  z.object({
    kind: z.literal('sliding'),
    leaves: z.union([z.literal(2), z.literal(3)]),
  }),
  z.object({
    kind: z.literal('drawers'),
    mount: z.enum(['overlay', 'inset']),
    sizes: z.array(lenSchema.positive().nullable()).min(1).max(12),
  }),
]);

const edgeRefSchema = z.string().nullable();

const zoneSchema: z.ZodType<Zone> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    front: frontSchema.optional(),
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
  plinth: z.object({ height: lenSchema.nonnegative(), setback: lenSchema.nonnegative() }).optional(),
  legs: z.object({ hardwareId: z.string().min(1), includeInHeight: z.boolean().optional() }).optional(),
  overrides: z
    .record(
      z.string(),
      z.object({
        materialId: z.string().optional(),
        edges: z.object({ L1: edgeRefSchema, L2: edgeRefSchema, W1: edgeRefSchema, W2: edgeRefSchema }).partial().optional(),
        frontSetback: lenSchema.nonnegative().optional(),
      }),
    )
    .optional(),
  construction: z
    .object({
      top: z.enum(['between', 'over', 'rails', 'none']).optional(),
      bottom: z.enum(['between', 'under']).optional(),
      back: z.enum(['method', 'none']).optional(),
      railWidth: lenSchema.positive().optional(),
    })
    .optional(),
  hardware: hardwareChoiceSchema.optional(),
});

// ───────────────────────── bibliotecas ─────────────────────────

export interface Material {
  id: string;
  name: string;
  kind: 'panel' | 'edge';
  thickness: Len;
  /** 'length' = la veta va a lo largo de la pieza; no se puede girar al optimizar. */
  grain: 'none' | 'length';
  /** Precio en centavos por m² (tableros) o por metro lineal (cantos). */
  priceCents: number;
  /** Color para el visor 3D, como token o valor CSS. */
  color: string;
  /** Medida de la placa que se compra (tableros). Sin ella, la de partida según el espesor (ver cutting.ts). */
  sheet?: { length: Len; width: Len };
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
  /**
   * Solo se descuentan los cantos de este espesor o más. 0 = todos. Por ejemplo, con 1 mm el
   * tapacanto de 0,45 no cambia la medida de corte y el de 2 mm sí (así trabajan muchas madereras).
   */
  edgeReduceMin: Len;
  /** Puertas y frentes de cajón. */
  fronts: {
    materialId: string;
    /** Canto de los cuatro lados de cada frente. `null` = sin canto. */
    edgeMaterialId: string | null;
    /**
     * Holgura entre frentes vecinos. En los frentes superpuestos, la mitad queda también
     * en el borde exterior del mueble; en los encastrados, la holgura entera rodea el frente.
     */
    gap: Len;
  };
  /** Herrajes por defecto de los muebles hechos con este método. Sin herraje, se usan las holguras de aquí. */
  hardware?: HardwareChoice;
  /** Estructura de los cajones. */
  drawer: {
    /** Tablero de laterales, trasera y contrafrente. */
    materialId: string;
    bottomMaterialId: string;
    /** 'groove' = fondo en ranura · 'under' = fondo clavado por debajo. */
    bottomMode: 'groove' | 'under';
    /** Profundidad de la ranura del fondo (lo que entra el fondo en cada lado). */
    grooveDepth: Len;
    /** Altura de la ranura del fondo sobre el canto inferior de los laterales. */
    grooveHeight: Len;
    /** Hueco a cada lado entre el cajón y el mueble, para la guía (12,5–13 mm en guías de bolas). */
    sideClearance: Len;
    /** Espacio libre por encima de la caja del cajón. */
    topClearance: Len;
    /** Espacio libre por debajo de la caja del cajón. */
    bottomClearance: Len;
    /** Espacio mínimo libre detrás del cajón. */
    rearClearance: Len;
    /** El fondo del cajón se redondea hacia abajo a múltiplos de esta medida (largos de guía). 0 = sin redondeo. */
    depthStep: Len;
  };
}

// ───────────────────────── salida del motor ─────────────────────────

export type PartRole =
  | 'side'
  | 'top'
  | 'bottom'
  | 'back'
  | 'shelf'
  | 'divider'
  | 'plinth'
  | 'door'
  | 'drawer-front'
  | 'drawer-side'
  | 'drawer-back'
  | 'drawer-bottom';

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
  /** Hueco que crea, divide o cierra esta pieza. */
  zoneId?: string;
  /**
   * Conjunto al que pertenece la pieza, si no es parte de la estructura fija.
   * Todas las piezas de un mismo cajón (frente incluido) comparten `id`.
   * Las exportaciones (por ejemplo STL) lo usan para separar o integrar ese conjunto.
   */
  assembly?: PartAssembly;
  /** La pieza tiene cambios hechos a mano (material o cantos). */
  overridden?: boolean;
  /** Solo puertas: lado de las bisagras (para abrirla en el visor y, más adelante, taladrar). */
  hinge?: 'left' | 'right';
  /** Solo puertas corredizas: riel en el que va la hoja. */
  track?: 'front' | 'back';
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
  code:
    | 'zone_too_small'
    | 'fixed_sizes_exceed'
    | 'groove_too_deep'
    | 'material_missing'
    | 'size_out_of_range'
    | 'front_collision'
    | 'drawer_too_small'
    | 'drawer_on_split'
    | 'override_ignored'
    | 'hardware_mismatch';
  message: string;
  zoneId?: string;
}

export interface ComputeResult {
  parts: Part[];
  zones: ZoneOut[];
  warnings: Warning[];
  /** Herrajes que lleva el mueble (bisagras, correderas, sistemas corredizos), si se pasó la biblioteca. */
  hardware: HardwareItem[];
  /** Patas del mueble (vacío si no lleva). */
  legs: LegOut[];
}

// ───────────────────────── validación de bibliotecas guardadas ─────────────────────────

export const materialSchema: z.ZodType<Material> = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  kind: z.enum(['panel', 'edge']),
  thickness: lenSchema.positive(),
  grain: z.enum(['none', 'length']),
  priceCents: z.number().int().nonnegative(),
  color: z.string().min(1),
  sheet: z.object({ length: lenSchema.positive(), width: lenSchema.positive() }).optional(),
});

export const methodSchema: z.ZodType<Method> = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  carcassMaterialId: z.string().min(1),
  back: z.object({
    mode: z.enum(['groove', 'overlay', 'none']),
    materialId: z.string(),
    grooveDepth: lenSchema.nonnegative(),
    inset: lenSchema.nonnegative(),
    clearance: lenSchema.nonnegative(),
  }),
  shelfFrontSetback: lenSchema.nonnegative(),
  dividerFrontSetback: lenSchema.nonnegative(),
  frontEdgeMaterialId: z.string().nullable(),
  edgeReducesCut: z.boolean(),
  edgeReduceMin: lenSchema.nonnegative(),
  hardware: hardwareChoiceSchema.optional(),
  fronts: z.object({
    materialId: z.string().min(1),
    edgeMaterialId: z.string().nullable(),
    gap: lenSchema.nonnegative(),
  }),
  drawer: z.object({
    materialId: z.string().min(1),
    bottomMaterialId: z.string().min(1),
    bottomMode: z.enum(['groove', 'under']),
    grooveDepth: lenSchema.nonnegative(),
    grooveHeight: lenSchema.nonnegative(),
    sideClearance: lenSchema.nonnegative(),
    topClearance: lenSchema.nonnegative(),
    bottomClearance: lenSchema.nonnegative(),
    rearClearance: lenSchema.nonnegative(),
    depthStep: lenSchema.nonnegative(),
  }),
});
