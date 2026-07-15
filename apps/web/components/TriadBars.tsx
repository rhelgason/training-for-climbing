import { TRIAD_AREAS, TRIAD_LABELS, type TriadScores } from '@tfc/core';
import { triadColors } from '../lib/theme';

interface Props {
  scores: TriadScores;
  maxPerArea: TriadScores;
  weakestArea?: string;
}

/** Horizontal bar chart of the three triad scores (no external chart dep). */
export function TriadBars({ scores, maxPerArea, weakestArea }: Props) {
  return (
    <div>
      {TRIAD_AREAS.map((area) => {
        const value = scores[area];
        const max = maxPerArea[area] || 1;
        const pct = Math.max(0, Math.min(100, (value / max) * 100));
        const isWeakest = area === weakestArea;
        return (
          <div key={area} className="mb-4">
            <div className="mb-1 flex flex-row justify-between">
              <span className="text-base font-semibold">
                {TRIAD_LABELS[area]}
                {isWeakest ? '  ·  weakest' : ''}
              </span>
              <span className="text-sm text-muted">
                {value}/{max}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-sm bg-surface-alt">
              <div
                className={`h-full rounded-sm ${isWeakest ? 'border border-warning' : ''}`}
                style={{ width: `${pct}%`, backgroundColor: triadColors[area] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
