'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}

export function Button({ children, variant = 'primary', className = '', ...rest }: Props) {
  const base =
    'w-full rounded-xl px-6 py-3 text-center text-base font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100';
  const look =
    variant === 'primary'
      ? 'bg-brand text-primary-text shadow-lg shadow-primary/25 hover:brightness-110'
      : 'border border-border bg-surface-alt/50 text-text hover:bg-surface-alt hover:border-muted/40';
  return (
    <button className={`${base} ${look} ${className}`} {...rest}>
      {children}
    </button>
  );
}
