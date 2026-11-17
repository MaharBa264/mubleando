import { mm, toMm, type Len } from '@mw/engine';

/**
 * Formato de números, dinero y fechas de la app: Argentina.
 * Para otro país, basta con cambiar estas dos constantes.
 */
export const LOCALE = 'es-AR';
/** Moneda de todos los precios (ISO 4217). Los importes se guardan en centavos, enteros. */
export const CURRENCY = 'ARS';

const nf = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY });
const date = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });

export const fmtMm = (l: Len) => nf.format(toMm(l));
export const fmtDims = (...ls: Len[]) => ls.map(fmtMm).join(' × ');
/** Centavos → "$ 12.345,50". */
export const fmtMoney = (cents: number) => money.format(cents / 100);
export const fmtNum = (n: number, digits = 2) => new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits }).format(n);
export const fmtDate = (iso: string) => date.format(new Date(iso));

/** Lee "600", "600,5" o "600.5" → Len. Devuelve null si está vacío y NaN si no es un número. */
export function parseMm(text: string): Len | null | typeof NaN {
  const s = text.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return mm(Number(s));
}

/**
 * Lee un precio escrito a la manera argentina y lo devuelve en centavos.
 *   "20000"     → 2000000      "20.000"    → 2000000 (punto de miles)
 *   "20.000,50" → 2000050      "1.234.567" → 123456700
 *   "20000,5"   → 2000050      "20000.50"  → 2000050 (punto decimal, si no son grupos de 3)
 *   "$ 20.000"  → 2000000      ""          → 0
 * Devuelve null si no es un precio válido (letras, más de dos decimales, negativos…).
 */
export function parseCents(text: string): number | null {
  let t = text.trim().replace(/\s|\$/g, '');
  if (t === '') return 0;
  if (t.includes(',')) {
    // Con coma: la coma es el decimal y los puntos son de miles.
    if (!/^\d{1,3}(\.\d{3})*(,\d{0,2})?$|^\d+(,\d{0,2})?$/.test(t)) return null;
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    // Solo puntos en grupos de tres: son de miles.
    t = t.replace(/\./g, '');
  } else if (!/^\d+(\.\d{0,2})?$/.test(t)) {
    return null;
  }
  return Math.round(Number(t) * 100);
}
