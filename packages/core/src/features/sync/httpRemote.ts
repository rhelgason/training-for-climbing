/**
 * HTTP RemoteStore — talks to the web app's sync API (`/api/snapshot`), which
 * stores one JSON snapshot per user behind a bearer token.
 */
import type { Snapshot } from '../../db/types';
import { AuthError } from '../auth/authClient';
import type { RemoteStore } from './engine';

/**
 * A 401 means the token itself is no longer accepted — expired, or signed with
 * a secret the server has since rotated. That's distinct from a transient
 * failure: retrying can never fix it, so it surfaces as an AuthError the caller
 * can recognise (see isSessionExpired) and turn into a re-sign-in prompt.
 */
function failed(action: string, res: Response): Error {
  if (res.status === 401) {
    return new AuthError('Your session has expired. Please sign in again.', 401);
  }
  return new Error(`Sync ${action} failed (HTTP ${res.status})`);
}

export class HttpRemoteStore implements RemoteStore {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private endpoint(): string {
    return `${this.baseUrl.replace(/\/+$/, '')}/snapshot`;
  }

  async download(): Promise<Snapshot | null> {
    const res = await fetch(this.endpoint(), {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) throw failed('download', res);
    const body = (await res.json()) as { data: Snapshot | null };
    return body.data ?? null;
  }

  async upload(snapshot: Snapshot): Promise<void> {
    const res = await fetch(this.endpoint(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(snapshot),
    });
    if (!res.ok) throw failed('upload', res);
  }
}
