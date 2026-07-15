'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ABILITY_TIERS,
  REST_GUIDANCE,
  TRAINING_HIERARCHY,
  buildSessionPlan,
  effectiveProfile,
  restGuidanceFor,
  tierInfo,
  trackEvent,
  type AbilityTier,
  type HierarchyAreaId,
} from '@tfc/core';
import { Card } from '@/components/Card';
import { OptionChips, type ChipOption } from '@/components/OptionChips';
import { Screen } from '@/components/Screen';
import { useRepository } from '@/lib/db/RepositoryProvider';

const TIER_OPTIONS: ChipOption<AbilityTier>[] = ABILITY_TIERS.map((t) => ({
  label: t.label,
  value: t.id,
}));

const AREA_OPTIONS: ChipOption<HierarchyAreaId>[] = TRAINING_HIERARCHY.map((a) => ({
  label: a.name,
  value: a.id,
}));

export default function ProgramBuilderScreen() {
  const repo = useRepository();
  const [tier, setTier] = useState<AbilityTier>('intermediate');
  const [areas, setAreas] = useState<HierarchyAreaId[]>(['skill']);

  useEffect(() => {
    repo.getProfile().then((p) => setTier(effectiveProfile(p).abilityTier));
  }, [repo]);

  const plan = useMemo(() => buildSessionPlan(areas), [areas]);
  const info = tierInfo(tier);

  const onSelectTier = (next: AbilityTier) => {
    setTier(next);
    repo.saveProfile({ abilityTier: next });
  };

  const toggleArea = (id: HierarchyAreaId) => {
    const next = areas.includes(id) ? areas.filter((a) => a !== id) : [...areas, id];
    setAreas(next);
    trackEvent('program_built', { tier, areaCount: next.length });
  };

  return (
    <Screen>
      <h1 className="text-2xl font-bold">Program builder</h1>

      <div>
        <h2 className="mb-2 text-lg font-bold">Ability tier</h2>
        <OptionChips options={TIER_OPTIONS} selected={tier} onSelect={onSelectTier} />
        <Card className="mt-4">
          <p className="text-base font-bold text-primary">
            {info.techniqueMentalPct}% technique &amp; mental · {info.conditioningPct}% conditioning
          </p>
          <p className="mt-1 text-sm leading-5 text-muted">{info.guidance}</p>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-bold">What will you train?</h2>
        <OptionChips options={AREA_OPTIONS} selected={areas} onSelect={toggleArea} />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-bold">Your session order</h2>
        {plan.length === 0 ? (
          <p className="text-base text-muted">Pick at least one focus area above.</p>
        ) : (
          plan.map((step, i) => {
            const rest = restGuidanceFor(step.id);
            return (
              <Card key={step.id} className="mb-2">
                <p className="text-base font-bold">
                  {i + 1}. {step.name}
                </p>
                <p className="mt-1 text-sm leading-5 text-muted">{step.description}</p>
                {rest && <p className="mt-2 text-sm text-warning">⏱ {rest}</p>}
              </Card>
            );
          })
        )}
      </div>

      <p className="text-sm italic leading-5 text-muted">
        Always warm up first. {REST_GUIDANCE.betweenWorkouts}
      </p>
    </Screen>
  );
}
