import type { Material, Method } from './types';
import { mm } from './units';

/** Materiales de partida. Precios orientativos, editables por el usuario. */
export const PRESET_MATERIALS: Material[] = [
  { id: 'mel-blanco-19', name: 'Melamina blanca 19', kind: 'panel', thickness: mm(19), grain: 'none', priceCents: 1150, color: 'var(--mat-white)' },
  { id: 'mel-roble-19', name: 'Melamina roble 19', kind: 'panel', thickness: mm(19), grain: 'length', priceCents: 1480, color: 'var(--mat-oak)' },
  { id: 'mel-grafito-16', name: 'Melamina grafito 16', kind: 'panel', thickness: mm(16), grain: 'none', priceCents: 1320, color: 'var(--mat-graphite)' },
  { id: 'dm-8', name: 'DM 8', kind: 'panel', thickness: mm(8), grain: 'none', priceCents: 640, color: 'var(--mat-mdf)' },
  { id: 'hdf-3', name: 'HDF 3 blanco', kind: 'panel', thickness: mm(3), grain: 'none', priceCents: 380, color: 'var(--mat-white)' },
  { id: 'pvc-blanco-1', name: 'Canto PVC blanco 1', kind: 'edge', thickness: mm(1), grain: 'none', priceCents: 45, color: 'var(--mat-white)' },
  { id: 'abs-roble-2', name: 'Canto ABS roble 2', kind: 'edge', thickness: mm(2), grain: 'none', priceCents: 90, color: 'var(--mat-oak)' },
];

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
  },
];
