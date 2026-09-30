'use client';

/**
 * Indoor and outdoor bests in one card. Three stacked disciplines, two columns
 * each — a phone-width column, not six tiles that wrap.
 */
import { DISCIPLINE_LABELS, personalBests, type ClimbOutcome, type ClimbRecord } from '@tfc/core';
import { Card } from './Card';

/** Short on purpose. "Send (redpoint)" does not fit half a phone card. */
const SHORT_OUTCOME: Record<ClimbOutcome, string> = {
  onsight: 'Onsight',
  flash: 'Flash',
  send: 'Redpoint',
  repeat: 'Repeat',
  attempt: 'Attempt',
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function BestCell({ label, climb }: { label: string; climb: ClimbRecord | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      {climb ? (
        <>
          <p className="break-words text-2xl font-bold leading-tight text-primary">{climb.grade}</p>
          <p className="text-xs leading-4 text-muted">{SHORT_OUTCOME[climb.outcome]}</p>
          <p className="text-xs leading-4 text-muted">{formatDate(climb.date)}</p>
        </>
      ) : (
        <p
          className="text-2xl font-bold text-muted/50"
          aria-label={`No ${label.toLowerCase()} send`}
        >
          —
        </p>
      )}
    </div>
  );
}

export function PersonalBests({ climbs }: { climbs: ClimbRecord[] }) {
  const rows = personalBests(climbs);
  if (rows.length === 0) {
    return <p className="text-muted">Log a send to see your hardest grades here.</p>;
  }
  return (
    <Card>
      {rows.map((row, i) => (
        <div
          key={row.discipline}
          className={i > 0 ? 'mt-4 border-t border-border pt-4' : undefined}
        >
          <p className="text-sm font-bold uppercase tracking-wide text-muted">
            {DISCIPLINE_LABELS[row.discipline]}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <BestCell label="Indoor" climb={row.indoor} />
            <BestCell label="Outdoor" climb={row.outdoor} />
          </div>
        </div>
      ))}
    </Card>
  );
}
