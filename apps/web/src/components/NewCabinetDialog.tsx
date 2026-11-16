'use client';

import { useState } from 'react';
import { LIMITS, mm, newDesign, type Len, type Method } from '@mw/engine';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { MmField, SelectField, TextField } from '@/components/ui/fields';
import { fmtDims } from '@/lib/format';

const SHAPES = [
  { id: 'rect', label: 'Rectangular', ready: true, icon: 'M5 5h14v14H5z' },
  { id: 'L', label: 'En L', ready: false, icon: 'M5 5h6v8h8v6H5z' },
  { id: 'corner', label: 'Rinconero', ready: false, icon: 'M5 5h14l-6 6v8H5z' },
  { id: 'free', label: 'Forma libre', ready: false, icon: 'M5 19V9c0-3 3-4 7-4s7 2 7 6v8z' },
] as const;

const PRESETS: { label: string; w: number; h: number; d: number }[] = [
  { label: 'Bajo de cocina', w: 600, h: 720, d: 560 },
  { label: 'Alto de cocina', w: 600, h: 720, d: 330 },
  { label: 'Armario', w: 1000, h: 2400, d: 600 },
  { label: 'Estantería', w: 800, h: 1800, d: 300 },
];

/** S02 · Nuevo mueble */
export function NewCabinetDialog({
  open,
  onClose,
  methods,
  defaultName,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  methods: Method[];
  defaultName: string;
  onCreate: (input: { name: string; methodId: string; design: ReturnType<typeof newDesign> }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [size, setSize] = useState<{ w: Len; h: Len; d: Len }>({ w: mm(600), h: mm(720), d: mm(560) });
  const [methodId, setMethodId] = useState(methods[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: name.trim() || defaultName, methodId: methodId || methods[0]!.id, design: newDesign(size) });
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido crear el mueble.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuevo mueble"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="new-cabinet" disabled={busy || methods.length === 0}>
            Crear y abrir
          </Button>
        </>
      }
    >
      <form
        id="new-cabinet"
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted">Forma</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SHAPES.map((s) => (
              <label
                key={s.id}
                className={`flex flex-col items-center gap-2 rounded-s border p-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${
                  s.ready ? 'cursor-pointer border-accent bg-accent-soft text-accent' : 'cursor-not-allowed border-border text-muted opacity-70'
                }`}
              >
                <input type="radio" name="shape" value={s.id} defaultChecked={s.id === 'rect'} disabled={!s.ready} className="sr-only" />
                <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d={s.icon} />
                </svg>
                <span className="font-medium">{s.label}</span>
                {!s.ready && <span className="text-xs">Más adelante</span>}
              </label>
            ))}
          </div>
        </fieldset>

        <TextField label="Nombre" placeholder={defaultName} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted">Medidas exteriores</legend>
          <div className="mb-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const active = size.w === mm(p.w) && size.h === mm(p.h) && size.d === mm(p.d);
              return (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSize({ w: mm(p.w), h: mm(p.h), d: mm(p.d) })}
                  className={`rounded-full border px-3 py-1 text-xs ${active ? 'border-accent bg-accent-soft text-accent' : 'border-border hover:bg-surface-2'}`}
                >
                  {p.label} · {fmtDims(mm(p.w), mm(p.h), mm(p.d))}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MmField label="Ancho" value={size.w} min={LIMITS.w.min} max={LIMITS.w.max} onCommit={(v) => v !== null && setSize((s) => ({ ...s, w: v }))} />
            <MmField label="Alto" value={size.h} min={LIMITS.h.min} max={LIMITS.h.max} onCommit={(v) => v !== null && setSize((s) => ({ ...s, h: v }))} />
            <MmField label="Fondo" value={size.d} min={LIMITS.d.min} max={LIMITS.d.max} onCommit={(v) => v !== null && setSize((s) => ({ ...s, d: v }))} />
          </div>
        </fieldset>

        <SelectField label="Método de fabricación" value={methodId} onChange={(e) => setMethodId(e.target.value)}>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </SelectField>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
