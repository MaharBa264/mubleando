'use client';

import { useMemo, useState } from 'react';
import type { CutItem, LegOut, Material, Part } from '@mw/engine';
import { cabinetPdf, type DocInclude } from '@mw/exporters';
import { readCuttingOptions } from '@/components/CuttingPlanView';
import { readSavedLabelFormat } from '@/components/LabelsDialog';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/feedback';
import { downloadBlob } from '@/lib/download';
import { fmtDims, LOCALE } from '@/lib/format';

const KEY = 'mw-documento';
const DEFAULT: DocInclude = { cutList: true, plan: true, closed: true, open: false, exploded: true, labels: false };

function readInclude(): DocInclude {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<DocInclude> | null;
    if (v && typeof v === 'object') return { ...DEFAULT, ...v };
  } catch {
    /* sin almacenamiento */
  }
  return DEFAULT;
}

const OPTIONS: { key: keyof DocInclude; label: string; hint: string }[] = [
  { key: 'cutList', label: 'Lista de corte', hint: 'Lista agrupada con medidas y cantos. Si hay muebles bajo escalera, suma los croquis de cortes en ángulo.' },
  { key: 'plan', label: 'Plano de cortes', hint: 'Cada placa con sus piezas numeradas, dos placas por página.' },
  { key: 'closed', label: 'Mueble armado, frentes cerrados', hint: 'Vista isométrica.' },
  { key: 'open', label: 'Mueble armado, frentes abiertos', hint: 'Puertas abiertas y cajones afuera.' },
  { key: 'exploded', label: 'Vista explotada', hint: 'Cada pieza separada en la dirección en que se arma, con su número.' },
  { key: 'labels', label: 'Etiquetas', hint: 'Al final, en el formato elegido en Etiquetas, para imprimir esas hojas en papel autoadhesivo.' },
];

/** Documento PDF: portada, lista, plano, vistas y etiquetas, cada parte opcional. */
export function DocumentDialog({
  open,
  onClose,
  items,
  materials,
  title,
  fileName,
  cost,
  legs = {},
}: {
  open: boolean;
  onClose: () => void;
  items: CutItem[];
  materials: Material[];
  title: string;
  fileName: string;
  /** Costo estimado ya escrito, si hay precios. */
  cost?: string;
  /** Patas de cada mueble, por nombre. */
  legs?: Record<string, LegOut[]>;
}) {
  const [include, setInclude] = useState<DocInclude>(() => (typeof window === 'undefined' ? DEFAULT : readInclude()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Muebles del documento: en un proyecto, uno por mueble de origen.
  const cabinets = useMemo(() => {
    const m = new Map<string, Part[]>();
    for (const it of items) {
      const name = it.source ?? title;
      const list = m.get(name) ?? [];
      list.push(it.part);
      m.set(name, list);
    }
    return [...m].map(([name, parts]) => ({ name, parts, legs: legs[name] }));
  }, [items, title, legs]);

  const subtitle = useMemo(() => {
    if (cabinets.length !== 1) return `${cabinets.length} muebles`;
    const s = { w: 0, h: 0, d: 0 };
    for (const p of cabinets[0]!.parts) {
      s.w = Math.max(s.w, p.box.x + p.box.dx);
      s.h = Math.max(s.h, p.box.y + p.box.dy);
      s.d = Math.max(s.d, p.box.z + p.box.dz);
    }
    return `${fmtDims(s.w, s.h, s.d)} mm`;
  }, [cabinets]);

  const toggle = (k: keyof DocInclude, v: boolean) => {
    const next = { ...include, [k]: v };
    setInclude(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* solo por esta vez */
    }
  };

  const generate = () => {
    setBusy(true);
    setError(null);
    // Un instante para que se vea «Generando…» antes del trabajo (todo pasa en el navegador).
    setTimeout(() => {
      try {
        const { bytes } = cabinetPdf({
          title,
          subtitle,
          date: new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long' }).format(new Date()),
          cost,
          items,
          materials,
          cabinets,
          include,
          cutting: readCuttingOptions(),
          labelFormat: readSavedLabelFormat(),
        });
        downloadBlob(bytes, `${fileName}.pdf`, 'application/pdf');
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo generar el PDF.');
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Documento PDF"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={generate} disabled={busy}>
            {busy ? 'Generando…' : 'Descargar PDF'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Un solo archivo para la maderera, el taller o el cliente. Empieza con una portada (nombre, medidas, fecha, costo estimado y una vista del mueble). Las vistas son dibujos nítidos, no capturas
          de pantalla{cabinets.length > 1 ? '; en un proyecto, una por mueble' : ''}.
        </p>
        <ul className="space-y-2">
          {OPTIONS.map((o) => (
            <li key={o.key}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={include[o.key]} onChange={(e) => toggle(o.key, e.target.checked)} />
                <span>
                  {o.label}
                  <span className="block text-xs text-muted">{o.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
