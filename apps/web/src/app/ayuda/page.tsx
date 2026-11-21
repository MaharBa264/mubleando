'use client';

import { Page } from '@/components/AppShell';
import { HelpSteps } from '@/components/HelpIntro';
import { GUIDE_URL, HELP_INTRO } from '@/lib/help';

/** Ayuda: los pasos para usar la app, con dónde se toca cada cosa. */
export default function HelpPage() {
  return (
    <Page title="Cómo se usa">
      <p className="mb-6 max-w-2xl text-muted">{HELP_INTRO}</p>
      <HelpSteps expanded />
      <div className="mt-8 max-w-2xl space-y-2 text-sm">
        <h2 className="text-base font-semibold">Más ayuda</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Dejá el mouse sobre un botón, llegá a él con la tecla Tab o mantenelo apretado en el celular: aparece qué hace y su atajo de teclado.</li>
          <li>
            La{' '}
            <a href={GUIDE_URL} target="_blank" rel="noreferrer" className="font-medium text-accent underline">
              guía de uso completa
            </a>{' '}
            explica cada pantalla con detalle.
          </li>
        </ul>
      </div>
    </Page>
  );
}
