'use client';

import { useState, type ReactNode } from 'react';
import { mm, type Hardware, type HardwareKind, type Len, type Material, type Method } from '@mw/engine';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/feedback';
import { MmField, SelectField, TextField } from '@/components/ui/fields';
import { fmtMm } from '@/lib/format';

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-m border border-border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {hint && <p className="-mt-1 text-xs text-muted">{hint}</p>}
      {children}
    </fieldset>
  );
}

/** S10 · Crear o editar un método de fabricación (las reglas de construcción). */
export function MethodDialog({
  open,
  initial,
  isNew,
  materials,
  hardware = [],
  onClose,
  onSave,
}: {
  open: boolean;
  initial: Method;
  isNew: boolean;
  materials: Material[];
  hardware?: Hardware[];
  onClose: () => void;
  onSave: (m: Method) => Promise<void>;
}) {
  const [m, setM] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const panels = materials.filter((x) => x.kind === 'panel');
  const edges = materials.filter((x) => x.kind === 'edge');
  const thick = (id: string) => materials.find((x) => x.id === id)?.thickness ?? 0;

  const panelSelect = (label: string, value: string, onChange: (id: string) => void) => (
    <SelectField label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {!panels.some((p) => p.id === value) && <option value={value}>(material borrado)</option>}
      {panels.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </SelectField>
  );
  const edgeSelect = (label: string, value: string | null, onChange: (id: string | null) => void) => (
    <SelectField label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Sin canto</option>
      {edges.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </SelectField>
  );
  const len = (label: string, value: Len, onChange: (v: Len) => void, hint?: string, max = mm(200)) => (
    <MmField compact label={label} value={value} min={0} max={max} hint={hint} onCommit={(v) => v !== null && onChange(v)} />
  );

  const back = (patch: Partial<Method['back']>) => setM({ ...m, back: { ...m.back, ...patch } });
  const fronts = (patch: Partial<Method['fronts']>) => setM({ ...m, fronts: { ...m.fronts, ...patch } });
  const drawer = (patch: Partial<Method['drawer']>) => setM({ ...m, drawer: { ...m.drawer, ...patch } });

  // Comprobaciones que el motor también avisa, pero mejor verlas antes de guardar.
  const problems: string[] = [];
  if (m.back.mode === 'groove' && m.back.grooveDepth >= thick(m.carcassMaterialId)) problems.push('La ranura de la trasera es tan profunda como el tablero de la estructura.');
  if (m.back.mode === 'groove' && m.back.clearance >= m.back.grooveDepth) problems.push('La holgura de la trasera es mayor que la ranura: la trasera no entraría en ella.');
  if (m.drawer.bottomMode === 'groove' && m.drawer.grooveDepth >= thick(m.drawer.materialId)) problems.push('La ranura del fondo del cajón es tan profunda como sus laterales.');

  const save = async () => {
    if (!m.name.trim()) return setError('Ponle un nombre.');
    setBusy(true);
    setError(null);
    try {
      await onSave({ ...m, name: m.name.trim() });
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
      wide
      title={isNew ? 'Nuevo método de fabricación' : 'Editar método de fabricación'}
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
        <TextField label="Nombre" value={m.name} maxLength={120} onChange={(e) => setM({ ...m, name: e.target.value })} />
        {!isNew && <p className="text-xs text-muted">Los cambios se aplican a todos los muebles que usan este método.</p>}

        <Group title="Estructura" hint="Costados, tapa, base, estantes, divisores y zócalo.">
          {panelSelect('Tablero', m.carcassMaterialId, (id) => setM({ ...m, carcassMaterialId: id }))}
          <div className="grid gap-3 sm:grid-cols-2">
            {edgeSelect('Canto del frente', m.frontEdgeMaterialId, (id) => setM({ ...m, frontEdgeMaterialId: id }))}
            <label className="flex items-start gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={m.edgeReducesCut} onChange={(e) => setM({ ...m, edgeReducesCut: e.target.checked })} />
              El tapacanto se descuenta de la medida de corte
            </label>
            {m.edgeReducesCut &&
              len(
                'Descontar solo tapacantos desde',
                m.edgeReduceMin,
                (v) => setM({ ...m, edgeReduceMin: v }),
                'Con 1 mm, el de 0,45 no cambia la medida y el de 2 sí. 0 = descontar todos.',
                mm(5),
              )}
            {len('Retranqueo de los estantes', m.shelfFrontSetback, (v) => setM({ ...m, shelfFrontSetback: v }), 'Cuánto quedan por detrás del frente.')}
            {len('Retranqueo de los divisores', m.dividerFrontSetback, (v) => setM({ ...m, dividerFrontSetback: v }))}
          </div>
        </Group>

        <Group title="Trasera">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Montaje" value={m.back.mode} onChange={(e) => back({ mode: e.target.value as Method['back']['mode'] })}>
              <option value="groove">En ranura</option>
              <option value="overlay">Clavada por detrás</option>
              <option value="none">Sin trasera</option>
            </SelectField>
            {m.back.mode !== 'none' && panelSelect('Tablero', m.back.materialId, (id) => back({ materialId: id }))}
            {m.back.mode === 'groove' && (
              <>
                {len('Profundidad de la ranura', m.back.grooveDepth, (v) => back({ grooveDepth: v }))}
                {len('Distancia de la ranura al fondo', m.back.inset, (v) => back({ inset: v }), 'Desde el canto trasero de los costados.')}
                {len('Holgura en el fondo de la ranura', m.back.clearance, (v) => back({ clearance: v }), 'Lo que entra la trasera en cada ranura es su profundidad menos esta holgura.')}
              </>
            )}
          </div>
        </Group>

        <Group title="Puertas y frentes de cajón">
          <div className="grid gap-3 sm:grid-cols-2">
            {panelSelect('Tablero', m.fronts.materialId, (id) => fronts({ materialId: id }))}
            {edgeSelect('Canto (los cuatro lados)', m.fronts.edgeMaterialId, (id) => fronts({ edgeMaterialId: id }))}
            {len('Holgura entre frentes', m.fronts.gap, (v) => fronts({ gap: v }), 'Superpuestos: la mitad queda en el borde del mueble. Encastrados: alrededor de todo el frente.', mm(20))}
          </div>
        </Group>

        {hardware.length > 0 && (
          <Group title="Herrajes por defecto" hint="Los usan los muebles hechos con este método, salvo que el mueble elija otros. Sin herraje, se usan las holguras de abajo.">
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ['hinge', 'Bisagras'],
                  ['slide', 'Correderas'],
                  ['sliding', 'Sistema corredizo'],
                ] as [HardwareKind, string][]
              ).map(([kind, label]) => (
                <SelectField
                  key={kind}
                  label={label}
                  value={m.hardware?.[kind] ?? ''}
                  onChange={(e) => {
                    const next = { ...m.hardware };
                    if (e.target.value) next[kind] = e.target.value;
                    else delete next[kind];
                    setM({ ...m, hardware: next });
                  }}
                >
                  <option value="">Ninguno</option>
                  {hardware
                    .filter((h) => h.kind === kind)
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                </SelectField>
              ))}
            </div>
          </Group>
        )}

        <Group title="Cajones" hint="Caja con dos laterales enteros, trasera y contrafrente entre ellos, y fondo.">
          <div className="grid gap-3 sm:grid-cols-2">
            {panelSelect('Tablero de laterales y traseras', m.drawer.materialId, (id) => drawer({ materialId: id }))}
            {panelSelect('Tablero del fondo', m.drawer.bottomMaterialId, (id) => drawer({ bottomMaterialId: id }))}
            <SelectField label="Fondo" value={m.drawer.bottomMode} onChange={(e) => drawer({ bottomMode: e.target.value as Method['drawer']['bottomMode'] })}>
              <option value="groove">En ranura</option>
              <option value="under">Clavado por debajo</option>
            </SelectField>
            {m.drawer.bottomMode === 'groove' && (
              <>
                {len('Profundidad de la ranura', m.drawer.grooveDepth, (v) => drawer({ grooveDepth: v }))}
                {len('Altura de la ranura', m.drawer.grooveHeight, (v) => drawer({ grooveHeight: v }), 'Sobre el canto de abajo de los laterales.')}
              </>
            )}
            {len('Hueco a cada lado (guías)', m.drawer.sideClearance, (v) => drawer({ sideClearance: v }), 'Guías de bolas: 12,5–13 mm.')}
            {len('Espacio libre arriba', m.drawer.topClearance, (v) => drawer({ topClearance: v }))}
            {len('Espacio libre abajo', m.drawer.bottomClearance, (v) => drawer({ bottomClearance: v }))}
            {len('Espacio libre detrás', m.drawer.rearClearance, (v) => drawer({ rearClearance: v }))}
            {len('Fondo en múltiplos de', m.drawer.depthStep, (v) => drawer({ depthStep: v }), `Largos de guía. 0 = sin redondear. Ahora: ${fmtMm(m.drawer.depthStep)} mm.`)}
          </div>
        </Group>

        {problems.length > 0 && (
          <Alert tone="warning" title="Revisa esto">
            <ul className="list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
