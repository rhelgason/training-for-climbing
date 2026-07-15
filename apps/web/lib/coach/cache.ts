/**
 * Caches the last AI-coach suggestion in localStorage so it shows instantly on
 * load and survives offline, mirroring the mobile app's coach cache.
 */
import type { CoachSuggestion } from '@tfc/core';

const KEY = 'tfc.coachSuggestion';

export interface CachedCoachSuggestion {
  suggestion: CoachSuggestion;
  /** Epoch ms the suggestion was generated. */
  generatedAt: number;
}

export function getCachedSuggestion(): CachedCoachSuggestion | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedCoachSuggestion;
  } catch {
    return null;
  }
}

export function saveCachedSuggestion(entry: CachedCoachSuggestion): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(entry));
}

export function clearCachedSuggestion(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}
