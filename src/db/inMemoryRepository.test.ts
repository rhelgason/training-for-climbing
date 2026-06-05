import { InMemoryRepository } from './inMemoryRepository';
import type { NewAssessment, NewGoal } from './types';

function sampleAssessment(overrides: Partial<NewAssessment> = {}): NewAssessment {
  return {
    responses: { 1: 5, 2: 3, 3: 4 },
    mental: 40,
    technical: 30,
    physical: 45,
    weakestArea: 'technical',
    ...overrides,
  };
}

describe('InMemoryRepository', () => {
  it('saves an assessment and returns it with id + createdAt', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    const saved = await repo.saveAssessment(sampleAssessment());
    expect(saved.id).toBeTruthy();
    expect(saved.createdAt).toBeGreaterThan(0);
    expect(saved.weakestArea).toBe('technical');
  });

  it('lists assessments newest-first', async () => {
    const repo = new InMemoryRepository();
    const older = await repo.saveAssessment(sampleAssessment({ createdAt: 1000 }));
    const newer = await repo.saveAssessment(sampleAssessment({ createdAt: 2000 }));
    const list = await repo.listAssessments();
    expect(list.map((a) => a.id)).toEqual([newer.id, older.id]);
  });

  it('retrieves an assessment by id and returns null when missing', async () => {
    const repo = new InMemoryRepository();
    const saved = await repo.saveAssessment(sampleAssessment());
    expect(await repo.getAssessment(saved.id)).toEqual(saved);
    expect(await repo.getAssessment('does-not-exist')).toBeNull();
  });

  it('copies responses so later mutation of the input does not affect the record', async () => {
    const repo = new InMemoryRepository();
    const input = sampleAssessment();
    const saved = await repo.saveAssessment(input);
    input.responses[1] = 0;
    expect(saved.responses[1]).toBe(5);
  });

  it('saves a goal with defaults and lists newest-first', async () => {
    const repo = new InMemoryRepository();
    const newGoal: NewGoal = { horizon: 'medium', title: 'Redpoint my first 5.11' };
    const older = await repo.saveGoal({ ...newGoal, createdAt: 1000 });
    const newer = await repo.saveGoal({ ...newGoal, createdAt: 2000, title: 'Send the project' });
    expect(older.status).toBe('active');
    const list = await repo.listGoals();
    expect(list.map((g) => g.id)).toEqual([newer.id, older.id]);
  });

  it('updates a goal and returns null for unknown ids', async () => {
    const repo = new InMemoryRepository();
    const goal = await repo.saveGoal({ horizon: 'short', title: 'Focus on footwork today' });
    const updated = await repo.updateGoal(goal.id, { status: 'done', completedAt: 5 });
    expect(updated).toMatchObject({ status: 'done', completedAt: 5 });
    expect(await repo.updateGoal('nope', { status: 'done' })).toBeNull();
  });

  it('deletes a goal', async () => {
    const repo = new InMemoryRepository();
    const goal = await repo.saveGoal({ horizon: 'long', title: 'Climb 5.13' });
    await repo.deleteGoal(goal.id);
    expect(await repo.getGoal(goal.id)).toBeNull();
    expect(await repo.listGoals()).toHaveLength(0);
  });

  it('records and lists usage events newest-first with limit', async () => {
    const repo = new InMemoryRepository();
    await repo.recordEvent({ name: 'app_opened', props: {}, timestamp: 1 });
    await repo.recordEvent({
      name: 'assessment_completed',
      props: { weakestArea: 'mental' },
      timestamp: 2,
    });
    const all = await repo.listEvents();
    expect(all.map((e) => e.name)).toEqual(['assessment_completed', 'app_opened']);
    const limited = await repo.listEvents(1);
    expect(limited).toHaveLength(1);
    expect(limited[0].name).toBe('assessment_completed');
  });
});
