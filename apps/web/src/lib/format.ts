import { mm, toMm, type Len } from '@mw/engine';

const nf = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const date = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

export const fmtMm = (l: Len) => nf.format(toMm(l));
export const fmtDims = (...ls: Len[]) => ls.map(fmtMm).join(' × ');
export const fmtMoney = (cents: number) => money.format(cents / 100);
export const fmtNum = (n: number, digits = 2) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: digits }).format(n);
export const fmtDate = (iso: string) => date.format(new Date(iso));

/** Lee "600", "600,5" o "600.5" → Len. Devuelve null si está vacío y NaN si no es un número. */
export function parseMm(text: string): Len | null | typeof NaN {
  const s = text.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return mm(Number(s));
}
