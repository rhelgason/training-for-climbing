'use client';

import { useEffect, useState } from 'react';
import {
  ABILITY_TIERS,
  ABILITY_TIER_LABELS,
  DISCIPLINES,
  DISCIPLINE_LABELS,
  SESSION_LENGTHS,
  SESSION_LENGTH_LABELS,
  STYLE_FOCUSES,
  STYLE_FOCUS_LABELS,
  effectiveProfile,
  revokeDerivedNote,
  type AbilityTier,
  type ClimbDiscipline,
  type ProfilePatch,
  type ProfileRecord,
  type ProfileSettings,
  type SessionLength,
  type StyleFocus,
} from '@tfc/core';
import { Card } from './Card';
import { EquipmentPicker } from './EquipmentPicker';
import { OptionChips, type ChipOption } from './OptionChips';
import { useRepository, useSync } from '../lib/db/RepositoryProvider';

const TIER_OPTIONS: ChipOption<AbilityTier>[] = ABILITY_TIERS.map((t) => ({
  label: ABILITY_TIER_LABELS[t.id],
  value: t.id,
}));
const DISCIPLINE_OPTIONS: ChipOption<ClimbDiscipline>[] = DISCIPLINES.map((d) => ({
  label: DISCIPLINE_LABELS[d],
  value: d,
}));
const REASSESS_OPTIONS: ChipOption<string>[] = ['4', '6', '8', '12'].map((w) => ({
  label: `${w} wks`,
  value: w,
}));
const AI_OPTIONS: ChipOption<'on' | 'off'>[] = [
  { label: 'On', value: 'on' },
  { label: 'Off', value: 'off' },
];
const STYLE_OPTIONS: ChipOption<StyleFocus>[] = STYLE_FOCUSES.map((s) => ({
  label: STYLE_FOCUS_LABELS[s],
  value: s,
}));
const LENGTH_OPTIONS: ChipOption<SessionLength>[] = SESSION_LENGTHS.map((s) => ({
  label: SESSION_LENGTH_LABELS[s],
  value: s,
}));
const DAYS_OPTIONS: ChipOption<string>[] = ['1', '2', '3', '4', '5', '6'].map((d) => ({
  label: d,
  value: d,
}));

const textareaClass =
  'w-full min-h-32 rounded-xl border border-border bg-surface-alt/60 px-4 py-2.5 text-base text-text placeholder:text-muted focus:border-primary focus:outline-none';

/** Training preferences (formerly the separate Profile screen). */
export function TrainingPreferences() {
  const repo = useRepository();
  const { dataVersion } = useSync();
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  // The raw record too: `derivedContext` isn't a user-editable setting, so it
  // isn't on ProfileSettings, but this is where it has to be reviewable.
  const [profile, setProfile] = useState<ProfileRecord | null>(null);

  useEffect(() => {
    repo.getProfile().then((p) => {
      setSettings(effectiveProfile(p));
      setProfile(p);
    });
  }, [repo, dataVersion]);

  const update = async (patch: ProfilePatch) => {
    const saved = await repo.saveProfile(patch);
    setSettings(effectiveProfile(saved));
    setProfile(saved);
  };

  if (settings === null) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="display text-xl font-bold">Training preferences</h2>
      <p className="-mt-2 text-sm leading-6 text-muted">
        These tailor your daily suggestion, defaults, and reminders.
      </p>

      <Card>
        <p className="mb-2 font-semibold">Ability tier</p>
        <OptionChips
          options={TIER_OPTIONS}
          selected={settings.abilityTier}
          onSelect={(v) => update({ abilityTier: v })}
        />
      </Card>

      <Card>
        <p className="mb-2 font-semibold">Optimising for</p>
        <OptionChips
          options={STYLE_OPTIONS}
          selected={settings.styleFocus}
          onSelect={(v) => update({ styleFocus: v })}
        />
      </Card>

      <Card>
        <p className="mb-1 font-semibold">About you</p>
        <p className="mb-2 text-sm leading-5 text-muted">
          What you climb, injuries you work around, what your gym is like. Your coach reads this
          every day.
        </p>
        {/* Committed on blur, not per keystroke: every save bumps `updatedAt`
            and queues a sync, and a paragraph of typing shouldn't do that. */}
        <textarea
          className={textareaClass}
          defaultValue={settings.climberContext ?? ''}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next !== (settings.climberContext ?? '')) {
              void update({ climberContext: next || undefined });
            }
          }}
        />
      </Card>

      {(profile?.derivedContext?.length ?? 0) > 0 && (
        <Card>
          <p className="mb-1 font-semibold">What the app worked out</p>
          <p className="mb-3 text-sm leading-5 text-muted">
            Things you confirmed when the app asked. Your coach reads these alongside what you wrote
            above. Remove any that no longer apply — a healed finger it keeps training around is
            worse than one it never knew about.
          </p>
          {profile!.derivedContext!.map((note) => (
            <div
              key={note.id}
              className="mt-2 flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-surface-alt/40 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm leading-5">{note.text}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Noted {new Date(note.addedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void update(revokeDerivedNote(note.id, profile))}
                className="shrink-0 py-1 text-sm font-semibold text-danger active:opacity-70"
              >
                Remove
              </button>
            </div>
          ))}
        </Card>
      )}

      <Card>
        <p className="mb-1 font-semibold">Training days per week</p>
        <p className="mb-2 text-sm leading-5 text-muted">
          The budget your plan is built against — it decides when you&apos;re told to rest.
        </p>
        <OptionChips
          options={DAYS_OPTIONS}
          selected={String(settings.daysPerWeek)}
          onSelect={(v) => update({ daysPerWeek: Number(v) })}
        />
      </Card>

      <Card>
        <p className="mb-2 font-semibold">Typical session length</p>
        <OptionChips
          options={LENGTH_OPTIONS}
          selected={settings.sessionLength}
          onSelect={(v) => update({ sessionLength: v })}
        />
      </Card>

      <Card>
        <p className="mb-1 font-semibold">Your equipment</p>
        <p className="mb-3 text-sm leading-5 text-muted">
          What you normally have access to. You&apos;ll never be prescribed something you can&apos;t
          do; change it for a single day from the Train screen.
        </p>
        <EquipmentPicker
          selected={settings.equipment}
          onChange={(equipment) => update({ equipment })}
        />
      </Card>

      <Card>
        <p className="mb-2 font-semibold">Default discipline</p>
        <OptionChips
          options={DISCIPLINE_OPTIONS}
          selected={settings.defaultDiscipline}
          onSelect={(v) => update({ defaultDiscipline: v })}
        />
      </Card>

      <Card>
        <p className="mb-2 font-semibold">Re-assess every</p>
        <p className="mb-2 text-sm leading-5 text-muted">
          How often to nudge you to retake the self-assessment.
        </p>
        <OptionChips
          options={REASSESS_OPTIONS}
          selected={String(settings.reassessWeeks)}
          onSelect={(v) => update({ reassessWeeks: Number(v) })}
        />
      </Card>

      <Card>
        <p className="mb-2 font-semibold">AI coach</p>
        <p className="mb-2 text-sm leading-5 text-muted">
          When on, your daily suggestion is generated by an AI from your assessments, recent
          journals, and climbs. Off uses the built-in rule-based suggestion.
        </p>
        <OptionChips
          options={AI_OPTIONS}
          selected={settings.aiCoachEnabled ? 'on' : 'off'}
          onSelect={(v) => update({ aiCoachEnabled: v === 'on' })}
        />
      </Card>
    </section>
  );
}
