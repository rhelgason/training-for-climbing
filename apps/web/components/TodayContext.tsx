'use client';

/**
 * The one-tap daily check-in that sits above today's plan.
 *
 * Collapsed by default and pre-filled from yesterday's answers (falling back to
 * the profile), so the common case — same gym, feeling normal — costs zero
 * taps. Opening it and changing anything regenerates the plan immediately.
 *
 * This is deliberately not a gate. A climber who ignores it still gets a plan
 * built from sensible defaults; the check-in only makes it sharper.
 */
import { useState } from 'react';
import {
  ENVIRONMENTS,
  ENVIRONMENT_LABELS,
  EQUIPMENT_LABELS,
  READINESS_LABELS,
  READINESS_OPTIONS,
  SESSION_LENGTHS,
  SESSION_LENGTH_LABELS,
  type ClimbEnvironment,
  type EquipmentId,
  type Readiness,
  type SessionLength,
} from '@tfc/core';
import { Card } from './Card';
import { EquipmentPicker } from './EquipmentPicker';
import { OptionChips, type ChipOption } from './OptionChips';

export interface TodayContextValue {
  environment: ClimbEnvironment;
  equipment: EquipmentId[];
  sessionLength: SessionLength;
  readiness: Readiness;
  note?: string;
}

const ENVIRONMENT_OPTIONS: ChipOption<ClimbEnvironment>[] = ENVIRONMENTS.map((e) => ({
  label: ENVIRONMENT_LABELS[e],
  value: e,
}));
const READINESS_CHIPS: ChipOption<Readiness>[] = READINESS_OPTIONS.map((r) => ({
  label: READINESS_LABELS[r],
  value: r,
}));
const LENGTH_CHIPS: ChipOption<SessionLength>[] = SESSION_LENGTHS.map((s) => ({
  label: SESSION_LENGTH_LABELS[s],
  value: s,
}));

const inputClass =
  'w-full rounded-xl border border-border bg-surface-alt/60 px-4 py-2.5 text-base text-text placeholder:text-muted focus:border-primary focus:outline-none';

interface Props {
  value: TodayContextValue;
  onChange: (value: TodayContextValue) => void;
  /** True once the climber has actually confirmed today (vs. inherited defaults). */
  confirmed: boolean;
}

/** A short summary line, e.g. "Indoor · 1–1.5 hours · Fresh · 5 items". */
function summarise(value: TodayContextValue): string {
  const gear =
    value.equipment.length === 1
      ? EQUIPMENT_LABELS[value.equipment[0]]
      : `${value.equipment.length} items`;
  return [
    ENVIRONMENT_LABELS[value.environment],
    SESSION_LENGTH_LABELS[value.sessionLength],
    READINESS_LABELS[value.readiness],
    gear,
  ].join(' · ');
}

export function TodayContext({ value, onChange, confirmed }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(value.note ?? '');
  const set = <K extends keyof TodayContextValue>(key: K, next: TodayContextValue[K]) =>
    onChange({ ...value, [key]: next });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-border/80 bg-surface/70 px-4 py-3 text-left shadow-sm backdrop-blur-sm transition hover:border-muted/40"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wide text-muted">
              Today {confirmed ? '' : '· assumed'}
            </p>
            <p className="truncate text-sm">{summarise(value)}</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-primary">Change</span>
        </div>
      </button>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-wide text-muted">Today</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-semibold text-primary"
        >
          Done
        </button>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Where?</p>
        <OptionChips
          options={ENVIRONMENT_OPTIONS}
          selected={value.environment}
          onSelect={(v) => set('environment', v)}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">How long have you got?</p>
        <OptionChips
          options={LENGTH_CHIPS}
          selected={value.sessionLength}
          onSelect={(v) => set('sessionLength', v)}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">How do you feel?</p>
        <OptionChips
          options={READINESS_CHIPS}
          selected={value.readiness}
          onSelect={(v) => set('readiness', v)}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">What&apos;s available?</p>
        <EquipmentPicker
          selected={value.equipment}
          onChange={(equipment) => set('equipment', equipment)}
          showPresets={false}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Anything else about today?</p>
        {/* Held locally and committed on blur — each commit is a repo write and
            a queued sync, which a per-keystroke handler would fire dozens of. */}
        <input
          className={inputClass}
          placeholder="e.g. at a friend's gym, slept badly"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note.trim() !== (value.note ?? '').trim()) set('note', note.trim() || undefined);
          }}
        />
      </div>
    </Card>
  );
}
