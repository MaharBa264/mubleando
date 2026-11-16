'use client';

import { useParams } from 'next/navigation';
import { Page } from '@/components/AppShell';
import { Editor } from '@/components/editor/Editor';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { data } from '@/data';
import { useAsync } from '@/lib/useAsync';

export default function CabinetPage() {
  const { id } = useParams<{ id: string }>();
  const state = useAsync(async () => {
    const [cabinet, materials, methods] = await Promise.all([data.getCabinet(id), data.listMaterials(), data.listMethods()]);
    return { cabinet, materials, methods };
  }, [id]);

  if (state.status === 'loading')
    return (
      <div role="status" className="grid flex-1 grid-cols-1 gap-px lg:grid-cols-[260px_1fr_340px]">
        <span className="sr-only">Cargando mueble…</span>
        <Skeleton className="hidden h-full rounded-none lg:block" />
        <Skeleton className="h-[46dvh] rounded-none lg:h-full" />
        <Skeleton className="h-64 rounded-none lg:h-full" />
      </div>
    );
  if (state.status === 'error')
    return (
      <Page title="Mueble">
        <ErrorState error={state.error} onRetry={state.reload} />
      </Page>
    );
  const { cabinet, materials, methods } = state.data;
  if (!cabinet)
    return (
      <Page title="Mueble no encontrado">
        <EmptyState title="Este mueble no existe" action={<ButtonLink href="/">Ir a proyectos</ButtonLink>}>
          Puede que se haya borrado o que el enlace esté mal.
        </EmptyState>
      </Page>
    );
  if (methods.length === 0)
    return (
      <Page title={cabinet.name}>
        <EmptyState title="No hay métodos de fabricación">Hace falta al menos un método para calcular las piezas.</EmptyState>
      </Page>
    );
  return <Editor cabinet={cabinet} materials={materials} methods={methods} />;
}
