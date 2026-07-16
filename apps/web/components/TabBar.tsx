'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, isActive } from './nav';

/** Mobile-only bottom navigation. Hidden at the md breakpoint (desktop uses the sidebar). */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-border/70 bg-surface/80 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.match);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-xs font-semibold"
            style={{ color: active ? item.accent : 'var(--color-muted)' }}
          >
            <span
              className="flex h-7 w-12 items-center justify-center rounded-full text-lg leading-none transition"
              style={active ? { backgroundColor: item.accent + '22' } : undefined}
              aria-hidden
            >
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
