import type { EquipmentId } from '../../content/trainingContext';
import type { BenchmarkRecord } from '../../db/types';
import type { ClimbingPrescription } from './climbingPrescription';
import {
  buildFocusSteps,
  buildSessionSteps,
  coolDownStep,
  focusLabel,
  overlayAiPlan,
  restSteps,
  warmUpStep,
  type SessionPlanContext,
} from './sessionPlan';

const NOW = Date.UTC(2026, 8, 16);

const GYM: EquipmentId[] = [
  'boulder-wall',
  'rope-wall',
  'steep-wall',
  'hangboard',
  'campus-board',
  'pull-up-bar',
  'free-weights',
];

function ctx(over: Partial<SessionPlanContext> = {}): SessionPlanContext {
  return {
    dayIdx: 0,
    equipment: GYM,
    benchmarks: [],
    nowMs: NOW,
    abilityTier: 'intermediate',
    sessionLength: 'standard',
    climbing: null,
    injury: null,
    ...over,
  };
}

function climbing(over: Partial<ClimbingPrescription> = {}): ClimbingPrescription {
  return {
    discipline: 'boulder',
    bands: { warmUp: 'V1', volume: 'V3', work: 'V5', project: 'V6' },
    anchor: 'V4',
    confidence: 'established',
    because: 'pyramid',
    style: 'Short, powerful boulders.',
    ...over,
  };
}

function hang(value: number): BenchmarkRecord {
  return {
    id: 'b',
    createdAt: NOW,
    testId: 'protocol-max-weight-hang',
    value,
    date: NOW - 4 * 24 * 60 * 60 * 1000,
  };
}

function repeater(level: number): BenchmarkRecord {
  return {
    id: 'r',
    createdAt: NOW,
    testId: 'protocol-repeaters-level',
    value: level,
    date: NOW - 3 * 24 * 60 * 60 * 1000,
  };
}

describe('warmUpStep / coolDownStep / restSteps', () => {
  it('names a warm-up grade when the pyramid has one', () => {
    expect(warmUpStep(ctx({ climbing: climbing() })).text).toMatch(/V1/);
  });

  it('falls back to bodyweight language with no wall or bar', () => {
    expect(warmUpStep(ctx({ equipment: ['bands'] })).text).toMatch(/bodyweight/);
  });

  it('uses large-hold pulling when there is a bar but no wall', () => {
    expect(warmUpStep(ctx({ equipment: ['pull-up-bar'] })).text).toMatch(/large holds/);
  });

  it('writes injury-specific rest, including a non-climbing moderate case', () => {
    const severe = restSteps({
      severity: 'severe',
      region: 'leg',
      summary: 'Logged a leg issue.',
      evidence: 'MRI',
      noClimbing: true,
      noHighIntensity: true,
    });
    expect(severe.map((s) => s.text).join(' ')).toMatch(/MRI/);
    expect(severe[1].text).toMatch(/Do not test it/);

    const moderate = restSteps({
      severity: 'moderate',
      region: 'finger',
      summary: 'Logged a finger issue.',
      evidence: 'tweak',
      noClimbing: false,
      noHighIntensity: true,
    });
    expect(moderate[1].text).toMatch(/unloaded/);
  });

  it('has a generic rest script when nothing is injured', () => {
    expect(restSteps(null)[0].text).toMatch(/Rest from hard climbing/);
  });

  it('always ends a training session with the cool-down', () => {
    expect(coolDownStep().text).toMatch(/Cool down/);
  });
});

describe('buildSessionSteps', () => {
  it('returns rest when the primary is missing or rest', () => {
    expect(buildSessionSteps(null, [], ctx())[0].text).toMatch(/Rest from hard climbing/);
    expect(buildSessionSteps('rest', ['skill'], ctx()).length).toBe(3);
  });

  it('orders warm-up, primary, supporting, cool-down', () => {
    const steps = buildSessionSteps('skill', ['conditioning'], ctx({ climbing: climbing() }));
    expect(steps[0].text).toMatch(/Warm up/);
    expect(steps.some((s) => s.focus === 'skill')).toBe(true);
    expect(steps.some((s) => s.focus === 'conditioning')).toBe(true);
    expect(steps[steps.length - 1].text).toMatch(/Cool down/);
    expect(steps.some((s) => /Grades today/.test(s.text))).toBe(true);
  });

  it('skips a rest supporting block', () => {
    const steps = buildSessionSteps('skill', ['rest', 'conditioning'], ctx());
    expect(
      steps.filter((s) => s.focus === 'skill' || s.focus === 'conditioning').length,
    ).toBeGreaterThan(0);
  });
});

describe('buildFocusSteps — every focus, gym gear', () => {
  it('skill as primary includes mileage; supporting does not', () => {
    const primary = buildFocusSteps('skill', ctx({ climbing: climbing() }), 'primary');
    const supporting = buildFocusSteps('skill', ctx(), 'supporting');
    expect(primary.some((s) => /Skill mileage/.test(s.text))).toBe(true);
    expect(supporting.some((s) => /Skill mileage/.test(s.text))).toBe(false);
  });

  it('mental drills rotate through breathing, falls, visualization, and a cue', () => {
    const titles = [0, 1, 2, 3].map(
      (dayIdx) =>
        buildFocusSteps('mental', ctx({ dayIdx, climbing: climbing() }), 'primary')[0].text,
    );
    expect(titles.some((t) => /belly breaths/.test(t))).toBe(true);
    expect(titles.some((t) => /controlled falls/.test(t))).toBe(true);
    expect(titles.some((t) => /associated/.test(t))).toBe(true);
    expect(titles.some((t) => /one word/.test(t))).toBe(true);
  });

  it('mental supporting off the wall drops the on-wall closer', () => {
    const text = buildFocusSteps('mental', ctx({ equipment: ['bands'] }), 'supporting')[0].text;
    expect(text).not.toMatch(/Then climb/);
  });

  it('max-strength rotates min-edge, 7-53, and 10-second hangs', () => {
    const minEdge = buildFocusSteps('maxStrength', ctx({ dayIdx: 1 }), 'primary');
    expect(minEdge.some((s) => /Minimum-edge/.test(s.text))).toBe(true);

    const seven = buildFocusSteps(
      'maxStrength',
      ctx({ dayIdx: 2, benchmarks: [hang(40), hang(38)] }),
      'primary',
    );
    expect(seven.some((s) => /7-53/.test(s.text) && /\+35 lb/.test(s.text))).toBe(true);

    const sevenTest = buildFocusSteps('maxStrength', ctx({ dayIdx: 2 }), 'primary');
    expect(sevenTest.some((s) => /7-53/.test(s.text))).toBe(true);

    const ten = buildFocusSteps(
      'maxStrength',
      ctx({ dayIdx: 0, benchmarks: [hang(40), hang(38)] }),
      'primary',
    );
    expect(ten.some((s) => /Max-weight hangs/.test(s.text) && /\+35 lb/.test(s.text))).toBe(true);

    const tenTest = buildFocusSteps('maxStrength', ctx({ dayIdx: 0 }), 'primary');
    expect(tenTest.some((s) => /Max-weight hangs|establish/.test(s.text))).toBe(true);
  });

  it('max-strength on a rope or outdoor day without a boulder wall names short efforts', () => {
    const rope = buildFocusSteps(
      'maxStrength',
      ctx({ equipment: ['rope-wall', 'hangboard', 'pull-up-bar'], climbing: climbing() }),
      'primary',
    );
    expect(rope.some((s) => /Short, powerful climbing/.test(s.text))).toBe(true);

    const rock = buildFocusSteps('maxStrength', ctx({ equipment: ['outdoor-rock'] }), 'primary');
    expect(rock.some((s) => /Short, powerful climbing/.test(s.text))).toBe(true);
  });

  it('max-strength with no gear falls back to a generic short-effort block', () => {
    const steps = buildFocusSteps(
      'maxStrength',
      ctx({ equipment: [], abilityTier: 'beginner' }),
      'primary',
    );
    expect(steps.some((s) => /whatever you have/.test(s.text))).toBe(true);
  });

  it('max-strength supporting keeps a single block', () => {
    expect(buildFocusSteps('maxStrength', ctx({ dayIdx: 0 }), 'supporting')).toHaveLength(1);
  });

  it('power uses campus when available, boulders otherwise, clap pull-ups on a bar, generic last', () => {
    expect(
      buildFocusSteps('power', ctx(), 'primary').some((s) => /Campus laddering/.test(s.text)),
    ).toBe(true);
    expect(buildFocusSteps('power', ctx(), 'supporting')).toHaveLength(1);

    const boulders = buildFocusSteps(
      'power',
      ctx({ equipment: ['boulder-wall'], climbing: climbing() }),
      'primary',
    );
    expect(boulders.some((s) => /Big-move boulders/.test(s.text))).toBe(true);
    expect(boulders.some((s) => /One-arm lunges/.test(s.text))).toBe(true);

    const bar = buildFocusSteps('power', ctx({ equipment: ['pull-up-bar'] }), 'primary');
    expect(bar.some((s) => /Clap pull-ups/.test(s.text))).toBe(true);

    const none = buildFocusSteps('power', ctx({ equipment: [] }), 'primary');
    expect(none.some((s) => /Explosive pulling/.test(s.text))).toBe(true);
  });

  it('power-endurance covers 4x4s, repeaters with and without a baseline, Frenchies, and a generic fallback', () => {
    const gym = buildFocusSteps('powerEndurance', ctx({ climbing: climbing() }), 'primary');
    expect(gym.some((s) => /4×4/.test(s.text) && /V3/.test(s.text))).toBe(true);
    expect(gym.some((s) => /Frenchies/.test(s.text))).toBe(true);

    const withLevel = buildFocusSteps(
      'powerEndurance',
      ctx({ equipment: ['hangboard'], benchmarks: [repeater(3), repeater(3)] }),
      'primary',
    );
    expect(withLevel.some((s) => /Repeaters L2|Repeaters L3/.test(s.text))).toBe(true);

    const testLevel = buildFocusSteps(
      'powerEndurance',
      ctx({ equipment: ['hangboard'] }),
      'primary',
    );
    expect(testLevel.some((s) => /Repeaters/.test(s.text))).toBe(true);

    const none = buildFocusSteps('powerEndurance', ctx({ equipment: [] }), 'primary');
    expect(none.some((s) => /8–12 hard efforts/.test(s.text))).toBe(true);
    expect(buildFocusSteps('powerEndurance', ctx(), 'supporting').length).toBe(1);
  });

  it('aerobic uses ARC on a wall, moving hangs on a board, or a tempo run', () => {
    const arc = buildFocusSteps('enduranceAerobic', ctx({ climbing: climbing() }), 'primary');
    expect(arc.some((s) => /ARC/.test(s.text))).toBe(true);
    expect(arc.some((s) => /threshold finisher/.test(s.text))).toBe(true);
    expect(
      buildFocusSteps('enduranceAerobic', ctx(), 'supporting').some((s) =>
        /10–15 min/.test(s.text),
      ),
    ).toBe(true);

    const hangs = buildFocusSteps('enduranceAerobic', ctx({ equipment: ['hangboard'] }), 'primary');
    expect(hangs.some((s) => /Moving hangs/.test(s.text))).toBe(true);

    const run = buildFocusSteps('enduranceAerobic', ctx({ equipment: [] }), 'primary');
    expect(run.some((s) => /tempo run/.test(s.text))).toBe(true);
  });

  it('conditioning names a lift when weights are on hand and push-ups when they are not', () => {
    const withBar = buildFocusSteps('conditioning', ctx({ dayIdx: 0 }), 'primary');
    expect(withBar.some((s) => /Deadlift|Sumo deadlift|Squat/.test(s.text))).toBe(true);
    expect(withBar.some((s) => /scapular pull-ups/.test(s.text))).toBe(true);

    const noBar = buildFocusSteps(
      'conditioning',
      ctx({ equipment: ['bands', 'free-weights'], dayIdx: 1 }),
      'primary',
    );
    expect(noBar.some((s) => /prone or band/.test(s.text))).toBe(true);

    const noWeights = buildFocusSteps('conditioning', ctx({ equipment: ['bands'] }), 'primary');
    expect(noWeights.some((s) => /push-ups/.test(s.text))).toBe(true);

    expect(buildFocusSteps('conditioning', ctx(), 'supporting').length).toBe(2);
  });

  it('buildFocusSteps rest uses the injury script', () => {
    const steps = buildFocusSteps(
      'rest',
      ctx({
        injury: {
          severity: 'severe',
          region: 'knee',
          summary: 'Knee.',
          evidence: 'swollen',
          noClimbing: true,
          noHighIntensity: true,
        },
      }),
      'primary',
    );
    expect(steps[0].text).toMatch(/Knee/);
  });
});

describe('overlayAiPlan', () => {
  it('keeps AI wording and re-attaches the matching protocol', () => {
    const baseline = buildFocusSteps('maxStrength', ctx({ dayIdx: 0 }), 'primary');
    const hang = baseline.find((s) => s.protocolId === 'protocol-max-weight-hang');
    expect(hang).toBeTruthy();
    const overlaid = overlayAiPlan(baseline, [
      'Max-weight hangs today: 5 x 10 s, half-crimp, rest 3 min. Use the prescribed load.',
    ]);
    expect(overlaid[0].text).toMatch(/Max-weight hangs today/);
    expect(overlaid[0].protocolId).toBe('protocol-max-weight-hang');
  });

  it('returns the baseline unchanged when there is no AI plan', () => {
    const baseline = buildFocusSteps('skill', ctx(), 'supporting');
    expect(overlayAiPlan(baseline, null)).toEqual(baseline);
  });
});

describe('focusLabel', () => {
  it('returns the catalog label', () => {
    expect(focusLabel('maxStrength')).toBe('Max strength');
  });
});
