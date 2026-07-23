/** Pure helpers for the program builder. No I/O — unit-testable. */
import type {
  AbilityTier,
  AbilityTierInfo,
  HierarchyArea,
  HierarchyAreaId,
} from '../../content/planning';
import { ABILITY_TIERS, REST_GUIDANCE, TRAINING_HIERARCHY } from '../../content/planning';

/**
 * Build an ordered session plan from the chosen training areas. Output always
 * follows the book's within-session hierarchy regardless of selection order,
 * and duplicates are removed.
 */
export function buildSessionPlan(selected: HierarchyAreaId[]): HierarchyArea[] {
  const chosen = new Set(selected);
  return TRAINING_HIERARCHY.filter((area) => chosen.has(area.id)); // already in order
}

/** Rest guidance most relevant to a given training area, if any. */
export function restGuidanceFor(areaId: HierarchyAreaId): string | undefined {
  switch (areaId) {
    case 'skill':
    case 'maxStrengthPower':
      return REST_GUIDANCE.strengthPowerSkill;
    case 'anaerobicEndurance':
      return REST_GUIDANCE.anaerobicEndurance;
    default:
      return undefined;
  }
}

export function tierInfo(tier: AbilityTier): AbilityTierInfo {
  const info = ABILITY_TIERS.find((t) => t.id === tier);
  if (!info) throw new Error(`Unknown ability tier: ${tier}`);
  return info;
}

/** Recommended three-way split of training time for an ability tier. */
export function focusSplit(tier: AbilityTier): {
  climbingPct: number;
  specificStrengthPct: number;
  generalConditioningPct: number;
} {
  const info = tierInfo(tier);
  return {
    climbingPct: info.climbingPct,
    specificStrengthPct: info.specificStrengthPct,
    generalConditioningPct: info.generalConditioningPct,
  };
}
