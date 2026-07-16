/** Shared navigation model for the sidebar (desktop) and tab bar (mobile). */
export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Path prefix that marks this item active. */
  match: string;
  /** Section accent colour (CSS var name) used for the active state. */
  accent: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/assess', label: 'Assess', icon: '🎯', match: '/assess', accent: 'var(--color-mental)' },
  { href: '/plan', label: 'Plan', icon: '🗺️', match: '/plan', accent: 'var(--color-technical)' },
  { href: '/train', label: 'Train', icon: '💪', match: '/train', accent: 'var(--color-physical)' },
  {
    href: '/progress',
    label: 'Progress',
    icon: '📈',
    match: '/progress',
    accent: 'var(--color-warning)',
  },
  { href: '/more', label: 'More', icon: '⚙️', match: '/more', accent: 'var(--color-muted)' },
];

export function isActive(pathname: string, match: string): boolean {
  return pathname === match || pathname.startsWith(`${match}/`);
}
