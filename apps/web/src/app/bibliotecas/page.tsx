'use client';

import { Page } from '@/components/AppShell';
import { ErrorState, LoadingBlock } from '@/components/ui/feedback';
import { data } from '@/data';
import { fmtMm, fmtMoney } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';

/** S11/S12/S10 (solo lectura en la fase 1): materiales, cantos y métodos de partida. */
export default function LibrariesPage() {
  const state = useAsync(async () => ({ materials: await data.listMaterials(), methods: await data.listMethods() }), []);

  return (
    <Page title="Bibliotecas">
      <p className="-mt-3 mb-6 text-sm text-muted">Materiales y métodos de partida. Se podrán editar en la fase 2.</p>
      {state.status === 'loading' && <LoadingBlock />}
      {state.status === 'error' && <ErrorState error={state.error} onRetry={state.reload} />}
      {state.status === 'ready' && (
        <div className="space-y-8">
          {(['panel', 'edge'] as const).map((kind) => (
            <section key={kind} aria-labelledby={`h-${kind}`}>
              <h2 id={`h-${kind}`} className="mb-3 text-lg font-semibold">
                {kind === 'panel' ? 'Tableros' : 'Cantos'}
              </h2>
              <div className="overflow-x-auto rounded-m border border-border bg-surface shadow-1">
                <table className="tabular w-full min-w-[480px] text-sm">
                  <thead className="bg-surface-2 text-left text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Nombre</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Espesor</th>
                      <th scope="col" className="px-3 py-2 font-medium">Veta</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Precio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {state.data.materials
                      .filter((m) => m.kind === kind)
                      .map((m) => (
                        <tr key={m.id}>
                          <td className="px-3 py-2">
                            <span aria-hidden className="mr-2 inline-block h-3 w-3 rounded-full border border-border align-middle" style={{ background: m.color }} />
                            {m.name}
                          </td>
                          <td className="px-3 py-2 text-right">{fmtMm(m.thickness)} mm</td>
                          <td className="px-3 py-2">{m.grain === 'length' ? 'Sí' : 'No'}</td>
                          <td className="px-3 py-2 text-right">
                            {fmtMoney(m.priceCents)} / {kind === 'panel' ? 'm²' : 'm'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
          <section aria-labelledby="h-methods">
            <h2 id="h-methods" className="mb-3 text-lg font-semibold">
              Métodos de fabricación
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {state.data.methods.map((m) => {
                const name = (id: string | null) => state.data.materials.find((x) => x.id === id)?.name ?? '—';
                return (
                  <li key={m.id} className="rounded-m border border-border bg-surface p-4 text-sm shadow-1">
                    <h3 className="font-semibold">{m.name}</h3>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted">
                      <dt>Estructura</dt>
                      <dd className="text-text">{name(m.carcassMaterialId)}</dd>
                      <dt>Trasera</dt>
                      <dd className="text-text">
                        {name(m.back.materialId)} ·{' '}
                        {m.back.mode === 'groove' ? `en ranura de ${fmtMm(m.back.grooveDepth)} mm a ${fmtMm(m.back.inset)} mm del fondo` : m.back.mode === 'overlay' ? 'clavada por detrás' : 'sin trasera'}
                      </dd>
                      <dt>Canto frontal</dt>
                      <dd className="text-text">{name(m.frontEdgeMaterialId)}</dd>
                      <dt>Estantes</dt>
                      <dd className="text-text">retranqueados {fmtMm(m.shelfFrontSetback)} mm</dd>
                    </dl>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </Page>
  );
}
