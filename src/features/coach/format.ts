/** Small formatting helpers for the coach UI. Pure and unit-testable. */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A compact "time ago" label for when a suggestion was generated, e.g.
 * "just now", "5m ago", "2h ago", "3d ago". Future or invalid inputs clamp to
 * "just now".
 */
export function relativeTime(thenMs: number, nowMs: number): string {
  const diff = nowMs - thenMs;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  return `${Math.floor(diff / DAY)}d ago`;
}
