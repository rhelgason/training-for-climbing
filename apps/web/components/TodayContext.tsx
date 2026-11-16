'use client';

/**
 * The one-tap daily check-in that sits above today's plan.
 *
 * Collapsed by default and pre-filled from yesterday's gym and time. Feeling
 * starts at OK and is not carried over. The coach does not run until the
 * climber confirms the row, so a rest-day call cannot go out before they say
 * how today actually feels.
 *
 * While the editor is open every chip edits a local draft. Nothing is saved
 * and nothing reaches the coach until Done: a half-filled check-in ("Indoor,
 * 2 hours, …" before they've said how they feel) is not a picture worth an
 * AI call, and a pause between taps used to be enough to send one.
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
  /** Save the values already on screen, including an unchanged assumed row. */
  onConfirm: () => void;
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

/** True when two check-ins describe the same day. Equipment order doesn't matter. */
function sameDay(a: TodayContextValue, b: TodayContextValue): boolean {
  return (
    a.environment === b.environment &&
    a.sessionLength === b.sessionLength &&
    a.readiness === b.readiness &&
    (a.note ?? '').trim() === (b.note ?? '').trim() &&
    [...a.equipment].sort().join(',') === [...b.equipment].sort().join(',')
  );
}

export function TodayContext({ value, onChange, onConfirm, confirmed }: Props) {
  const [draft, setDraft] = useState<TodayContextValue | null>(null);
  const set = <K extends keyof TodayContextValue>(key: K, next: TodayContextValue[K]) =>
    setDraft((d) => ({ ...(d ?? value), [key]: next }));

  const edit = () => setDraft(value);

  const finish = () => {
    if (!draft) return;
    const next = { ...draft, note: draft.note?.trim() || undefined };
    if (!sameDay(next, value)) onChange(next);
    else if (!confirmed) onConfirm();
    setDraft(null);
  };

  if (!draft) {
    return (
      <div className="w-full rounded-xl border border-border/80 bg-surface/70 px-4 py-3 text-left shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wide text-muted">
              Today {confirmed ? '' : '· not confirmed'}
            </p>
            <p className="truncate text-sm">{summarise(value)}</p>
          </div>
          {confirmed ? (
            <button
              type="button"
              onClick={edit}
              className="shrink-0 text-sm font-semibold text-primary"
            >
              Change
            </button>
          ) : null}
        </div>
        {!confirmed && (
          <>
            <p className="mt-2 text-sm leading-5 text-muted">
              Gym and time are from last time. Feeling starts at OK, not yesterday&apos;s. The coach
              does not run until you confirm this.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-primary-text"
              >
                This is right
              </button>
              <button
                type="button"
                onClick={edit}
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-primary"
              >
                Change
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-wide text-muted">Today</p>
        <button type="button" onClick={finish} className="text-sm font-semibold text-primary">
          Done
        </button>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Where?</p>
        <OptionChips
          options={ENVIRONMENT_OPTIONS}
          selected={draft.environment}
          onSelect={(v) => set('environment', v)}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">How long have you got?</p>
        <OptionChips
          options={LENGTH_CHIPS}
          selected={draft.sessionLength}
          onSelect={(v) => set('sessionLength', v)}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">How do you feel?</p>
        <OptionChips
          options={READINESS_CHIPS}
          selected={draft.readiness}
          onSelect={(v) => set('readiness', v)}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">What&apos;s available?</p>
        <EquipmentPicker
          selected={draft.equipment}
          onChange={(equipment) => set('equipment', equipment)}
          showPresets={false}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Anything else about today?</p>
        <input
          className={inputClass}
          placeholder="e.g. at a friend's gym, slept badly"
          value={draft.note ?? ''}
          onChange={(e) => set('note', e.target.value)}
        />
      </div>
    </Card>
  );
}
