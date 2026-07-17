import { afterEach, describe, expect, it } from 'vitest';
import type { CoachSuggestion } from '@tfc/core';
import {
  clearCachedSuggestion,
  getCachedSuggestion,
  saveCachedSuggestion,
  type CachedCoachSuggestion,
} from './cache';

const suggestion: CoachSuggestion = {
  focusArea: 'physical',
  headline: 'Build finger strength',
  plan: ['Warm up', 'Hangboard repeaters', 'Cool down'],
  rationale: 'Your physical score is the weakest of the triad.',
  watchOuts: ['Skin', 'Pulley strain'],
};

const entry: CachedCoachSuggestion = { suggestion, generatedAt: 1700000000000 };

describe('coach suggestion cache', () => {
  afterEach(() => {
    clearCachedSuggestion();
  });

  it('returns null when nothing is cached', () => {
    expect(getCachedSuggestion()).toBeNull();
  });

  it('round-trips a cached suggestion through localStorage', () => {
    saveCachedSuggestion(entry);
    expect(getCachedSuggestion()).toEqual(entry);
  });

  it('clearCachedSuggestion removes the cached entry', () => {
    saveCachedSuggestion(entry);
    clearCachedSuggestion();
    expect(getCachedSuggestion()).toBeNull();
  });
});
