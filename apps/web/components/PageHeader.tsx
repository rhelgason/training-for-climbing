'use client';

import { useRouter } from 'next/navigation';

/**
 * Screen header with an optional back button. Mirrors the native-stack header
 * used on nested screens.
 */
export function PageHeader({ title, back = true }: { title: string; back?: boolean }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
      {back && (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="-ml-1 rounded px-1 text-lg text-muted active:opacity-70"
        >
          ‹
        </button>
      )}
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
