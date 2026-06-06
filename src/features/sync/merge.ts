/**
 * Snapshot merge for cloud sync. Pure — unit-testable.
 *
 * Strategy: union by id with last-write-wins. The comparable timestamp is
 * `updatedAt` where a record has one (goals, periods, climbs) and `createdAt`
 * otherwise (append-only records). On a tie, the second argument wins.
 *
 * Note (v1 limitation): this never removes records, so a delete on one device
 * is not propagated to another (no tombstones yet).
 */
import type { Snapshot } from '../../db/types';

export function emptySnapshot(): Snapshot {
  return {
    assessments: [],
    goals: [],
    sessions: [],
    climbs: [],
    periods: [],
    benchmarks: [],
    checkins: [],
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

export function mergeSnapshots(a: Snapshot, b: Snapshot): Snapshot {
  return {
    assessments: mergeLists(a.assessments, b.assessments),
    goals: mergeLists(a.goals, b.goals),
    sessions: mergeLists(a.sessions, b.sessions),
    climbs: mergeLists(a.climbs, b.climbs),
    periods: mergeLists(a.periods, b.periods),
    benchmarks: mergeLists(a.benchmarks, b.benchmarks),
    checkins: mergeLists(a.checkins, b.checkins),
  };
}
