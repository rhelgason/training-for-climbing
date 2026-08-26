import { describe, expect, it } from 'vitest';
import type { JournalEntry } from '@tfc/core';
import { scannableEntries } from './journalScan';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 26);

function entry(
  daysAgo: number,
  text: string | undefined,
  field: 'summary' | 'struggles' = 'summary',
): JournalEntry {
  return {
    id: `j-${daysAgo}`,
    createdAt: NOW - daysAgo * DAY,
    updatedAt: NOW - daysAgo * DAY,
    date: NOW - daysAgo * DAY,
    activities: ['climbing'],
    [field]: text,
  } as JournalEntry;
}

describe('scannableEntries', () => {
  it('returns dated prose newest first', () => {
    const text = scannableEntries([entry(1, 'Finger sore'), entry(4, 'Good session')], NOW);
    expect(text).not.toBeNull();
    const lines = text!.split('\n');
    expect(lines[0]).toContain('Finger sore');
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}: /);
    expect(lines[1]).toContain('Good session');
  });

  it('gives back nothing when there is too little to conclude from', () => {
    // The model is told to require two separate days; one entry cannot satisfy
    // that, so there is no point spending a call on it.
    expect(scannableEntries([], NOW)).toBeNull();
    expect(scannableEntries([entry(1, 'Finger sore')], NOW)).toBeNull();
  });

  it('ignores entries with no free text at all', () => {
    const text = scannableEntries(
      [entry(1, undefined), entry(2, undefined), entry(3, 'Sore')],
      NOW,
    );
    expect(text).toBeNull(); // only one entry had prose
  });

  it('drops entries outside the recent window', () => {
    const text = scannableEntries([entry(2, 'Recent'), entry(200, 'Ancient')], NOW);
    expect(text).toBeNull(); // only the recent one survives, which is not enough
  });

  it('ignores entries dated in the future', () => {
    const future = { ...entry(0, 'Tomorrow'), date: NOW + 5 * DAY };
    expect(scannableEntries([future, entry(3, 'Sore')], NOW)).toBeNull();
  });

  it('combines the several free-text fields of one entry', () => {
    const both: JournalEntry = {
      ...entry(1, 'Felt strong'),
      struggles: 'but the ring finger twinged',
    };
    const text = scannableEntries([both, entry(3, 'Same finger again')], NOW);
    expect(text).toContain('Felt strong');
    expect(text).toContain('ring finger twinged');
  });

  it('caps how much prose goes into the prompt', () => {
    const many = Array.from({ length: 60 }, (_, i) => entry(i, `Session ${i}`));
    const lines = scannableEntries(many, NOW)!.split('\n');
    expect(lines.length).toBeLessThanOrEqual(25);
  });
});
