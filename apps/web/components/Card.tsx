import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-border bg-surface p-4 ${className}`}>{children}</div>
  );
}
