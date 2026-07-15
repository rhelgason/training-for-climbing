'use client';

import { useMemo, useState } from 'react';
import {
  CATEGORY_FILTERS,
  EXERCISES,
  EXERCISE_CATEGORY_LABELS,
  categoryFilterLabel,
  filterByCategory,
  type CategoryFilter,
} from '@tfc/core';
import { Card } from '@/components/Card';
import { OptionChips, type ChipOption } from '@/components/OptionChips';
import { Screen } from '@/components/Screen';

const FILTER_OPTIONS: ChipOption<CategoryFilter>[] = CATEGORY_FILTERS.map((f) => ({
  label: categoryFilterLabel(f),
  value: f,
}));

export default function ExercisesScreen() {
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const results = useMemo(() => filterByCategory(EXERCISES, filter), [filter]);

  return (
    <Screen>
      <h1 className="text-2xl font-bold">Exercise library</h1>
      <p className="mt-2 mb-2 text-base leading-6 text-muted">
        Conditioning and climbing-specific exercises to build the physical side of your climbing.
      </p>

      <OptionChips options={FILTER_OPTIONS} selected={filter} onSelect={setFilter} />

      {results.map((ex) => (
        <div key={ex.id} className="mt-2">
          <Card>
            <p className="font-bold">{ex.name}</p>
            <p className="mt-1 text-sm text-primary">{EXERCISE_CATEGORY_LABELS[ex.category]}</p>
            <p className="mt-1 text-sm leading-5 text-muted">{ex.description}</p>
          </Card>
        </div>
      ))}
    </Screen>
  );
}
