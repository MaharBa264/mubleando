import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
/** `icon` y `icon-sm`: botón cuadrado para un solo icono (siempre con aria-label). */
type Size = 'sm' | 'md' | 'icon' | 'icon-sm';

const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none active:translate-y-px disabled:opacity-45 disabled:cursor-not-allowed disabled:active:translate-y-0 whitespace-nowrap';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast shadow-1 hover:bg-accent-hover',
  secondary: 'bg-surface text-text border border-border shadow-1 hover:border-border-strong',
  ghost: 'text-text hover:bg-surface-2',
  danger: 'bg-danger text-accent-contrast hover:opacity-90',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  icon: 'h-10 w-10',
  'icon-sm': 'h-8 w-8',
};

export const buttonClass = (variant: Variant = 'secondary', size: Size = 'md', extra = '') =>
  `${base} ${variants[variant]} ${sizes[size]} ${extra}`;

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({
  href,
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
