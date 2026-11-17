import type { Material, Method } from './types';
import { mm } from './units';

/**
 * Materiales de partida. Vienen **sin precio** (0): cada taller carga los suyos en Bibliotecas,
 * en pesos. El despiece avisa de los materiales sin precio.
 */
export const PRESET_MATERIALS: Material[] = [
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

export const PRESET_METHODS: Method[] = [
  {
    id: 'std-ranura',
    name: 'Estándar · trasera en ranura',
    carcassMaterialId: 'mel-blanco-19',
    back: { mode: 'groove', materialId: 'dm-8', grooveDepth: mm(10), inset: mm(10), clearance: mm(1) },
    shelfFrontSetback: mm(20),
    dividerFrontSetback: 0,
    frontEdgeMaterialId: 'pvc-blanco-1',
    edgeReducesCut: true,
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
    fronts: { ...DEFAULT_FRONTS },
    drawer: { ...DEFAULT_DRAWER, bottomMode: 'under', grooveDepth: 0, grooveHeight: 0 },
  },
];

/**
 * Completa un método guardado con una versión anterior del formato (sin frentes ni cajones)
 * con los valores por defecto. Los métodos nuevos pasan sin cambios.
 */
export function normalizeMethod(m: Omit<Method, 'fronts' | 'drawer'> & Partial<Pick<Method, 'fronts' | 'drawer'>>): Method {
  return {
    ...m,
    fronts: { ...DEFAULT_FRONTS, ...m.fronts },
    drawer: { ...DEFAULT_DRAWER, ...m.drawer },
  };
}

/**
 * Precios que traían los materiales de partida hasta el 17-11-2026, cuando estaban en euros.
 * Sirven para reconocer los que nadie ha tocado y ponerlos sin precio al pasar a pesos.
 */
export const LEGACY_EURO_PRICES: Readonly<Record<string, number>> = { 'mel-blanco-19': 1150, 'mel-roble-19': 1480, 'mel-grafito-16': 1320, 'mel-blanco-16': 1050, 'dm-8': 640, 'hdf-3': 380, 'pvc-blanco-1': 45, 'abs-roble-2': 90 };
