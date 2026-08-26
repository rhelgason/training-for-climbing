'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DISCIPLINES,
  DISCIPLINE_LABELS,
  ENVIRONMENTS,
  ENVIRONMENT_LABELS,
  OUTCOMES,
  OUTCOME_LABELS,
  gradesForDiscipline,
  now,
  trackEvent,
  type ClimbDiscipline,
  type ClimbEnvironment,
  type ClimbOutcome,
} from '@tfc/core';
import { Button } from './Button';
import { OptionChips, type ChipOption } from './OptionChips';
import { Screen } from './Screen';
import { PageHeader } from './PageHeader';
import { DayPicker } from './DayPicker';
import { useRepository } from '../lib/db/RepositoryProvider';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ENV_OPTIONS: ChipOption<ClimbEnvironment>[] = ENVIRONMENTS.map((e) => ({
  label: ENVIRONMENT_LABELS[e],
  value: e,
}));
const DISCIPLINE_OPTIONS: ChipOption<ClimbDiscipline>[] = DISCIPLINES.map((d) => ({
  label: DISCIPLINE_LABELS[d],
  value: d,
}));
const OUTCOME_OPTIONS: ChipOption<ClimbOutcome>[] = OUTCOMES.map((o) => ({
  label: OUTCOME_LABELS[o],
  value: o,
}));

const inputClass =
  'w-full rounded-md border border-border bg-surface-alt px-4 py-2 text-base text-text placeholder:text-muted';

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ClimbForm({ climbId }: { climbId?: string }) {
  const repo = useRepository();
  const router = useRouter();
  const editing = Boolean(climbId);

  const [day, setDay] = useState(() => now());
  const [existingDate, setExistingDate] = useState<number | null>(null);
  const [environment, setEnvironment] = useState<ClimbEnvironment>('indoor');
  const [discipline, setDiscipline] = useState<ClimbDiscipline>('boulder');
  const [grade, setGrade] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ClimbOutcome>('send');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!climbId) return;
    repo.getClimb(climbId).then((c) => {
      if (!c) return;
      setExistingDate(c.date);
      setEnvironment(c.environment);
      setDiscipline(c.discipline);
      setGrade(c.grade);
      setOutcome(c.outcome);
      setName(c.name ?? '');
      setLocation(c.location ?? '');
      setNotes(c.notes ?? '');
    });
  }, [climbId, repo]);

  const gradeOptions = useMemo<ChipOption<string>[]>(
    () => gradesForDiscipline(discipline).map((g) => ({ label: g, value: g })),
    [discipline],
  );

  const onChangeDiscipline = (d: ClimbDiscipline) => {
    setDiscipline(d);
    setGrade(null); // grade scale changes with discipline
  };

  const onSave = async () => {
    if (!grade) {
      window.alert('Pick a grade — select the grade you climbed.');
      return;
    }
    setSaving(true);
    try {
      const fields = {
        environment,
        discipline,
        grade,
        outcome,
        name: name.trim() || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (climbId) {
        await repo.updateClimb(climbId, fields);
      } else {
        await repo.saveClimb({ ...fields, date: day });
        trackEvent('climb_logged', { discipline, environment, grade, outcome });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title={editing ? 'Edit climb' : 'Log climb'} />
      <Screen>
        <div>
          <p className="mb-2 font-semibold">When</p>
          {editing ? (
            <p>{existingDate ? formatDate(existingDate) : '—'}</p>
          ) : (
            <DayPicker value={day} onChange={setDay} />
          )}
        </div>

        <div>
          <p className="mb-2 font-semibold">Where</p>
          <OptionChips options={ENV_OPTIONS} selected={environment} onSelect={setEnvironment} />
        </div>

        <div>
          <p className="mb-2 font-semibold">Discipline</p>
          <OptionChips
            options={DISCIPLINE_OPTIONS}
            selected={discipline}
            onSelect={onChangeDiscipline}
          />
        </div>

        <div>
          <p className="mb-2 font-semibold">Grade</p>
          <OptionChips options={gradeOptions} selected={grade} onSelect={setGrade} />
        </div>

        <div>
          <p className="mb-2 font-semibold">Outcome</p>
          <OptionChips options={OUTCOME_OPTIONS} selected={outcome} onSelect={setOutcome} />
        </div>

        <div>
          <p className="mb-2 font-semibold">Name (optional)</p>
          <input
            className={inputClass}
            placeholder="Route or problem name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 font-semibold">Location (optional)</p>
          <input
            className={inputClass}
            placeholder="Crag or gym"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 font-semibold">Notes (optional)</p>
          <textarea
            className={`${inputClass} min-h-16`}
            placeholder="Beta, how it felt, conditions…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Log climb'}
        </Button>
      </Screen>
    </>
  );
}
