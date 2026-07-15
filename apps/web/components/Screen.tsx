import type { ReactNode } from 'react';

/**
 * Standard padded page container. The max-width phone column, centering, and
 * safe-area padding are applied once in the root layout; this just handles the
 * per-page padding and vertical rhythm.
 */
export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-4 px-4 pt-4 pb-6 ${className}`}>{children}</div>;
}
