'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ACTIVITY_LABELS,
  INTENSITY_LABELS,
  buildDailyRecommendation,
  dayIndex,
  effectiveProfile,
  flaggedPromptsForArea,
  isOnboarded,
  loadHistory,
  now,
  relativeTime,
  sessionFocus,
  trackEvent,
  trainingDates,
  type DailyRecommendation,
  type JournalEntry,
  type JournalIntensity,
  type SessionFocusId,
} from '@tfc/core';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { GettingStarted, type OnboardingStep } from '../../components/GettingStarted';
import { BackupBanner } from '../../components/BackupBanner';
import { TodayContext } from '../../components/TodayContext';
import { WhyThisPlan } from '../../components/WhyThisPlan';
import { useRepository, useSync } from '../../lib/db/RepositoryProvider';
import { useCoach } from '../../lib/coach/useCoach';
import { useBackupNudge } from '../../lib/auth/useBackupNudge';
import { useOnboarding } from '../../lib/onboarding/useOnboarding';
import { useDailyContext } from '../../lib/today/useDailyContext';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function greeting(nowMs: number): string {
  const h = new Date(nowMs).getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
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
  const { dataVersion } = useSync();
  const router = useRouter();
  const [state, setState] = useState<LoadState | null>(null);
  const backup = useBackupNudge();
  const onboarding = useOnboarding();
  const daily = useDailyContext(repo, dataVersion);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [marking, setMarking] = useState(false);

  const today = daily.value;
  // Fingerprints today's context for the coach cache — changing any of these
  // makes yesterday's AI advice wrong, so it forces a regeneration.
  const contextKey = today
    ? [
        dayIndex(now()),
        today.environment,
        today.sessionLength,
        today.readiness,
        [...today.equipment].sort().join(','),
      ].join('|')
    : undefined;
  const coach = useCoach(repo, contextKey);

  const sendFeedback = (rating: 'up' | 'down') => {
    setFeedback(rating);
    trackEvent('coach_feedback', { rating });
  };

  /**
   * Record today as done with the focus that was actually prescribed.
   *
   * This is the step that keeps tomorrow honest. Without it the scheduler has
   * to *infer* load from activity tags; with it, "yesterday was max strength"
   * is a fact, and the 48-hour rule can be enforced rather than guessed at.
   */
  const markDone = async () => {
    if (!state || marking) return;
    const { recommendation: plan, todayJournalId } = state;
    const focus = [plan.focus, ...plan.supportingFocuses].filter(Boolean) as SessionFocusId[];
    const intensity: JournalIntensity = plan.focus
      ? sessionFocus(plan.focus).intensity === 'high'
        ? 'hard'
        : sessionFocus(plan.focus).intensity === 'low'
          ? 'easy'
          : 'moderate'
      : 'easy';
    setMarking(true);
    try {
      let journalId = todayJournalId;
      if (journalId) {
        await repo.updateJournal(journalId, { focus, intensity });
      } else {
        const saved = await repo.saveJournal({
          date: now(),
          activities: plan.kind === 'rest' ? ['rest'] : ['climbing'],
          focus: plan.kind === 'rest' ? ['rest'] : focus,
          intensity: plan.kind === 'rest' ? 'easy' : intensity,
        });
        journalId = saved.id;
      }
      trackEvent('plan_completed', { focus: plan.focus ?? 'rest', kind: plan.kind });
      // Open the log so they can add the free text the coach reads tomorrow.
      router.push(`/train/journal/${journalId}`);
    } finally {
      setMarking(false);
    }
  };

  useEffect(() => {
    // Wait for today's context — the plan is built from it, and rendering a
    // plan that then changes under the reader is worse than a beat of delay.
    if (!today) return;
    let on = true;
    Promise.all([
      repo.listJournals(),
      repo.listClimbs(),
      repo.listAssessments(),
      repo.listGoals(),
      repo.getProfile(),
    ]).then(([journals, climbs, assessments, goals, profile]) => {
      if (!on) return;
      const nowMs = now();

      // A brand-new install with nothing in it goes through guided sign-up.
      // Existing users predate `onboardedAt`, so their data is what protects
      // them from being dropped into the wizard.
      const empty =
        journals.length === 0 &&
        climbs.length === 0 &&
        assessments.length === 0 &&
        goals.length === 0;
      if (!isOnboarded(profile) && empty) {
        router.replace('/welcome');
        return;
      }

      const settings = effectiveProfile(profile);
      const latest = assessments[0] ?? null;
      const weakestArea = latest?.weakestArea ?? null;
      const recommendation = buildDailyRecommendation({
        weakestArea,
        weakSpots:
          latest && weakestArea ? flaggedPromptsForArea(latest.responses, weakestArea) : [],
        goals,
        trainingDates: trainingDates(journals, climbs),
        nowMs,
        history: loadHistory(journals, climbs),
        abilityTier: settings.abilityTier,
        styleFocus: settings.styleFocus,
        daysPerWeek: settings.daysPerWeek,
        equipment: today.equipment,
        readiness: today.readiness,
        sessionLength: today.sessionLength,
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
  }, [repo, dataVersion, router, today]);

  if (state === null || today === null) return <Screen />;
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">{greeting(now())}</p>
          <h1 className="display text-3xl font-extrabold">
            Let’s <span className="text-gradient">train</span>
          </h1>
        </div>
        {rec.streak > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-3 py-1.5 text-sm font-bold text-warning">
            🔥 {rec.streak}
            <span className="hidden sm:inline">-day{rec.streak >= 7 ? ' 🔥' : ''}</span>
          </span>
        )}
      </div>

      {showOnboarding && <GettingStarted steps={onboardingSteps} onDismiss={onboarding.dismiss} />}

      {backup.visible && <BackupBanner onDismiss={backup.dismiss} />}

      <TodayContext value={today} onChange={daily.update} confirmed={daily.confirmed} />

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

      <WhyThisPlan microcycle={rec.microcycle} because={rec.because} />

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

      <Button onClick={markDone} disabled={marking}>
        {marking
          ? 'Saving…'
          : rec.kind === 'rest'
            ? 'Log today as a rest day'
            : 'I did this — log it'}
      </Button>

      <Link href={todayJournalId ? `/train/journal/${todayJournalId}` : '/train/journal/new'}>
        <Button variant="secondary">
          {todayJournalId ? "Edit today's log" : 'Log something else'}
        </Button>
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
