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
    journals: [],
    climbs: [],
    periods: [],
    benchmarks: [],
    checkins: [],
    dailyContexts: [],
    profile: null,
    tombstones: [],
  };
}

/**
 * Backfill any missing fields so the merge never touches `undefined`.
 *
 * Unknown fields are **preserved, not dropped**. Sync is whole-snapshot
 * last-write-wins, so a client running an older build downloads, merges, and
 * re-uploads the entire document: anything it discarded here would be erased
 * for every other device. That is not hypothetical — it is how a client that
 * predates `dailyContexts` would silently delete a newer client's check-ins.
 *
 * The cost is that genuinely dead fields (a since-removed `sessions`) ride
 * along as inert weight. That's the right trade: stale bytes are cheap, and
 * there is no way to tell "removed last year" from "added by a build newer
 * than me" without a schema version we don't have.
 */
export function normalizeSnapshot(snapshot: Partial<Snapshot> | null | undefined): Snapshot {
  const empty = emptySnapshot();
  if (!snapshot) return empty;
  return {
    // Spread first so known keys below always win over the passthrough.
    ...snapshot,
    assessments: snapshot.assessments ?? empty.assessments,
    goals: snapshot.goals ?? empty.goals,
    journals: snapshot.journals ?? empty.journals,
    climbs: snapshot.climbs ?? empty.climbs,
    periods: snapshot.periods ?? empty.periods,
    benchmarks: snapshot.benchmarks ?? empty.benchmarks,
    checkins: snapshot.checkins ?? empty.checkins,
    dailyContexts: snapshot.dailyContexts ?? empty.dailyContexts,
    profile: snapshot.profile ?? empty.profile,
    tombstones: snapshot.tombstones ?? empty.tombstones,
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

/** Is this a list of syncable records we can merge by id? */
function isRecordList(
  value: unknown,
): value is { id: string; createdAt: number; updatedAt?: number }[] {
  return (
    Array.isArray(value) &&
    value.every(
      (r) =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as { id?: unknown }).id === 'string' &&
        typeof (r as { createdAt?: unknown }).createdAt === 'number',
    )
  );
}

/**
 * Merge a table this build has no schema for. Where both sides look like record
 * lists we can apply the ordinary rules; anything else (a scalar, a differently
 * shaped field) is passed through newest-side-wins, which at worst preserves
 * one side rather than losing both.
 */
function mergeUnknown(
  key: string,
  listA: unknown,
  listB: unknown,
  ctx: { deletedAtFor: Map<string, number> },
): unknown {
  const rowsA = isRecordList(listA) ? listA : null;
  const rowsB = isRecordList(listB) ? listB : null;
  // Neither side is a record list (a scalar like `schemaVersion`): keep
  // whichever is actually present rather than inventing an empty array.
  if (!rowsA && !rowsB) return listA !== undefined ? listA : listB;
  // One side missing still has to run the filter, or a tombstone for a table
  // only the other side carries would be ignored.
  return mergeLists(rowsA ?? [], rowsB ?? []).filter((r) => {
    const deletedAt = ctx.deletedAtFor.get(`${key}:${r.id}`);
    return deletedAt === undefined || timestamp(r) > deletedAt;
  });
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

export function mergeSnapshots(aIn: Partial<Snapshot>, bIn: Partial<Snapshot>): Snapshot {
  // Tolerate older/partial snapshots (missing or renamed fields) on either side.
  const a = normalizeSnapshot(aIn);
  const b = normalizeSnapshot(bIn);
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
    journals: survive('journals', a.journals, b.journals),
    climbs: survive('climbs', a.climbs, b.climbs),
    periods: survive('periods', a.periods, b.periods),
    benchmarks: survive('benchmarks', a.benchmarks, b.benchmarks),
    checkins: survive('checkins', a.checkins, b.checkins),
    dailyContexts: survive('dailyContexts', a.dailyContexts, b.dailyContexts),
    profile: !a.profile
      ? b.profile
      : !b.profile
        ? a.profile
        : b.profile.updatedAt >= a.profile.updatedAt
          ? b.profile
          : a.profile,
    tombstones,
  };

  // Tables this build doesn't know about, merged with the same last-write-wins
  // rule rather than taken from one side. Without this, two newer clients
  // syncing through an older one would each clobber the other's rows in any
  // table the older build can't name.
  const known = new Set(Object.keys(emptySnapshot()));
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (known.has(key)) continue;
    const listA = (a as unknown as Record<string, unknown>)[key];
    const listB = (b as unknown as Record<string, unknown>)[key];
    (merged as unknown as Record<string, unknown>)[key] = mergeUnknown(key, listA, listB, {
      deletedAtFor,
    });
  }

  // Drop tombstones superseded by a record that survived (re-created/edited).
  const surviving = new Set<string>();
  for (const [table, list] of [
    ['assessments', merged.assessments],
    ['goals', merged.goals],
    ['journals', merged.journals],
    ['climbs', merged.climbs],
    ['periods', merged.periods],
    ['benchmarks', merged.benchmarks],
    ['checkins', merged.checkins],
    ['dailyContexts', merged.dailyContexts],
  ] as const) {
    for (const r of list) surviving.add(`${table}:${r.id}`);
  }
  merged.tombstones = tombstones.filter((t) => !surviving.has(`${t.table}:${t.id}`));

  return merged;
}
