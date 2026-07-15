'use client';

interface Props {
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

/** A 0..5 rating selector rendered as a row of selectable chips. */
export function RatingSelector({ value, onChange, min = 0, max = 5 }: Props) {
  const options: number[] = [];
  for (let i = min; i <= max; i += 1) options.push(i);
  return (
    <div className="flex flex-row gap-2">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt)}
            className={`flex aspect-square max-w-12 flex-1 items-center justify-center rounded-sm border text-base font-semibold transition ${
              selected
                ? 'border-primary bg-primary text-primary-text'
                : 'border-border bg-surface-alt text-muted'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
