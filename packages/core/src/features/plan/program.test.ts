import { REST_GUIDANCE } from '../../content/planning';
import { buildSessionPlan, focusSplit, restGuidanceFor, tierInfo } from './program';

describe('buildSessionPlan', () => {
  it('orders selected areas by the canonical hierarchy regardless of input order', () => {
    const plan = buildSessionPlan(['stamina', 'skill', 'anaerobicEndurance']);
    expect(plan.map((a) => a.id)).toEqual(['skill', 'anaerobicEndurance', 'stamina']);
  });

  it('removes duplicates and ignores nothing extra', () => {
    const plan = buildSessionPlan(['skill', 'skill', 'maxStrengthPower']);
    expect(plan.map((a) => a.id)).toEqual(['skill', 'maxStrengthPower']);
  });

  it('returns an empty plan for no selection', () => {
    expect(buildSessionPlan([])).toEqual([]);
  });
});

describe('restGuidanceFor', () => {
  it('maps skill/power to strength rest and endurance to short rest', () => {
    expect(restGuidanceFor('skill')).toBe(REST_GUIDANCE.strengthPowerSkill);
    expect(restGuidanceFor('maxStrengthPower')).toBe(REST_GUIDANCE.strengthPowerSkill);
    expect(restGuidanceFor('anaerobicEndurance')).toBe(REST_GUIDANCE.anaerobicEndurance);
    expect(restGuidanceFor('stamina')).toBeUndefined();
  });
});

describe('focusSplit / tierInfo', () => {
  it('returns the tier split and the three parts sum to 100', () => {
    for (const tier of ['beginner', 'intermediate', 'elite'] as const) {
      const split = focusSplit(tier);
      expect(split.climbingPct + split.specificStrengthPct + split.generalConditioningPct).toBe(
        100,
      );
    }
    expect(focusSplit('beginner').climbingPct).toBe(75);
    expect(focusSplit('intermediate').specificStrengthPct).toBe(30);
    expect(focusSplit('elite').specificStrengthPct).toBe(40);
  });

  it('exposes tier guidance', () => {
    expect(tierInfo('beginner').label).toBe('Beginner');
  });
});
