'use client';

import { EQUIPMENT_IDS, EQUIPMENT_LABELS, EQUIPMENT_PRESETS, type EquipmentId } from '@tfc/core';
import { OptionChips, type ChipOption } from './OptionChips';

const EQUIPMENT_OPTIONS: ChipOption<EquipmentId>[] = EQUIPMENT_IDS.map((id) => ({
  label: EQUIPMENT_LABELS[id],
  value: id,
}));

interface Props {
  selected: EquipmentId[];
  onChange: (equipment: EquipmentId[]) => void;
  /** Hide the preset row when the picker is used for a one-off day. */
  showPresets?: boolean;
}

/**
 * Multi-select equipment picker with one-tap presets.
 *
 * Presets exist because a twelve-item checklist is exactly the kind of setup
 * friction that stops people finishing sign-up — most climbers can pick "full
 * climbing gym" and be done, then adjust one or two chips.
 */
export function EquipmentPicker({ selected, onChange, showPresets = true }: Props) {
  const toggle = (id: EquipmentId) =>
    onChange(selected.includes(id) ? selected.filter((e) => e !== id) : [...selected, id]);

  return (
    <div className="flex flex-col gap-3">
      {showPresets && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">Start from a preset, then adjust:</p>
          <div className="flex flex-row flex-wrap gap-2">
            {EQUIPMENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange([...preset.equipment])}
                title={preset.description}
                className="rounded-lg border border-border bg-surface-alt/60 px-3 py-1.5 text-sm font-semibold text-muted transition hover:border-primary hover:text-text"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <OptionChips options={EQUIPMENT_OPTIONS} selected={selected} onSelect={toggle} />
      {selected.length === 0 && (
        <p className="text-sm italic text-muted">
          Nothing selected — you&apos;ll only get bodyweight and mobility work.
        </p>
      )}
    </div>
  );
}
