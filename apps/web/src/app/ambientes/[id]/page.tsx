'use client';

import { useParams } from 'next/navigation';
import { Page } from '@/components/AppShell';
import { RoomEditor } from '@/components/room/RoomEditor';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { data } from '@/data';
import { useAsync } from '@/lib/useAsync';

/** Editor de un ambiente: planta, aberturas y muebles colocados. */
export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const state = useAsync(async () => {
    const room = await data.getRoom(id);
    if (!room) return { room: null, cabinets: [], materials: [], methods: [], hardware: [] };
    const [cabinets, materials, methods, hardware] = await Promise.all([data.listCabinets(room.projectId), data.listMaterials(), data.listMethods(), data.listHardware()]);
    return { room, cabinets, materials, methods, hardware };
  }, [id]);

  if (state.status === 'loading')
    return (
      <div role="status" className="grid flex-1 grid-cols-1 gap-px lg:grid-cols-[360px_1fr]">
        <span className="sr-only">Cargando ambiente…</span>
        <Skeleton className="h-64 rounded-none lg:h-full" />
        <Skeleton className="h-[50dvh] rounded-none lg:h-full" />
      </div>
    );
  if (state.status === 'error')
    return (
      <Page title="Ambiente">
        <ErrorState error={state.error} onRetry={state.reload} />
      </Page>
    );
  const { room, cabinets, materials, methods, hardware } = state.data;
  if (!room)
    return (
      <Page title="Ambiente no encontrado">
        <EmptyState title="Este ambiente no existe" action={<ButtonLink href="/">Ir a proyectos</ButtonLink>}>
          Puede que se haya borrado o que el enlace esté mal.
        </EmptyState>
      </Page>
    );
  return <RoomEditor room={room} cabinets={cabinets} materials={materials} methods={methods} hardware={hardware} />;
}
