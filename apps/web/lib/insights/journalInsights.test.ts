import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalEntry, SyncConfig } from '@tfc/core';
import { dueForScan, markScanned, maybeScanJournals } from './journalInsights';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 26);
const config: SyncConfig = { url: '/api', token: 't' };

const journals: JournalEntry[] = [
  {
    id: 'j1',
    createdAt: NOW,
    updatedAt: NOW,
    date: NOW - DAY,
    activities: ['climbing'],
    struggles: 'Ring finger sore again',
  },
];

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('dueForScan', () => {
  it('is due when it has never run', () => {
    expect(dueForScan(NOW)).toBe(true);
  });

  it('is not due again straight away', () => {
    markScanned(NOW);
    expect(dueForScan(NOW + DAY)).toBe(false);
  });

  it('is due once a week has passed', () => {
    markScanned(NOW);
    expect(dueForScan(NOW + 8 * DAY)).toBe(true);
  });

  it('recovers from a garbled or future timestamp', () => {
    // Otherwise a bad clock or a corrupt value switches the scan off for good.
    window.localStorage.setItem('tfc.insights.lastScan', 'not-a-number');
    expect(dueForScan(NOW)).toBe(true);
    window.localStorage.setItem('tfc.insights.lastScan', String(NOW + 400 * DAY));
    expect(dueForScan(NOW)).toBe(true);
  });
});

describe('maybeScanJournals', () => {
  it('turns findings into proposals carrying the climber’s own words back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              findings: [
                {
                  note: 'Right ring finger has been sore on crimps since mid-August.',
                  evidence: 'Ring finger sore again',
                  bodyPart: 'right-ring-finger',
                },
              ],
            }),
          ),
      ),
    );

    const [insight] = await maybeScanJournals(config, journals, NOW);
    expect(insight).toMatchObject({ kind: 'injury', source: 'journal-scan' });
    // Month-scoped: the same finger shouldn't produce a new card every week.
    expect(insight.id).toBe('injury:right-ring-finger:2026-08');
    expect(insight.detail).toContain('Ring finger sore again');
    expect(insight.proposedNote).toContain('Right ring finger');
  });

  it('does nothing when not signed in', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await maybeScanJournals(null, journals, NOW)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not scan again inside the interval', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    markScanned(NOW);
    expect(await maybeScanJournals(config, journals, NOW + DAY)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('stays silent on failure and retries next time rather than going quiet for a week', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 503 })),
    );
    expect(await maybeScanJournals(config, journals, NOW)).toEqual([]);
    // An unconfigured server must not buy itself a week of silence.
    expect(dueForScan(NOW)).toBe(true);
  });

  it('stays silent when the network is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    expect(await maybeScanJournals(config, journals, NOW)).toEqual([]);
  });
});
