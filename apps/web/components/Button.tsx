'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}

export function Button({ children, variant = 'primary', className = '', ...rest }: Props) {
  const base =
    'w-full rounded-md px-6 py-3 text-center text-base font-semibold transition disabled:opacity-40';
  const look =
    variant === 'primary'
      ? 'bg-primary text-primary-text active:opacity-80'
      : 'border border-border bg-transparent text-text active:opacity-80';
  return (
    <button className={`${base} ${look} ${className}`} {...rest}>
      {children}
    </button>
  );
}
