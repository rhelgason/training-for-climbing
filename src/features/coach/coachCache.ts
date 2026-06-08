/**
 * Local cache of the latest AI coach suggestion, so it shows instantly and works
 * offline. One entry (the most recent); replaced on each successful refresh.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CoachSuggestion } from './types';

const KEY = 'tfc.coachSuggestion';

export interface CachedCoachSuggestion {
  suggestion: CoachSuggestion;
  /** When the suggestion was generated (epoch ms). */
  generatedAt: number;
}

export async function getCachedSuggestion(): Promise<CachedCoachSuggestion | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedCoachSuggestion;
  } catch {
    return null;
  }
}

export async function saveCachedSuggestion(entry: CachedCoachSuggestion): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(entry));
}

export async function clearCachedSuggestion(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
