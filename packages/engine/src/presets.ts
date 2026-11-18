import { DEFAULT_HARDWARE_CHOICE } from './hardware';
import type { Material, Method } from './types';
import { mm } from './units';

// ───────────────────────── juego de referencia ─────────────────────────
// Materiales y métodos con medidas europeas (estructura de 19 mm, trasera de DM 8). Eran los de
// partida hasta el 17-11-2026. Se conservan porque son la base de las pruebas del motor y de los
// ejemplos de docs/motor.md (cifras calculadas a mano), y porque las cuentas creadas antes los tienen.

/** Materiales del juego de referencia (19 / 16 mm, DM 8, HDF 3, cantos de 1 y 2 mm). */
export const REFERENCE_MATERIALS: Material[] = [
  { id: 'mel-blanco-19', name: 'Melamina blanca 19', kind: 'panel', thickness: mm(19), grain: 'none', priceCents: 0, color: 'var(--mat-white)' },
  { id: 'mel-roble-19', name: 'Melamina roble 19', kind: 'panel', thickness: mm(19), grain: 'length', priceCents: 0, color: 'var(--mat-oak)' },
  { id: 'mel-grafito-16', name: 'Melamina grafito 16', kind: 'panel', thickness: mm(16), grain: 'none', priceCents: 0, color: 'var(--mat-graphite)' },
  { id: 'mel-blanco-16', name: 'Melamina blanca 16', kind: 'panel', thickness: mm(16), grain: 'none', priceCents: 0, color: 'var(--mat-white)' },
  { id: 'dm-8', name: 'DM 8', kind: 'panel', thickness: mm(8), grain: 'none', priceCents: 0, color: 'var(--mat-mdf)' },
  { id: 'hdf-3', name: 'HDF 3 blanco', kind: 'panel', thickness: mm(3), grain: 'none', priceCents: 0, color: 'var(--mat-white)' },
  { id: 'pvc-blanco-1', name: 'Canto PVC blanco 1', kind: 'edge', thickness: mm(1), grain: 'none', priceCents: 0, color: 'var(--mat-white)' },
  { id: 'abs-roble-2', name: 'Canto ABS roble 2', kind: 'edge', thickness: mm(2), grain: 'none', priceCents: 0, color: 'var(--mat-oak)' },
];

/** Frentes por defecto: melamina blanca 19 con canto de PVC de 1 mm en los cuatro lados y 3 mm de holgura. */
export const DEFAULT_FRONTS: Method['fronts'] = { materialId: 'mel-blanco-19', edgeMaterialId: 'pvc-blanco-1', gap: mm(3) };

/** Cajón por defecto: laterales de 16, fondo de HDF 3 en ranura, guías de bolas (13 mm por lado). */
export const DEFAULT_DRAWER: Method['drawer'] = {
  materialId: 'mel-blanco-16',
  bottomMaterialId: 'hdf-3',
  bottomMode: 'groove',
  grooveDepth: mm(8),
  grooveHeight: mm(10),
  sideClearance: mm(13),
  topClearance: mm(20),
  bottomClearance: mm(15),
  rearClearance: mm(10),
  depthStep: mm(50),
};

/** Métodos del juego de referencia: `std-ranura` y `std-clavada`. */
export const REFERENCE_METHODS: Method[] = [
  {
    id: 'std-ranura',
    name: 'Estándar · trasera en ranura',
    carcassMaterialId: 'mel-blanco-19',
    back: { mode: 'groove', materialId: 'dm-8', grooveDepth: mm(10), inset: mm(10), clearance: mm(1) },
    shelfFrontSetback: mm(20),
    dividerFrontSetback: 0,
    frontEdgeMaterialId: 'pvc-blanco-1',
    edgeReducesCut: true,
    edgeReduceMin: 0,
    fronts: { ...DEFAULT_FRONTS },
    drawer: { ...DEFAULT_DRAWER },
  },
  {
    id: 'std-clavada',
    name: 'Económico · trasera clavada',
    carcassMaterialId: 'mel-blanco-19',
    back: { mode: 'overlay', materialId: 'hdf-3', grooveDepth: 0, inset: 0, clearance: 0 },
    shelfFrontSetback: mm(20),
    dividerFrontSetback: 0,
    frontEdgeMaterialId: 'pvc-blanco-1',
    edgeReducesCut: true,
    edgeReduceMin: 0,
    fronts: { ...DEFAULT_FRONTS },
    drawer: { ...DEFAULT_DRAWER, bottomMode: 'under', grooveDepth: 0, grooveHeight: 0 },
  },
];

/**
 * Completa un método guardado con una versión anterior del formato (sin frentes ni cajones)
 * con los valores por defecto. Los métodos nuevos pasan sin cambios.
 */
export function normalizeMethod(
  m: Omit<Method, 'fronts' | 'drawer' | 'edgeReduceMin'> & Partial<Pick<Method, 'fronts' | 'drawer' | 'edgeReduceMin'>>,
): Method {
  return {
    ...m,
    edgeReduceMin: m.edgeReduceMin ?? 0,
    fronts: { ...DEFAULT_FRONTS, ...m.fronts },
    drawer: { ...DEFAULT_DRAWER, ...m.drawer },
  };
}

/**
 * Precios que traían los materiales de partida hasta el 17-11-2026, cuando estaban en euros.
 * Sirven para reconocer los que nadie ha tocado y ponerlos sin precio al pasar a pesos.
 */
export const LEGACY_EURO_PRICES: Readonly<Record<string, number>> = { 'mel-blanco-19': 1150, 'mel-roble-19': 1480, 'mel-grafito-16': 1320, 'mel-blanco-16': 1050, 'dm-8': 640, 'hdf-3': 380, 'pvc-blanco-1': 45, 'abs-roble-2': 90 };

// ───────────────────────── de partida (Argentina) ─────────────────────────

/**
 * Materiales de partida, con las medidas habituales en Argentina: melamina de 18 mm, fondos de
 * fibrofácil (MDF) de 3 mm y tapacantos de PVC de 0,45 y 2 mm. Vienen **sin precio**: cada taller
 * carga los suyos, en pesos, en Bibliotecas. El despiece avisa de los materiales sin precio.
 */
export const PRESET_MATERIALS: Material[] = [
  { id: 'ar-mel-blanca-18', name: 'Melamina blanca 18', kind: 'panel', thickness: mm(18), grain: 'none', priceCents: 0, color: 'var(--mat-white)' },
  { id: 'ar-mel-madera-18', name: 'Melamina símil madera 18', kind: 'panel', thickness: mm(18), grain: 'length', priceCents: 0, color: 'var(--mat-oak)' },
  { id: 'ar-mel-gris-18', name: 'Melamina gris grafito 18', kind: 'panel', thickness: mm(18), grain: 'none', priceCents: 0, color: 'var(--mat-graphite)' },
  { id: 'ar-mel-blanca-15', name: 'Melamina blanca 15', kind: 'panel', thickness: mm(15), grain: 'none', priceCents: 0, color: 'var(--mat-white)' },
  { id: 'ar-fibro-3', name: 'Fibrofácil 3', kind: 'panel', thickness: mm(3), grain: 'none', priceCents: 0, color: 'var(--mat-mdf)' },
  { id: 'ar-fibro-blanco-3', name: 'Fibrofácil blanco 3', kind: 'panel', thickness: mm(3), grain: 'none', priceCents: 0, color: 'var(--mat-white)' },
  { id: 'ar-tc-blanco-045', name: 'Tapacanto PVC blanco 0,45', kind: 'edge', thickness: mm(0.45), grain: 'none', priceCents: 0, color: 'var(--mat-white)' },
  { id: 'ar-tc-blanco-2', name: 'Tapacanto PVC blanco 2', kind: 'edge', thickness: mm(2), grain: 'none', priceCents: 0, color: 'var(--mat-white)' },
  { id: 'ar-tc-madera-045', name: 'Tapacanto PVC símil madera 0,45', kind: 'edge', thickness: mm(0.45), grain: 'none', priceCents: 0, color: 'var(--mat-oak)' },
];

const AR_DRAWER: Method['drawer'] = {
  materialId: 'ar-mel-blanca-18',
  bottomMaterialId: 'ar-fibro-blanco-3',
  bottomMode: 'groove',
  grooveDepth: mm(8),
  grooveHeight: mm(12),
  // Correderas telescópicas de bolas de 45 mm: 12,5 mm por lado.
  sideClearance: mm(12.5),
  topClearance: mm(20),
  bottomClearance: mm(15),
  rearClearance: mm(10),
  depthStep: mm(50),
};

/**
 * Métodos de partida para Argentina: estructura y frentes de melamina blanca 18, tapacanto de
 * 0,45 en el frente de la estructura y en los cuatro lados de puertas y frentes de cajón.
 * El tapacanto de 0,45 no se descuenta de la medida de corte (sí los de 1 mm o más).
 */
export const PRESET_METHODS: Method[] = [
  {
    id: 'ar-18-ranura',
    name: 'Melamina 18 · fondo 3 en ranura',
    carcassMaterialId: 'ar-mel-blanca-18',
    back: { mode: 'groove', materialId: 'ar-fibro-3', grooveDepth: mm(8), inset: mm(15), clearance: mm(1) },
    shelfFrontSetback: mm(20),
    dividerFrontSetback: 0,
    frontEdgeMaterialId: 'ar-tc-blanco-045',
    edgeReducesCut: true,
    edgeReduceMin: mm(1),
    hardware: { ...DEFAULT_HARDWARE_CHOICE },
    fronts: { materialId: 'ar-mel-blanca-18', edgeMaterialId: 'ar-tc-blanco-045', gap: mm(3) },
    drawer: { ...AR_DRAWER },
  },
  {
    id: 'ar-18-clavado',
    name: 'Melamina 18 · fondo 3 clavado',
    carcassMaterialId: 'ar-mel-blanca-18',
    back: { mode: 'overlay', materialId: 'ar-fibro-3', grooveDepth: 0, inset: 0, clearance: 0 },
    shelfFrontSetback: mm(20),
    dividerFrontSetback: 0,
    frontEdgeMaterialId: 'ar-tc-blanco-045',
    edgeReducesCut: true,
    edgeReduceMin: mm(1),
    hardware: { ...DEFAULT_HARDWARE_CHOICE },
    fronts: { materialId: 'ar-mel-blanca-18', edgeMaterialId: 'ar-tc-blanco-045', gap: mm(3) },
    drawer: { ...AR_DRAWER, bottomMode: 'under', grooveDepth: 0, grooveHeight: 0 },
  },
];
