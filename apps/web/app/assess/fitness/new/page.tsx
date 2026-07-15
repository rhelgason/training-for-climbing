'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FITNESS_TESTS, now, trackEvent, type NewBenchmark } from '@tfc/core';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { PageHeader } from '@/components/PageHeader';
import { useRepository } from '@/lib/db/RepositoryProvider';

const inputClass =
  'w-full rounded-md border border-border bg-surface-alt px-4 py-2 text-base text-text placeholder:text-muted';

function parseValue(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : null;
}

function NumberField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      className={`${inputClass} mt-2`}
      placeholder="—"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function FitnessFormScreen() {
  const repo = useRepository();
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const onSave = async () => {
    setSaving(true);
    try {
      const date = now();
      const toSave: NewBenchmark[] = [];
      for (const test of FITNESS_TESTS) {
        if (test.bilateral) {
          const left = parseValue(values[`${test.id}:left`]);
          const right = parseValue(values[`${test.id}:right`]);
          if (left !== null) toSave.push({ testId: test.id, side: 'left', value: left, date });
          if (right !== null) toSave.push({ testId: test.id, side: 'right', value: right, date });
        } else {
          const v = parseValue(values[test.id]);
          if (v !== null) toSave.push({ testId: test.id, value: v, date });
        }
      }
      for (const b of toSave) {
        await repo.saveBenchmark(b);
        trackEvent('benchmark_recorded', { testId: b.testId });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Record evaluation" />
      <Screen>
        <p className="text-base text-muted">
          Enter the tests you completed today; leave the rest blank.
        </p>

        {FITNESS_TESTS.map((test) => (
          <div key={test.id}>
            <p className="font-bold">{test.name}</p>
            <p className="mt-1 text-sm leading-5 text-muted">{test.instructions}</p>
            <p className="mt-1 text-sm italic text-muted">
              {test.metric} ({test.unit})
            </p>
            {test.bilateral ? (
              <div className="flex flex-row gap-4">
                <div className="flex-1">
                  <p className="mt-2 text-sm text-muted">Left</p>
                  <NumberField
                    value={values[`${test.id}:left`] ?? ''}
                    onChange={(v) => set(`${test.id}:left`, v)}
                  />
                </div>
                <div className="flex-1">
                  <p className="mt-2 text-sm text-muted">Right</p>
                  <NumberField
                    value={values[`${test.id}:right`] ?? ''}
                    onChange={(v) => set(`${test.id}:right`, v)}
                  />
                </div>
              </div>
            ) : (
              <NumberField value={values[test.id] ?? ''} onChange={(v) => set(test.id, v)} />
            )}
          </div>
        ))}

        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save results'}
        </Button>
      </Screen>
    </>
  );
}
