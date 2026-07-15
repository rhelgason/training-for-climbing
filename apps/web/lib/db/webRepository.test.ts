import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { WebRepository } from './webRepository';
import { clearSnapshot, loadSnapshot } from './webSnapshotStore';

/** Wait for the debounced persist (400ms) plus a margin. */
const settle = () => new Promise((r) => setTimeout(r, 600));

describe('WebRepository', () => {
  beforeEach(async () => {
    await clearSnapshot();
  });

  it('persists a saved record to IndexedDB and rehydrates it on a fresh repo', async () => {
    const repo = new WebRepository();
    await repo.init();
    const goal = await repo.saveGoal({
      horizon: 'short',
      title: 'Send my first V5',
      triadArea: 'physical',
    });
    await settle();

    // A brand-new repo instance should load the persisted snapshot.
    const reopened = new WebRepository();
    await reopened.init();
    const goals = await reopened.listGoals();
    expect(goals.map((g) => g.id)).toContain(goal.id);
    expect(goals.find((g) => g.id === goal.id)?.title).toBe('Send my first V5');
  });

  it('persists updates and deletes', async () => {
    const repo = new WebRepository();
    await repo.init();
    const goal = await repo.saveGoal({ horizon: 'short', title: 'Draft', triadArea: 'mental' });
    await repo.updateGoal(goal.id, { title: 'Final' });
    await settle();
    expect((await loadSnapshot())?.goals.find((g) => g.id === goal.id)?.title).toBe('Final');

    await repo.deleteGoal(goal.id);
    await settle();
    const snap = await loadSnapshot();
    expect(snap?.goals.find((g) => g.id === goal.id)).toBeUndefined();
    // A tombstone should be recorded so the delete propagates on sync.
    expect(snap?.tombstones.some((t) => t.table === 'goals' && t.id === goal.id)).toBe(true);
  });

  it('persists an applied snapshot (sync-merge path)', async () => {
    const seed = new WebRepository();
    await seed.init();
    await seed.saveClimb({
      date: Date.now(),
      environment: 'indoor',
      discipline: 'boulder',
      grade: 'V4',
      outcome: 'send',
    });
    await seed.flush();
    const snapshot = await seed.exportSnapshot();

    // A fresh repo that applies the snapshot should persist it too.
    await clearSnapshot();
    const repo = new WebRepository();
    await repo.init();
    await repo.applySnapshot(snapshot);
    await settle();
    expect((await loadSnapshot())?.climbs).toHaveLength(1);
  });
});
