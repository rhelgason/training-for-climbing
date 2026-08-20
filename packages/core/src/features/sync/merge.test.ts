import type {
  DailyContextRecord,
  GoalRecord,
  JournalEntry,
  Snapshot,
  TombstoneRecord,
} from '../../db/types';
import { emptySnapshot, mergeLists, mergeSnapshots, mergeTombstones } from './merge';

function goal(id: string, createdAt: number, updatedAt: number, title: string): GoalRecord {
  return { id, createdAt, updatedAt, horizon: 'medium', title, status: 'active' };
}

function journal(id: string, createdAt: number): JournalEntry {
  return { id, createdAt, updatedAt: createdAt, date: createdAt, activities: [] };
}

function dailyContext(
  id: string,
  updatedAt: number,
  readiness: 'ok' | 'tired',
): DailyContextRecord {
  return {
    id,
    createdAt: 1,
    updatedAt,
    date: 1,
    environment: 'indoor',
    equipment: ['boulder-wall'],
    sessionLength: 'standard',
    readiness,
  };
}

describe('mergeLists', () => {
  it('unions records by id', () => {
    const merged = mergeLists([journal('a', 1)], [journal('b', 2)]);
    expect(merged.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('keeps the newer record by updatedAt (last-write-wins)', () => {
    const merged = mergeLists([goal('g', 100, 100, 'old')], [goal('g', 100, 200, 'new')]);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('new');
  });

  it('does not overwrite a newer local record with an older remote one', () => {
    const merged = mergeLists(
      [goal('g', 100, 300, 'local-new')],
      [goal('g', 100, 200, 'remote-old')],
    );
    expect(merged[0].title).toBe('local-new');
  });

  it('falls back to createdAt for records without updatedAt', () => {
    const withoutUpdatedAt = (id: string, createdAt: number) =>
      ({ id, createdAt, date: createdAt, activities: [] }) as unknown as JournalEntry;
    const merged = mergeLists([withoutUpdatedAt('s', 100)], [withoutUpdatedAt('s', 50)]);
    expect(merged[0].createdAt).toBe(100);
  });
});

function tomb(id: string, deletedAt: number): TombstoneRecord {
  return { table: 'goals', id, deletedAt };
}

describe('mergeTombstones', () => {
  it('unions by table+id keeping the latest deletedAt', () => {
    const merged = mergeTombstones([tomb('g', 100)], [tomb('g', 200)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].deletedAt).toBe(200);
  });
});

describe('mergeSnapshots', () => {
  it('merges every table', () => {
    const a: Snapshot = { ...emptySnapshot(), goals: [goal('g', 1, 1, 'a')] };
    const b: Snapshot = { ...emptySnapshot(), journals: [journal('s', 1)] };
    const merged = mergeSnapshots(a, b);
    expect(merged.goals).toHaveLength(1);
    expect(merged.journals).toHaveLength(1);
  });

  it('removes a record when a tombstone is newer than it', () => {
    const a: Snapshot = { ...emptySnapshot(), goals: [goal('g', 100, 100, 'kept?')] };
    const b: Snapshot = { ...emptySnapshot(), tombstones: [tomb('g', 200)] };
    const merged = mergeSnapshots(a, b);
    expect(merged.goals).toHaveLength(0);
    expect(merged.tombstones).toHaveLength(1);
  });

  it('keeps a record re-created after its deletion and drops the tombstone', () => {
    const a: Snapshot = { ...emptySnapshot(), goals: [goal('g', 300, 300, 'recreated')] };
    const b: Snapshot = { ...emptySnapshot(), tombstones: [tomb('g', 200)] };
    const merged = mergeSnapshots(a, b);
    expect(merged.goals).toHaveLength(1);
    expect(merged.tombstones).toHaveLength(0);
  });

  it('tolerates an older/partial remote snapshot (missing fields, dropped sessions)', () => {
    const local: Snapshot = { ...emptySnapshot(), journals: [journal('j', 1)] };
    // Pre-refactor shape: has `sessions`, lacks journals/profile/tombstones.
    const oldRemote = { goals: [goal('g', 1, 1, 'kept')], sessions: [{ id: 's' }] };
    const merged = mergeSnapshots(local, oldRemote as unknown as Snapshot);
    expect(merged.goals).toHaveLength(1);
    expect(merged.journals).toHaveLength(1);
    expect(merged.tombstones).toEqual([]);
    expect('sessions' in merged).toBe(false);
  });

  describe('daily contexts', () => {
    it('merges them last-write-wins like every other table', () => {
      const a: Snapshot = { ...emptySnapshot(), dailyContexts: [dailyContext('d', 100, 'ok')] };
      const b: Snapshot = { ...emptySnapshot(), dailyContexts: [dailyContext('d', 200, 'tired')] };
      expect(mergeSnapshots(a, b).dailyContexts).toEqual([
        expect.objectContaining({ id: 'd', readiness: 'tired' }),
      ]);
    });

    it('unions contexts created independently on two devices', () => {
      const a: Snapshot = { ...emptySnapshot(), dailyContexts: [dailyContext('a', 100, 'ok')] };
      const b: Snapshot = { ...emptySnapshot(), dailyContexts: [dailyContext('b', 100, 'tired')] };
      expect(mergeSnapshots(a, b).dailyContexts).toHaveLength(2);
    });

    it('honours a tombstone that is newer than the record', () => {
      const a: Snapshot = { ...emptySnapshot(), dailyContexts: [dailyContext('d', 100, 'ok')] };
      const b: Snapshot = {
        ...emptySnapshot(),
        tombstones: [{ table: 'dailyContexts', id: 'd', deletedAt: 200 }],
      };
      const merged = mergeSnapshots(a, b);
      expect(merged.dailyContexts).toHaveLength(0);
      expect(merged.tombstones).toHaveLength(1);
    });

    it('keeps a context edited after its deletion and drops the tombstone', () => {
      const a: Snapshot = { ...emptySnapshot(), dailyContexts: [dailyContext('d', 300, 'tired')] };
      const b: Snapshot = {
        ...emptySnapshot(),
        tombstones: [{ table: 'dailyContexts', id: 'd', deletedAt: 200 }],
      };
      const merged = mergeSnapshots(a, b);
      expect(merged.dailyContexts).toHaveLength(1);
      expect(merged.tombstones).toHaveLength(0);
    });

    it('survives a remote snapshot written before the table existed', () => {
      const local: Snapshot = { ...emptySnapshot(), dailyContexts: [dailyContext('d', 1, 'ok')] };
      const oldRemote = { goals: [goal('g', 1, 1, 'kept')] };
      const merged = mergeSnapshots(local, oldRemote as unknown as Snapshot);
      expect(merged.dailyContexts).toHaveLength(1);
      expect(merged.goals).toHaveLength(1);
    });
  });

  it('preserves every table through an empty-to-full merge', () => {
    // Guards the commonest way a new syncable table gets lost: added to the
    // model but forgotten in one of merge's three lists.
    const full: Snapshot = {
      ...emptySnapshot(),
      goals: [goal('g', 1, 1, 'g')],
      journals: [journal('j', 1)],
      dailyContexts: [dailyContext('d', 1, 'ok')],
    };
    const merged = mergeSnapshots(emptySnapshot(), full);
    for (const key of Object.keys(full) as (keyof Snapshot)[]) {
      if (key === 'profile' || key === 'tombstones') continue;
      expect({ key, length: (merged[key] as unknown[]).length }).toEqual({
        key,
        length: (full[key] as unknown[]).length,
      });
    }
  });
});
