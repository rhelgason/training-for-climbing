/**
 * Minimal IndexedDB helper: persists a single repository Snapshot under one key.
 * No dependency — a thin promise wrapper over the IndexedDB request API. The
 * whole dataset is a modest JSON blob (see @tfc/core's exportSnapshot), so one
 * object store with one fixed key is plenty for this app's scale.
 */
import type { Snapshot } from '@tfc/core';

const DB_NAME = 'tfc';
const STORE = 'snapshot';
const KEY = 'current';
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        transaction.oncomplete = () => {
          resolve(request.result);
          db.close();
        };
        transaction.onerror = () => {
          reject(transaction.error ?? new Error('IndexedDB transaction failed'));
          db.close();
        };
      }),
  );
}

export function loadSnapshot(): Promise<Snapshot | null> {
  return tx<Snapshot | undefined>('readonly', (store) => store.get(KEY)).then((v) => v ?? null);
}

export function saveSnapshot(snapshot: Snapshot): Promise<void> {
  return tx<IDBValidKey>('readwrite', (store) => store.put(snapshot, KEY)).then(() => undefined);
}

export function clearSnapshot(): Promise<void> {
  return tx<undefined>('readwrite', (store) => store.delete(KEY)).then(() => undefined);
}
