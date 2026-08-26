/**
 * Noticing that the profile has gone stale, and proposing a fix.
 *
 * Nobody goes back and edits their training profile. They start climbing V5,
 * or tweak a finger, and the app carries on planning for the person they were
 * six months ago — which matters, because `abilityTier` drives how the whole
 * week is split between climbing and strength work.
 *
 * Three rules shape this module:
 *
 *  - **Detection is deterministic where it can be.** Whether someone is
 *    climbing a grade is a query over their own logged sends, not a judgement.
 *    An ability tier chosen by a language model is one nobody can reproduce or
 *    test, and it would silently reshape every future plan.
 *  - **Propose, never apply.** These change what the app tells someone to do
 *    with their body. A card they can accept in one tap is just as hands-off as
 *    a silent edit, and leaves them in charge.
 *  - **Derived context is kept apart from what the climber wrote.**
 *    `climberContext` is their own words and is fed to the coach verbatim. If
 *    the app wrote into it, the model's own inferences would come back as
 *    established fact on the next run and compound. Derived notes live in their
 *    own field, timestamped, with provenance, so they can be shown and revoked.
 */
import { gradeRank } from '../../content/grades';
import { ABILITY_TIERS, type AbilityTier } from '../../content/planning';
import type { ClimbDiscipline } from '../../content/climbing';
import type { ClimbRecord, DerivedNote, ProfileRecord } from '../../db/types';
import { consolidatedGrade, PYRAMID_WINDOW_DAYS } from '../today/climbingPrescription';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type InsightKind = 'ability-tier' | 'injury';

export interface Insight {
  /**
   * Stable identity for the *proposal*, not the occasion. Dismissing
   * `ability-tier:elite` silences that suggestion for good, while a later,
   * different proposal still gets through.
   */
  id: string;
  kind: InsightKind;
  /** One line, phrased as something to accept or decline. */
  title: string;
  /** The evidence, in the climber's own numbers. */
  detail: string;
  /** Where it came from — shown, so nothing arrives unattributed. */
  source: 'history' | 'journal-scan';
  detectedAt: number;
  /** Set on `ability-tier`: the tier accepting would move them to. */
  proposedTier?: AbilityTier;
  /** Set on `injury`: the note accepting would add to derived context. */
  proposedNote?: string;
}

function tierFloor(tier: AbilityTier, discipline: ClimbDiscipline): string {
  const info = ABILITY_TIERS.find((t) => t.id === tier)!;
  return discipline === 'boulder' ? info.boulderFloor : info.routeFloor;
}

/** The hardest tier whose floor the grade has reached. */
function tierForGrade(grade: string, discipline: ClimbDiscipline): AbilityTier {
  const rank = gradeRank(discipline, grade);
  let best: AbilityTier = 'beginner';
  for (const tier of ABILITY_TIERS) {
    const floor = gradeRank(discipline, tierFloor(tier.id, discipline));
    if (floor >= 0 && rank >= floor) best = tier.id;
  }
  return best;
}

const TIER_ORDER: AbilityTier[] = ABILITY_TIERS.map((t) => t.id);

/**
 * Propose an ability-tier change when the climber's consolidated grade has
 * outgrown their profile.
 *
 * Upgrades only. Detraining is real, but "you've got worse" is a claim from
 * weak evidence — a quiet few months usually means a busy life, not lost
 * ability — and it's a miserable thing for an app to volunteer. Someone who
 * has genuinely detrained can move the setting down themselves.
 */
export function detectAbilityDrift(
  climbs: ClimbRecord[],
  profile: ProfileRecord | null,
  discipline: ClimbDiscipline,
  nowMs: number,
): Insight | null {
  if (!profile) return null;
  const recent = climbs.filter(
    (c) => c.date <= nowMs && nowMs - c.date <= PYRAMID_WINDOW_DAYS * MS_PER_DAY,
  );
  const { grade, confidence, counted } = consolidatedGrade(recent, discipline);
  // Only an established grade counts. A provisional one is a single hard send,
  // which is exactly the evidence this is designed not to act on.
  if (!grade || confidence !== 'established') return null;

  const implied = tierForGrade(grade, discipline);
  if (TIER_ORDER.indexOf(implied) <= TIER_ORDER.indexOf(profile.abilityTier)) return null;

  const label = ABILITY_TIERS.find((t) => t.id === implied)!.label;
  const months = Math.round(PYRAMID_WINDOW_DAYS / 30);
  return {
    id: `ability-tier:${implied}`,
    kind: 'ability-tier',
    title: `Move your ability tier to ${label}?`,
    detail: `You've sent ${grade} ${counted} times in the last ${months} months, which is ${label.toLowerCase()} territory. Your plan still splits your week as ${ABILITY_TIERS.find((t) => t.id === profile.abilityTier)!.label.toLowerCase()}.`,
    source: 'history',
    detectedAt: nowMs,
    proposedTier: implied,
  };
}

/** Insights the climber hasn't already declined. */
export function pendingInsights(insights: Insight[], profile: ProfileRecord | null): Insight[] {
  const dismissed = new Set(profile?.dismissedInsights ?? []);
  return insights.filter((i) => !dismissed.has(i.id));
}

/**
 * The profile changes that accepting an insight implies. Returned rather than
 * applied so the caller owns the write — and so this stays a pure function.
 */
export function acceptInsight(
  insight: Insight,
  profile: ProfileRecord | null,
): Partial<ProfileRecord> {
  const dismissed = profile?.dismissedInsights ?? [];
  // Accepting also retires the proposal: it has been dealt with either way.
  const patch: Partial<ProfileRecord> = { dismissedInsights: [...dismissed, insight.id] };

  if (insight.kind === 'ability-tier' && insight.proposedTier) {
    patch.abilityTier = insight.proposedTier;
  }
  if (insight.kind === 'injury' && insight.proposedNote) {
    const existing: DerivedNote[] = profile?.derivedContext ?? [];
    patch.derivedContext = [
      ...existing,
      {
        id: insight.id,
        text: insight.proposedNote,
        source: insight.source,
        addedAt: insight.detectedAt,
      },
    ];
  }
  return patch;
}

/** The profile change that declining an insight implies. */
export function dismissInsight(
  insight: Insight,
  profile: ProfileRecord | null,
): Partial<ProfileRecord> {
  return { dismissedInsights: [...(profile?.dismissedInsights ?? []), insight.id] };
}

/** Remove a derived note the climber no longer wants the coach reading. */
export function revokeDerivedNote(
  noteId: string,
  profile: ProfileRecord | null,
): Partial<ProfileRecord> {
  return { derivedContext: (profile?.derivedContext ?? []).filter((n) => n.id !== noteId) };
}
