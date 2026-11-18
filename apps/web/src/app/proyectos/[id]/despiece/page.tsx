'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { compute, type HardwareItem } from '@mw/engine';
import { Page } from '@/components/AppShell';
import { CutListView } from '@/components/CutListView';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/feedback';
import { data } from '@/data';
import { useAsync } from '@/lib/useAsync';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'proyecto';

/** S24 · Despiece de todo el proyecto (agrupa piezas iguales de distintos muebles). */
export default function ProjectCutListPage() {
  const { id } = useParams<{ id: string }>();
  const state = useAsync(async () => {
    const all = await Promise.all([
      data.getProject(id),
      data.listCabinets(id),
      data.listMaterials(),
      data.listMethods(),
      data.listHardware(),
    ]).then(([project, cabinets, materials, methods, hardware]) => ({ project, cabinets, materials, methods, hardware }));
    return all;
  }, [id]);

  if (state.status === 'loading')
    return (
      <Page title="Despiece del proyecto">
        <LoadingBlock label="Calculando despiece…" />
      </Page>
    );
  if (state.status === 'error')
    return (
      <Page title="Despiece del proyecto">
        <ErrorState error={state.error} onRetry={state.reload} />
      </Page>
    );
  const { project, cabinets, materials, methods, hardware } = state.data;
  if (!project)
    return (
      <Page title="Despiece del proyecto">
        <EmptyState title="Este proyecto no existe" action={<ButtonLink href="/">Ir a proyectos</ButtonLink>} />
      </Page>
    );

  const warnings: string[] = [];
  const hwItems: HardwareItem[] = [];
  const items = cabinets.flatMap((c) => {
    const method = methods.find((m) => m.id === c.methodId) ?? methods[0]!;
    const r = compute(c.design, method, materials, hardware);
    for (const w of r.warnings) warnings.push(`${c.name}: ${w.message}`);
    for (const h of r.hardware) hwItems.push({ ...h, qty: h.qty * c.quantity });
    return r.parts.map((part) => ({ part, qty: c.quantity, source: c.name }));
  });

  return (
    <Page
      title={`Despiece · ${project.name}`}
      back={
        <Link href={`/proyectos/${project.id}`} className="text-muted hover:text-text">
          ← Volver al proyecto
        </Link>
      }
    >
      <p className="-mt-4 mb-6 text-sm text-muted">
        {cabinets.length} {cabinets.length === 1 ? 'mueble' : 'muebles'}
      </p>
      <CutListView items={items} materials={materials} hardware={hwItems} fileName={slug(project.name)} warnings={warnings} />
    </Page>
  );
}
