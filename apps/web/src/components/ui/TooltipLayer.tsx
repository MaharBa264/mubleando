'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { placeTip, splitShortcut, tipFor } from './tooltip';

const INTERACTIVE = 'button, a[href], [role="button"], [role="radio"], [role="tab"], input, select, summary';
const CANDIDATE = `[data-tip], [title], ${INTERACTIVE}`;
const HOVER_DELAY = 350;
const LONG_PRESS = 500;
const TIP_ID = 'mw-tooltip';

/** Busca, desde el elemento tocado hacia arriba, el primero que tenga tooltip. */
function findTarget(start: EventTarget | null): { el: HTMLElement; tip: string } | null {
  let el = start instanceof Element ? (start.closest(CANDIDATE) as HTMLElement | null) : null;
  while (el) {
    if (el.id === TIP_ID) return null;
    const tip = tipFor({
      tip: el.getAttribute('data-tip'),
      title: el.getAttribute('title'),
      ariaLabel: el.getAttribute('aria-label'),
      text: el.textContent ?? '',
      interactive: el.matches(INTERACTIVE),
    });
    if (tip) {
      // El title del navegador se cambia por el nuestro (si no, salen los dos).
      if (el.hasAttribute('title')) {
        el.setAttribute('data-tip', el.getAttribute('title')!);
        el.removeAttribute('title');
        // Sin nombre accesible propio, el texto del title lo era: se conserva como aria-label.
        if (!el.getAttribute('aria-label') && !(el.textContent ?? '').trim()) el.setAttribute('aria-label', tip);
      }
      return { el, tip };
    }
    el = el.parentElement?.closest(CANDIDATE) as HTMLElement | null;
  }
  return null;
}

/**
 * Tooltips de toda la app. Se monta una vez (en AppShell) y escucha al documento:
 * - con el ratón, al quedarse un momento sobre el elemento;
 * - con el teclado, al llegar con Tab (foco visible);
 * - en pantallas táctiles, con una pulsación larga (y entonces no se activa el botón).
 * El texto sale de `data-tip`, `title` o, en los botones de solo icono, de su `aria-label`.
 */
export function TooltipLayer() {
  const [state, setState] = useState<{ el: HTMLElement; tip: string } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: number | undefined;
    let current: HTMLElement | null = null;
    let swallowClick = false;
    let pressStart: { x: number; y: number } | null = null;

    const clear = () => window.clearTimeout(timer);
    const show = (t: { el: HTMLElement; tip: string }) => {
      current = t.el;
      setState(t);
    };
    const hide = () => {
      clear();
      current = null;
      pressStart = null;
      setState(null);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const t = findTarget(e.target);
      if (!t) return;
      if (t.el === current) return;
      clear();
      setState(null);
      current = t.el;
      timer = window.setTimeout(() => show(t), HOVER_DELAY);
    };
    const onOut = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !current) return;
      if (e.relatedTarget instanceof Node && current.contains(e.relatedTarget)) return;
      hide();
    };
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (!el.matches?.(':focus-visible')) return;
      const t = findTarget(el);
      if (t) {
        clear();
        show(t);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') {
        hide();
        return;
      }
      hide();
      const t = findTarget(e.target);
      if (!t) return;
      pressStart = { x: e.clientX, y: e.clientY };
      timer = window.setTimeout(() => {
        show(t);
        swallowClick = true;
      }, LONG_PRESS);
    };
    const onMove = (e: PointerEvent) => {
      if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 10) {
        clear();
        pressStart = null;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      clear();
      pressStart = null;
      // Después de una pulsación larga el tooltip queda unos segundos.
      if (swallowClick) timer = window.setTimeout(hide, 2500);
    };
    // La pulsación larga solo muestra el tooltip: no activa el botón ni abre el menú del navegador.
    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const onContext = (e: Event) => {
      if (swallowClick || pressStart) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', hide, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('contextmenu', onContext, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      clear();
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', hide, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('contextmenu', onContext, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);

  // Posición y descripción accesible del elemento mientras se ve el tooltip.
  useLayoutEffect(() => {
    if (!state || !ref.current) {
      setPos(null);
      return;
    }
    const r = state.el.getBoundingClientRect();
    const t = ref.current.getBoundingClientRect();
    setPos(placeTip({ left: r.left, top: r.top, width: r.width, height: r.height }, t, { width: window.innerWidth, height: window.innerHeight }));
    const el = state.el;
    const describes = el.getAttribute('aria-label') !== state.tip;
    if (describes) el.setAttribute('aria-describedby', TIP_ID);
    return () => {
      if (describes && el.getAttribute('aria-describedby') === TIP_ID) el.removeAttribute('aria-describedby');
    };
  }, [state]);

  if (!state) return null;
  const { text, keys } = splitShortcut(state.tip);
  return (
    <div
      ref={ref}
      id={TIP_ID}
      role="tooltip"
      className="pointer-events-none fixed z-[100] max-w-[min(18rem,calc(100vw-16px))] rounded-control bg-text px-2.5 py-1.5 text-xs leading-snug text-bg shadow-2"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
    >
      {text}
      {keys && <kbd className="ml-2 rounded border border-bg/30 px-1 font-sans text-[11px] opacity-80">{keys}</kbd>}
    </div>
  );
}
