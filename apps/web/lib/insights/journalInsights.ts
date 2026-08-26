/**
 * Journal-derived insights (web): when to scan, and remembering that we did.
 *
 * The scan costs a model call and reads weeks of prose, so it runs on a slow
 * cadence rather than on every visit to the Train screen. Weekly is roughly the
 * rate at which enough new writing accumulates for the answer to change.
 *
 * The timestamp is deliberately *not* synced. It marks "this device already
 * spent a call on this", which is local by nature; the decisions that matter —
 * accepted and dismissed insights — live on the profile and sync with
 * everything else.
 */
import {
  requestJournalInsights,
  type Insight,
  type JournalEntry,
  type SyncConfig,
} from '@tfc/core';

const KEY = 'tfc.insights.lastScan';
const SCAN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function dueForScan(nowMs: number): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return true;
  const last = Number(raw);
  // A garbled or future value shouldn't wedge the scan off forever.
  if (!Number.isFinite(last) || last > nowMs) return true;
  return nowMs - last >= SCAN_INTERVAL_MS;
}

export function markScanned(nowMs: number): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, String(nowMs));
}

/**
 * Scan if due. Returns [] on any failure — a missing insight is a non-event,
 * and there is nothing useful to tell someone about a background scan that
 * didn't happen.
 */
export async function maybeScanJournals(
  config: SyncConfig | null,
  journals: JournalEntry[],
  nowMs: number,
): Promise<Insight[]> {
  if (!config || !dueForScan(nowMs)) return [];
  try {
    const insights = await requestJournalInsights(config, journals, nowMs);
    // Mark on success only, so a 503 from an unconfigured server doesn't buy a
    // week of silence.
    markScanned(nowMs);
    return insights;
  } catch {
    return [];
  }
}
