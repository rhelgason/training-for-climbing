'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FITNESS_TESTS, now, trackEvent, type NewBenchmark } from '@tfc/core';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { PageHeader } from '@/components/PageHeader';
import { TestTimer } from '@/components/session/TestTimer';
import { useRepository } from '@/lib/db/RepositoryProvider';

/** Tests the app can time, so the result fills itself in. */
const TIMED: Record<string, 'stopwatch' | 'repeaters'> = {
  'finger-endurance-repeaters': 'repeaters',
  'finger-endurance-hang': 'stopwatch',
  'rope-climb-power': 'stopwatch',
  'campus-ladder-power': 'stopwatch',
};

/** Ratio = added weight ÷ body weight, to two places. */
function ratio(addedLb: number, bodyWeightLb: number): number {
  return Math.round((addedLb / bodyWeightLb) * 100) / 100;
}

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
  /** Latest recorded body weight, which the ratio tests divide by. */
  const [lastWeight, setLastWeight] = useState<number | null>(null);
  const [weight, setWeight] = useState('');

  useEffect(() => {
    let on = true;
    repo.listBodyWeights().then((weights) => {
      const latest = [...weights].sort((a, b) => b.date - a.date)[0];
      if (!on || !latest) return;
      setLastWeight(latest.lb);
      setWeight(String(latest.lb));
    });
    return () => {
      on = false;
    };
  }, [repo]);
  const bodyWeight = parseValue(weight);

  const set = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const onSave = async () => {
    setSaving(true);
    try {
      const date = now();
      if (bodyWeight !== null && bodyWeight > 0 && bodyWeight !== lastWeight) {
        await repo.saveBodyWeight({ date, lb: bodyWeight });
      }
      const toSave: NewBenchmark[] = [];
      for (const test of FITNESS_TESTS) {
        if (test.bilateral) {
          const left = parseValue(values[`${test.id}:left`]);
          const right = parseValue(values[`${test.id}:right`]);
          if (left !== null) toSave.push({ testId: test.id, side: 'left', value: left, date });
          if (right !== null) toSave.push({ testId: test.id, side: 'right', value: right, date });
        } else if (test.unit === 'ratio' && bodyWeight) {
          const added = parseValue(values[test.id]);
          if (added !== null)
            toSave.push({ testId: test.id, value: ratio(added, bodyWeight), date });
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

        <div>
          <p className="font-bold">Body weight (lb)</p>
          <p className="mt-1 text-sm leading-5 text-muted">
            The strength tests are a share of it, so weigh in on test day.
          </p>
          <NumberField value={weight} onChange={setWeight} />
        </div>

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
            ) : test.unit === 'ratio' && bodyWeight ? (
              <>
                <p className="mt-2 text-sm text-muted">Added weight (lb)</p>
                <NumberField value={values[test.id] ?? ''} onChange={(v) => set(test.id, v)} />
                {parseValue(values[test.id]) !== null ? (
                  <p className="mt-1 text-sm font-semibold text-primary">
                    = {ratio(parseValue(values[test.id])!, bodyWeight).toFixed(2)} × body weight
                  </p>
                ) : null}
              </>
            ) : (
              <>
                {TIMED[test.id] ? (
                  <TestTimer mode={TIMED[test.id]} onResult={(sec) => set(test.id, String(sec))} />
                ) : null}
                <NumberField value={values[test.id] ?? ''} onChange={(v) => set(test.id, v)} />
              </>
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
