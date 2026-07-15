'use client';

export interface ChipOption<T extends string> {
  label: string;
  value: T;
}

interface Props<T extends string> {
  options: ChipOption<T>[];
  /** Selected value(s). For single-select pass the value or null. */
  selected: T | T[] | null;
  onSelect: (value: T) => void;
}

/** A wrapping row of selectable chips. Works for single- or multi-select. */
export function OptionChips<T extends string>({ options, selected, onSelect }: Props<T>) {
  const isSelected = (value: T) =>
    Array.isArray(selected) ? selected.includes(value) : selected === value;

  return (
    <div className="flex flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const active = isSelected(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(opt.value)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              active
                ? 'border-primary bg-primary text-primary-text'
                : 'border-border bg-surface-alt text-muted'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
