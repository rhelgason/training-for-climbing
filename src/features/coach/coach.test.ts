import { type CoachSuggestion, InMemoryRepository } from '@tfc/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SyncConfig } from '../sync/syncConfig';
import { refreshCoachSuggestion } from './coach';
import { getCachedSuggestion } from './coachCache';

const config: SyncConfig = { url: 'https://srv.example.com', token: 'secret' };

const suggestion: CoachSuggestion = {
  focusArea: 'mental',
  headline: 'Head game',
  plan: ['Visualize', 'Practice falls'],
  rationale: 'Mental is weakest.',
  watchOuts: ['Stay rested'],
};

describe('refreshCoachSuggestion', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });
  afterEach(() => {
    delete (globalThis as unknown as { fetch?: typeof fetch }).fetch;
  });

  it('builds context from the repo, posts it, returns and caches the suggestion', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    await repo.saveAssessment({
      responses: {},
      mental: 30,
      technical: 40,
      physical: 45,
      weakestArea: 'mental',
    });
    await repo.saveJournal({ date: 1000, activities: ['climbing'], summary: 'Felt good' });

    let sentBody: { context?: unknown } = {};
    (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (
      _url: string,
      init: RequestInit,
    ) => {
      sentBody = JSON.parse(init.body as string);
      return { ok: true, status: 200, json: async () => ({ suggestion }) } as Response;
    }) as unknown as typeof fetch;

    const result = await refreshCoachSuggestion(repo, config);

    expect(result).toEqual(suggestion);
    // The posted context reflects the repo data.
    expect(
      (sentBody.context as { assessment: { weakestArea: string } }).assessment.weakestArea,
    ).toBe('mental');
    // It cached the suggestion for offline display.
    const cached = await getCachedSuggestion();
    expect(cached?.suggestion).toEqual(suggestion);
  });

  it('does not cache when the request fails', async () => {
    const repo = new InMemoryRepository();
    await repo.init();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = (async () =>
      ({ ok: false, status: 500, json: async () => ({}) }) as Response) as unknown as typeof fetch;

    await expect(refreshCoachSuggestion(repo, config)).rejects.toBeTruthy();
    expect(await getCachedSuggestion()).toBeNull();
  });
});
