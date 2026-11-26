'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { LIMITS, TEMPLATES, type CabinetTemplate, type Design, type Len, type Material, type Method } from '@mw/engine';
import { CabinetSketch } from '@/components/CabinetSketch';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { MmField, SelectField, TextField } from '@/components/ui/fields';
import { fmtDims, fmtMm } from '@/lib/format';

const GROUPS: [CabinetTemplate['group'], string][] = [
  ['bajo', 'Bajo mesada'],
  ['alto', 'Altos'],
  ['columna', 'Columnas'],
  ['otros', 'Otros'],
];

/**
 * S02 · Nuevo mueble: selector por categorías en pestañas + vista previa y medidas visibles sin scroll largo.
 */
export function NewCabinetDialog({
  open,
  onClose,
  methods,
  materials,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  methods: Method[];
  materials: Material[];
  defaultName?: string;
  onCreate: (input: { name: string; methodId: string; design: Design }) => Promise<void>;
}) {
  const [templateId, setTemplateId] = useState(TEMPLATES[0]!.id);
  const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0]!;
  const [activeGroup, setActiveGroup] = useState<CabinetTemplate['group']>(template.group);
  const [size, setSize] = useState<{ w: Len; h: Len; d: Len }>(template.size);
  const [name, setName] = useState('');
  const [methodId, setMethodId] = useState(methods[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const method = methods.find((m) => m.id === methodId) ?? methods[0];

  const groupTemplates = useMemo(() => TEMPLATES.filter((t) => t.group === activeGroup), [activeGroup]);

  // Para la vista previa: identificadores fijos, así no cambian en cada render.
  const preview = useMemo(() => {
    let i = 0;
    return template.build(size, () => `p${++i}`);
  }, [template, size]);

  const choose = (t: CabinetTemplate) => {
    setTemplateId(t.id);
    setActiveGroup(t.group);
    setSize(t.size);
  };

  const switchGroup = (g: CabinetTemplate['group']) => {
    setActiveGroup(g);
    const firstInGroup = TEMPLATES.find((t) => t.group === g);
    if (firstInGroup && template.group !== g) {
      setTemplateId(firstInGroup.id);
      setSize(firstInGroup.size);
    }
  };

  const autoName = `${template.name} ${fmtMm(size.w)}`;

  const submit = async () => {
    if (!method) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: name.trim() || autoName, methodId: method.id, design: template.build(size) });
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el mueble.');
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
          <Button variant="primary" type="submit" form="new-cabinet" disabled={busy || !method}>
            {busy ? 'Creando…' : 'Crear y abrir'}
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
        <fieldset className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="text-xs font-medium text-muted">Elegí una categoría y plantilla. Después podés editar todo en 3D.</legend>
          </div>
          {/* Pestañas segmentadas por categoría */}
          <div className="flex flex-wrap gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label="Categorías de plantillas">
            {GROUPS.map(([g, label]) => {
              const selected = activeGroup === g;
              return (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => switchGroup(g)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    selected ? 'bg-surface text-text shadow-1' : 'text-muted hover:text-text'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {groupTemplates.map((t) => {
              const active = t.id === templateId;
              return (
                <label
                  key={t.id}
                  className={`flex cursor-pointer flex-col gap-1 rounded-control border p-2 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${
                    active ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-2'
                  }`}
                >
                  <input type="radio" name="template" value={t.id} checked={active} onChange={() => choose(t)} className="sr-only" />
                  {method && <TemplateThumb template={t} method={method} materials={materials} />}
                  <span className={`font-medium ${active ? 'text-accent' : ''}`}>{t.name}</span>
                  <span className="tabular text-xs text-muted">{fmtDims(t.size.w, t.size.h, t.size.d)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-5 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="space-y-4">
            <p className="text-sm text-muted">{template.description}</p>
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-muted">Medidas exteriores</legend>
              <div className="grid grid-cols-3 gap-3">
                <MmField label="Ancho" value={size.w} min={LIMITS.w.min} max={LIMITS.w.max} onCommit={(v) => v !== null && setSize((s) => ({ ...s, w: v }))} />
                <MmField label="Alto" value={size.h} min={LIMITS.h.min} max={LIMITS.h.max} onCommit={(v) => v !== null && setSize((s) => ({ ...s, h: v }))} />
                <MmField label="Fondo" value={size.d} min={LIMITS.d.min} max={LIMITS.d.max} onCommit={(v) => v !== null && setSize((s) => ({ ...s, d: v }))} />
              </div>
            </fieldset>
            <TextField label="Nombre" placeholder={autoName} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            <div className="space-y-1.5">
              <SelectField label="Método de fabricación" value={method?.id ?? ''} onChange={(e) => setMethodId(e.target.value)}>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </SelectField>
              <p className="text-xs text-muted">
                ¿Necesitás otro espesor o placa?{' '}
                <Link href="/bibliotecas" onClick={onClose} className="font-medium text-accent hover:underline">
                  Gestionar bibliotecas
                </Link>
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center rounded-card bg-surface-2 p-3">
            {method && <CabinetSketch design={preview} method={method} materials={materials} className="h-48 w-full" title={`Frente de ${template.name}`} />}
            <p className="measure mt-2 text-xs text-muted">{fmtDims(size.w, size.h, size.d)} mm</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

function TemplateThumb({ template, method, materials }: { template: CabinetTemplate; method: Method; materials: Material[] }) {
  const design = useMemo(() => {
    let i = 0;
    return template.build(template.size, () => `m${++i}`);
  }, [template]);
  return <CabinetSketch design={design} method={method} materials={materials} className="h-20 w-full" title={template.name} />;
}
