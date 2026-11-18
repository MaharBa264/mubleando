'use client';

import { useState } from 'react';
import { mm, rectRoom, type Len, type RoomPlan } from '@mw/engine';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { MmField, TextField } from '@/components/ui/fields';

/**
 * Nuevo ambiente: arranca como un rectángulo con las medidas que se den. Después, en el editor,
 * se ajusta cada pared y cada ángulo como se midió en obra (fuera de escuadra incluido).
 */
export function NewRoomDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; plan: RoomPlan }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [w, setW] = useState<Len>(mm(3500));
  const [d, setD] = useState<Len>(mm(3000));
  const [h, setH] = useState<Len>(mm(2600));
  const [t, setT] = useState<Len>(mm(150));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: name.trim() || 'Ambiente', plan: rectRoom(w, d, undefined, { wallHeight: h, wallThickness: t }) });
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el ambiente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuevo ambiente"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="new-room" disabled={busy}>
            Crear y abrir
          </Button>
        </>
      }
    >
      <form
        id="new-room"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <TextField label="Nombre" placeholder="Cocina, lavadero, dormitorio…" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted">Medidas interiores (de pared a pared)</legend>
          <div className="grid grid-cols-2 gap-3">
            <MmField label="Ancho" value={w} min={mm(500)} max={mm(30000)} onCommit={(v) => v !== null && setW(v)} />
            <MmField label="Largo" value={d} min={mm(500)} max={mm(30000)} onCommit={(v) => v !== null && setD(v)} />
            <MmField label="Alto de las paredes" value={h} min={mm(1800)} max={mm(6000)} onCommit={(v) => v !== null && setH(v)} />
            <MmField label="Espesor de las paredes" value={t} min={mm(50)} max={mm(600)} onCommit={(v) => v !== null && setT(v)} />
          </div>
        </fieldset>
        <p className="text-xs text-muted">
          Empieza rectangular. En el editor cargás el largo real de cada pared y el ángulo de cada esquina, partís paredes para hacer una L o una ochava, y agregás puertas y ventanas.
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
