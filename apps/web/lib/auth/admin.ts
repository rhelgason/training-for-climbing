/**
 * Admin accounts see the tuning knobs (AI coach switch, and anything else
 * that is the app's call rather than the climber's). Everyone else gets the
 * app's defaults and never has to wonder what a setting should be.
 *
 * Listed by username in NEXT_PUBLIC_ADMIN_USERNAMES (comma-separated). It is
 * a client-side display switch, not a permission: none of these settings is
 * sensitive, and the data they change belongs to the account changing it.
 */
import { getSession } from './session';

export function adminUsernames(raw = process.env.NEXT_PUBLIC_ADMIN_USERNAMES ?? ''): string[] {
  return raw
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(username = getSession()?.username): boolean {
  return Boolean(username) && adminUsernames().includes(username!.toLowerCase());
}
