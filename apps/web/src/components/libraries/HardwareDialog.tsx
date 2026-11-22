'use client';

import { useState, type ReactNode } from 'react';
import { mm, type Hardware, type HingeSpec, type Len, type LegSpec, type LiftSpec, type SlideSpec, type SlidingSpec } from '@mw/engine';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/feedback';
import { MmField, SelectField, TextField } from '@/components/ui/fields';
import { fmtMm, parseCents } from '@/lib/format';

export const HW_KIND_LABEL: Record<Hardware['kind'], string> = { hinge: 'Bisagra', slide: 'Corredera de cajón', sliding: 'Sistema corredizo', leg: 'Pata', lift: 'Pistón, brazo o compás' };
const UNIT: Record<Hardware['kind'], string> = { hinge: 'por unidad', slide: 'por par', sliding: 'por juego', leg: 'por unidad', lift: 'por unidad' };

/** Número con coma decimal, o null si no es un número de 0 a `max`. */
const parseNum = (text: string, max: number) => {
  const v = Number(text.replace(',', '.'));
  return Number.isFinite(v) && v >= 0 && v <= max ? v : null;
};
const fmtNum = (v: number) => String(v).replace('.', ',');

/** Un número que se edita como texto y se aplica cuando es válido. */
function NumField({ label, value, max, hint, onChange }: { label: string; value: number; max: number; hint?: string; onChange: (v: number) => void }) {
  const [text, setText] = useState(fmtNum(value));
  return (
    <TextField
      label={label}
      inputMode="decimal"
      value={text}
      hint={hint}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseNum(e.target.value, max);
        if (v !== null) onChange(v);
      }}
    />
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-card border border-border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {hint && <p className="-mt-1 text-xs text-muted">{hint}</p>}
      {children}
    </fieldset>
  );
}

/** Lista de medidas en mm separadas por coma o espacio: "250, 300, 350" → [25000, 30000, 35000]. */
function parseLengths(text: string): Len[] | null {
  const parts = text.split(/[;\s]+|,(?=\s)|,(?=\d{3})/).map((x) => x.trim()).filter(Boolean);
  const out = parts.map((x) => Number(x.replace(',', '.')));
  if (out.length === 0 || out.some((v) => !Number.isFinite(v) || v <= 0)) return null;
  return [...new Set(out.map((v) => mm(v)))].sort((a, b) => a - b);
}

/** Crear o editar un herraje de la biblioteca. Las medidas cambian según el tipo. */
export function HardwareDialog({ open, initial, isNew, onClose, onSave }: { open: boolean; initial: Hardware; isNew: boolean; onClose: () => void; onSave: (h: Hardware) => Promise<void> }) {
  const [h, setH] = useState<Hardware>(initial);
  const [price, setPrice] = useState(initial.priceCents ? (initial.priceCents / 100).toFixed(2).replace('.', ',') : '');
  const [lengthsText, setLengthsText] = useState(h.kind === 'slide' ? h.spec.lengths.map((l) => fmtMm(l).replace(/\./g, '')).join(' ') : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cents = parseCents(price);

  // El tipo de `spec` depende de `kind`; aquí se cambia solo la parte que corresponde al herraje que se edita.
  const spec = <S,>(patch: Partial<S>) => setH((x) => ({ ...x, spec: { ...(x.spec as S), ...patch } }) as unknown as Hardware);
  const len = (label: string, value: Len, onChange: (v: Len) => void, hint?: string) => (
    <MmField compact label={label} value={value} min={0} max={mm(500)} hint={hint} onCommit={(v) => v !== null && onChange(v)} />
  );

  const save = async () => {
    if (!h.name.trim()) return setError('Ponele un nombre.');
    if (cents === null) return setError('El precio tiene que ser un número, por ejemplo 2.500 o 2.500,50.');
    let next: Hardware = { ...h, name: h.name.trim(), priceCents: cents };
    if (next.kind === 'lift' && (next.spec.minWeight > next.spec.maxWeight || next.spec.minHeight > next.spec.maxHeight)) {
      return setError('El peso y el alto mínimos no pueden ser mayores que los máximos.');
    }
    if (next.kind === 'slide') {
      const lengths = parseLengths(lengthsText);
      if (!lengths) return setError('Los largos de corredera tienen que ser medidas en mm separadas por espacios, por ejemplo: 250 300 350 400.');
      next = { ...next, spec: { ...next.spec, lengths } };
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={`${isNew ? 'Nuevo' : 'Editar'}: ${HW_KIND_LABEL[h.kind].toLowerCase()}`}
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
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
          <TextField label="Nombre (marca y modelo)" value={h.name} maxLength={120} onChange={(e) => setH({ ...h, name: e.target.value })} />
          <TextField label={`Precio ${UNIT[h.kind]} ($)`} inputMode="decimal" value={price} placeholder="sin precio" aria-invalid={cents === null} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <Alert tone="info">Cada marca usa sus propias medidas: copiá las de la ficha técnica del herraje que compres.</Alert>

        {h.kind === 'hinge' && (
          <Group title="Bisagra de cazoleta">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Codo" value={h.spec.crank} onChange={(e) => spec<HingeSpec>({ crank: e.target.value as HingeSpec['crank'] })}>
                <option value="full">Codo 0 · puerta superpuesta</option>
                <option value="half">Codo 9 · semisuperpuesta</option>
                <option value="inset">Codo 18 · encastrada</option>
              </SelectField>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={h.spec.softClose} onChange={(e) => spec<HingeSpec>({ softClose: e.target.checked })} />
                Cierre suave
              </label>
              {len('Diámetro de la cazoleta', h.spec.cupDiameter, (v) => spec<HingeSpec>({ cupDiameter: v }))}
              {len('Distancia del taladro al borde', h.spec.cupDistance, (v) => spec<HingeSpec>({ cupDistance: v }), 'Entre 3 y 6 mm según la marca.')}
            </div>
            <p className="text-xs font-medium">Cantidad por puerta según su alto</p>
            <ul className="space-y-2">
              {h.spec.countByHeight.map(([upTo, count], i) => (
                <li key={i} className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
                  <MmField
                    compact
                    label={i === 0 ? 'Puertas de hasta' : 'Hasta'}
                    value={upTo}
                    min={mm(100)}
                    onCommit={(v) => v !== null && h.kind === 'hinge' && spec<HingeSpec>({ countByHeight: h.spec.countByHeight.map((r, j) => (j === i ? [v, r[1]] : r)) })}
                  />
                  <TextField
                    label="Bisagras"
                    inputMode="numeric"
                    value={String(count)}
                    onChange={(e) => {
                      const c = Math.max(1, Math.min(10, Number(e.target.value.replace(/\D/g, '')) || 1));
                      if (h.kind === 'hinge') spec<HingeSpec>({ countByHeight: h.spec.countByHeight.map((r, j) => (j === i ? [r[0], c] : r)) });
                    }}
                  />
                </li>
              ))}
            </ul>
          </Group>
        )}

        {h.kind === 'slide' && (
          <Group title="Corredera" hint="El fondo del cajón será el largo de corredera más grande que entre en el mueble.">
            <SelectField label="Tipo" value={h.spec.type} onChange={(e) => spec<SlideSpec>({ type: e.target.value as SlideSpec['type'] })}>
              <option value="ball">Telescópica de bolas (al costado)</option>
              <option value="roller">De rodillo (al costado)</option>
              <option value="undermount">Oculta bajo el cajón</option>
              <option value="metal">Cajón de laterales metálicos</option>
            </SelectField>
            <TextField label="Largos que se venden (mm, separados por espacios)" value={lengthsText} onChange={(e) => setLengthsText(e.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              {(h.spec.type === 'ball' || h.spec.type === 'roller') &&
                len('Hueco a cada lado del cajón', h.spec.sideClearance, (v) => spec<SlideSpec>({ sideClearance: v }), 'Bolas de 45 mm: 12,5 a 13 mm.')}
              {h.spec.type === 'undermount' && (
                <>
                  {len('Ancho interior = hueco menos', h.spec.innerWidthDeduction, (v) => spec<SlideSpec>({ innerWidthDeduction: v }), 'Blum Tandem: 42 mm.')}
                  {len('Largo de la caja = corredera menos', h.spec.lengthDeduction, (v) => spec<SlideSpec>({ lengthDeduction: v }), 'Blum Tandem: 10 mm.')}
                  {len('Espesor máximo de laterales', h.spec.maxSideThickness, (v) => spec<SlideSpec>({ maxSideThickness: v }), '0 = sin límite.')}
                </>
              )}
              {h.spec.type === 'metal' && (
                <>
                  {len('Ancho del fondo = hueco menos', h.spec.bottomWidthDeduction, (v) => spec<SlideSpec>({ bottomWidthDeduction: v }))}
                  {len('Ancho de la trasera = hueco menos', h.spec.backWidthDeduction, (v) => spec<SlideSpec>({ backWidthDeduction: v }))}
                  {len('Largo del fondo = corredera menos', h.spec.bottomLengthDeduction, (v) => spec<SlideSpec>({ bottomLengthDeduction: v }))}
                </>
              )}
            </div>
          </Group>
        )}

        {h.kind === 'sliding' && (
          <Group title="Sistema corredizo" hint="Las hojas van dentro del hueco, en dos rieles; cada hoja se monta sobre la siguiente.">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Hojas" value={h.spec.leaves} onChange={(e) => spec<SlidingSpec>({ leaves: Number(e.target.value) as 2 | 3 })}>
                <option value={2}>2 hojas</option>
                <option value={3}>3 hojas</option>
              </SelectField>
              {len('Solape entre hojas', h.spec.overlap, (v) => spec<SlidingSpec>({ overlap: v }), 'Häfele recomienda 20 mm.')}
              {len('Luz arriba (riel superior)', h.spec.topGap, (v) => spec<SlidingSpec>({ topGap: v }))}
              {len('Luz abajo (riel inferior)', h.spec.bottomGap, (v) => spec<SlidingSpec>({ bottomGap: v }))}
              {len('Del frente a la hoja de adelante', h.spec.frontSetback, (v) => spec<SlidingSpec>({ frontSetback: v }))}
              {len('Entre las dos hojas', h.spec.trackGap, (v) => spec<SlidingSpec>({ trackGap: v }), 'Espacio entre rieles, además del espesor de la hoja.')}
            </div>
          </Group>
        )}
        {h.kind === 'leg' && (
          <Group title="Pata" hint="El mueble sube el alto de la pata (o, con zócalo, las patas van ocultas detrás).">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Estilo" value={h.spec.style} onChange={(e) => spec<LegSpec>({ style: e.target.value as LegSpec['style'] })}>
                <option value="straight">Recta</option>
                <option value="tapered">Cónica</option>
                <option value="midcentury">Estilo años 60 (inclinada, con placa)</option>
                <option value="adjustable">Regulable (para zócalo)</option>
              </SelectField>
              <SelectField label="Sección" value={h.spec.section} onChange={(e) => spec<LegSpec>({ section: e.target.value as LegSpec['section'] })}>
                <option value="square">Cuadrada</option>
                <option value="round">Redonda</option>
              </SelectField>
              {len('Alto', h.spec.height, (v) => v > 0 && spec<LegSpec>({ height: v }))}
              {len('Retiro desde los bordes del mueble', h.spec.inset, (v) => spec<LegSpec>({ inset: v }), 'Hasta el borde de la pata.')}
              {len(h.spec.section === 'square' ? 'Lado arriba' : 'Diámetro arriba', h.spec.topSize, (v) => v > 0 && spec<LegSpec>({ topSize: v }))}
              {len(h.spec.section === 'square' ? 'Lado abajo' : 'Diámetro abajo', h.spec.bottomSize, (v) => v > 0 && spec<LegSpec>({ bottomSize: v }), 'Igual que arriba = recta.')}
              <TextField
                label="Inclinación hacia afuera (grados)"
                inputMode="decimal"
                value={String(h.spec.splay).replace('.', ',')}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(',', '.'));
                  if (Number.isFinite(v) && v >= 0 && v <= 30) spec<LegSpec>({ splay: v });
                }}
              />
              {h.spec.style === 'adjustable' && (
                <>
                  {len('Regula desde', h.spec.adjustMin, (v) => spec<LegSpec>({ adjustMin: v }))}
                  {len('Regula hasta', h.spec.adjustMax, (v) => spec<LegSpec>({ adjustMax: v }))}
                </>
              )}
            </div>
            <p className="text-xs font-medium">Cantidad según el ancho del mueble</p>
            <ul className="space-y-2">
              {h.spec.countByWidth.map(([upTo, count], i) => (
                <li key={i} className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
                  <MmField
                    compact
                    label={i === 0 ? 'Muebles de hasta' : 'Hasta'}
                    value={upTo}
                    min={mm(100)}
                    onCommit={(v) => v !== null && h.kind === 'leg' && spec<LegSpec>({ countByWidth: h.spec.countByWidth.map((r, j) => (j === i ? [v, r[1]] : r)) })}
                  />
                  <TextField
                    label="Patas"
                    inputMode="numeric"
                    value={String(count)}
                    onChange={(e) => {
                      const c = Math.max(2, Math.min(20, Number(e.target.value.replace(/\D/g, '')) || 2));
                      if (h.kind === 'leg') spec<LegSpec>({ countByWidth: h.spec.countByWidth.map((r, j) => (j === i ? [r[0], c] : r)) });
                    }}
                  />
                </li>
              ))}
            </ul>
          </Group>
        )}
        {h.kind === 'lift' && (
          <Group title="Apertura hacia arriba o hacia abajo" hint="El motor calcula el peso de la puerta y elige el primero que la aguanta (o avisa si el elegido no). Los rangos salen de la tabla del fabricante.">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Tipo"
                value={h.spec.type}
                onChange={(e) => {
                  const type = e.target.value as LiftSpec['type'];
                  spec<LiftSpec>({ type, direction: type === 'flap' ? 'down' : 'up', ...(type === 'gas' ? {} : { force: 0 }) });
                }}
              >
                <option value="gas">Pistón a gas (hacia arriba)</option>
                <option value="stay">Brazo con freno (hacia arriba, queda en cualquier posición)</option>
                <option value="flap">Compás con freno (tapa que baja)</option>
              </SelectField>
              {h.spec.type === 'gas' && <NumField label="Fuerza (N)" value={h.spec.force} max={2000} hint="Para pedirlo al comprar." onChange={(v) => spec<LiftSpec>({ force: v })} />}
              <NumField label="Peso de puerta desde (kg)" value={h.spec.minWeight} max={100} onChange={(v) => spec<LiftSpec>({ minWeight: v })} />
              <NumField label="Hasta (kg)" value={h.spec.maxWeight} max={100} hint={`Con los ${h.spec.perDoor} que lleva cada puerta.`} onChange={(v) => v > 0 && spec<LiftSpec>({ maxWeight: v })} />
              <MmField compact label="Alto de puerta desde" value={h.spec.minHeight} min={0} max={mm(1500)} onCommit={(v) => v !== null && spec<LiftSpec>({ minHeight: v })} />
              <MmField compact label="Hasta" value={h.spec.maxHeight} min={mm(50)} max={mm(1500)} onCommit={(v) => v !== null && spec<LiftSpec>({ maxHeight: v })} />
              {len('Fondo mínimo del mueble', h.spec.minDepth, (v) => spec<LiftSpec>({ minDepth: v }))}
              <SelectField label="Por puerta" value={String(h.spec.perDoor)} onChange={(e) => spec<LiftSpec>({ perDoor: e.target.value === '1' ? 1 : 2 })}>
                <option value="2">Dos (uno por lado)</option>
                <option value="1">Uno</option>
              </SelectField>
              <NumField label="Ángulo de apertura (grados)" value={h.spec.angle} max={180} hint="90 = horizontal. Más de 90 sube por encima del mueble." onChange={(v) => v >= 45 && spec<LiftSpec>({ angle: v })} />
            </div>
          </Group>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
