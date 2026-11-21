'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { Design, LegOut, Part, ZoneOut } from '@mw/engine';
import { exportStl, exportToy, slug, zip, type DrawerMode } from '@mw/exporters';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField } from '@/components/ui/fields';
import { Alert } from '@/components/ui/feedback';
import { downloadBlob } from '@/lib/download';
import { fmtNum } from '@/lib/format';

const SCALES = [
  { value: 0.2, label: '1:5' },
  { value: 0.1, label: '1:10' },
  { value: 0.05, label: '1:20' },
  { value: 0.04, label: '1:25' },
  { value: 0.02, label: '1:50' },
  { value: 1, label: '1:1 (tamaño real)' },
];

const MIN_THICKNESS = [
  { value: 0, label: 'No engordar' },
  { value: 0.4, label: '0,4 mm (boquilla fina)' },
  { value: 0.8, label: '0,8 mm (recomendado)' },
  { value: 1.2, label: '1,2 mm (más robusto)' },
];

type Mode = 'assembled' | 'pieces' | 'toy';

const CLEARANCES = [
  { value: 0.3, label: '0,3 mm (impresora muy precisa)' },
  { value: 0.4, label: '0,4 mm (recomendado)' },
  { value: 0.5, label: '0,5 mm (más suelta)' },
];

/** Exportar el mueble a STL para imprimirlo en 3D: completo o pieza a pieza, y qué hacer con los cajones. */
export function StlExportDialog({
  open,
  onClose,
  parts,
  zones,
  legs = [],
  size,
  name,
}: {
  open: boolean;
  onClose: () => void;
  parts: Part[];
  zones: ZoneOut[];
  legs?: LegOut[];
  size: Design['size'];
  name: string;
}) {
  const [mode, setMode] = useState<Mode>('assembled');
  const [scale, setScale] = useState(0.1);
  const [minT, setMinT] = useState(0.8);
  const [drawers, setDrawers] = useState<DrawerMode>('integrated');
  const [clearance, setClearance] = useState(0.4);
  const hasDrawers = parts.some((p) => p.assembly?.kind === 'drawer');

  // Se calcula al vuelo (son unos pocos cientos de triángulos) para enseñar el tamaño y los avisos antes de descargar.
  const preview = useMemo(() => {
    if (mode === 'toy') {
      const t = exportToy(parts, zones, size, { name: name || 'mueble', scale, clearance, minWall: Math.max(minT, 0.8), legs });
      return { ...t, printedSize: null };
    }
    return exportStl(parts, { mode, scale, minThicknessMm: minT, drawers: hasDrawers ? drawers : 'integrated', name: name || 'mueble', legs });
  }, [parts, zones, legs, size, mode, scale, minT, drawers, hasDrawers, name, clearance]);

  const download = () => {
    const { files, readme } = preview;
    if (files.length === 1) {
      downloadBlob(files[0]!.data, files[0]!.name, 'model/stl');
    } else {
      // BOM para que el Bloc de notas de Windows lea bien las tildes.
      const z = zip([...files, { name: 'LEEME.txt', data: '﻿' + readme.replace(/\n/g, '\r\n') }]);
      downloadBlob(z, `${slug(name || 'mueble')}-stl.zip`, 'application/zip');
    }
    onClose();
  };

  const fileCount = preview.files.length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Exportar para impresión 3D (STL)"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={download} disabled={parts.length === 0}>
            {fileCount === 1 ? 'Descargar STL' : `Descargar ZIP (${fileCount} archivos)`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Choice
          legend="Qué exportar"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'assembled', label: 'Mueble completo', hint: 'Montado, en un solo archivo, como se ve en el visor.' },
            {
              value: 'toy',
              label: 'De juguete (funciona)',
              hint: 'Mueble y puertas de una vez, con bisagras impresas que giran; cajones y hojas corredizas aparte, para encastrar.',
            },
            {
              value: 'pieces',
              label: 'Pieza a pieza',
              hint: 'Cada pieza tumbada en su archivo. Las iguales se imprimen una vez y el nombre dice cuántas hacen falta.',
            },
          ]}
        />

        {mode === 'assembled' && (
          <Choice
            legend="Cajones"
            value={drawers}
            onChange={setDrawers}
            disabled={!hasDrawers}
            note={hasDrawers ? undefined : 'Este mueble todavía no tiene cajones. Los cajones llegan en la fase 2.'}
            options={[
              { value: 'integrated', label: 'Integrados en el mueble', hint: 'En su sitio, en el mismo archivo.' },
              { value: 'separate', label: 'Cada cajón aparte, montado', hint: 'Un archivo por cajón, para imprimirlo y meterlo después.' },
              { value: 'pieces', label: 'Cajones pieza a pieza', hint: 'Las piezas de cada cajón sueltas, para pegarlas.' },
            ]}
          />
        )}

        {mode === 'toy' && (
          <SelectField label="Holgura de lo que se mueve" value={clearance} onChange={(e) => setClearance(Number(e.target.value))}>
            {CLEARANCES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </SelectField>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Escala" value={scale} onChange={(e) => setScale(Number(e.target.value))}>
            {SCALES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Espesor mínimo impreso" value={minT} onChange={(e) => setMinT(Number(e.target.value))}>
            {MIN_THICKNESS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </SelectField>
        </div>

        {preview.printedSize && (
          <p className="tabular rounded-control bg-surface-2 px-3 py-2 text-sm">
            Tamaño impreso: <strong>{fmtNum(preview.printedSize.x, 1)} × {fmtNum(preview.printedSize.y, 1)} × {fmtNum(preview.printedSize.z, 1)} mm</strong>{' '}
            <span className="text-muted">(ancho × fondo × alto)</span>
          </p>
        )}
        {preview.warnings.length > 0 && (
          <Alert tone="warning" title="Antes de imprimir">
            <ul className="list-disc pl-5">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Alert>
        )}
        <p className="text-xs text-muted">
          Archivo en milímetros con el eje Z hacia arriba, listo para el programa de laminado (PrusaSlicer, Cura, Orca, Bambu Studio…).
          {fileCount > 1 && ' El ZIP incluye un LEEME.txt con la medida real de cada pieza y cuántas imprimir.'}
        </p>
      </div>
    </Dialog>
  );
}

function Choice<T extends string>({
  legend,
  value,
  onChange,
  options,
  disabled = false,
  note,
}: {
  legend: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint: string }[];
  disabled?: boolean;
  note?: ReactNode;
}) {
  return (
    <fieldset disabled={disabled} className="disabled:opacity-60">
      <legend className="mb-2 text-xs font-medium text-muted">{legend}</legend>
      <div className="space-y-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-start gap-3 rounded-control border border-border p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
          >
            <input type="radio" className="mt-1 accent-[var(--accent)]" checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>
              <span className="block text-sm font-medium">{o.label}</span>
              <span className="block text-xs text-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </fieldset>
  );
}
