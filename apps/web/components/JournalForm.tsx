'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ACTIVITY_TAGS,
  ACTIVITY_LABELS,
  INTENSITIES,
  INTENSITY_LABELS,
  now,
  trackEvent,
  type ActivityTag,
  type JournalIntensity,
} from '@tfc/core';
import { Button } from './Button';
import { OptionChips, type ChipOption } from './OptionChips';
import { Screen } from './Screen';
import { PageHeader } from './PageHeader';
import { useRepository } from '../lib/db/RepositoryProvider';

type WhenChoice = 'today' | 'yesterday' | '2ago';
const WHEN_OPTIONS: ChipOption<WhenChoice>[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: '2 days ago', value: '2ago' },
];
const WHEN_OFFSET_DAYS: Record<WhenChoice, number> = { today: 0, yesterday: 1, '2ago': 2 };
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ACTIVITY_OPTIONS: ChipOption<ActivityTag>[] = ACTIVITY_TAGS.map((a) => ({
  label: ACTIVITY_LABELS[a],
  value: a,
}));
const INTENSITY_OPTIONS: ChipOption<JournalIntensity>[] = INTENSITIES.map((i) => ({
  label: INTENSITY_LABELS[i],
  value: i,
}));

const inputClass =
  'w-full rounded-md border border-border bg-surface-alt px-4 py-2 text-base text-text placeholder:text-muted';

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function JournalForm({ journalId }: { journalId?: string }) {
  const repo = useRepository();
  const router = useRouter();
  const editing = Boolean(journalId);

  const [when, setWhen] = useState<WhenChoice>('today');
  const [existingDate, setExistingDate] = useState<number | null>(null);
  const [activities, setActivities] = useState<ActivityTag[]>([]);
  const [intensity, setIntensity] = useState<JournalIntensity | null>(null);
  const [summary, setSummary] = useState('');
  const [wins, setWins] = useState('');
  const [struggles, setStruggles] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!journalId) return;
    repo.getJournal(journalId).then((j) => {
      if (!j) return;
      setExistingDate(j.date);
      setActivities(j.activities);
      setIntensity(j.intensity ?? null);
      setSummary(j.summary ?? '');
      setWins(j.wins ?? '');
      setStruggles(j.struggles ?? '');
    });
  }, [journalId, repo]);

  const toggleActivity = (a: ActivityTag) =>
    setActivities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const onSave = async () => {
    setSaving(true);
    try {
      const fields = {
        activities,
        intensity: intensity ?? undefined,
        summary: summary.trim() || undefined,
        wins: wins.trim() || undefined,
        struggles: struggles.trim() || undefined,
      };
      if (journalId) {
        await repo.updateJournal(journalId, fields);
      } else {
        await repo.saveJournal({ ...fields, date: now() - WHEN_OFFSET_DAYS[when] * MS_PER_DAY });
        trackEvent('journal_logged', { activityCount: activities.length });
      }
      router.push('/train');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!journalId) return;
    if (!window.confirm('Delete this journal entry? This cannot be undone.')) return;
    await repo.deleteJournal(journalId);
    trackEvent('journal_deleted');
    router.push('/train');
  };

  return (
    <>
      <PageHeader title={editing ? 'Edit entry' : 'Log today'} />
      <Screen>
        <div>
          <p className="mb-2 font-semibold">When</p>
          {editing ? (
            <p>{existingDate ? formatDate(existingDate) : '—'}</p>
          ) : (
            <OptionChips options={WHEN_OPTIONS} selected={when} onSelect={setWhen} />
          )}
        </div>

        <div>
          <p className="mb-2 font-semibold">What did you do?</p>
          <OptionChips options={ACTIVITY_OPTIONS} selected={activities} onSelect={toggleActivity} />
        </div>

        <div>
          <p className="mb-2 font-semibold">How hard? (optional)</p>
          <OptionChips options={INTENSITY_OPTIONS} selected={intensity} onSelect={setIntensity} />
        </div>

        <div>
          <p className="mb-2 font-semibold">What did you do today?</p>
          <textarea
            className={`${inputClass} min-h-16`}
            placeholder="A quick blurb about your day"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 font-semibold">What went well? (optional)</p>
          <textarea
            className={`${inputClass} min-h-16`}
            placeholder="Wins, breakthroughs, good feelings"
            value={wins}
            onChange={(e) => setWins(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 font-semibold">What didn&apos;t? (optional)</p>
          <textarea
            className={`${inputClass} min-h-16`}
            placeholder="Struggles, tweaks, frustrations"
            value={struggles}
            onChange={(e) => setStruggles(e.target.value)}
          />
        </div>

        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save entry' : 'Save'}
        </Button>
        {editing && (
          <button
            type="button"
            onClick={saving ? undefined : onDelete}
            className="py-2 text-center text-sm text-danger active:opacity-70"
          >
            Delete entry
          </button>
        )}
      </Screen>
    </>
  );
}
