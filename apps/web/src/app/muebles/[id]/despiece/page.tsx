'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { compute } from '@mw/engine';
import { Page } from '@/components/AppShell';
import { CutListView } from '@/components/CutListView';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/feedback';
import { data } from '@/data';
import { fmtDims } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'mueble';

/** S24 · Despiece de un mueble */
export default function CabinetCutListPage() {
  const { id } = useParams<{ id: string }>();
  const state = useAsync(async () => {
    const [cabinet, materials, methods, hardware] = await Promise.all([data.getCabinet(id), data.listMaterials(), data.listMethods(), data.listHardware()]);
    return { cabinet, materials, methods, hardware };
  }, [id]);

  if (state.status === 'loading')
    return (
      <Page title="Despiece">
        <LoadingBlock label="Calculando despiece…" />
      </Page>
    );
  if (state.status === 'error')
    return (
      <Page title="Despiece">
        <ErrorState error={state.error} onRetry={state.reload} />
      </Page>
    );
  const { cabinet, materials, methods, hardware } = state.data;
  if (!cabinet)
    return (
      <Page title="Despiece">
        <EmptyState title="Este mueble no existe" action={<ButtonLink href="/">Ir a proyectos</ButtonLink>} />
      </Page>
    );

  const method = methods.find((m) => m.id === cabinet.methodId) ?? methods[0]!;
  const r = compute(cabinet.design, method, materials, hardware);
  const hwItems = r.hardware.map((h) => ({ ...h, qty: h.qty * cabinet.quantity }));
  const items = r.parts.map((part) => ({ part, qty: cabinet.quantity, source: cabinet.name }));

  return (
    <Page
      title={`Despiece · ${cabinet.name}`}
      back={
        <Link href={`/muebles/${cabinet.id}`} className="text-muted hover:text-text">
          ← Volver al mueble
        </Link>
      }
    >
      <p className="tabular -mt-4 mb-6 text-sm text-muted">
        {fmtDims(cabinet.design.size.w, cabinet.design.size.h, cabinet.design.size.d)} mm · {method.name}
        {cabinet.quantity > 1 && ` · ${cabinet.quantity} unidades`}
      </p>
      <CutListView title={cabinet.name} items={items} materials={materials} hardware={hwItems} fileName={slug(cabinet.name)} warnings={r.warnings.map((w) => w.message)} />
    </Page>
  );
}
