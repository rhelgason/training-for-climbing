/** Pure helpers for the exercise library. No I/O — unit-testable. */
import type { EquipmentId } from '../../content/trainingContext';
import type { Exercise, ExerciseCategory } from '../../content/types';
import { EXERCISE_CATEGORY_LABELS } from '../../content/types';

export type CategoryFilter = ExerciseCategory | 'all';

/** Canonical category order for display, with an "all" sentinel first. */
export const CATEGORY_FILTERS: CategoryFilter[] = [
  'all',
  ...(Object.keys(EXERCISE_CATEGORY_LABELS) as ExerciseCategory[]),
];

export function filterByCategory(exercises: Exercise[], filter: CategoryFilter): Exercise[] {
  if (filter === 'all') return exercises;
  return exercises.filter((e) => e.category === filter);
}

export function categoryFilterLabel(filter: CategoryFilter): string {
  return filter === 'all' ? 'All' : EXERCISE_CATEGORY_LABELS[filter];
}

/** Can this exercise be done with what's on hand? Any one listed item suffices. */
export function isDoableWith(exercise: Exercise, available: EquipmentId[]): boolean {
  return exercise.equipment.length === 0 || exercise.equipment.some((e) => available.includes(e));
}

/** Only the exercises the climber can actually perform today. */
export function filterByEquipment(exercises: Exercise[], available: EquipmentId[]): Exercise[] {
  return exercises.filter((e) => isDoableWith(e, available));
}
