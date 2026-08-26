import { PROFILE_ID } from '../../content/profile';
import type { ClimbRecord, ProfileRecord } from '../../db/types';
import { CONSOLIDATED_SENDS, PYRAMID_WINDOW_DAYS } from '../today/climbingPrescription';
import {
  acceptInsight,
  detectAbilityDrift,
  dismissInsight,
  pendingInsights,
  revokeDerivedNote,
  type Insight,
} from './insights';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 26);

function profile(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    id: PROFILE_ID,
    createdAt: 1,
    updatedAt: 1,
    abilityTier: 'beginner',
    defaultDiscipline: 'boulder',
    gradeSystem: 'yds-v',
    reassessWeeks: 8,
    aiCoachEnabled: false,
    styleFocus: 'all-round',
    equipment: [],
    daysPerWeek: 3,
    sessionLength: 'standard',
    ...overrides,
  };
}

function climb(grade: string, daysAgo: number, overrides: Partial<ClimbRecord> = {}): ClimbRecord {
  return {
    id: `c-${grade}-${daysAgo}`,
    createdAt: NOW - daysAgo * MS_PER_DAY,
    updatedAt: NOW - daysAgo * MS_PER_DAY,
    date: NOW - daysAgo * MS_PER_DAY,
    environment: 'indoor',
    discipline: 'boulder',
    grade,
    outcome: 'send',
    ...overrides,
  };
}

const sends = (grade: string, n = CONSOLIDATED_SENDS) =>
  Array.from({ length: n }, (_, i) => climb(grade, 5 + i * 4));

describe('detectAbilityDrift', () => {
  it('proposes a tier when the consolidated grade has outgrown the profile', () => {
    const insight = detectAbilityDrift(sends('V4'), profile(), 'boulder', NOW);
    expect(insight).not.toBeNull();
    expect(insight).toMatchObject({
      id: 'ability-tier:intermediate',
      kind: 'ability-tier',
      proposedTier: 'intermediate',
      source: 'history',
    });
    // The evidence, not just the verdict.
    expect(insight!.detail).toContain('V4');
    expect(insight!.detail).toContain(String(CONSOLIDATED_SENDS));
  });

  it('says nothing when the profile already matches', () => {
    expect(
      detectAbilityDrift(sends('V4'), profile({ abilityTier: 'intermediate' }), 'boulder', NOW),
    ).toBeNull();
  });

  it('never proposes a downgrade', () => {
    // Climbing V0s while set to elite is a quiet few months, not lost ability —
    // and volunteering "you've got worse" from that evidence is not on.
    expect(
      detectAbilityDrift(sends('V0'), profile({ abilityTier: 'elite' }), 'boulder', NOW),
    ).toBeNull();
  });

  it('ignores a single hard send', () => {
    // The whole point: one lucky V7 is not a tier change.
    const climbs = [...sends('V1'), climb('V7', 3)];
    const insight = detectAbilityDrift(climbs, profile(), 'boulder', NOW);
    expect(insight?.proposedTier).not.toBe('elite');
  });

  it('skips the proposal entirely when nothing is consolidated', () => {
    expect(
      detectAbilityDrift([climb('V7', 3), climb('V6', 8)], profile(), 'boulder', NOW),
    ).toBeNull();
  });

  it('ignores sends outside the window', () => {
    const old = sends('V7').map((c) => ({
      ...c,
      date: NOW - (PYRAMID_WINDOW_DAYS + 20) * MS_PER_DAY,
    }));
    expect(detectAbilityDrift(old, profile(), 'boulder', NOW)).toBeNull();
  });

  it('jumps straight to the tier the evidence supports', () => {
    const insight = detectAbilityDrift(sends('V8'), profile(), 'boulder', NOW);
    expect(insight?.proposedTier).toBe('elite');
  });

  it('works on the route scale', () => {
    const routes = sends('5.12b').map((c) => ({ ...c, discipline: 'lead' as const }));
    expect(detectAbilityDrift(routes, profile(), 'lead', NOW)?.proposedTier).toBe('elite');
  });

  it('returns nothing without a profile to compare against', () => {
    expect(detectAbilityDrift(sends('V8'), null, 'boulder', NOW)).toBeNull();
  });
});

describe('pendingInsights', () => {
  const insight = (id: string): Insight => ({
    id,
    kind: 'ability-tier',
    title: 't',
    detail: 'd',
    source: 'history',
    detectedAt: NOW,
  });

  it('hides what has already been decided', () => {
    const p = profile({ dismissedInsights: ['ability-tier:intermediate'] });
    const out = pendingInsights([insight('ability-tier:intermediate'), insight('injury:a')], p);
    expect(out.map((i) => i.id)).toEqual(['injury:a']);
  });

  it('still surfaces a different proposal after one was declined', () => {
    // Declining "move to intermediate" shouldn't silence "move to elite" later.
    const p = profile({ dismissedInsights: ['ability-tier:intermediate'] });
    expect(pendingInsights([insight('ability-tier:elite')], p)).toHaveLength(1);
  });
});

describe('accept and dismiss', () => {
  const tierInsight: Insight = {
    id: 'ability-tier:intermediate',
    kind: 'ability-tier',
    title: 't',
    detail: 'd',
    source: 'history',
    detectedAt: NOW,
    proposedTier: 'intermediate',
  };

  const injuryInsight: Insight = {
    id: 'injury:finger-2026-08',
    kind: 'injury',
    title: 't',
    detail: 'd',
    source: 'journal-scan',
    detectedAt: NOW,
    proposedNote: 'Right ring finger has been sore on crimps since mid-August.',
  };

  it('accepting a tier change moves the tier and retires the proposal', () => {
    const patch = acceptInsight(tierInsight, profile());
    expect(patch.abilityTier).toBe('intermediate');
    expect(patch.dismissedInsights).toContain('ability-tier:intermediate');
  });

  it('accepting an injury note writes to derived context, never climberContext', () => {
    const p = profile({ climberContext: 'Ten years in, mostly outdoor granite.' });
    const patch = acceptInsight(injuryInsight, p);
    expect(patch.derivedContext).toEqual([
      {
        id: 'injury:finger-2026-08',
        text: injuryInsight.proposedNote,
        source: 'journal-scan',
        addedAt: NOW,
      },
    ]);
    // The climber's own words are untouched — the feedback loop this avoids is
    // the model's inferences returning as fact on the next run.
    expect(patch.climberContext).toBeUndefined();
  });

  it('accepting appends rather than replacing existing derived notes', () => {
    const p = profile({
      derivedContext: [{ id: 'old', text: 'Shoulder', source: 'journal-scan', addedAt: 1 }],
    });
    expect(acceptInsight(injuryInsight, p).derivedContext).toHaveLength(2);
  });

  it('dismissing records the decision and changes nothing else', () => {
    const patch = dismissInsight(tierInsight, profile());
    expect(patch.dismissedInsights).toEqual(['ability-tier:intermediate']);
    expect(patch.abilityTier).toBeUndefined();
  });

  it('never applies anything on its own — the caller does the write', () => {
    const p = profile();
    acceptInsight(tierInsight, p);
    dismissInsight(tierInsight, p);
    expect(p.abilityTier).toBe('beginner');
    expect(p.dismissedInsights).toBeUndefined();
  });
});

describe('revokeDerivedNote', () => {
  it('removes just that note, so the coach stops reading it', () => {
    const p = profile({
      derivedContext: [
        { id: 'a', text: 'Finger', source: 'journal-scan', addedAt: 1 },
        { id: 'b', text: 'Shoulder', source: 'journal-scan', addedAt: 2 },
      ],
    });
    expect(revokeDerivedNote('a', p).derivedContext).toEqual([
      { id: 'b', text: 'Shoulder', source: 'journal-scan', addedAt: 2 },
    ]);
  });
});
