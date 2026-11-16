import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  interactive = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** Adds hover affordance for cards that act as links/buttons. */
  interactive?: boolean;
  /** Tutorial spotlight hook. */
  'data-nux'?: string;
}) {
  const base = 'rounded-xl border border-border/80 bg-surface/70 p-4 shadow-sm backdrop-blur-sm';
  const hover = interactive
    ? 'transition hover:border-muted/40 hover:bg-surface active:scale-[0.99]'
    : '';
  return (
    <div className={`${base} ${hover} ${className}`} {...rest}>
      {children}
    </div>
  );
}
