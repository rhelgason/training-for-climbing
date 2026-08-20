import type { JournalEntry } from '../../db/types';
import { loadHistory } from '../train/load';
import {
  allowedFocuses,
  blockedFocuses,
  buildMicrocycle,
  type MicrocycleInput,
} from './microcycle';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY + DAY / 2;

function journal(dayOffset: number, partial: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: partial.id ?? `j${dayOffset}`,
    createdAt: 0,
    updatedAt: 0,
    date: NOW + dayOffset * DAY,
    activities: partial.activities ?? [],
    ...partial,
  };
}

/** A day whose load is recorded exactly, so tests state intent not inference. */
function day(
  dayOffset: number,
  focus: JournalEntry['focus'],
  intensity: JournalEntry['intensity'] = 'hard',
) {
  return journal(dayOffset, { id: `d${dayOffset}`, focus, intensity, activities: ['climbing'] });
}

function input(overrides: Partial<MicrocycleInput> = {}): MicrocycleInput {
  return {
    history: [],
    nowMs: NOW,
    abilityTier: 'intermediate',
    weakestArea: 'physical',
    styleFocus: 'all-round',
    daysPerWeek: 4,
    equipment: ['boulder-wall', 'rope-wall', 'hangboard', 'campus-board', 'pull-up-bar'],
    readiness: 'ok',
    sessionLength: 'standard',
    ...overrides,
  };
}

function verdictFor(cycle: ReturnType<typeof buildMicrocycle>, focus: string) {
  const v = cycle.verdicts.find((x) => x.focus === focus);
  if (!v) throw new Error(`no verdict for ${focus}`);
  return v;
}

describe('weekly frequency ceilings', () => {
  it('blocks max strength after two sessions in the rolling week', () => {
    const history = loadHistory([day(-2, ['maxStrength']), day(-5, ['maxStrength'])], []);
    const cycle = buildMicrocycle(input({ history }));
    const verdict = verdictFor(cycle, 'maxStrength');
    expect(verdict.status).toBe('blocked');
    expect(verdict.usedThisWeek).toBe(2);
    expect(verdict.reason).toContain('2 of 2 this week');
  });

  it('allows max strength again once a session ages out of the week', () => {
    const history = loadHistory([day(-2, ['maxStrength']), day(-8, ['maxStrength'])], []);
    const cycle = buildMicrocycle(input({ history }));
    expect(verdictFor(cycle, 'maxStrength').status).not.toBe('blocked');
    expect(verdictFor(cycle, 'maxStrength').usedThisWeek).toBe(1);
  });

  it('caps power endurance at three a week', () => {
    const history = loadHistory(
      [day(-2, ['powerEndurance']), day(-4, ['powerEndurance']), day(-6, ['powerEndurance'])],
      [],
    );
    expect(verdictFor(buildMicrocycle(input({ history })), 'powerEndurance').status).toBe(
      'blocked',
    );
  });

  it('never caps aerobic endurance', () => {
    const history = loadHistory(
      [-1, -2, -3, -4, -5, -6].map((o) => day(o, ['enduranceAerobic'], 'easy')),
      [],
    );
    expect(
      verdictFor(buildMicrocycle(input({ history, daysPerWeek: 7 })), 'enduranceAerobic').status,
    ).not.toBe('blocked');
  });
});

describe('recovery gaps between sessions', () => {
  it('blocks max strength the day after a max-strength session', () => {
    const history = loadHistory([day(-1, ['maxStrength'])], []);
    const verdict = verdictFor(buildMicrocycle(input({ history })), 'maxStrength');
    expect(verdict.status).toBe('blocked');
    expect(verdict.reason).toContain('48 hours');
    expect(verdict.daysSince).toBe(1);
  });

  it('allows max strength two days after the last one', () => {
    const history = loadHistory([day(-2, ['maxStrength'])], []);
    expect(verdictFor(buildMicrocycle(input({ history })), 'maxStrength').status).not.toBe(
      'blocked',
    );
  });

  it('leaves uncapped focuses trainable on back-to-back days', () => {
    const history = loadHistory([day(-1, ['skill'], 'moderate')], []);
    expect(verdictFor(buildMicrocycle(input({ history })), 'skill').status).not.toBe('blocked');
  });
});

describe('equipment gating', () => {
  it('blocks power when there is no board or steep wall', () => {
    const cycle = buildMicrocycle(input({ equipment: ['hangboard', 'pull-up-bar'] }));
    const verdict = verdictFor(cycle, 'power');
    expect(verdict.status).toBe('blocked');
    expect(verdict.reason).toContain('Campus board');
  });

  it('still allows conditioning with no equipment at all', () => {
    const cycle = buildMicrocycle(input({ equipment: [] }));
    expect(verdictFor(cycle, 'conditioning').status).not.toBe('blocked');
    expect(verdictFor(cycle, 'skill').status).toBe('blocked');
  });

  it("uses today's equipment, so a travel day changes the plan", () => {
    const gym = buildMicrocycle(input());
    const hotel = buildMicrocycle(input({ equipment: ['bands'] }));
    expect(allowedFocuses(gym)).toContain('maxStrength');
    expect(allowedFocuses(hotel)).not.toContain('maxStrength');
    expect(allowedFocuses(hotel)).toContain('conditioning');
  });
});

describe('readiness', () => {
  it('calls a rest day when something hurts', () => {
    const cycle = buildMicrocycle(input({ readiness: 'tweaky' }));
    expect(cycle.restDay).toBe(true);
    expect(cycle.restReason).toContain('hurts');
  });

  it('blocks high-intensity work when tired but still offers easy work', () => {
    const cycle = buildMicrocycle(input({ readiness: 'tired' }));
    expect(cycle.restDay).toBe(false);
    expect(verdictFor(cycle, 'maxStrength').status).toBe('blocked');
    expect(verdictFor(cycle, 'power').status).toBe('blocked');
    expect(allowedFocuses(cycle)).toContain('enduranceAerobic');
  });
});

describe('whole-day rest rules', () => {
  it('rests after three hard days in a row', () => {
    const history = loadHistory(
      [day(0, ['skill']), day(-1, ['maxStrength']), day(-2, ['power'])],
      [],
    );
    const cycle = buildMicrocycle(input({ history, daysPerWeek: 7 }));
    expect(cycle.restDay).toBe(true);
    expect(cycle.hardDaysInARow).toBe(3);
    expect(cycle.restReason).toContain('3 days running');
  });

  it("rests once the week's planned training days are used up", () => {
    const history = loadHistory(
      [-1, -2, -3].map((o) => day(o, ['skill'], 'moderate')),
      [],
    );
    const cycle = buildMicrocycle(input({ history, daysPerWeek: 3 }));
    expect(cycle.restDay).toBe(true);
    expect(cycle.trainingDaysThisWeek).toBe(3);
  });

  it('does not rest when the climber has days left in their week', () => {
    const history = loadHistory([day(-1, ['skill'], 'moderate')], []);
    expect(buildMicrocycle(input({ history, daysPerWeek: 4 })).restDay).toBe(false);
  });

  it('still finds low-intensity work when the hard options are all blocked', () => {
    const history = loadHistory([day(-1, ['maxStrength'])], []);
    const cycle = buildMicrocycle(input({ history, equipment: ['hangboard'], readiness: 'tired' }));
    // Hangboard-only and tired rules out the hard work; aerobic and
    // conditioning need no equipment, so the day is salvaged rather than lost.
    expect(cycle.restDay).toBe(false);
    expect(['enduranceAerobic', 'conditioning']).toContain(cycle.primary);
  });
});

describe('choosing the day', () => {
  it('prefers the weakest triad area', () => {
    const mental = buildMicrocycle(input({ weakestArea: 'mental', styleFocus: 'all-round' }));
    expect(mental.primary).toBe('mental');
  });

  it('lets a macrocycle block outrank style preference', () => {
    const cycle = buildMicrocycle(
      input({ styleFocus: 'boulder-power', blockFocuses: ['powerEndurance'], weakestArea: null }),
    );
    expect(cycle.primary).toBe('powerEndurance');
  });

  it('never stacks two high-intensity focuses in one day', () => {
    const cycle = buildMicrocycle(input({ sessionLength: 'long' }));
    const highCount = [cycle.primary, ...cycle.supporting].filter((f) =>
      ['maxStrength', 'power', 'powerEndurance'].includes(f as string),
    ).length;
    expect(highCount).toBeLessThanOrEqual(1);
  });

  it('fits fewer blocks into a short session', () => {
    expect(buildMicrocycle(input({ sessionLength: 'quick' })).supporting).toHaveLength(0);
    expect(buildMicrocycle(input({ sessionLength: 'long' })).supporting.length).toBeGreaterThan(1);
  });

  it('orders supporting work by the within-session hierarchy', () => {
    const cycle = buildMicrocycle(input({ sessionLength: 'long', weakestArea: 'technical' }));
    const order = [
      'skill',
      'maxStrength',
      'power',
      'powerEndurance',
      'conditioning',
      'enduranceAerobic',
    ];
    const positions = cycle.supporting.map((f) => order.indexOf(f));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('holds back tier-gated work from beginners', () => {
    const cycle = buildMicrocycle(input({ abilityTier: 'beginner' }));
    expect(verdictFor(cycle, 'maxStrength').status).toBe('blocked');
    expect(verdictFor(cycle, 'skill').status).not.toBe('blocked');
  });
});

describe('explaining itself', () => {
  it('summarises the last few days in plain language', () => {
    const history = loadHistory([day(-1, ['maxStrength'], 'hard'), day(-2, ['skill'], 'easy')], []);
    const cycle = buildMicrocycle(input({ history }));
    expect(cycle.recentLoadSummary).toContain('Yesterday: max strength (hard)');
    expect(cycle.recentLoadSummary).toContain('2 days ago');
  });

  it('says so when nothing has been logged', () => {
    expect(buildMicrocycle(input()).recentLoadSummary).toContain('No training logged');
  });

  it('lists blocked focuses with a reason for each', () => {
    const history = loadHistory([day(-1, ['maxStrength'])], []);
    const blocked = blockedFocuses(buildMicrocycle(input({ history })));
    const maxStrength = blocked.find((b) => b.focus === 'maxStrength');
    expect(maxStrength?.reason).toContain('48 hours');
  });

  it('reports allowed focuses in session order and excludes blocked ones', () => {
    const history = loadHistory([day(-1, ['maxStrength'])], []);
    const allowed = allowedFocuses(buildMicrocycle(input({ history })));
    expect(allowed).not.toContain('maxStrength');
    expect(allowed.indexOf('skill')).toBeLessThan(allowed.indexOf('conditioning'));
  });

  it('returns no allowed focuses on a rest day', () => {
    expect(allowedFocuses(buildMicrocycle(input({ readiness: 'tweaky' })))).toEqual([]);
  });
});
