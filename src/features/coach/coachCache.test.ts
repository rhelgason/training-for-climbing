import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearCachedSuggestion, getCachedSuggestion, saveCachedSuggestion } from './coachCache';
import type { CoachSuggestion } from './types';

const suggestion: CoachSuggestion = {
  focusArea: 'physical',
  headline: 'Power day',
  plan: ['Warm up', 'Campus board'],
  rationale: 'Physical is your weakest area.',
  watchOuts: [],
};

describe('coachCache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns null when nothing is cached', async () => {
    expect(await getCachedSuggestion()).toBeNull();
  });

  it('round-trips a saved suggestion', async () => {
    await saveCachedSuggestion({ suggestion, generatedAt: 123 });
    expect(await getCachedSuggestion()).toEqual({ suggestion, generatedAt: 123 });
  });

  it('clears the cached suggestion', async () => {
    await saveCachedSuggestion({ suggestion, generatedAt: 123 });
    await clearCachedSuggestion();
    expect(await getCachedSuggestion()).toBeNull();
  });

  it('returns null on corrupt JSON', async () => {
    await AsyncStorage.setItem('tfc.coachSuggestion', '{not json');
    expect(await getCachedSuggestion()).toBeNull();
  });
});
