/** User profile defaults and resolution helpers. */
import type { GradeSystem, ProfileRecord } from '../db/types';
import type { ClimbDiscipline } from './climbing';
import type { AbilityTier } from './planning';

/** The singleton profile row id. */
export const PROFILE_ID = 'profile';

/** The user-editable settings, independent of id/timestamps. */
export interface ProfileSettings {
  abilityTier: AbilityTier;
  defaultDiscipline: ClimbDiscipline;
  gradeSystem: GradeSystem;
  reassessWeeks: number;
  aiCoachEnabled: boolean;
}

/** Default settings used until the user customises them. */
export const PROFILE_DEFAULTS: ProfileSettings = {
  abilityTier: 'intermediate',
  defaultDiscipline: 'boulder',
  gradeSystem: 'yds-v',
  reassessWeeks: 8,
  aiCoachEnabled: false,
};

/** The effective settings, falling back to defaults when unset. */
export function effectiveProfile(profile: ProfileRecord | null): ProfileSettings {
  if (!profile) return { ...PROFILE_DEFAULTS };
  return {
    abilityTier: profile.abilityTier,
    defaultDiscipline: profile.defaultDiscipline,
    gradeSystem: profile.gradeSystem,
    reassessWeeks: profile.reassessWeeks,
    aiCoachEnabled: profile.aiCoachEnabled,
  };
}
