import type { GoalRecord, JournalEntry, Snapshot, TombstoneRecord } from '../../db/types';
import { emptySnapshot, mergeLists, mergeSnapshots, mergeTombstones } from './merge';

function goal(id: string, createdAt: number, updatedAt: number, title: string): GoalRecord {
  return { id, createdAt, updatedAt, horizon: 'medium', title, status: 'active' };
}

function journal(id: string, createdAt: number): JournalEntry {
  return { id, createdAt, updatedAt: createdAt, date: createdAt, activities: [] };
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
});
