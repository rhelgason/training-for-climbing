'use client';

/**
 * The end of the day, on the same screen as the start of it.
 *
 * "I did this" used to open a separate journal form, and the one sentence the
 * coach most needs — how it felt, what hurt, what got cut — was a page away.
 * Here it's an effort chip and a line of text, then a look at tomorrow so the
 * next session is already decided before they leave the gym.
 */
import { useState } from 'react';
import { INTENSITIES, INTENSITY_LABELS, type JournalIntensity } from '@tfc/core';
import { Card } from './Card';
import { OptionChips, type ChipOption } from './OptionChips';

const EFFORT_OPTIONS: ChipOption<JournalIntensity>[] = INTENSITIES.map((i) => ({
  label: INTENSITY_LABELS[i],
  value: i,
}));

export interface TomorrowPreview {
  label: string;
  detail?: string;
}

interface Props {
  intensity: JournalIntensity;
  note: string;
  tomorrow: TomorrowPreview | null;
  onSave: (intensity: JournalIntensity, note: string) => Promise<void>;
}

export function Debrief({
  intensity: initialIntensity,
  note: initialNote,
  tomorrow,
  onSave,
}: Props) {
  const [intensity, setIntensity] = useState(initialIntensity);
  const [note, setNote] = useState(initialNote);
  // Already written today: show it, and let them reopen it.
  const [editing, setEditing] = useState(!initialNote.trim());
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(intensity, note.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-success">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-wide text-success">Done for today ✓</p>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-semibold text-primary"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <p className="mb-2 text-sm font-semibold">How hard was it?</p>
            <OptionChips options={EFFORT_OPTIONS} selected={intensity} onSelect={setIntensity} />
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">How did it go?</p>
            <textarea
              className="min-h-24 w-full rounded-xl border border-border bg-surface-alt/60 px-4 py-2.5 text-base text-text placeholder:text-muted focus:border-primary focus:outline-none"
              placeholder="Sore spots, sends, where you pumped out, what you ran out of time for. Tomorrow's plan reads this."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-primary-text disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-sm leading-5">
          <span className="font-semibold">{INTENSITY_LABELS[intensity]}.</span>{' '}
          <span className="text-muted">{note}</span>
        </p>
      )}

      {tomorrow && (
        <div className="mt-3 border-t border-border pt-2.5">
          <p className="text-sm font-bold uppercase tracking-wide text-muted">Tomorrow</p>
          <p className="mt-0.5 text-sm font-semibold">{tomorrow.label}</p>
          {tomorrow.detail && (
            <p className="mt-0.5 text-xs leading-4 text-muted">{tomorrow.detail}</p>
          )}
        </div>
      )}
    </Card>
  );
}
