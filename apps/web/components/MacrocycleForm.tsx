'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatYmd, parseYmd, trackEvent, validatePeriodInput } from '@tfc/core';
import { Button } from './Button';
import { Screen } from './Screen';
import { PageHeader } from './PageHeader';
import { useRepository } from '../lib/db/RepositoryProvider';

const inputClass =
  'w-full rounded-md border border-border bg-surface-alt px-4 py-2 text-base text-text placeholder:text-muted';

export function MacrocycleForm({ periodId }: { periodId?: string }) {
  const repo = useRepository();
  const router = useRouter();
  const editing = Boolean(periodId);

  const [label, setLabel] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [focus, setFocus] = useState('');
  const [objective, setObjective] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!periodId) return;
    repo.getMacrocyclePeriod(periodId).then((p) => {
      if (!p) return;
      setLabel(p.label);
      setStart(formatYmd(p.startDate));
      setEnd(formatYmd(p.endDate));
      setFocus(p.focus ?? '');
      setObjective(p.objective ?? '');
      setNotes(p.notes ?? '');
    });
  }, [periodId, repo]);

  const onSave = async () => {
    const startDate = parseYmd(start);
    const endDate = parseYmd(end);
    const validation = validatePeriodInput({ label, startDate, endDate });
    if (!validation.valid) {
      window.alert(`Check the period\n\n${validation.errors.join('\n')}`);
      return;
    }
    setSaving(true);
    try {
      const fields = {
        label: label.trim(),
        startDate: startDate as number,
        endDate: endDate as number,
        focus: focus.trim() || undefined,
        objective: objective.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (periodId) {
        await repo.updateMacrocyclePeriod(periodId, fields);
      } else {
        await repo.saveMacrocyclePeriod(fields);
        trackEvent('macrocycle_period_created');
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title={editing ? 'Edit period' : 'New period'} />
      <Screen>
        <div>
          <p className="mb-2 font-semibold">Label</p>
          <input
            className={inputClass}
            placeholder="e.g. Winter base"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <p className="mb-2 font-semibold">Start (YYYY-MM-DD)</p>
            <input
              className={inputClass}
              placeholder="2026-01-01"
              autoCapitalize="none"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <p className="mb-2 font-semibold">End (YYYY-MM-DD)</p>
            <input
              className={inputClass}
              placeholder="2026-03-31"
              autoCapitalize="none"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 font-semibold">Training focus (optional)</p>
          <input
            className={inputClass}
            placeholder="e.g. Max strength & power"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 font-semibold">Climbing objective (optional)</p>
          <input
            className={inputClass}
            placeholder="e.g. Send a 5.12 on the spring trip"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 font-semibold">Notes / achievements (optional)</p>
          <textarea
            className={`${inputClass} min-h-16`}
            placeholder="Plan details and what you accomplished"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save period'}
        </Button>
      </Screen>
    </>
  );
}
