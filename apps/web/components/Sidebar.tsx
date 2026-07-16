'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brand } from './Brand';
import { NAV_ITEMS, isActive } from './nav';

/** Desktop-only vertical navigation. Hidden below the md breakpoint. */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 border-r border-border/70 bg-surface/40 px-4 py-6 backdrop-blur md:flex">
      <div className="px-2 pb-6">
        <Brand />
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.match);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-semibold transition ${
                active
                  ? 'bg-surface-alt text-text'
                  : 'text-muted hover:bg-surface-alt/60 hover:text-text'
              }`}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition"
                style={active ? { backgroundColor: item.accent + '22' } : undefined}
                aria-hidden
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
              {active && (
                <span
                  className="ml-auto h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.accent }}
                />
              )}
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto px-3 text-xs text-muted/70">Companion to Eric Hörst’s book</p>
    </aside>
  );
}
