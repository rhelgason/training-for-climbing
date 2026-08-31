import type { SyncConfig } from '../sync/syncConfig';
import type { JournalEntry } from '../../db/types';
import { InsightsUnavailableError, requestJournalInsights } from './insightClient';

const NOW = Date.UTC(2026, 7, 26);
const config: SyncConfig = { url: 'https://srv.example.com/', token: 'jwt-abc' };
const journals: JournalEntry[] = [];

function mockFetch(impl: (url: string, init: RequestInit) => Promise<unknown>) {
  (globalThis as unknown as { fetch: typeof fetch }).fetch = impl as unknown as typeof fetch;
}

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

const finding = (bodyPart = 'right-ring-finger') => ({
  note: 'Right ring finger has been sore on crimps since mid-August.',
  evidence: 'ring finger twinged again',
  bodyPart,
});

afterEach(() => {
  delete (globalThis as unknown as { fetch?: typeof fetch }).fetch;
});

describe('requestJournalInsights', () => {
  it('posts to /insights with the bearer token and trims the trailing slash', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    mockFetch(async (url, init) => {
      calls.push({ url, init });
      return ok({ findings: [] });
    });

    await requestJournalInsights(config, journals, NOW);

    expect(calls[0].url).toBe('https://srv.example.com/insights');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-abc');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ journals: [], nowMs: NOW });
  });

  it('turns a finding into an injury proposal', async () => {
    mockFetch(async () => ok({ findings: [finding()] }));
    const [insight] = await requestJournalInsights(config, journals, NOW);

    expect(insight).toMatchObject({
      kind: 'injury',
      source: 'journal-scan',
      detectedAt: NOW,
      proposedNote: finding().note,
    });
    // The evidence is quoted back, so the climber is answering "did I say that?"
    // rather than "is this diagnosis correct?".
    expect(insight.detail).toContain('ring finger twinged again');
  });

  it('scopes the id per body part per month', async () => {
    // Per scan would bring the same finger back every week; permanent would
    // miss a genuine flare-up months later.
    mockFetch(async () => ok({ findings: [finding()] }));
    const [august] = await requestJournalInsights(config, journals, NOW);
    const [alsoAugust] = await requestJournalInsights(config, journals, NOW + 3 * 864e5);
    const [october] = await requestJournalInsights(config, journals, Date.UTC(2026, 9, 2));

    expect(august.id).toBe('injury:right-ring-finger:2026-08');
    expect(alsoAugust.id).toBe(august.id);
    expect(october.id).toBe('injury:right-ring-finger:2026-10');
  });

  it('pads single-digit months so ids sort and compare predictably', async () => {
    mockFetch(async () => ok({ findings: [finding()] }));
    const [insight] = await requestJournalInsights(config, journals, Date.UTC(2026, 2, 4));
    expect(insight.id).toBe('injury:right-ring-finger:2026-03');
  });

  it('keeps separate body parts separate', async () => {
    mockFetch(async () => ok({ findings: [finding('left-shoulder'), finding('elbow')] }));
    const insights = await requestJournalInsights(config, journals, NOW);
    expect(insights.map((i) => i.id)).toEqual([
      'injury:left-shoulder:2026-08',
      'injury:elbow:2026-08',
    ]);
  });

  it('drops malformed findings rather than surfacing a broken card', async () => {
    mockFetch(async () =>
      ok({
        findings: [finding(), { note: 'no body part' }, { bodyPart: 'knee' }, null, 'nonsense', 42],
      }),
    );
    const insights = await requestJournalInsights(config, journals, NOW);
    expect(insights).toHaveLength(1);
  });

  it('copes with a finding that has no evidence quote', async () => {
    mockFetch(async () => ok({ findings: [{ ...finding(), evidence: '' }] }));
    const [insight] = await requestJournalInsights(config, journals, NOW);
    expect(insight.detail).toBe(finding().note);
  });

  it('returns nothing when the server reports nothing found', async () => {
    mockFetch(async () => ok({ findings: [] }));
    expect(await requestJournalInsights(config, journals, NOW)).toEqual([]);
  });

  it('returns nothing when the response has no findings array', async () => {
    mockFetch(async () => ok({}));
    expect(await requestJournalInsights(config, journals, NOW)).toEqual([]);
  });

  it('throws with the status when the server refuses', async () => {
    mockFetch(async () => ({ ok: false, status: 503 }) as unknown as Response);
    await expect(requestJournalInsights(config, journals, NOW)).rejects.toMatchObject({
      name: 'InsightsUnavailableError',
      status: 503,
    });
  });

  it('throws when the network is down', async () => {
    mockFetch(async () => {
      throw new Error('offline');
    });
    await expect(requestJournalInsights(config, journals, NOW)).rejects.toBeInstanceOf(
      InsightsUnavailableError,
    );
  });
});
