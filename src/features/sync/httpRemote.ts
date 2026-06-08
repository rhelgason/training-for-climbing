/**
 * HTTP RemoteStore — talks to the self-hosted sync server (deployable to
 * Railway). Stores one JSON snapshot per user behind a bearer token.
 */
import type { Snapshot } from '../../db/types';
import type { RemoteStore } from './engine';

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
    if (!res.ok) throw new Error(`Sync download failed (HTTP ${res.status})`);
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
    if (!res.ok) throw new Error(`Sync upload failed (HTTP ${res.status})`);
  }
}
