import type { ProfileRecord } from '../db/types';
import { PROFILE_DEFAULTS, effectiveProfile, isOnboarded } from './profile';

/** A profile as written by a build that had the new fields. */
function profile(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    id: 'profile',
    createdAt: 0,
    updatedAt: 0,
    abilityTier: 'intermediate',
    defaultDiscipline: 'boulder',
    gradeSystem: 'yds-v',
    reassessWeeks: 8,
    aiCoachEnabled: true,
    styleFocus: 'all-round',
    equipment: ['boulder-wall'],
    daysPerWeek: 3,
    sessionLength: 'standard',
    ...overrides,
  };
}

describe('effectiveProfile', () => {
  it('falls back to defaults when no profile is saved', () => {
    expect(effectiveProfile(null)).toEqual(PROFILE_DEFAULTS);
  });

  it('hands back a copy of the default equipment, not the shared array', () => {
    // Mutating a caller's copy must not poison PROFILE_DEFAULTS for everyone.
    const settings = effectiveProfile(null);
    settings.equipment.push('campus-board');
    expect(PROFILE_DEFAULTS.equipment).not.toContain('campus-board');
    expect(effectiveProfile(null).equipment).not.toContain('campus-board');
  });

  it('defaults the AI coach on, since that is the product promise', () => {
    expect(PROFILE_DEFAULTS.aiCoachEnabled).toBe(true);
  });

  it('passes through a fully-populated profile unchanged', () => {
    const record = profile({ styleFocus: 'sport-endurance', daysPerWeek: 5 });
    const settings = effectiveProfile(record);
    expect(settings.styleFocus).toBe('sport-endurance');
    expect(settings.daysPerWeek).toBe(5);
  });

  describe('records written before the training-context fields existed', () => {
    // Rows synced from an older client arrive with these missing. Handing
    // `undefined` to the scheduler would make every focus unschedulable, so
    // the backfill is load-bearing rather than cosmetic.
    const legacy = profile();
    delete (legacy as Partial<ProfileRecord>).styleFocus;
    delete (legacy as Partial<ProfileRecord>).equipment;
    delete (legacy as Partial<ProfileRecord>).daysPerWeek;
    delete (legacy as Partial<ProfileRecord>).sessionLength;

    it('backfills every missing field from the defaults', () => {
      const settings = effectiveProfile(legacy);
      expect(settings.styleFocus).toBe(PROFILE_DEFAULTS.styleFocus);
      expect(settings.equipment).toEqual(PROFILE_DEFAULTS.equipment);
      expect(settings.daysPerWeek).toBe(PROFILE_DEFAULTS.daysPerWeek);
      expect(settings.sessionLength).toBe(PROFILE_DEFAULTS.sessionLength);
    });

    it('keeps the fields the old record did set', () => {
      const settings = effectiveProfile({ ...legacy, abilityTier: 'elite', reassessWeeks: 4 });
      expect(settings.abilityTier).toBe('elite');
      expect(settings.reassessWeeks).toBe(4);
    });

    it('never yields undefined for a field the scheduler depends on', () => {
      const settings = effectiveProfile(legacy);
      for (const key of ['styleFocus', 'equipment', 'daysPerWeek', 'sessionLength'] as const) {
        expect(settings[key]).toBeDefined();
      }
    });
  });
});

describe('isOnboarded', () => {
  it('is false for no profile and for one that never finished sign-up', () => {
    expect(isOnboarded(null)).toBe(false);
    expect(isOnboarded(profile())).toBe(false);
  });

  it('is true once the wizard has stamped a completion time', () => {
    expect(isOnboarded(profile({ onboardedAt: 1 }))).toBe(true);
  });
});
