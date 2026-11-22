'use client';

import { useEffect, useId, useState, type ComponentProps, type ReactNode } from 'react';
import type { Len } from '@mw/engine';
import { fmtMm, parseMm } from '@/lib/format';
import { Icon } from './Icon';

const inputClass =
  'h-10 w-full rounded-control border border-border bg-surface px-3 text-sm text-text transition-[border-color,box-shadow] duration-150 placeholder:text-muted hover:border-border-strong focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20';

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted">
      {children}
    </label>
  );
}

export function TextField({ label, id, hint, ...rest }: ComponentProps<'input'> & { label: string; hint?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div>
      <Label htmlFor={fid}>{label}</Label>
      <input id={fid} className={inputClass} aria-describedby={hint ? `${fid}-hint` : undefined} {...rest} />
      {hint && (
        <p id={`${fid}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  id,
  children,
  ...rest
}: ComponentProps<'select'> & { label: string; children: ReactNode }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div>
      <Label htmlFor={fid}>{label}</Label>
      <select id={fid} className={inputClass} {...rest}>
        {children}
      </select>
    </div>
  );
}

/**
 * Campo de medida en mm. Acepta coma o punto. Aplica al salir del campo o con Intro; Esc deshace.
 * Con `allowEmpty`, vaciarlo significa "automático" (onCommit(null)).
 */
export function MmField({
  label,
  value,
  onCommit,
  min,
  max,
  allowEmpty = false,
  placeholder,
  hint,
  compact = false,
}: {
  label: string;
  value: Len | null;
  onCommit: (v: Len | null) => void;
  min?: Len;
  max?: Len;
  allowEmpty?: boolean;
  placeholder?: string;
  hint?: string;
  compact?: boolean;
}) {
  const id = useId();
  const shown = value === null ? '' : fmtMm(value).replace(/\./g, '');
  const [text, setText] = useState(shown);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(shown);
    setError(null);
  }, [shown]);

  const commit = () => {
    const v = parseMm(text);
    if (v === null) {
      if (allowEmpty) {
        setError(null);
        if (value !== null) onCommit(null);
      } else {
        setError('Escribe una medida.');
      }
      return;
    }
    if (Number.isNaN(v)) return setError('Solo números, por ejemplo 600 o 600,5.');
    if (min !== undefined && v < min) return setError(`Mínimo ${fmtMm(min)} mm.`);
    if (max !== undefined && v > max) return setError(`Máximo ${fmtMm(max)} mm.`);
    setError(null);
    if (v !== value) onCommit(v);
  };

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className={`${inputClass} tabular pr-10 ${compact ? 'h-9' : ''}`}
          value={text}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setText(shown);
              setError(null);
            }
          }}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-muted">mm</span>
      </div>
      {(error || hint) && (
        <p id={`${id}-msg`} className={`mt-1 text-xs ${error ? 'text-danger' : 'text-muted'}`} role={error ? 'alert' : undefined}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** Contador − n + con límites. */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 30,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const id = useId();
  const btn =
    'grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-accent transition-colors hover:border-accent hover:bg-accent-soft disabled:text-muted disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-surface';
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} aria-label={`Quitar uno (${label})`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Icon name="minus" size={16} />
        </button>
        <input
          id={id}
          className={`${inputClass} tabular w-16 text-center`}
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, ''));
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
        />
        <button type="button" className={btn} aria-label={`Añadir uno (${label})`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  );
}
