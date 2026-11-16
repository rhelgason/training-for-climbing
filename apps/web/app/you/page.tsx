'use client';

/**
 * You — everything the daily plan is built from, on one page.
 *
 * This replaces the separate Assess and Plan tabs. A new climber could not
 * tell those apart from the daily tracker, and nothing on them said what it
 * did to the plan. Here each input says, once, what it changes, and the ones
 * that are missing say what they would unlock. The book's machinery behind
 * them (hierarchy, splits, block rules) is the scheduler's job, not a screen.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ABILITY_TIER_LABELS,
  STYLE_FOCUS_LABELS,
  TRIAD_LABELS,
  activeGoals,
  dayIndex,
  effectiveProfile,
  mesocycleAnchor,
  now,
  reassessDue,
  relativeTime,
  resolveTrainingBlock,
  retestDue,
  trainingDates,
  type AssessmentRecord,
  type GoalRecord,
  type ProfileRecord,
} from '@tfc/core';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useRepository, useSync } from '@/lib/db/RepositoryProvider';

interface LoadState {
  profile: ProfileRecord | null;
  assessment: AssessmentRecord | null;
  assessDue: boolean;
  testsLogged: number;
  testDue: boolean;
  goals: GoalRecord[];
  block: { label: string; daysRemaining: number; planned: boolean };
}

function Section({
  title,
  href,
  action,
  missing,
  children,
}: {
  title: string;
  href: string;
  action: string;
  /** Not set up yet: drawn as a prompt rather than a summary. */
  missing?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="block">
      <Card interactive className={missing ? 'border-primary/60' : undefined}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="shrink-0 text-sm font-semibold text-primary">{action} →</span>
        </div>
        <div className="mt-1 text-sm leading-6 text-muted">{children}</div>
      </Card>
    </Link>
  );
}

export default function YouPage() {
  const repo = useRepository();
  const { dataVersion } = useSync();
  const [state, setState] = useState<LoadState | null>(null);

  useEffect(() => {
    let on = true;
    Promise.all([
      repo.getProfile(),
      repo.listAssessments(),
      repo.listBenchmarks(),
      repo.listGoals(),
      repo.listMacrocyclePeriods(),
      repo.listJournals(),
      repo.listClimbs(),
    ]).then(([profile, assessments, benchmarks, goals, periods, journals, climbs]) => {
      if (!on) return;
      const nowMs = now();
      const settings = effectiveProfile(profile);
      const dates = trainingDates(journals, climbs);
      const block = resolveTrainingBlock(
        periods,
        nowMs,
        mesocycleAnchor(profile, dates.length > 0 ? Math.min(...dates) : null, nowMs),
      );
      const latest = [...assessments].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
      setState({
        profile,
        assessment: latest,
        assessDue: reassessDue(assessments, nowMs, settings.reassessWeeks),
        testsLogged: new Set(benchmarks.map((b) => b.testId)).size,
        testDue: benchmarks.length > 0 && retestDue(benchmarks, nowMs),
        goals: activeGoals(goals),
        block: {
          label: block.label,
          daysRemaining: block.daysRemaining,
          planned: block.source !== 'auto',
        },
      });
    });
    return () => {
      on = false;
    };
  }, [repo, dataVersion]);

  if (state === null) return <Screen />;
  const settings = effectiveProfile(state.profile);
  const nowMs = now();

  return (
    <Screen>
      <div>
        <h1 className="display text-3xl font-extrabold">You</h1>
        <p className="mt-1 text-base leading-6 text-muted">
          What your daily plan is built from. Set it once and update it when things change — Today
          does the rest.
        </p>
      </div>

      <Section
        title="Goals"
        href={state.goals.length > 0 ? '/plan/goals' : '/plan/goals/new'}
        action={state.goals.length > 0 ? 'Edit' : 'Add one'}
        missing={state.goals.length === 0}
      >
        {state.goals.length === 0 ? (
          <p>No goal yet. Your coach plans toward your goals and holds you to their deadlines.</p>
        ) : (
          state.goals.slice(0, 3).map((g) => (
            <p key={g.id} className="text-text">
              {g.title}
              {g.targetDate !== undefined && (
                <span className="text-muted">
                  {' '}
                  · {Math.max(0, dayIndex(g.targetDate) - dayIndex(nowMs))} days left
                </span>
              )}
            </p>
          ))
        )}
      </Section>

      <Section
        title="Self-assessment"
        href="/assess/new"
        action={state.assessment ? 'Retake' : 'Take it'}
        missing={!state.assessment}
      >
        {state.assessment ? (
          <>
            <p className="text-text">Weakest area: {TRIAD_LABELS[state.assessment.weakestArea]}</p>
            <p>
              Taken {relativeTime(state.assessment.createdAt, nowMs)}.{' '}
              {state.assessDue
                ? 'Due for a retake, so the plan aims at where you are now.'
                : 'Your plan leans into this area.'}
            </p>
          </>
        ) : (
          <p>
            30 quick ratings, about five minutes. It finds your weakest area, and your plan leans
            into it.
          </p>
        )}
      </Section>

      <Section
        title="Strength tests"
        href="/assess/fitness"
        action={state.testsLogged > 0 ? 'View' : 'Test'}
        missing={state.testsLogged === 0}
      >
        {state.testsLogged > 0 ? (
          <p>
            {state.testsLogged} test{state.testsLogged === 1 ? '' : 's'} recorded.{' '}
            {state.testDue ? 'Time to retest.' : 'Loads in your plan come from these numbers.'}
          </p>
        ) : (
          <p>
            Optional. A max-hang or pull-up test lets the app set your loads from your numbers.
            Today will also put a test in your plan when it needs one.
          </p>
        )}
      </Section>

      <Section
        title="Season"
        href="/plan/macrocycle"
        action={state.block.planned ? 'Edit' : 'Plan'}
      >
        <p className="text-text">
          {state.block.label} · {state.block.daysRemaining} days left
        </p>
        <p>
          {state.block.planned
            ? 'Every session serves this block.'
            : 'Running an automatic 4-3-2-1 cycle. Plan blocks yourself if you have a trip or a peak.'}
        </p>
      </Section>

      <Section title="Climber profile" href="/more" action="Edit">
        <p className="text-text">
          {ABILITY_TIER_LABELS[settings.abilityTier]} · {STYLE_FOCUS_LABELS[settings.styleFocus]} ·{' '}
          {settings.daysPerWeek} days/week
        </p>
        <p>Your gear, your week, and the notes your coach reads every day.</p>
      </Section>
    </Screen>
  );
}
