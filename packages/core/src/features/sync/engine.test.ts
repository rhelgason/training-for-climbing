import { InMemoryRepository } from '../../db/inMemoryRepository';
import { InMemoryRemoteStore, runSync } from './engine';

describe('runSync', () => {
  it('uploads local data to an empty remote', async () => {
    const repo = new InMemoryRepository();
    await repo.saveClimb({
      date: 1,
      environment: 'indoor',
      discipline: 'boulder',
      grade: 'V3',
      outcome: 'send',
    });
    const remote = new InMemoryRemoteStore();

    await runSync(repo, remote);

    const remoteSnapshot = await remote.download();
    expect(remoteSnapshot?.climbs).toHaveLength(1);
  });

  it('propagates records between two devices sharing a remote', async () => {
    const remote = new InMemoryRemoteStore();
    const deviceA = new InMemoryRepository();
    const deviceB = new InMemoryRepository();

    await deviceA.saveGoal({ horizon: 'medium', title: 'Send 5.11' });
    await runSync(deviceA, remote);
    await runSync(deviceB, remote);

    const onB = await deviceB.listGoals();
    expect(onB).toHaveLength(1);
    expect(onB[0].title).toBe('Send 5.11');
  });

  it('propagates a delete from one device to another', async () => {
    const remote = new InMemoryRemoteStore();
    const deviceA = new InMemoryRepository();
    const deviceB = new InMemoryRepository();

    const goal = await deviceA.saveGoal({ horizon: 'short', title: 'Temp' });
    await runSync(deviceA, remote);
    await runSync(deviceB, remote);
    expect(await deviceB.listGoals()).toHaveLength(1);

    // Delete on A, sync both — B should lose the goal.
    await deviceA.deleteGoal(goal.id);
    await runSync(deviceA, remote);
    await runSync(deviceB, remote);

    expect(await deviceA.listGoals()).toHaveLength(0);
    expect(await deviceB.listGoals()).toHaveLength(0);
  });

  it('applies last-write-wins for edits made on another device', async () => {
    const remote = new InMemoryRemoteStore();
    const deviceA = new InMemoryRepository();
    const deviceB = new InMemoryRepository();

    const goal = await deviceA.saveGoal({ horizon: 'short', title: 'Original' });
    await runSync(deviceA, remote);
    await runSync(deviceB, remote);

    // Edit on B (newer updatedAt), then sync both.
    await deviceB.updateGoal(goal.id, { title: 'Edited on B' });
    await runSync(deviceB, remote);
    await runSync(deviceA, remote);

    const onA = await deviceA.listGoals();
    expect(onA).toHaveLength(1);
    expect(onA[0].title).toBe('Edited on B');
  });
});
