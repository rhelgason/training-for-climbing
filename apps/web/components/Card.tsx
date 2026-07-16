import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  /** Adds hover affordance for cards that act as links/buttons. */
  interactive?: boolean;
}) {
  const base = 'rounded-xl border border-border/80 bg-surface/70 p-4 shadow-sm backdrop-blur-sm';
  const hover = interactive
    ? 'transition hover:border-muted/40 hover:bg-surface active:scale-[0.99]'
    : '';
  return <div className={`${base} ${hover} ${className}`}>{children}</div>;
}
