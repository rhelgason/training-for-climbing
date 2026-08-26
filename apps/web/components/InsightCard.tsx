'use client';

/**
 * A proposal to update the training profile, shown where the climber already is.
 *
 * The reason this exists on the Train screen rather than in settings is the
 * whole point of the feature: nobody opens settings to say they've got stronger
 * or that a finger hurts. It has to arrive on the screen they open anyway, and
 * be one tap either way.
 *
 * Accept and Dismiss are equally weighted on purpose. This is not a nudge to be
 * dark-patterned into — the app is asking to change what it tells someone to do
 * with their body, and declining has to be as easy as agreeing.
 */
import type { Insight } from '@tfc/core';
import { Button } from './Button';
import { Card } from './Card';

interface Props {
  insight: Insight;
  onAccept: (insight: Insight) => void;
  onDismiss: (insight: Insight) => void;
  busy?: boolean;
}

export function InsightCard({ insight, onAccept, onDismiss, busy }: Props) {
  return (
    <Card className="border-primary/60">
      <p className="text-sm font-bold uppercase tracking-wide text-muted">
        {insight.source === 'history' ? 'From your logged climbs' : 'From your journal'}
      </p>
      <p className="mt-1 font-semibold">{insight.title}</p>
      <p className="mt-1 text-sm leading-5 text-muted">{insight.detail}</p>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => onAccept(insight)} disabled={busy}>
          {insight.kind === 'ability-tier' ? 'Update my profile' : 'Yes, remember this'}
        </Button>
        <Button variant="secondary" onClick={() => onDismiss(insight)} disabled={busy}>
          Not right
        </Button>
      </div>
    </Card>
  );
}
