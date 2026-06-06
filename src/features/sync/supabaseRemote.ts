/**
 * Supabase-backed RemoteStore. Stores each user's full Snapshot as a single
 * JSON row in a `snapshots` table (one row per user), which keeps the remote
 * schema trivial and lets the sync engine own all merge logic.
 *
 * Expected table (see README for the SQL + row-level security):
 *   snapshots(user_id uuid primary key, data jsonb, updated_at timestamptz)
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Snapshot } from '../../db/types';
import type { RemoteStore } from './engine';

export class SupabaseRemoteStore implements RemoteStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  async download(): Promise<Snapshot | null> {
    const { data, error } = await this.client
      .from('snapshots')
      .select('data')
      .eq('user_id', this.userId)
      .maybeSingle();
    if (error) throw error;
    return (data?.data as Snapshot | undefined) ?? null;
  }

  async upload(snapshot: Snapshot): Promise<void> {
    const { error } = await this.client
      .from('snapshots')
      .upsert({ user_id: this.userId, data: snapshot, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
}
