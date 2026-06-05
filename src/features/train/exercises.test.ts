import { EXERCISES } from '../../content/exercises';
import { EXERCISE_CATEGORY_LABELS, type ExerciseCategory } from '../../content/types';
import { CATEGORY_FILTERS, categoryFilterLabel, filterByCategory } from './exercises';

describe('exercise content integrity', () => {
  it('has unique ids and a known category for every exercise', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of EXERCISES) {
      expect(EXERCISE_CATEGORY_LABELS[e.category]).toBeTruthy();
      expect(e.description.length).toBeGreaterThan(0);
    }
  });

  it('covers every category with at least one exercise', () => {
    for (const cat of Object.keys(EXERCISE_CATEGORY_LABELS) as ExerciseCategory[]) {
      expect(EXERCISES.some((e) => e.category === cat)).toBe(true);
    }
  });
});

describe('filterByCategory', () => {
  it('returns everything for "all"', () => {
    expect(filterByCategory(EXERCISES, 'all')).toHaveLength(EXERCISES.length);
  });

  it('returns only matching exercises for a category', () => {
    const core = filterByCategory(EXERCISES, 'core');
    expect(core.length).toBeGreaterThan(0);
    expect(core.every((e) => e.category === 'core')).toBe(true);
  });
});

describe('CATEGORY_FILTERS / labels', () => {
  it('starts with "all" then the categories', () => {
    expect(CATEGORY_FILTERS[0]).toBe('all');
    expect(categoryFilterLabel('all')).toBe('All');
    expect(categoryFilterLabel('core')).toBe('Core');
  });
});
