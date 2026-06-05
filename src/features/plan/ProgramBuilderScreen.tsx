import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/Card';
import { OptionChips, type ChipOption } from '../../components/OptionChips';
import { Screen } from '../../components/Screen';
import {
  ABILITY_TIERS,
  REST_GUIDANCE,
  TRAINING_HIERARCHY,
  type AbilityTier,
  type HierarchyAreaId,
} from '../../content/planning';
import { trackEvent } from '../../lib/logger';
import { colors, fontSize, spacing } from '../../theme';
import { buildSessionPlan, restGuidanceFor, tierInfo } from './program';

const TIER_OPTIONS: ChipOption<AbilityTier>[] = ABILITY_TIERS.map((t) => ({
  label: t.label,
  value: t.id,
}));

const AREA_OPTIONS: ChipOption<HierarchyAreaId>[] = TRAINING_HIERARCHY.map((a) => ({
  label: a.name,
  value: a.id,
}));

export function ProgramBuilderScreen() {
  const [tier, setTier] = useState<AbilityTier>('intermediate');
  const [areas, setAreas] = useState<HierarchyAreaId[]>(['skill']);

  const plan = useMemo(() => buildSessionPlan(areas), [areas]);
  const info = tierInfo(tier);

  const toggleArea = (id: HierarchyAreaId) => {
    const next = areas.includes(id) ? areas.filter((a) => a !== id) : [...areas, id];
    setAreas(next);
    trackEvent('program_built', { tier, areaCount: next.length });
  };

  return (
    <Screen>
      <Text style={styles.title}>Program builder</Text>

      <Text style={styles.sectionTitle}>Ability tier</Text>
      <OptionChips options={TIER_OPTIONS} selected={tier} onSelect={setTier} testIDPrefix="tier" />
      <Card style={styles.tierCard}>
        <Text style={styles.split}>
          {info.techniqueMentalPct}% technique &amp; mental · {info.conditioningPct}% conditioning
        </Text>
        <Text style={styles.guidance}>{info.guidance}</Text>
      </Card>

      <Text style={styles.sectionTitle}>What will you train?</Text>
      <OptionChips
        options={AREA_OPTIONS}
        selected={areas}
        onSelect={toggleArea}
        testIDPrefix="area"
      />

      <Text style={styles.sectionTitle}>Your session order</Text>
      {plan.length === 0 ? (
        <Text style={styles.empty}>Pick at least one focus area above.</Text>
      ) : (
        plan.map((step, i) => {
          const rest = restGuidanceFor(step.id);
          return (
            <Card key={step.id} style={styles.step}>
              <Text style={styles.stepName}>
                {i + 1}. {step.name}
              </Text>
              <Text style={styles.stepDesc}>{step.description}</Text>
              {rest && <Text style={styles.rest}>⏱ {rest}</Text>}
            </Card>
          );
        })
      )}

      <View style={styles.footer}>
        <Text style={styles.footerNote}>Always warm up first. {REST_GUIDANCE.betweenWorkouts}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  tierCard: { marginTop: spacing.md },
  split: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
  guidance: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  empty: { color: colors.textMuted, fontSize: fontSize.md },
  step: { marginBottom: spacing.sm },
  stepName: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  stepDesc: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  rest: { color: colors.warning, fontSize: fontSize.sm, marginTop: spacing.sm },
  footer: { marginTop: spacing.lg },
  footerNote: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
