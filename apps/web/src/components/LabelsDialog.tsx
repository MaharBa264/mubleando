'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CutItem, Material } from '@mw/engine';
import { formatProblem, LABEL_FORMATS, labelsFromCutList, labelsPdf, type LabelFormat } from '@mw/exporters';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/feedback';
import { SelectField, TextField } from '@/components/ui/fields';
import { downloadBlob } from '@/lib/download';

const KEY = 'mw-etiquetas';
const CUSTOM = 'propio';

interface Saved {
  formatId: string;
  custom: LabelFormat;
}
const DEFAULT_CUSTOM: LabelFormat = { ...LABEL_FORMATS[0]!, id: CUSTOM, name: 'Medidas propias' };

function readSaved(): Saved {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Saved | null;
    if (v && typeof v.formatId === 'string' && v.custom) return { formatId: v.formatId, custom: { ...DEFAULT_CUSTOM, ...v.custom, id: CUSTOM } };
  } catch {
    /* sin almacenamiento */
  }
  return { formatId: LABEL_FORMATS[0]!.id, custom: DEFAULT_CUSTOM };
}

/** Número decimal con coma o punto; null si no es un número. */
const parseNum = (t: string) => {
  const v = Number(t.trim().replace(',', '.'));
  return t.trim() && Number.isFinite(v) ? v : null;
};

/** Campo numérico en mm (con decimales), que aplica al salir. */
function NumField({ label, value, onCommit, integer = false }: { label: string; value: number; onCommit: (v: number) => void; integer?: boolean }) {
  const shown = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2, useGrouping: false }).format(value);
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const commit = () => {
    const v = parseNum(text);
    if (v === null || v < 0 || (integer && !Number.isInteger(v))) return setText(shown);
    onCommit(v);
  };
  return <TextField label={label} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />;
}

/** S27 · Etiquetas para pegar en las piezas: formato de hoja, qué piezas y desde qué etiqueta. */
export function LabelsDialog({ open, onClose, items, materials, title, fileName }: { open: boolean; onClose: () => void; items: CutItem[]; materials: Material[]; title: string; fileName: string }) {
  const [saved, setSaved] = useState<Saved>({ formatId: LABEL_FORMATS[0]!.id, custom: DEFAULT_CUSTOM });
  useEffect(() => setSaved(readSaved()), []);
  const save = (next: Saved) => {
    setSaved(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* solo por esta vez */
    }
  };
  const format = saved.formatId === CUSTOM ? saved.custom : (LABEL_FORMATS.find((f) => f.id === saved.formatId) ?? LABEL_FORMATS[0]!);
  const problem = formatProblem(format);
  const perPage = format.cols * format.rows;

  const all = useMemo(() => labelsFromCutList(items, materials, { title }), [items, materials, title]);
  // Qué piezas: por número de la lista agrupada (todas al abrir).
  const refs = useMemo(() => {
    const m = new Map<string, { ref: string; piece: string; count: number }>();
    for (const l of all) {
      const cur = m.get(l.ref);
      if (cur) {
        cur.count++;
        if (!cur.piece.split(' / ').includes(l.piece)) cur.piece += ` / ${l.piece}`;
      } else m.set(l.ref, { ref: l.ref, piece: l.piece, count: 1 });
    }
    return [...m.values()];
  }, [all]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [start, setStart] = useState(1);
  const [outline, setOutline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = all.filter((l) => !off.has(l.ref));
  const first = Math.min(Math.max(1, start), perPage);
  const sheets = chosen.length ? Math.ceil((first - 1 + chosen.length) / perPage) : 0;

  const download = () => {
    setError(null);
    try {
      const { bytes } = labelsPdf(chosen, format, { start: first - 1, outline, title });
      downloadBlob(bytes, `${fileName}-etiquetas.pdf`, 'application/pdf');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF.');
    }
  };

  const setCustom = (patch: Partial<LabelFormat>) => save({ formatId: CUSTOM, custom: { ...saved.custom, ...patch } });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Etiquetas para las piezas"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={download} disabled={!!problem || chosen.length === 0}>
            Descargar PDF
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-muted">
          Una etiqueta por pieza (si una pieza va 4 veces, salen 4), con el mueble, la medida de corte, el material, qué cantos lleva (trazo grueso; el de abajo es el canto delantero), la veta y de
          qué placa del plano de cortes sale. El número (G1, G2…) es el de la lista agrupada.
        </p>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <SelectField label="Hoja de etiquetas (A4)" value={saved.formatId} onChange={(e) => save({ ...saved, formatId: e.target.value })}>
            {LABEL_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value={CUSTOM}>Medidas propias…</option>
          </SelectField>
          <NumField label={`Empezar en la etiqueta (1 a ${perPage})`} value={first} integer onCommit={(v) => setStart(Math.max(1, Math.min(perPage, v)))} />
        </div>

        {saved.formatId === CUSTOM && (
          <fieldset className="grid grid-cols-2 gap-3 rounded-control border border-border p-3 sm:grid-cols-4">
            <legend className="px-1 text-sm font-medium">Medidas de tu hoja, en mm</legend>
            <NumField label="Columnas" value={format.cols} integer onCommit={(v) => setCustom({ cols: v })} />
            <NumField label="Filas" value={format.rows} integer onCommit={(v) => setCustom({ rows: v })} />
            <NumField label="Ancho de etiqueta" value={format.width} onCommit={(v) => setCustom({ width: v })} />
            <NumField label="Alto de etiqueta" value={format.height} onCommit={(v) => setCustom({ height: v })} />
            <NumField label="Margen de arriba" value={format.marginTop} onCommit={(v) => setCustom({ marginTop: v })} />
            <NumField label="Margen izquierdo" value={format.marginLeft} onCommit={(v) => setCustom({ marginLeft: v })} />
            <NumField label="Separación horizontal" value={format.gapX} onCommit={(v) => setCustom({ gapX: v })} />
            <NumField label="Separación vertical" value={format.gapY} onCommit={(v) => setCustom({ gapY: v })} />
          </fieldset>
        )}
        {problem && <Alert tone="danger">{problem}</Alert>}

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={outline} onChange={(e) => setOutline(e.target.checked)} />
          <span>
            Dibujar el borde de cada etiqueta
            <span className="block text-xs text-muted">Para probar primero en papel común y ver si coincide con tu hoja de etiquetas.</span>
          </span>
        </label>

        <fieldset className="space-y-2">
          <legend className="mb-1 flex w-full items-center justify-between text-sm font-medium">
            Piezas
            <span className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setOff(new Set())}>
                Todas
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOff(new Set(refs.map((r) => r.ref)))}>
                Ninguna
              </Button>
            </span>
          </legend>
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-control border border-border p-2 text-sm">
            {refs.map((r) => (
              <li key={r.ref}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--accent)]"
                    checked={!off.has(r.ref)}
                    onChange={(e) => {
                      const next = new Set(off);
                      if (e.target.checked) next.delete(r.ref);
                      else next.add(r.ref);
                      setOff(next);
                    }}
                  />
                  <span className="w-10 shrink-0 font-medium">{r.ref}</span>
                  <span className="min-w-0 flex-1 truncate">{r.piece}</span>
                  <span className="tabular shrink-0 text-muted">× {r.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <p className="tabular rounded-control bg-surface-2 px-3 py-2 text-sm">
          {chosen.length} {chosen.length === 1 ? 'etiqueta' : 'etiquetas'} · {sheets} {sheets === 1 ? 'hoja' : 'hojas'}
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
