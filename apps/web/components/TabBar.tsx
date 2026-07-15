'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab {
  href: string;
  label: string;
  icon: string;
  /** Path prefix that marks this tab active. */
  match: string;
}

const TABS: Tab[] = [
  { href: '/assess', label: 'Assess', icon: '🎯', match: '/assess' },
  { href: '/plan', label: 'Plan', icon: '🗺️', match: '/plan' },
  { href: '/train', label: 'Train', icon: '💪', match: '/train' },
  { href: '/progress', label: 'Progress', icon: '📈', match: '/progress' },
  { href: '/more', label: 'More', icon: '⚙️', match: '/more' },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const active = pathname === tab.match || pathname.startsWith(`${tab.match}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-semibold transition ${
              active ? 'text-primary' : 'text-muted'
            }`}
          >
            <span className="text-lg leading-none" aria-hidden>
              {tab.icon}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
