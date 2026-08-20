'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

        {/* Free text is the highest-signal thing here and the coach reads it
            verbatim, so the prompts ask for specifics rather than a mood. The
            fields are as long as the climber wants — a sentence is fine, a
            paragraph is better. */}
        <div>
          <p className="mb-1 font-semibold">What did you do?</p>
          <p className="mb-2 text-sm leading-5 text-muted">
            Grades, sets, how much of the plan you got through. The more concrete, the better
            tomorrow&apos;s session fits.
          </p>
          <textarea
            className={`${inputClass} min-h-24`}
            placeholder="e.g. Warmed up, then max hangs 20mm +25lb, 5 sets. Projected a V6 on the steep wall, got the crux move twice. Skipped the core work, ran out of time."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-1 font-semibold">What went well? (optional)</p>
          <textarea
            className={`${inputClass} min-h-20`}
            placeholder="e.g. Heel hooks felt solid, first time holding the 20mm at +25lb"
            value={wins}
            onChange={(e) => setWins(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-1 font-semibold">Where did you struggle? (optional)</p>
          <p className="mb-2 text-sm leading-5 text-muted">
            Sticking points, tweaks, anything that felt off — this is what changes what you get
            prescribed next.
          </p>
          <textarea
            className={`${inputClass} min-h-20`}
            placeholder="e.g. Pumped out fast on anything over 15 moves. Right elbow grumbled on the last set."
            value={struggles}
            onChange={(e) => setStruggles(e.target.value)}
          />
        </div>

        {/* Grades belong in the climb log, where they feed pyramids and personal
            bests — but nobody navigates there mid-journal unless it's offered. */}
        <Link href="/progress/climbs/new" className="block">
          <Button variant="secondary">+ Log a climb from today</Button>
        </Link>

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
