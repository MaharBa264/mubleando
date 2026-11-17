'use client';

import { useState } from 'react';
import { mm, type Material } from '@mw/engine';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/feedback';
import { MmField, SelectField, TextField } from '@/components/ui/fields';
import { parseCents } from '@/lib/format';

/** Colores del visor 3D disponibles para un material (tokens de globals.css). */
export const MATERIAL_COLORS: [string, string][] = [
  ['var(--mat-white)', 'Blanco'],
  ['var(--mat-sand)', 'Arena'],
  ['var(--mat-oak)', 'Roble'],
  ['var(--mat-mdf)', 'DM crudo'],
  ['var(--mat-walnut)', 'Nogal'],
  ['var(--mat-sage)', 'Verde salvia'],
  ['var(--mat-graphite)', 'Grafito'],
  ['var(--mat-black)', 'Negro'],
];

/** Centavos → texto editable sin separador de miles: 2000050 → "20000,50"; 0 → "". */
const centsText = (c: number) => (c === 0 ? '' : (c / 100).toFixed(2).replace('.', ','));

/** S11 / S12 · Crear o editar un tablero o un canto. */
export function MaterialDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  /** Material a editar, o uno nuevo ya con su `kind` e `id`. */
  initial: Material;
  onClose: () => void;
  onSave: (m: Material) => Promise<void>;
}) {
  const [m, setM] = useState(initial);
  const [price, setPrice] = useState(centsText(initial.priceCents));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const panel = m.kind === 'panel';
  const cents = parseCents(price);

  const save = async () => {
    if (!m.name.trim()) return setError('Ponle un nombre.');
    if (cents === null) return setError('El precio tiene que ser un número, por ejemplo 25.000 o 25.000,50.');
    setBusy(true);
    setError(null);
    try {
      await onSave({ ...m, name: m.name.trim(), priceCents: cents });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${initial.name ? 'Editar' : 'Nuevo'} ${panel ? 'tablero' : 'canto'}`}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Nombre" value={m.name} maxLength={120} placeholder={panel ? 'Melamina roble 19' : 'Canto PVC roble 1'} onChange={(e) => setM({ ...m, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <MmField label="Espesor" value={m.thickness} min={mm(0.1)} max={mm(100)} onCommit={(v) => v !== null && setM({ ...m, thickness: v })} />
          <div>
            <TextField
              label={panel ? 'Precio por m² ($)' : 'Precio por metro ($)'}
              placeholder={panel ? 'Ej.: 25.000' : 'Ej.: 900'}
              inputMode="decimal"
              value={price}
              aria-invalid={cents === null}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
        {panel && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={m.grain === 'length'} onChange={(e) => setM({ ...m, grain: e.target.checked ? 'length' : 'none' })} />
            <span>
              Tiene veta
              <span className="block text-xs text-muted">Las piezas no se podrán girar al colocarlas en el tablero; el largo de la pieza va en la dirección de la veta.</span>
            </span>
          </label>
        )}
        <SelectField label="Color en el visor 3D" value={m.color} onChange={(e) => setM({ ...m, color: e.target.value })}>
          {MATERIAL_COLORS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
          {!MATERIAL_COLORS.some(([v]) => v === m.color) && <option value={m.color}>Personalizado</option>}
        </SelectField>
        {initial.name && initial.thickness !== m.thickness && (
          <Alert tone="info">
            Al cambiar el espesor se recalculan todos los muebles que lo usan. Los cambios a mano de piezas que usaban este material con el espesor anterior dejarán de aplicarse.
          </Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
