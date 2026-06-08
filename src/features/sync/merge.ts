/**
 * Snapshot merge for cloud sync. Pure — unit-testable.
 *
 * Strategy: union by id with last-write-wins. The comparable timestamp is
 * `updatedAt` where a record has one (goals, periods, climbs) and `createdAt`
 * otherwise (append-only records). On a tie, the second argument wins.
 *
 * Deletions propagate via tombstones: a record is dropped when a tombstone for
 * its id is at least as new as the record. A record re-created/edited after its
 * deletion (newer timestamp) wins and supersedes the tombstone.
 */
import type { Snapshot, SyncTable, TombstoneRecord } from '../../db/types';

export function emptySnapshot(): Snapshot {
  return {
    assessments: [],
    goals: [],
    sessions: [],
    climbs: [],
    periods: [],
    benchmarks: [],
    checkins: [],
    profile: null,
    tombstones: [],
  };
}

function timestamp(record: { createdAt: number; updatedAt?: number }): number {
  return record.updatedAt ?? record.createdAt;
}

export function mergeLists<T extends { id: string; createdAt: number; updatedAt?: number }>(
  a: T[],
  b: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const record of a) byId.set(record.id, record);
  for (const record of b) {
    const existing = byId.get(record.id);
    if (!existing || timestamp(record) >= timestamp(existing)) byId.set(record.id, record);
  }
  return [...byId.values()];
}

export function mergeTombstones(a: TombstoneRecord[], b: TombstoneRecord[]): TombstoneRecord[] {
  const byKey = new Map<string, TombstoneRecord>();
  for (const t of [...a, ...b]) {
    const key = `${t.table}:${t.id}`;
    const existing = byKey.get(key);
    if (!existing || t.deletedAt > existing.deletedAt) byKey.set(key, t);
  }
  return [...byKey.values()];
}

export function mergeSnapshots(a: Snapshot, b: Snapshot): Snapshot {
  const tombstones = mergeTombstones(a.tombstones, b.tombstones);
  const deletedAtFor = new Map(tombstones.map((t) => [`${t.table}:${t.id}`, t.deletedAt]));

  function survive<T extends { id: string; createdAt: number; updatedAt?: number }>(
    table: SyncTable,
    listA: T[],
    listB: T[],
  ): T[] {
    return mergeLists(listA, listB).filter((r) => {
      const deletedAt = deletedAtFor.get(`${table}:${r.id}`);
      return deletedAt === undefined || timestamp(r) > deletedAt;
    });
  }

  const merged: Snapshot = {
    assessments: survive('assessments', a.assessments, b.assessments),
    goals: survive('goals', a.goals, b.goals),
    sessions: survive('sessions', a.sessions, b.sessions),
    climbs: survive('climbs', a.climbs, b.climbs),
    periods: survive('periods', a.periods, b.periods),
    benchmarks: survive('benchmarks', a.benchmarks, b.benchmarks),
    checkins: survive('checkins', a.checkins, b.checkins),
    profile: !a.profile
      ? b.profile
      : !b.profile
        ? a.profile
        : b.profile.updatedAt >= a.profile.updatedAt
          ? b.profile
          : a.profile,
    tombstones,
  };

  // Drop tombstones superseded by a record that survived (re-created/edited).
  const surviving = new Set<string>();
  for (const [table, list] of [
    ['assessments', merged.assessments],
    ['goals', merged.goals],
    ['sessions', merged.sessions],
    ['climbs', merged.climbs],
    ['periods', merged.periods],
    ['benchmarks', merged.benchmarks],
    ['checkins', merged.checkins],
  ] as const) {
    for (const r of list) surviving.add(`${table}:${r.id}`);
  }
  merged.tombstones = tombstones.filter((t) => !surviving.has(`${t.table}:${t.id}`));

  return merged;
}
