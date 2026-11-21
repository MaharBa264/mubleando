import { z } from 'zod';
import { mm, type Len } from './units';

/**
 * Herrajes: bisagras, correderas de cajón, sistemas de puertas corredizas y patas.
 *
 * Cada herraje trae las medidas que el motor necesita para calcular las piezas (holguras,
 * descuentos, largos disponibles). Las constantes cambian de una marca a otra: los valores de
 * partida son típicos y hay que comprobarlos con la ficha técnica del herraje que se compre.
 *
 * Qué herraje usa cada mueble: el que elija el mueble (`design.hardware`) o, si no elige, el del
 * método de fabricación (`method.hardware`). Sin herraje, el motor usa las holguras del método.
 */

export interface HingeSpec {
  /**
   * Codo de la bisagra de cazoleta:
   * - 'full' (codo 0): puerta superpuesta, tapa todo el costado.
   * - 'half' (codo 9): puerta semisuperpuesta, dos puertas sobre un mismo costado o divisor.
   * - 'inset' (codo 18): puerta encastrada, dentro del hueco.
   */
  crank: 'full' | 'half' | 'inset';
  /** Diámetro de la cazoleta (taladro en la puerta). Casi siempre 35 mm. */
  cupDiameter: Len;
  /** Distancia del borde de la puerta al borde del taladro de la cazoleta (3 a 6 mm). */
  cupDistance: Len;
  softClose: boolean;
  /** Cuántas bisagras lleva una puerta según su alto: pares [alto hasta, cantidad], de menor a mayor. */
  countByHeight: [Len, number][];
}

export interface SlideSpec {
  /**
   * - 'ball': telescópica de bolas, al costado del cajón.
   * - 'roller': de rodillo (ruedita), al costado.
   * - 'undermount': oculta, debajo del cajón (tipo Blum Tandem, Hettich Quadro).
   * - 'metal': cajón con laterales metálicos (tipo Blum Antaro, Häfele Matrix): solo se cortan fondo y trasera.
   */
  type: 'ball' | 'roller' | 'undermount' | 'metal';
  /** Largos nominales que se venden, de menor a mayor. Se elige el mayor que entra. */
  lengths: Len[];
  /** 'ball' y 'roller': hueco a cada lado entre el costado del mueble y el lateral del cajón. */
  sideClearance: Len;
  /** 'undermount': ancho interior de la caja = ancho del hueco − esto (Blum Tandem: 42 mm). */
  innerWidthDeduction: Len;
  /** 'undermount': largo de la caja = largo nominal − esto (Blum Tandem: 10 mm). */
  lengthDeduction: Len;
  /** 'undermount': espesor máximo de los laterales del cajón (Blum Tandem: 16 mm). 0 = sin límite. */
  maxSideThickness: Len;
  /** 'metal': ancho del fondo = ancho del hueco − esto. */
  bottomWidthDeduction: Len;
  /** 'metal': ancho de la trasera = ancho del hueco − esto. */
  backWidthDeduction: Len;
  /** 'metal': largo del fondo = largo nominal − esto. */
  bottomLengthDeduction: Len;
}

export interface SlidingSpec {
  /** Hojas por hueco: 2 o 3, en dos rieles. */
  leaves: 2 | 3;
  /** Cuánto se monta una hoja sobre la siguiente (Häfele recomienda 20 mm). */
  overlap: Len;
  /** Luz entre la hoja y la tapa (riel de arriba). */
  topGap: Len;
  /** Luz entre la hoja y la base (riel de abajo). */
  bottomGap: Len;
  /** Distancia del frente del mueble a la cara de la hoja delantera. */
  frontSetback: Len;
  /** Separación entre las caras de las dos hojas (de riel a riel), además del espesor de la hoja. */
  trackGap: Len;
}

export interface LegSpec {
  /**
   * - 'straight': recta (misma sección arriba y abajo).
   * - 'tapered': cónica (más fina abajo).
   * - 'midcentury': estilo años 60: cónica e inclinada hacia afuera, con placa de montaje.
   * - 'adjustable': regulable de plástico (de cocina), normalmente oculta detrás de un zócalo.
   */
  style: 'straight' | 'tapered' | 'midcentury' | 'adjustable';
  section: 'square' | 'round';
  /** Alto de la pata (en las regulables, el alto de partida). */
  height: Len;
  /** Lado o diámetro arriba (donde se atornilla) y abajo (en el piso). */
  topSize: Len;
  bottomSize: Len;
  /** Inclinación hacia afuera, en grados (0 = vertical). */
  splay: number;
  /** Retiro desde los bordes del mueble hasta el borde de la pata. */
  inset: Len;
  /** Regulables: alto mínimo y máximo. 0 en las demás. */
  adjustMin: Len;
  adjustMax: Len;
  /** Cuántas patas según el ancho del mueble: pares [ancho hasta, cantidad], de menor a mayor. */
  countByWidth: [Len, number][];
}

export type Hardware =
  | { id: string; name: string; kind: 'hinge'; priceCents: number; spec: HingeSpec }
  | { id: string; name: string; kind: 'slide'; priceCents: number; spec: SlideSpec }
  | { id: string; name: string; kind: 'sliding'; priceCents: number; spec: SlidingSpec }
  | { id: string; name: string; kind: 'leg'; priceCents: number; spec: LegSpec };

export type HardwareKind = Hardware['kind'];

/** Qué herraje usa un mueble o un método, por tipo. */
export interface HardwareChoice {
  hinge?: string;
  slide?: string;
  sliding?: string;
}

/** Una línea de la lista de herrajes de un mueble. */
export interface HardwareItem {
  hardwareId: string;
  name: string;
  kind: HardwareKind;
  qty: number;
  /** Unidad de la cantidad: bisagras sueltas, pares de correderas o juegos corredizos. */
  unit: 'unidad' | 'par' | 'juego';
  priceCents: number;
  /** Detalle: largo de corredera, largo de riel… */
  note?: string;
}

// ───────────────────────── de partida ─────────────────────────

const HINGE_COUNT: [Len, number][] = [
  [mm(900), 2],
  [mm(1600), 3],
  [mm(2000), 4],
  [mm(2600), 5],
];
const LEG_COUNT: [Len, number][] = [
  [mm(1200), 4],
  [mm(2400), 6],
  [mm(3600), 8],
];
const steps = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => mm(from + i * step));
const NO_DEDUCTIONS = { innerWidthDeduction: 0, lengthDeduction: 0, maxSideThickness: 0, bottomWidthDeduction: 0, backWidthDeduction: 0, bottomLengthDeduction: 0 };

/** Herrajes de partida. Valores típicos: comprobalos con la ficha del herraje que compres. Sin precio. */
export const PRESET_HARDWARE: Hardware[] = [
  { id: 'hw-bisagra-codo0', name: 'Bisagra cazoleta 35 · codo 0 (superpuesta)', kind: 'hinge', priceCents: 0, spec: { crank: 'full', cupDiameter: mm(35), cupDistance: mm(4), softClose: false, countByHeight: HINGE_COUNT } },
  { id: 'hw-bisagra-codo0-cs', name: 'Bisagra cazoleta 35 · codo 0 · cierre suave', kind: 'hinge', priceCents: 0, spec: { crank: 'full', cupDiameter: mm(35), cupDistance: mm(4), softClose: true, countByHeight: HINGE_COUNT } },
  { id: 'hw-bisagra-codo9', name: 'Bisagra cazoleta 35 · codo 9 (semisuperpuesta)', kind: 'hinge', priceCents: 0, spec: { crank: 'half', cupDiameter: mm(35), cupDistance: mm(4), softClose: false, countByHeight: HINGE_COUNT } },
  { id: 'hw-bisagra-codo18', name: 'Bisagra cazoleta 35 · codo 18 (encastrada)', kind: 'hinge', priceCents: 0, spec: { crank: 'inset', cupDiameter: mm(35), cupDistance: mm(4), softClose: false, countByHeight: HINGE_COUNT } },
  {
    id: 'hw-corredera-bolas-45',
    name: 'Corredera telescópica de bolas 45 mm',
    kind: 'slide',
    priceCents: 0,
    spec: { type: 'ball', lengths: steps(250, 600, 50), sideClearance: mm(12.5), ...NO_DEDUCTIONS },
  },
  {
    id: 'hw-corredera-rodillo',
    name: 'Corredera de rodillo',
    kind: 'slide',
    priceCents: 0,
    spec: { type: 'roller', lengths: steps(250, 550, 50), sideClearance: mm(12.5), ...NO_DEDUCTIONS },
  },
  {
    id: 'hw-corredera-oculta',
    name: 'Corredera oculta bajo cajón (tipo Blum Tandem)',
    kind: 'slide',
    priceCents: 0,
    spec: { type: 'undermount', lengths: [mm(250), mm(270), ...steps(300, 600, 50)], sideClearance: 0, ...NO_DEDUCTIONS, innerWidthDeduction: mm(42), lengthDeduction: mm(10), maxSideThickness: mm(16) },
  },
  {
    id: 'hw-cajon-metalico',
    name: 'Cajón de laterales metálicos (valores de ejemplo)',
    kind: 'slide',
    priceCents: 0,
    spec: { type: 'metal', lengths: [mm(270), ...steps(300, 550, 50)], sideClearance: 0, ...NO_DEDUCTIONS, bottomWidthDeduction: mm(75), backWidthDeduction: mm(87), bottomLengthDeduction: mm(24) },
  },
  {
    id: 'hw-corredizo-2',
    name: 'Sistema corredizo 2 hojas',
    kind: 'sliding',
    priceCents: 0,
    spec: { leaves: 2, overlap: mm(20), topGap: mm(10), bottomGap: mm(10), frontSetback: mm(5), trackGap: mm(6) },
  },
  {
    id: 'hw-corredizo-3',
    name: 'Sistema corredizo 3 hojas',
    kind: 'sliding',
    priceCents: 0,
    spec: { leaves: 3, overlap: mm(20), topGap: mm(10), bottomGap: mm(10), frontSetback: mm(5), trackGap: mm(6) },
  },
  ...PRESET_LEGS(),
];

/** Patas de partida (también se agregan solas a las bibliotecas que ya existían sin patas). */
function PRESET_LEGS(): Hardware[] {
  const leg = (id: string, name: string, spec: Partial<LegSpec> & Pick<LegSpec, 'style' | 'section' | 'height' | 'topSize' | 'bottomSize'>): Hardware => ({
    id,
    name,
    kind: 'leg',
    priceCents: 0,
    spec: { splay: 0, inset: mm(30), adjustMin: 0, adjustMax: 0, countByWidth: LEG_COUNT, ...spec },
  });
  return [
    leg('hw-pata-regulable', 'Pata regulable plástica 100 mm (para zócalo)', { style: 'adjustable', section: 'round', height: mm(100), topSize: mm(50), bottomSize: mm(40), inset: mm(40), adjustMin: mm(95), adjustMax: mm(150) }),
    leg('hw-pata-recta-cuadrada', 'Pata recta cuadrada 40 × 40', { style: 'straight', section: 'square', height: mm(150), topSize: mm(40), bottomSize: mm(40) }),
    leg('hw-pata-recta-redonda', 'Pata recta redonda Ø 40', { style: 'straight', section: 'round', height: mm(150), topSize: mm(40), bottomSize: mm(40) }),
    leg('hw-pata-conica', 'Pata cónica Ø 45 → 25', { style: 'tapered', section: 'round', height: mm(150), topSize: mm(45), bottomSize: mm(25) }),
    leg('hw-pata-60', 'Pata estilo años 60, inclinada 12°', { style: 'midcentury', section: 'round', height: mm(200), topSize: mm(45), bottomSize: mm(22), splay: 12, inset: mm(50) }),
  ];
}
export const PRESET_LEG_IDS = PRESET_LEGS().map((h) => h.id);

/** Herrajes que usan por defecto los métodos de partida argentinos. */
export const DEFAULT_HARDWARE_CHOICE: HardwareChoice = { hinge: 'hw-bisagra-codo0', slide: 'hw-corredera-bolas-45', sliding: 'hw-corredizo-2' };

// ───────────────────────── validación ─────────────────────────

const len = z.number().int();
const nonNeg = len.nonnegative();

export const hardwareSchema: z.ZodType<Hardware> = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(120),
    kind: z.literal('hinge'),
    priceCents: z.number().int().nonnegative(),
    spec: z.object({
      crank: z.enum(['full', 'half', 'inset']),
      cupDiameter: len.positive(),
      cupDistance: nonNeg,
      softClose: z.boolean(),
      countByHeight: z.array(z.tuple([len.positive(), z.number().int().min(1).max(10)])).min(1),
    }),
  }),
  z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(120),
    kind: z.literal('slide'),
    priceCents: z.number().int().nonnegative(),
    spec: z.object({
      type: z.enum(['ball', 'roller', 'undermount', 'metal']),
      lengths: z.array(len.positive()).min(1),
      sideClearance: nonNeg,
      innerWidthDeduction: nonNeg,
      lengthDeduction: nonNeg,
      maxSideThickness: nonNeg,
      bottomWidthDeduction: nonNeg,
      backWidthDeduction: nonNeg,
      bottomLengthDeduction: nonNeg,
    }),
  }),
  z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(120),
    kind: z.literal('sliding'),
    priceCents: z.number().int().nonnegative(),
    spec: z.object({
      leaves: z.union([z.literal(2), z.literal(3)]),
      overlap: nonNeg,
      topGap: nonNeg,
      bottomGap: nonNeg,
      frontSetback: nonNeg,
      trackGap: nonNeg,
    }),
  }),
  z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(120),
    kind: z.literal('leg'),
    priceCents: z.number().int().nonnegative(),
    spec: z.object({
      style: z.enum(['straight', 'tapered', 'midcentury', 'adjustable']),
      section: z.enum(['square', 'round']),
      height: len.positive(),
      topSize: len.positive(),
      bottomSize: len.positive(),
      splay: z.number().min(0).max(30),
      inset: nonNeg,
      adjustMin: nonNeg,
      adjustMax: nonNeg,
      countByWidth: z.array(z.tuple([len.positive(), z.number().int().min(2).max(20)])).min(1),
    }),
  }),
]);

export const hardwareChoiceSchema = z.object({ hinge: z.string().optional(), slide: z.string().optional(), sliding: z.string().optional() });

/** Cuántas bisagras lleva una puerta de este alto. */
export function hingeCount(spec: HingeSpec, height: Len): number {
  const sorted = [...spec.countByHeight].sort((a, b) => a[0] - b[0]);
  for (const [upTo, n] of sorted) if (height <= upTo) return n;
  return sorted[sorted.length - 1]![1];
}

/** El largo nominal más grande que entra en `avail`, o null si no entra ninguno. */
export function pickLength(lengths: readonly Len[], avail: Len): Len | null {
  const fits = lengths.filter((l) => l <= avail);
  return fits.length ? Math.max(...fits) : null;
}
