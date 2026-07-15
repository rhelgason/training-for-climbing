/**
 * Sync engine: reconciles the local repository with a remote store via a
 * last-write-wins snapshot merge. Backend-agnostic — works with any RemoteStore
 * (Supabase in production, in-memory in tests).
 */
import type { Repository } from '../../db/repository';
import type { Snapshot } from '../../db/types';
import { emptySnapshot, mergeSnapshots } from './merge';

/** A remote destination for the user's snapshot (one per signed-in user). */
export interface RemoteStore {
  /** The remote snapshot, or null if nothing has been uploaded yet. */
  download(): Promise<Snapshot | null>;
  upload(snapshot: Snapshot): Promise<void>;
}

/**
 * Pull the remote snapshot, merge with local, write the merged result back to
 * both. Returns the merged snapshot.
 */
export async function runSync(repo: Repository, remote: RemoteStore): Promise<Snapshot> {
  const local = await repo.exportSnapshot();
  const remoteSnapshot = (await remote.download()) ?? emptySnapshot();
  const merged = mergeSnapshots(local, remoteSnapshot);
  await repo.applySnapshot(merged);
  await remote.upload(merged);
  return merged;
}

/** In-memory RemoteStore for tests and local development. */
export class InMemoryRemoteStore implements RemoteStore {
  private snapshot: Snapshot | null = null;

  async download(): Promise<Snapshot | null> {
    return this.snapshot ? JSON.parse(JSON.stringify(this.snapshot)) : null;
  }

  async upload(snapshot: Snapshot): Promise<void> {
    this.snapshot = JSON.parse(JSON.stringify(snapshot));
  }
}
