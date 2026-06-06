import type { GoalRecord, SessionRecord, Snapshot } from '../../db/types';
import { emptySnapshot, mergeLists, mergeSnapshots } from './merge';

function goal(id: string, createdAt: number, updatedAt: number, title: string): GoalRecord {
  return { id, createdAt, updatedAt, horizon: 'medium', title, status: 'active' };
}

function session(id: string, createdAt: number): SessionRecord {
  return { id, createdAt, date: createdAt, focusAreas: [] };
}

describe('mergeLists', () => {
  it('unions records by id', () => {
    const merged = mergeLists([session('a', 1)], [session('b', 2)]);
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
    const merged = mergeLists([session('s', 100)], [session('s', 50)]);
    expect(merged[0].createdAt).toBe(100);
  });
});

describe('mergeSnapshots', () => {
  it('merges every table', () => {
    const a: Snapshot = { ...emptySnapshot(), goals: [goal('g', 1, 1, 'a')] };
    const b: Snapshot = { ...emptySnapshot(), sessions: [session('s', 1)] };
    const merged = mergeSnapshots(a, b);
    expect(merged.goals).toHaveLength(1);
    expect(merged.sessions).toHaveLength(1);
  });
});
