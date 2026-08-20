/** User profile defaults and resolution helpers. */
import type { GradeSystem, ProfileRecord } from '../db/types';
import type { ClimbDiscipline } from './climbing';
import type { AbilityTier } from './planning';
import {
  DEFAULT_EQUIPMENT,
  type EquipmentId,
  type SessionLength,
  type StyleFocus,
} from './trainingContext';

/** The singleton profile row id. */
export const PROFILE_ID = 'profile';

/** The user-editable settings, independent of id/timestamps. */
export interface ProfileSettings {
  abilityTier: AbilityTier;
  defaultDiscipline: ClimbDiscipline;
  gradeSystem: GradeSystem;
  reassessWeeks: number;
  aiCoachEnabled: boolean;
  climberContext?: string;
  styleFocus: StyleFocus;
  equipment: EquipmentId[];
  daysPerWeek: number;
  sessionLength: SessionLength;
  onboardedAt?: number;
}

/**
 * Default settings used until the user customises them.
 *
 * `aiCoachEnabled` defaults **on**: the product promise is opening the app and
 * being told what to do, and the AI is what makes that personal. It still needs
 * a signed-in account and a server key, and every failure falls back to the
 * deterministic plan — so "on" costs nothing when it isn't available.
 */
export const PROFILE_DEFAULTS: ProfileSettings = {
  abilityTier: 'intermediate',
  defaultDiscipline: 'boulder',
  gradeSystem: 'yds-v',
  reassessWeeks: 8,
  aiCoachEnabled: true,
  climberContext: undefined,
  styleFocus: 'all-round',
  equipment: DEFAULT_EQUIPMENT,
  daysPerWeek: 3,
  sessionLength: 'standard',
  onboardedAt: undefined,
};

/** The effective settings, falling back to defaults when unset. */
export function effectiveProfile(profile: ProfileRecord | null): ProfileSettings {
  if (!profile) return { ...PROFILE_DEFAULTS, equipment: [...PROFILE_DEFAULTS.equipment] };
  return {
    abilityTier: profile.abilityTier,
    defaultDiscipline: profile.defaultDiscipline,
    gradeSystem: profile.gradeSystem,
    reassessWeeks: profile.reassessWeeks,
    aiCoachEnabled: profile.aiCoachEnabled,
    climberContext: profile.climberContext,
    // Records written before these fields existed (or by an older client) still
    // load — fall back rather than hand `undefined` to the scheduler.
    styleFocus: profile.styleFocus ?? PROFILE_DEFAULTS.styleFocus,
    equipment: profile.equipment ?? [...PROFILE_DEFAULTS.equipment],
    daysPerWeek: profile.daysPerWeek ?? PROFILE_DEFAULTS.daysPerWeek,
    sessionLength: profile.sessionLength ?? PROFILE_DEFAULTS.sessionLength,
    onboardedAt: profile.onboardedAt,
  };
}

/** Whether the guided sign-up flow has been completed. */
export function isOnboarded(profile: ProfileRecord | null): boolean {
  return typeof profile?.onboardedAt === 'number';
}
