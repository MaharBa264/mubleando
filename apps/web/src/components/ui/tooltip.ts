/**
 * Reglas de los tooltips, sin DOM (se prueban aparte). El componente que los muestra es TooltipLayer.
 *
 * Qué texto lleva el tooltip de un elemento:
 * 1. `data-tip` o `title`, si lo tiene (el `title` se pasa a `data-tip` para que el navegador no muestre
 *    además el suyo, que tarda y no se ve con el teclado ni en el celular);
 * 2. si no, el `aria-label` de un botón o enlace sin texto visible (los botones de solo icono).
 */
export interface TipSource {
  tip: string | null;
  title: string | null;
  ariaLabel: string | null;
  /** Texto visible del elemento. */
  text: string;
  interactive: boolean;
}

export function tipFor(el: TipSource): string | null {
  const own = (el.tip ?? el.title ?? '').trim();
  if (own) return own;
  if (el.interactive && el.ariaLabel?.trim() && !el.text.trim()) return el.ariaLabel.trim();
  return null;
}

/**
 * Separa el atajo de teclado del final del texto para mostrarlo aparte:
 * "Deshacer (Ctrl+Z)" → { text: "Deshacer", keys: "Ctrl+Z" }.
 */
export function splitShortcut(tip: string): { text: string; keys: string | null } {
  const m = /^(.*\S)\s*\(((?:Ctrl|Mayús|Shift|Alt|Supr|Esc|Flechas|F\d)[^()]*)\)$/.exec(tip);
  return m ? { text: m[1]!, keys: m[2]! } : { text: tip, keys: null };
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Dónde va el tooltip: centrado arriba del elemento, o abajo si arriba no entra; siempre dentro de la
 * ventana con 8 px de margen.
 */
export function placeTip(target: Box, tip: { width: number; height: number }, viewport: { width: number; height: number }, gap = 8) {
  const margin = 8;
  const above = target.top - gap - tip.height >= margin;
  const top = above ? target.top - gap - tip.height : Math.min(target.top + target.height + gap, viewport.height - tip.height - margin);
  const centered = target.left + target.width / 2 - tip.width / 2;
  const left = Math.max(margin, Math.min(centered, viewport.width - tip.width - margin));
  return { left, top, side: above ? ('top' as const) : ('bottom' as const) };
}
