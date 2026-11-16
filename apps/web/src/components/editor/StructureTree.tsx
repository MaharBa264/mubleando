'use client';

import type { Part, Zone } from '@mw/engine';
import { fmtDims } from '@/lib/format';
import { useEditor, useEnv } from './context';

/** Árbol del mueble: huecos y piezas. Alternativa precisa (y accesible por teclado) al toque en 3D. */
export function StructureTree() {
  const { result, labels } = useEnv();
  const design = useEditor((s) => s.design);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const setHover = useEditor((s) => s.setHover);
  const zoneBox = new Map(result.zones.map((z) => [z.id, z.box]));

  const item = (active: boolean) =>
    `flex w-full items-center justify-between gap-2 rounded-s px-2 py-1.5 text-left text-sm ${
      active ? 'bg-accent-soft font-medium text-accent' : 'hover:bg-surface-2'
    }`;

  const renderZone = (z: Zone) => {
    const box = zoneBox.get(z.id);
    const active = selection.kind === 'zone' && selection.id === z.id;
    return (
      <li key={z.id}>
        <button
          type="button"
          className={item(active)}
          aria-pressed={active}
          onClick={() => select({ kind: 'zone', id: z.id })}
          onMouseEnter={() => setHover(`zone:${z.id}`)}
          onMouseLeave={() => setHover(null)}
        >
          <span className="truncate">{labels.get(z.id)?.short}</span>
          {box && <span className="tabular shrink-0 text-xs text-muted">{fmtDims(box.dx, box.dy)}</span>}
        </button>
        {z.split && <ul className="ml-3 border-l border-border pl-2">{z.split.children.map(renderZone)}</ul>}
      </li>
    );
  };

  const groups: { title: string; parts: Part[] }[] = [
    { title: 'Caja', parts: result.parts.filter((p) => ['side', 'top', 'bottom', 'back'].includes(p.role)) },
    { title: 'Estantes y divisores', parts: result.parts.filter((p) => p.role === 'shelf' || p.role === 'divider') },
  ];

  return (
    <nav aria-label="Estructura del mueble" className="space-y-4 p-3">
      <div>
        <button
          type="button"
          className={item(selection.kind === 'cabinet')}
          aria-pressed={selection.kind === 'cabinet'}
          onClick={() => select({ kind: 'cabinet' })}
        >
          <span>Mueble completo</span>
        </button>
      </div>
      <section>
        <h2 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">Huecos</h2>
        <ul>{renderZone(design.root)}</ul>
      </section>
      {groups.map(
        (g) =>
          g.parts.length > 0 && (
            <section key={g.title}>
              <h2 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">{g.title}</h2>
              <ul>
                {g.parts.map((p) => {
                  const active = selection.kind === 'part' && selection.key === p.key;
                  return (
                    <li key={p.key}>
                      <button
                        type="button"
                        className={item(active)}
                        aria-pressed={active}
                        onClick={() => select({ kind: 'part', key: p.key })}
                        onMouseEnter={() => setHover(`part:${p.key}`)}
                        onMouseLeave={() => setHover(null)}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="tabular shrink-0 text-xs text-muted">{fmtDims(p.cutLength, p.cutWidth)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
      )}
    </nav>
  );
}
