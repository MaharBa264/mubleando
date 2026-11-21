import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { placeTip, splitShortcut, tipFor } from './tooltip';

const src = { tip: null, title: null, ariaLabel: null, text: '', interactive: true };

describe('texto del tooltip', () => {
  it('data-tip o title, en ese orden', () => {
    expect(tipFor({ ...src, tip: 'A', title: 'B' })).toBe('A');
    expect(tipFor({ ...src, title: 'Agregar un estante' })).toBe('Agregar un estante');
  });
  it('un botón de solo icono usa su aria-label; uno con texto visible, no', () => {
    expect(tipFor({ ...src, ariaLabel: 'Cerrar' })).toBe('Cerrar');
    expect(tipFor({ ...src, ariaLabel: 'Cerrar', text: 'Cerrar' })).toBeNull();
    expect(tipFor({ ...src, ariaLabel: 'Algo', interactive: false })).toBeNull();
  });
  it('separa el atajo de teclado', () => {
    expect(splitShortcut('Deshacer (Ctrl+Z)')).toEqual({ text: 'Deshacer', keys: 'Ctrl+Z' });
    expect(splitShortcut('Tres cajones (después cambiás la cantidad)')).toEqual({ text: 'Tres cajones (después cambiás la cantidad)', keys: null });
  });
});

describe('posición', () => {
  const vp = { width: 400, height: 800 };
  it('arriba y centrado si entra', () => {
    expect(placeTip({ left: 100, top: 100, width: 40, height: 40 }, { width: 80, height: 30 }, vp)).toEqual({ left: 80, top: 62, side: 'top' });
  });
  it('abajo si arriba no entra', () => {
    expect(placeTip({ left: 100, top: 10, width: 40, height: 40 }, { width: 80, height: 30 }, vp).side).toBe('bottom');
  });
  it('dentro de la ventana, con 8 px de margen', () => {
    expect(placeTip({ left: 380, top: 100, width: 20, height: 20 }, { width: 120, height: 30 }, vp).left).toBe(272);
    expect(placeTip({ left: 0, top: 100, width: 20, height: 20 }, { width: 120, height: 30 }, vp).left).toBe(8);
  });
});

/** Todos los .tsx de la app. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

describe('todos los botones de solo icono tienen tooltip', () => {
  it('cada <Button size="icon…"> lleva aria-label, title o data-tip', () => {
    const root = join(import.meta.dirname, '..', '..');
    const missing: string[] = [];
    for (const f of files(root)) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(/<Button\b((?:=>|[^>])*?)>/gs)) {
        const attrs = m[1]!;
        if (!/size="icon/.test(attrs)) continue;
        if (!/aria-label=|title=|data-tip=/.test(attrs)) missing.push(`${f.slice(root.length)}:${s.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
