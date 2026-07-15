'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GOAL_DEADLINE_OPTIONS,
  GOAL_HORIZONS,
  TRIAD_AREAS,
  TRIAD_LABELS,
  now,
  trackEvent,
  validateGoalInput,
  type GoalHorizon,
  type GoalRecord,
  type TriadArea,
} from '@tfc/core';
import { Button } from './Button';
import { OptionChips, type ChipOption } from './OptionChips';
import { Screen } from './Screen';
import { PageHeader } from './PageHeader';
import { useRepository } from '../lib/db/RepositoryProvider';

const HORIZON_OPTIONS: ChipOption<GoalHorizon>[] = GOAL_HORIZONS.map((h) => ({
  label: h.label,
  value: h.id,
}));

type TriadChoice = TriadArea | 'none';
const TRIAD_OPTIONS: ChipOption<TriadChoice>[] = [
  { label: 'None', value: 'none' },
  ...TRIAD_AREAS.map((a) => ({ label: TRIAD_LABELS[a], value: a })),
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const inputClass =
  'w-full rounded-md border border-border bg-surface-alt px-4 py-2 text-base text-text placeholder:text-muted';

export function GoalForm({ goalId }: { goalId?: string }) {
  const repo = useRepository();
  const router = useRouter();
  const editing = Boolean(goalId);

  const [horizon, setHorizon] = useState<GoalHorizon>('medium');
  const [title, setTitle] = useState('');
  const [mission, setMission] = useState('');
  const [sacrifice, setSacrifice] = useState('');
  const [triad, setTriad] = useState<TriadChoice>('none');
  const [deadline, setDeadline] = useState<string>('none');
  const [existing, setExisting] = useState<GoalRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const deadlineOptions = GOAL_DEADLINE_OPTIONS[horizon];
  const deadlineChips: ChipOption<string>[] = deadlineOptions.map((o) => ({
    label: o.label,
    value: o.id,
  }));

  // Deadline options depend on the horizon; reset the choice if it no longer fits.
  const onSelectHorizon = (next: GoalHorizon) => {
    setHorizon(next);
    if (!GOAL_DEADLINE_OPTIONS[next].some((o) => o.id === deadline)) {
      setDeadline('none');
    }
  };

  useEffect(() => {
    if (!goalId) return;
    repo.getGoal(goalId).then((g) => {
      if (!g) return;
      setExisting(g);
      setHorizon(g.horizon);
      setTitle(g.title);
      setMission(g.mission ?? '');
      setSacrifice(g.sacrifice ?? '');
      setTriad(g.triadArea ?? 'none');
    });
  }, [goalId, repo]);

  const computeTargetDate = (): number | undefined => {
    const option = deadlineOptions.find((o) => o.id === deadline);
    // Open-ended: keep any existing deadline rather than wiping it.
    if (!option || option.days === null) return existing?.targetDate;
    return now() + option.days * MS_PER_DAY;
  };

  const onSave = async () => {
    const validation = validateGoalInput({ title });
    if (!validation.valid) {
      window.alert(`Add a title\n\n${validation.errors.join('\n')}`);
      return;
    }
    setSaving(true);
    try {
      const triadArea = triad === 'none' ? undefined : triad;
      const fields = {
        horizon,
        title: title.trim(),
        mission: mission.trim() || undefined,
        sacrifice: sacrifice.trim() || undefined,
        triadArea,
        targetDate: computeTargetDate(),
      };
      if (goalId) {
        await repo.updateGoal(goalId, fields);
      } else {
        await repo.saveGoal(fields);
        trackEvent('goal_created', { horizon });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title={editing ? 'Edit goal' : 'New goal'} />
      <Screen>
        <div>
          <p className="mb-2 font-semibold">Time horizon</p>
          <OptionChips options={HORIZON_OPTIONS} selected={horizon} onSelect={onSelectHorizon} />
        </div>

        <div>
          <p className="mb-2 font-semibold">Goal</p>
          <input
            className={inputClass}
            placeholder="e.g. Redpoint my first 5.11 by the end of summer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 font-semibold">Mission statement (optional)</p>
          <textarea
            className={`${inputClass} min-h-16`}
            placeholder="Why this goal matters"
            value={mission}
            onChange={(e) => setMission(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 font-semibold">What I&apos;ll give up (optional)</p>
          <textarea
            className={`${inputClass} min-h-16`}
            placeholder="The sacrifice that makes room for this goal"
            value={sacrifice}
            onChange={(e) => setSacrifice(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 font-semibold">Focus area (optional)</p>
          <OptionChips options={TRIAD_OPTIONS} selected={triad} onSelect={setTriad} />
        </div>

        <div>
          <p className="mb-2 font-semibold">Deadline</p>
          <OptionChips options={deadlineChips} selected={deadline} onSelect={setDeadline} />
          {editing && existing?.targetDate && deadline === 'none' && (
            <p className="mt-2 text-sm italic text-muted">
              Keeping the existing deadline unless you pick a new one.
            </p>
          )}
        </div>

        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save goal'}
        </Button>
      </Screen>
    </>
  );
}
