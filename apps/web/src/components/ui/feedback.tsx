import type { ReactNode } from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-control bg-surface-2 ${className}`} />;
}

export function LoadingBlock({ label = 'Cargando…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function Alert({ tone = 'warning', title, children }: { tone?: 'warning' | 'danger' | 'info'; title?: string; children?: ReactNode }) {
  const tones = {
    warning: 'bg-warning-soft text-warning border-warning/30',
    danger: 'bg-danger-soft text-danger border-danger/30',
    info: 'bg-accent-soft text-accent border-accent/30',
  };
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-control border px-3 py-2 text-sm ${tones[tone]}`}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
      <p className="text-base font-semibold">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="space-y-3">
      <Alert tone="danger" title="No se ha podido cargar">
        {error.message}
      </Alert>
      {onRetry && (
        <button type="button" className="text-sm font-medium text-accent underline" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
