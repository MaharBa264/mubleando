'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { GUIDE_URL, HELP_INTRO, HELP_STEPS, HELP_VERSION, type HelpStep } from '@/lib/help';

const ART: Record<HelpStep['art'], IconName> = { project: 'folder', cabinet: 'cube', cutlist: 'list', room: 'plan', library: 'layers' };
const KEY = 'mw-ayuda-cerrada';

/** ¿Este navegador ya cerró la explicación (de esta versión)? Sin almacenamiento, se muestra. */
function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === String(HELP_VERSION);
  } catch {
    return false;
  }
}

/** Los pasos de la ayuda. `expanded`: con el «cómo» a la vista (página de ayuda) o plegado (inicio). */
export function HelpSteps({ expanded = false }: { expanded?: boolean }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {HELP_STEPS.map((s, i) => (
        <li key={s.title} className="flex gap-3 rounded-card border border-border bg-surface p-4">
          <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Icon name={ART[s.art]} size={18} />
          </span>
          <div className="min-w-0 text-sm">
            <h3 className="font-semibold">
              <span className="text-muted">{i + 1}. </span>
              {s.title}
            </h3>
            <p className="mt-1 text-muted">{s.text}</p>
            {expanded ? (
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {s.how.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-accent">Dónde se toca</summary>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                  {s.how.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Explicación breve en el inicio. Se cierra con «Ya lo sé» y se vuelve a ver desde Ayuda. */
export function HelpIntro() {
  // null hasta leer el navegador (así no parpadea al cargar).
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  useEffect(() => setDismissed(readDismissed()), []);
  if (dismissed !== false) return null;

  const close = () => {
    try {
      window.localStorage.setItem(KEY, String(HELP_VERSION));
    } catch {
      /* sin almacenamiento: se cierra solo por ahora */
    }
    setDismissed(true);
  };

  return (
    <section aria-labelledby="ayuda-inicio" className="mb-8 rounded-card border border-accent/30 bg-accent-soft/40 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 id="ayuda-inicio" className="text-lg font-semibold">
            Qué podés hacer
          </h2>
          <p className="mt-1 text-sm text-muted">{HELP_INTRO}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/ayuda" className="inline-flex h-8 items-center rounded-control px-3 text-sm font-medium text-accent hover:bg-surface-2">
            Ver más
          </Link>
          <Button size="sm" onClick={close} title="Ocultar esta explicación. Vuelve con el botón Ayuda de arriba.">
            Ya lo sé
          </Button>
        </div>
      </div>
      <HelpSteps />
      <p className="mt-4 text-xs text-muted">
        ¿Dudas sobre un botón? Dejá el mouse encima (o mantenelo apretado en el celular) y aparece qué hace. Todo con detalle en la{' '}
        <a href={GUIDE_URL} target="_blank" rel="noreferrer" className="font-medium text-accent underline">
          guía de uso
        </a>
        .
      </p>
    </section>
  );
}
