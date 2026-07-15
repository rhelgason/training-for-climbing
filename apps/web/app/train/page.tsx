'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ACTIVITY_LABELS,
  INTENSITY_LABELS,
  buildDailyRecommendation,
  dayIndex,
  flaggedPromptsForArea,
  now,
  relativeTime,
  trackEvent,
  trainingDates,
  type DailyRecommendation,
  type JournalEntry,
} from '@tfc/core';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { GettingStarted, type OnboardingStep } from '../../components/GettingStarted';
import { BackupBanner } from '../../components/BackupBanner';
import { useRepository } from '../../lib/db/RepositoryProvider';
import { useCoach } from '../../lib/coach/useCoach';
import { useBackupNudge } from '../../lib/auth/useBackupNudge';
import { useOnboarding } from '../../lib/onboarding/useOnboarding';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

interface LoadState {
  journals: JournalEntry[];
  recommendation: DailyRecommendation;
  todayJournalId: string | null;
  hasAssessment: boolean;
  hasGoal: boolean;
}

export default function TrainHome() {
  const repo = useRepository();
  const router = useRouter();
  const [state, setState] = useState<LoadState | null>(null);
  const coach = useCoach(repo);
  const backup = useBackupNudge();
  const onboarding = useOnboarding();
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const sendFeedback = (rating: 'up' | 'down') => {
    setFeedback(rating);
    trackEvent('coach_feedback', { rating });
  };

  useEffect(() => {
    let on = true;
    Promise.all([
      repo.listJournals(),
      repo.listClimbs(),
      repo.listAssessments(),
      repo.listGoals(),
    ]).then(([journals, climbs, assessments, goals]) => {
      if (!on) return;
      const nowMs = now();
      const latest = assessments[0] ?? null;
      const weakestArea = latest?.weakestArea ?? null;
      const recommendation = buildDailyRecommendation({
        weakestArea,
        weakSpots:
          latest && weakestArea ? flaggedPromptsForArea(latest.responses, weakestArea) : [],
        goals,
        trainingDates: trainingDates(journals, climbs),
        nowMs,
      });
      const todayJournal = journals.find((j) => dayIndex(j.date) === dayIndex(nowMs));
      setState({
        journals,
        recommendation,
        todayJournalId: todayJournal?.id ?? null,
        hasAssessment: assessments.length > 0,
        hasGoal: goals.length > 0,
      });
    });
    return () => {
      on = false;
    };
  }, [repo]);

  if (state === null) return <Screen />;
  const { journals, recommendation: rec, todayJournalId, hasAssessment, hasGoal } = state;
  const ai = coach.suggestion;

  const onboardingSteps: OnboardingStep[] = [
    {
      key: 'assess',
      label: 'Take the self-assessment',
      done: hasAssessment,
      onClick: () => router.push('/assess/new'),
    },
    {
      key: 'goal',
      label: 'Set your first goal',
      done: hasGoal,
      onClick: () => router.push('/plan/goals/new'),
    },
    {
      key: 'journal',
      label: 'Log your first day',
      done: journals.length > 0,
      onClick: () => router.push('/train/journal/new'),
    },
  ];
  const showOnboarding = !onboarding.dismissed && onboardingSteps.some((s) => !s.done);

  const planSteps = ai ? ai.plan : rec.plan;
  const cardBorder = ai
    ? 'border-success'
    : rec.kind === 'rest'
      ? 'border-warning'
      : 'border-primary';

  return (
    <Screen>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Train</h1>
        {rec.streak > 0 && (
          <span className="rounded-full bg-surface-alt px-4 py-1 text-sm font-bold text-warning">
            🔥 {rec.streak}-day streak{rec.streak >= 7 ? ' — on fire!' : ''}
          </span>
        )}
      </div>

      {showOnboarding && <GettingStarted steps={onboardingSteps} onDismiss={onboarding.dismiss} />}

      {backup.visible && <BackupBanner onDismiss={backup.dismiss} />}

      <Card className={cardBorder}>
        <div className="flex items-center justify-between">
          <span
            className={`text-sm font-bold uppercase tracking-wide ${ai ? 'text-success' : 'text-muted'}`}
          >
            {ai ? 'AI coach' : 'Today'}
          </span>
          {coach.status === 'loading' ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-success" />
          ) : ai && coach.generatedAt ? (
            <span className="text-sm text-muted">
              updated {relativeTime(coach.generatedAt, now())}
            </span>
          ) : null}
        </div>
        <h2 className="mt-1 text-lg font-bold">{ai ? ai.headline : rec.headline}</h2>
        <p className="mt-2 text-sm leading-5 text-muted">
          {ai ? ai.rationale || rec.detail : rec.detail}
        </p>

        {planSteps.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">
              Today&apos;s plan
            </p>
            {planSteps.map((step, i) => (
              <div key={i} className="mt-1 flex">
                <span className="w-5 text-sm font-bold text-primary">{i + 1}</span>
                <span className="flex-1 text-sm leading-5">{step}</span>
              </div>
            ))}
          </div>
        )}

        {!ai && rec.focusItems.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-muted">Target your weak spots</p>
            {rec.focusItems.map((item) => (
              <p key={item} className="mt-1 text-sm">
                • {item}
              </p>
            ))}
          </div>
        )}

        {ai && ai.watchOuts.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-muted">Watch out for</p>
            {ai.watchOuts.map((w) => (
              <p key={w} className="mt-1 text-sm">
                • {w}
              </p>
            ))}
          </div>
        )}

        {rec.goalReminders.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-muted">Keep in mind</p>
            {rec.goalReminders.map((g) => (
              <p key={g} className="mt-1 text-sm">
                • {g}
              </p>
            ))}
          </div>
        )}

        {ai && (
          <div className="mt-4 flex items-center gap-4 border-t border-border pt-2">
            {feedback ? (
              <span className="text-sm italic text-muted">
                Thanks — this helps tune your coach.
              </span>
            ) : (
              <>
                <span className="text-sm text-muted">Was this helpful?</span>
                <button type="button" onClick={() => sendFeedback('up')} className="text-lg">
                  👍
                </button>
                <button type="button" onClick={() => sendFeedback('down')} className="text-lg">
                  👎
                </button>
              </>
            )}
          </div>
        )}
      </Card>

      {coach.enabled && (
        <Button variant="secondary" onClick={coach.refresh} disabled={coach.status === 'loading'}>
          {coach.status === 'loading'
            ? 'Asking your coach…'
            : ai
              ? 'Refresh AI suggestion'
              : 'Get AI suggestion'}
        </Button>
      )}
      {coach.status === 'error' && (
        <p className="text-sm italic text-muted">
          Couldn&apos;t reach your coach — showing the built-in plan instead.
        </p>
      )}

      <Link href={todayJournalId ? `/train/journal/${todayJournalId}` : '/train/journal/new'}>
        <Button>{todayJournalId ? "Edit today's log" : '+ Log today'}</Button>
      </Link>
      <Link href="/train/energy-emotion">
        <Button variant="secondary">Energy &amp; emotion check-in</Button>
      </Link>
      <Link href="/train/exercises">
        <Button variant="secondary">Exercise library</Button>
      </Link>

      <h2 className="mt-2 text-lg font-bold">Recent</h2>
      {journals.length === 0 ? (
        <p className="text-muted">No entries yet — log your day to start the streak.</p>
      ) : (
        journals.slice(0, 20).map((j) => (
          <Link key={j.id} href={`/train/journal/${j.id}`}>
            <Card>
              <div className="flex justify-between">
                <span className="font-semibold">{formatDate(j.date)}</span>
                {j.intensity ? (
                  <span className="text-sm text-muted">{INTENSITY_LABELS[j.intensity]}</span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-primary">
                {j.activities.length > 0
                  ? j.activities.map((a) => ACTIVITY_LABELS[a]).join(' · ')
                  : 'No activities'}
              </p>
              {j.summary ? (
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{j.summary}</p>
              ) : null}
            </Card>
          </Link>
        ))
      )}
    </Screen>
  );
}
