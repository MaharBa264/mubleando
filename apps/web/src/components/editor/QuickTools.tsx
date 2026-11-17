'use client';

import { findZone, setDivisions, setFront, type Front } from '@mw/engine';
import { useEditor, useEnv } from './context';

/**
 * Herramientas rápidas sobre el visor 3D: al tocar un hueco aparecen los botones para dividirlo
 * o ponerle frente, sin tener que buscar en el panel de propiedades. Todo lo que hacen se puede
 * afinar después en Propiedades (medidas de cada nivel, alturas de cajones, montaje…).
 */
export function QuickTools() {
  const { labels, result } = useEnv();
  const selection = useEditor((s) => s.selection);
  const design = useEditor((s) => s.design);
  const apply = useEditor((s) => s.apply);
  const select = useEditor((s) => s.select);

  if (selection.kind === 'cabinet') {
    return (
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-m bg-surface/95 px-3 py-2 text-xs shadow-1">
        <span className="text-muted">Tocá un hueco del mueble para agregarle estantes, divisores, puertas o cajones.</span>
        <button type="button" className="rounded-s bg-accent px-2 py-1 font-medium text-accent-contrast" onClick={() => select({ kind: 'zone', id: design.root.id })}>
          Elegir el interior
        </button>
      </div>
    );
  }
  if (selection.kind !== 'zone') return null;

  const zone = findZone(design.root, selection.id);
  const out = result.zones.find((z) => z.id === selection.id);
  if (!zone || !out) return null;
  const id = zone.id;
  const split = zone.split;
  const panels = (axis: 'x' | 'y') => (split?.axis === axis ? split.children.length - 1 : 0);
  const front = zone.front;
  const frontKind = !front ? 'none' : front.kind === 'drawers' ? 'drawers' : front.leaves === 2 ? 'door2' : 'door1';
  const putFront = (f: Front | undefined) => apply((d) => setFront(d, id, f));

  const btn = (active = false) =>
    `rounded-s px-2 py-1 font-medium whitespace-nowrap disabled:opacity-40 ${active ? 'bg-accent text-accent-contrast' : 'bg-surface-2 hover:bg-border'}`;

  return (
    <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-1 rounded-m bg-surface/95 p-1.5 text-xs shadow-1" role="toolbar" aria-label={`Herramientas para ${labels.get(id)?.full ?? 'el hueco'}`}>
      <span className="px-1 font-semibold">{labels.get(id)?.short}</span>
      <span className="mr-1 h-4 w-px bg-border" aria-hidden />
      <button
        type="button"
        className={btn()}
        disabled={split?.axis === 'x'}
        title={split?.axis === 'x' ? 'Este hueco ya tiene divisores: elegí una de sus columnas' : 'Agregar un estante'}
        onClick={() => apply((d) => setDivisions(d, id, 'y', panels('y') + 1))}
      >
        + Estante
      </button>
      <button
        type="button"
        className={btn()}
        disabled={split?.axis === 'y'}
        title={split?.axis === 'y' ? 'Este hueco ya tiene estantes: elegí uno de sus niveles' : 'Agregar un divisor vertical'}
        onClick={() => apply((d) => setDivisions(d, id, 'x', panels('x') + 1))}
      >
        + Divisor
      </button>
      {split && (
        <button type="button" className={btn()} onClick={() => apply((d) => setDivisions(d, id, split.axis, panels(split.axis) - 1))} title="Quitar el último">
          − {split.axis === 'y' ? 'Estante' : 'Divisor'}
        </button>
      )}
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <button type="button" className={btn(frontKind === 'door1')} aria-pressed={frontKind === 'door1'} onClick={() => putFront(frontKind === 'door1' ? undefined : { kind: 'door', leaves: 1, hinge: 'left', mount: front?.mount ?? 'overlay' })}>
        Puerta
      </button>
      <button type="button" className={btn(frontKind === 'door2')} aria-pressed={frontKind === 'door2'} onClick={() => putFront(frontKind === 'door2' ? undefined : { kind: 'door', leaves: 2, hinge: 'left', mount: front?.mount ?? 'overlay' })}>
        2 puertas
      </button>
      <button
        type="button"
        className={btn(frontKind === 'drawers')}
        aria-pressed={frontKind === 'drawers'}
        title={split ? 'Al poner cajones se quitan los estantes o divisores de este hueco (Ctrl+Z para deshacer)' : 'Tres cajones; después cambiás la cantidad y las alturas en Propiedades'}
        onClick={() => putFront(frontKind === 'drawers' ? undefined : { kind: 'drawers', mount: front?.mount ?? 'overlay', sizes: [null, null, null] })}
      >
        Cajones
      </button>
      {front && (
        <button type="button" className={btn()} onClick={() => putFront(undefined)}>
          Sin frente
        </button>
      )}
    </div>
  );
}
