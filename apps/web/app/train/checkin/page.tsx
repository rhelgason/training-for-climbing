'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EMOTION_MAX,
  EMOTION_MIN,
  ENERGY_MAX,
  ENERGY_MIN,
  now,
  quadrantOf,
  trackEvent,
} from '@tfc/core';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { OptionChips, type ChipOption } from '@/components/OptionChips';
import { Screen } from '@/components/Screen';
import { DayPicker } from '@/components/DayPicker';
import { PageHeader } from '@/components/PageHeader';
import { useRepository } from '@/lib/db/RepositoryProvider';

const inputClass =
  'w-full rounded-md border border-border bg-surface-alt px-4 py-2 text-base text-text placeholder:text-muted';

function numberChips(min: number, max: number): ChipOption<string>[] {
  const out: ChipOption<string>[] = [];
  for (let i = min; i <= max; i += 1) out.push({ label: String(i), value: String(i) });
  return out;
}

const ENERGY_OPTIONS = numberChips(ENERGY_MIN, ENERGY_MAX);
const EMOTION_OPTIONS = numberChips(EMOTION_MIN, EMOTION_MAX);

export default function CheckinFormScreen() {
  const repo = useRepository();
  const router = useRouter();
  const [energy, setEnergy] = useState(5);
  const [emotion, setEmotion] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [day, setDay] = useState(() => now());

  const quadrant = quadrantOf(energy, emotion);

  const onSave = async () => {
    setSaving(true);
    try {
      await repo.saveCheckin({ time: day, energy, emotion, note: note.trim() || undefined });
      trackEvent('checkin_logged', { quadrant: quadrant.id });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Log check-in" />
      <Screen>
        <p className="font-semibold">When</p>
        <DayPicker value={day} onChange={setDay} disabled={saving} />

        <p className="mt-4 font-semibold">Physical energy</p>
        <p className="-mt-2 mb-2 text-sm text-muted">0 = depleted · 10 = peak</p>
        <OptionChips
          options={ENERGY_OPTIONS}
          selected={String(energy)}
          onSelect={(v) => setEnergy(Number(v))}
        />

        <p className="mt-4 font-semibold">Emotional mind-set</p>
        <p className="-mt-2 mb-2 text-sm text-muted">−5 = very negative · +5 = very positive</p>
        <OptionChips
          options={EMOTION_OPTIONS}
          selected={String(emotion)}
          onSelect={(v) => setEmotion(Number(v))}
        />

        <Card className={quadrant.optimal ? 'border-success' : ''}>
          <p className="font-bold">
            Quadrant {quadrant.id} — {quadrant.label}
          </p>
          <p className="mt-1 text-sm leading-5 text-muted">
            {quadrant.optimal
              ? 'This is the performance zone — high energy and a positive mind-set.'
              : 'Notice what put you here; it’s a cue to manage your energy or mind-set.'}
          </p>
        </Card>

        <div>
          <p className="mb-2 font-semibold">Note / trigger (optional)</p>
          <textarea
            className={`${inputClass} min-h-16`}
            placeholder="What’s driving this energy or mood?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Log check-in'}
        </Button>
      </Screen>
    </>
  );
}
