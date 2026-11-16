import type { GoalRecord } from '../../db/types';
import { goalTrainingBlock, resolveTrainingBlock, type ClimberShape } from './macrocycle';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY + DAY / 2;
const routes: ClimberShape = { abilityTier: 'intermediate', styleFocus: 'sport-endurance' };
const boulderer: ClimberShape = { abilityTier: 'intermediate', styleFocus: 'boulder-power' };

function goal(daysOut: number, over: Partial<GoalRecord> = {}): GoalRecord {
  return {
    id: `g${daysOut}`,
    createdAt: 0,
    updatedAt: 0,
    horizon: 'medium',
    title: `Goal in ${daysOut}`,
    status: 'active',
    targetDate: NOW + daysOut * DAY,
    ...over,
  };
}

const phaseIn = (daysOut: number, climber = routes) =>
  goalTrainingBlock([goal(daysOut)], climber, NOW)?.label;

describe('goalTrainingBlock', () => {
  it('lands the taper on the last week before the deadline', () => {
    expect(phaseIn(7)).toBe('Taper');
    expect(phaseIn(3 * 7)).toBe('Power endurance');
    expect(phaseIn(5 * 7)).toBe('Max strength & power');
  });

  it('runs a full 4-3-2-1 for a route climber ten weeks out', () => {
    const block = goalTrainingBlock([goal(70)], routes, NOW)!;
    expect(block).toMatchObject({ label: 'Skill & stamina', source: 'goal', daysRemaining: 28 });
    expect(block.goal).toMatchObject({ title: 'Goal in 70', daysLeft: 70, cycle: '4-3-2-1' });
  });

  it('runs 3-2-1 for a boulderer, skipping skill and stamina', () => {
    const block = goalTrainingBlock([goal(42)], boulderer, NOW)!;
    expect(block.label).toBe('Max strength & power');
    expect(block.goal?.cycle).toBe('3-2-1');
  });

  it('stacks whole cycles back from a far deadline, spare weeks going to the start', () => {
    // 13 weeks: one 10-week cycle, with 3 spare weeks stretching skill & stamina to 7.
    expect(goalTrainingBlock([goal(91)], routes, NOW)).toMatchObject({
      label: 'Skill & stamina',
      daysRemaining: 49,
    });
    // 20 weeks: two cycles; today opens the first.
    expect(phaseIn(140)).toBe('Skill & stamina');
    // 11 weeks out on a 10+1 plan: still the first (stretched) phase.
    expect(phaseIn(77)).toBe('Skill & stamina');
  });

  it('plans for the nearest qualifying goal only', () => {
    const goals = [
      goal(60, { title: 'Later' }),
      goal(20, { title: 'Sooner' }),
      goal(10, { title: 'Short', horizon: 'short' }),
      goal(3, { title: 'Too close' }),
      goal(400, { title: 'Too far', horizon: 'long' }),
      goal(15, { title: 'Done', status: 'done' }),
    ];
    expect(goalTrainingBlock(goals, routes, NOW)?.goal?.title).toBe('Sooner');
  });

  it('gives a beginner no formal cycle', () => {
    expect(
      goalTrainingBlock([goal(70)], { abilityTier: 'beginner', styleFocus: 'all-round' }, NOW),
    ).toBeNull();
  });
});

describe('resolveTrainingBlock with goals', () => {
  it('prefers a hand-planned block, then the goal, then the rolling cycle', () => {
    const toward = { goals: [goal(7)], climber: routes };
    const planned = {
      id: 'p',
      createdAt: 0,
      updatedAt: 0,
      label: 'Trip prep',
      focus: 'power endurance',
      startDate: NOW - DAY,
      endDate: NOW + DAY,
    };
    expect(resolveTrainingBlock([planned], NOW, NOW, toward).source).toBe('planned');
    expect(resolveTrainingBlock([], NOW, NOW, toward)).toMatchObject({
      source: 'goal',
      label: 'Taper',
    });
    expect(resolveTrainingBlock([], NOW, NOW).source).toBe('auto');
  });
});
