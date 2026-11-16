/** Shared navigation model for the sidebar (desktop) and tab bar (mobile). */
export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Path prefixes that mark this item active. */
  match: string[];
  /** Section accent colour (CSS var name) used for the active state. */
  accent: string;
}

/**
 * Today is the app. Everything a climber sets up once — assessment, fitness
 * tests, goals, the season — lives under You, so the daily screen is never
 * confused with the setup it reads from.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: '/train',
    label: 'Today',
    icon: '💪',
    match: ['/train'],
    accent: 'var(--color-physical)',
  },
  {
    href: '/progress',
    label: 'Progress',
    icon: '📈',
    match: ['/progress'],
    accent: 'var(--color-warning)',
  },
  {
    href: '/you',
    label: 'You',
    icon: '🎯',
    match: ['/you', '/assess', '/plan'],
    accent: 'var(--color-mental)',
  },
  { href: '/more', label: 'Settings', icon: '⚙️', match: ['/more'], accent: 'var(--color-muted)' },
];

export function isActive(pathname: string, match: string[]): boolean {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}
