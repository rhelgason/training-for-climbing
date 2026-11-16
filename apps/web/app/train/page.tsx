'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  acceptInsight,
  activeGoals,
  buildDailyRecommendation,
  combineReadiness,
  dayStartMs,
  describeSession,
  detectAbilityDrift,
  dismissInsight,
  goalExtension,
  isOverdue,
  formatBands,
  latestReadingForDay,
  mesocycleAnchor,
  overlayAiPlan,
  pendingInsights,
  planNods,
  readinessFromEnergyEmotion,
  reassessDue,
  resolveTrainingBlock,
  type GoalRecord,
  type Insight,
  type TriadArea,
  type ProfileRecord,
  dayIndex,
  effectiveProfile,
  flaggedPromptsForArea,
  hasCompletedSetup,
  latestForTest,
  loadHistory,
  now,
  protocolById,
  relativeTime,
  log,
  sessionFocus,
  suggestionLooksLikeRest,
  summarizeSession,
  trackEvent,
  trainingDates,
  workoutById,
  type BenchmarkRecord,
  type DailyRecommendation,
  type ExerciseLogRecord,
  type JournalEntry,
  type JournalIntensity,
  type SessionFocusId,
} from '@tfc/core';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { BackupBanner } from '../../components/BackupBanner';
import { TodayContext } from '../../components/TodayContext';
import { InsightCard } from '../../components/InsightCard';
import { Debrief, type TomorrowPreview } from '../../components/Debrief';
import { GoalCheckIn, type GoalOutcome } from '../../components/GoalCheckIn';
import { SessionRun } from '../../components/SessionRun';
import { clearRun, loadRun, saveRun, type RunState } from '../../lib/session/runState';
import { ProtocolMetric } from '../../components/ProtocolMetric';
import { WhyThisPlan } from '../../components/WhyThisPlan';
import { useRepository, useSync } from '../../lib/db/RepositoryProvider';
import { useCoach } from '../../lib/coach/useCoach';
import { useBackupNudge } from '../../lib/auth/useBackupNudge';
import { useDailyContext } from '../../lib/today/useDailyContext';

const DAY_MS = 24 * 60 * 60 * 1000;

function greeting(nowMs: number): string {
  const h = new Date(nowMs).getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

interface LoadState {
  journals: JournalEntry[];
  /** The offline floor: a keyword-read injury shapes the plan. */
  recommendation: DailyRecommendation;
  /**
   * The same day with injuries left to the coach, which judges them live from
   * the journals. Shown whenever the coach is on and answering.
   */
  live: DailyRecommendation;
  todayJournalId: string | null;
  /**
   * Today's session was logged with "I did this". The plan has been used, so
   * nothing about today asks the coach again — editing the log afterwards is a
   * record of the day, not a request for a new session.
   */
  dayLogged: boolean;
  /** What the debrief starts from: today's logged effort and words. */
  todayIntensity: JournalIntensity;
  todayNote: string;
  /** The scheduler's read on tomorrow, once today is logged. */
  tomorrow: TomorrowPreview | null;
  /** Ninety days since the last self-assessment. */
  reassessDue: boolean;
  goals: GoalRecord[];
  weakestArea: TriadArea | null;
  /** What the coach is given, in a line, so its plan isn't a black box. */
  coachRead: string[];
  benchmarks: BenchmarkRecord[];
  /** Workouts already logged set by set today, newest first. */
  todayLogs: ExerciseLogRecord[];
  /** Fingerprint of the notebook before today, so a newly logged day re-asks the coach. */
  notebookStamp: string;
  profile: ProfileRecord | null;
  /** Today's latest energy/emotion reading, so a new check-in asks the coach again. */
  checkinStamp: string;
  /** Profile updates the app is proposing, already filtered to undecided ones. */
  insights: Insight[];
  blockLabel: string;
}

type CoachView = Pick<ReturnType<typeof useCoach>, 'enabled' | 'status' | 'suggestion'>;

/**
 * Which plan the screen stands on, and what the AI is allowed to change.
 *
 * With the coach on, injuries are its call: the plan is the `live` one and a
 * rest only comes from the scheduler or from an injury the server checked
 * against the climber's own words. With the coach off or failing, the
 * keyword-read plan is the safety floor.
 */
function resolvePlan(state: LoadState, coach: CoachView) {
  const coachLive = coach.enabled && coach.status !== 'error';
  const rec = coachLive ? state.live : state.recommendation;
  const ai = coach.suggestion;
  const injuries = ai?.injuries ?? [];
  const aiInjuryRest = Boolean(
    coachLive && ai?.restDay && injuries.some((injury) => injury.noClimbing),
  );
  // The scheduler already rested yesterday, or it says today is for training.
  // A cached or freshly written "rest day" does not get to overrule that, and
  // it does not get logged as rest either — unless a verified injury says so.
  const aiRestIgnored = Boolean(
    ai && rec.kind !== 'rest' && suggestionLooksLikeRest(ai) && !aiInjuryRest,
  );
  return {
    rec,
    coachLive,
    shownAi: aiRestIgnored ? null : ai,
    aiRestIgnored,
    restToday: rec.kind === 'rest' || aiInjuryRest,
    injuries: coachLive ? injuries : [],
  };
}

/**
 * Tomorrow, as the scheduler sees it with today on the books. A preview, not
 * a promise: tomorrow's check-in and the coach still get the final say.
 */
function previewTomorrow(
  input: Parameters<typeof buildDailyRecommendation>[0],
  journals: JournalEntry[],
  climbs: Parameters<typeof loadHistory>[1],
  exerciseLogs: ExerciseLogRecord[],
): TomorrowPreview {
  const nowMs = input.nowMs + DAY_MS;
  const rec = buildDailyRecommendation({
    ...input,
    nowMs,
    history: loadHistory(journals, climbs, exerciseLogs, nowMs),
    // How they'll feel tomorrow is tomorrow's answer; today's note is today's.
    readiness: 'ok',
    dailyNote: undefined,
    injuryPolicy: 'hint',
  });
  if (rec.kind === 'rest') {
    return { label: 'Rest day', detail: rec.microcycle?.restReason };
  }
  if (rec.microcycle?.offFingers) {
    return { label: 'Off the fingers', detail: 'Lifting, easy cardio, and stretching.' };
  }
  return {
    label: rec.focus ? sessionFocus(rec.focus).label : rec.headline,
    // The scheduler speaks from tomorrow, where today is "yesterday".
    detail: rec.because?.replace(/^Yesterday:/, 'After today:') || undefined,
  };
}

export default function TrainHome() {
  const repo = useRepository();
  const { dataVersion } = useSync();
  const router = useRouter();
  const [state, setState] = useState<LoadState | null>(null);
  const backup = useBackupNudge();
  const daily = useDailyContext(repo, dataVersion);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [marking, setMarking] = useState(false);
  const [decidingInsight, setDecidingInsight] = useState(false);
  const [decidingGoal, setDecidingGoal] = useState(false);
  const [showLight, setShowLight] = useState(false);
  /** Prescribed steps the climber has unticked as not done. */
  const [skippedSteps, setSkippedSteps] = useState<string[]>([]);
  /** Today's guided run, kept while paused; `runOpen` is whether it's on screen. */
  const [run, setRun] = useState<RunState | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  /** Protocol values for today, keyed by protocol id; seeded from last session. */
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  /** Bumped after logging, so the screen re-reads into its debrief. */
  const [reload, setReload] = useState(0);

  const toggleStep = (step: string) =>
    setSkippedSteps((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step],
    );

  const today = daily.value;
  // Fingerprints the picture the coach was generated for. A new calendar day,
  // a changed check-in, or new journal text each forces a fresh AI call.
  // Nothing is asked until today's row is confirmed — an assumed OK is not
  // "I feel good", and the call must not go out before they say so. The
  // check-in only commits on Done, so a half-edited row never gets here.
  // Content, not updatedAt. A sync rewrites timestamps without changing the
  // training picture, and that must not ask the coach for a new session.
  const journalStamp = (state?.journals ?? [])
    .map((j) =>
      [
        j.id,
        j.date,
        (j.activities ?? []).join('+'),
        (j.focus ?? []).join('+'),
        j.intensity ?? '',
        j.summary ?? '',
        j.struggles ?? '',
        j.wins ?? '',
      ].join(':'),
    )
    .sort()
    .join(',');
  // `logic` is part of the key so a cached plan from an older coach is
  // thrown out after the rules change, without waiting on a new journal.
  // logic6: injuries are judged live by the coach, so a plan cached under the
  // old keyword-enforced rules is asked again. logic7: targets come from the
  // per-set notebook.
  const contextKey =
    today && daily.confirmed && state
      ? [
          dayIndex(now()),
          today.environment,
          today.sessionLength,
          today.readiness,
          [...today.equipment].sort().join(','),
          journalStamp,
          state.checkinStamp,
          effectiveProfile(state.profile).trainingPush,
          state.notebookStamp,
          'logic7',
        ].join('|')
      : undefined;
  const coach = useCoach(repo, contextKey, { auto: !state?.dayLogged });

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
  const markDone = async (skippedOverride?: string[]) => {
    if (!state || marking) return;
    // A guided run brings its own skips; otherwise the unticked steps.
    const skipped = skippedOverride ?? skippedSteps;
    const { todayJournalId } = state;
    const resolved = resolvePlan(state, coach);
    const plan = resolved.rec;
    const rest = resolved.restToday;
    const focus = rest
      ? (['rest'] as SessionFocusId[])
      : ([plan.focus, ...plan.supportingFocuses].filter(Boolean) as SessionFocusId[]);
    const intensity: JournalIntensity = rest
      ? 'easy'
      : plan.focus
        ? sessionFocus(plan.focus).intensity === 'high'
          ? 'hard'
          : sessionFocus(plan.focus).intensity === 'low'
            ? 'easy'
            : 'moderate'
        : 'easy';
    // A conditioning day used to be stamped "climbing", which counted as another
    // day on the fingers and the off-finger day never broke the streak.
    const hands = focus.some((f) => f !== 'conditioning' && f !== 'rest');
    const activities = rest
      ? (['rest'] as const)
      : hands
        ? (['climbing'] as const)
        : (['strength', 'cardio', 'mobility'] as const);
    setMarking(true);
    try {
      let journalId = todayJournalId;
      if (journalId) {
        await repo.updateJournal(journalId, {
          focus,
          intensity,
          activities: [...activities],
          skipped,
        });
      } else {
        const saved = await repo.saveJournal({
          date: now(),
          activities: [...activities],
          focus,
          intensity,
          skipped: skipped.length > 0 ? skipped : undefined,
        });
        journalId = saved.id;
      }
      // Record each protocol number the climber actually did. Two exclusions,
      // both about not inventing results: a step they unticked wasn't done, and
      // a step that was never on screen (because the AI rewrote the session)
      // was never confirmed — saving its seeded value would silently duplicate
      // last session's number as if it happened again.
      const shownSteps = overlayAiPlan(plan.steps, resolved.shownAi?.plan);
      const shown = new Set(shownSteps.map((s) => s.text));
      for (const step of shownSteps) {
        if (!step.protocolId) continue;
        if (!shown.has(step.text) || skipped.includes(step.text)) continue;
        const value = metrics[step.protocolId];
        if (typeof value !== 'number') continue;
        await repo.saveBenchmark({ testId: step.protocolId, value, date: now() });
      }
      log.info('train: logged session', {
        rest,
        focus: rest ? 'rest' : (plan.focus ?? 'none'),
        kind: plan.kind,
        activities: [...activities],
      });
      trackEvent('plan_completed', {
        focus: rest ? 'rest' : (plan.focus ?? 'rest'),
        kind: rest ? 'rest' : plan.kind,
        skipped: skipped.length,
      });
      // Stay here: the debrief opens in place for the words the coach reads
      // tomorrow, rather than a separate form a page away.
      clearRun();
      setRun(null);
      setRunOpen(false);
      setReload((n) => n + 1);
    } finally {
      setMarking(false);
    }
  };

  /** Snapshot the plan on screen and walk it one step at a time. */
  const startRun = (steps: RunState['steps']) => {
    const fresh: RunState = { day: dayIndex(now()), steps, index: 0, skipped: [] };
    saveRun(fresh);
    setRun(fresh);
    setRunOpen(true);
    trackEvent('session_run_started', { steps: steps.length });
  };

  const advanceRun = (skipped: boolean) => {
    if (!run) return;
    const step = run.steps[run.index];
    const next: RunState = {
      ...run,
      index: run.index + 1,
      skipped: skipped ? [...run.skipped, step.text] : run.skipped,
    };
    if (next.index >= run.steps.length) {
      void markDone(next.skipped);
      return;
    }
    saveRun(next);
    setRun(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      repo.listBenchmarks(),
      repo.listMacrocyclePeriods(),
      repo.listCheckins(),
      repo.listExerciseLogs(),
    ]).then(
      ([
        journals,
        climbs,
        assessments,
        goals,
        profile,
        benchmarks,
        periods,
        checkins,
        exerciseLogs,
      ]) => {
        if (!on) return;
        const nowMs = now();

        // A brand-new install with nothing in it goes through guided sign-up.
        // Existing users predate `onboardedAt`, so a profile or any logged
        // history is what protects them from being dropped into the wizard.
        if (
          !hasCompletedSetup(profile, {
            journals: journals.length,
            climbs: climbs.length,
            assessments: assessments.length,
            goals: goals.length,
          })
        ) {
          router.replace('/welcome');
          return;
        }

        const settings = effectiveProfile(profile);
        const latest = assessments[0] ?? null;
        const weakestArea = latest?.weakestArea ?? null;
        const dates = trainingDates(journals, climbs);
        const block = resolveTrainingBlock(
          periods,
          nowMs,
          mesocycleAnchor(profile, dates.length > 0 ? Math.min(...dates) : null, nowMs),
          { goals, climber: settings },
        );
        const energy = latestReadingForDay(checkins, nowMs);
        const dailyInput: Parameters<typeof buildDailyRecommendation>[0] = {
          weakestArea,
          weakSpots:
            latest && weakestArea ? flaggedPromptsForArea(latest.responses, weakestArea) : [],
          goals,
          trainingDates: dates,
          nowMs,
          history: loadHistory(journals, climbs, exerciseLogs, nowMs),
          abilityTier: settings.abilityTier,
          styleFocus: settings.styleFocus,
          daysPerWeek: settings.daysPerWeek,
          trainingPush: settings.trainingPush,
          equipment: today.equipment,
          readiness: combineReadiness(
            today.readiness,
            energy ? readinessFromEnergyEmotion(energy.energy, energy.emotion) : null,
          ),
          sessionLength: today.sessionLength,
          benchmarks,
          exerciseLogs,
          climbs,
          discipline: settings.defaultDiscipline,
          journals,
          dailyNote: today.note,
          climberContext: settings.climberContext,
          blockFocuses: block.focuses,
        };
        const recommendation = buildDailyRecommendation(dailyInput);
        const live = buildDailyRecommendation({ ...dailyInput, injuryPolicy: 'hint' });
        // Newest-edit-wins rather than first match: sync can leave two entries
        // for one day, and editing an arbitrary one loses the other's text.
        const newest = (list: JournalEntry[]) =>
          list.reduce<JournalEntry | null>(
            (best, j) => (!best || j.updatedAt > best.updatedAt ? j : best),
            null,
          );
        const todays = journals.filter((j) => dayIndex(j.date) === dayIndex(nowMs));
        // The entry that recorded the plan. A second session logged by hand
        // later is its own entry, and must not make the day look unlogged.
        const loggedJournal = newest(todays.filter((j) => j.focus?.length));
        const todayJournal = loggedJournal ?? newest(todays);

        // Pre-fill each protocol with what was done last time, so confirming is
        // the default and typing is the exception.
        const seeded: Record<string, number> = {};
        for (const step of [...live.steps, ...recommendation.steps]) {
          if (!step.protocolId || step.protocolId in seeded) continue;
          const protocol = protocolById(step.protocolId);
          if (!protocol) continue;
          seeded[step.protocolId] =
            latestForTest(benchmarks, step.protocolId)?.value ?? protocol.defaultValue;
        }
        setMetrics(seeded);

        log.info('train: built-in plan', {
          kind: recommendation.kind,
          focus: recommendation.focus,
          headline: recommendation.headline,
          restReason: recommendation.microcycle?.restReason,
          offFingers: recommendation.microcycle?.offFingers ?? false,
          fingerDaysInARow: recommendation.microcycle?.fingerDaysInARow,
          fingerDaysThisWeek: recommendation.microcycle?.fingerDaysThisWeek,
          readiness: today.readiness,
        });
        setState({
          journals,
          recommendation,
          live,
          todayJournalId: todayJournal?.id ?? null,
          dayLogged: loggedJournal !== null,
          todayIntensity: loggedJournal?.intensity ?? 'moderate',
          todayNote: loggedJournal?.summary ?? '',
          tomorrow: loggedJournal
            ? previewTomorrow(dailyInput, journals, climbs, exerciseLogs)
            : null,
          reassessDue: reassessDue(assessments, nowMs),
          goals,
          weakestArea,
          coachRead: [
            `${dates.filter((d) => dayIndex(nowMs) - dayIndex(d) <= 7).length} days of logs`,
            ...(activeGoals(goals).length > 0
              ? [`${activeGoals(goals).length} goal${activeGoals(goals).length === 1 ? '' : 's'}`]
              : []),
            ...(latest ? ['your assessment'] : []),
            ...(exerciseLogs.length > 0 ? ['your logged sets'] : []),
            block.source === 'auto' ? `${block.label} phase` : `${block.label} block`,
          ],
          benchmarks,
          todayLogs: exerciseLogs.filter((l) => l.date >= dayStartMs(nowMs)),
          notebookStamp: exerciseLogs
            .filter((l) => l.date < dayStartMs(nowMs))
            .map((l) => `${l.id}:${l.updatedAt}`)
            .sort()
            .join(','),
          profile,
          blockLabel: block.source === 'planned' ? `${block.label} — ${block.focus}` : block.label,
          // Deterministic and on-device: whether someone is climbing a grade is a
          // query over their own sends, not something worth asking a model.
          checkinStamp: energy ? `${energy.id}:${energy.time}` : '',
          insights: pendingInsights(
            [detectAbilityDrift(climbs, profile, settings.defaultDiscipline, nowMs)].filter(
              (i): i is Insight => i !== null,
            ),
            profile,
          ),
        });
      },
    );
    return () => {
      on = false;
    };
  }, [repo, dataVersion, router, today, reload]);

  // A run paused yesterday is not today's; one paused this morning is.
  useEffect(() => {
    setRun(loadRun(now()));
  }, [reload]);

  useEffect(() => {
    const suggestion = coach.suggestion;
    if (!state || !suggestion) return;
    const resolved = resolvePlan(state, coach);
    if (!resolved.aiRestIgnored) return;
    log.warn('train: ignoring AI rest; the scheduler said train', {
      headline: suggestion.headline,
      restDay: suggestion.restDay ?? false,
      focus: resolved.rec.focus,
    });
  }, [coach, state]);

  if (state === null || today === null) return <Screen />;
  const { todayJournalId } = state;
  const { rec, shownAi, restToday, injuries, coachLive } = resolvePlan(state, coach);

  /** Apply the climber's decision, then drop the card whichever way it went. */
  const decideInsight = async (insight: Insight, accepted: boolean) => {
    setDecidingInsight(true);
    try {
      const patch = accepted
        ? acceptInsight(insight, state.profile)
        : dismissInsight(insight, state.profile);
      const profile = await repo.saveProfile(patch);
      trackEvent(accepted ? 'insight_accepted' : 'insight_dismissed', { kind: insight.kind });
      setState((prev) =>
        prev
          ? { ...prev, profile, insights: prev.insights.filter((i) => i.id !== insight.id) }
          : prev,
      );
    } finally {
      setDecidingInsight(false);
    }
  };
  const decideGoal = async (goal: GoalRecord, outcome: GoalOutcome) => {
    setDecidingGoal(true);
    try {
      const nowMs = now();
      await repo.updateGoal(
        goal.id,
        outcome === 'done'
          ? { status: 'done', completedAt: nowMs }
          : outcome === 'extend'
            ? { targetDate: nowMs + goalExtension(goal).days * DAY_MS }
            : { status: 'archived' },
      );
      trackEvent('goal_resolved', { outcome });
      setReload((n) => n + 1);
    } finally {
      setDecidingGoal(false);
    }
  };
  const activeNow = activeGoals(state.goals);
  const overdueGoal = activeNow.find((g) => isOverdue(g, now())) ?? null;
  // Asked once there was a goal to finish; a climber who never set one is
  // asked by the tutorial, not by a nag here.
  const askGoal = overdueGoal !== null || (activeNow.length === 0 && state.goals.length > 0);

  const ai = coach.suggestion;
  const hint = coachLive && !shownAi ? rec.injuryHint : null;

  const nods = planNods({
    goals: state.goals,
    weakestArea: state.weakestArea,
    todayArea: restToday
      ? null
      : (shownAi?.focusArea ?? (rec.focus ? sessionFocus(rec.focus).triadArea : null)),
    nowMs: now(),
  });

  // Never show the built-in plan while the coach is writing: it looks like
  // today's answer, and a climber who starts it is doing the wrong session.
  const coachWriting = coach.writing && !state.dayLogged;
  const displaySteps = overlayAiPlan(rec.steps, shownAi?.plan);
  const planSteps = displaySteps.map((s) => s.text);
  const cardBorder = restToday ? 'border-warning' : shownAi ? 'border-success' : 'border-primary';

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

      {state.reassessDue && (
        <Link href="/assess/new">
          <Card interactive className="border-primary">
            <p className="text-sm font-bold uppercase tracking-wide text-primary">
              Time to reassess
            </p>
            <p className="mt-1 text-sm leading-5">
              It&apos;s been three months since your self-assessment. Five minutes, and your plan
              re-aims at where you are now →
            </p>
          </Card>
        </Link>
      )}

      {backup.visible && <BackupBanner onDismiss={backup.dismiss} />}

      {askGoal && <GoalCheckIn goal={overdueGoal} onDecide={decideGoal} busy={decidingGoal} />}

      {state.dayLogged && (
        <Debrief
          key={todayJournalId ?? 'today'}
          intensity={state.todayIntensity}
          note={state.todayNote}
          tomorrow={state.tomorrow}
          onSave={async (intensity, note) => {
            if (!todayJournalId) return;
            await repo.updateJournal(todayJournalId, { intensity, summary: note || undefined });
            trackEvent('debrief_saved', { intensity, words: note ? note.split(/\s+/).length : 0 });
            setReload((n) => n + 1);
          }}
        />
      )}

      {runOpen && run && !state.dayLogged ? (
        <SessionRun
          run={run}
          todayLogs={state.todayLogs}
          benchmarks={state.benchmarks}
          metrics={metrics}
          onMetric={(id, value) => setMetrics((m) => ({ ...m, [id]: value }))}
          onAdvance={advanceRun}
          onPause={() => setRunOpen(false)}
          finishing={marking}
        />
      ) : (
        <>
          <TodayContext
            value={today}
            onChange={daily.update}
            onConfirm={daily.confirm}
            confirmed={daily.confirmed}
          />

          {coachWriting ? (
            <Card className="border-success" data-nux="coach-writing">
              <div className="flex items-center gap-3">
                <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-border border-t-success" />
                <p className="text-lg font-bold">Your coach is writing today&apos;s plan</p>
              </div>
              <p className="mt-2 text-sm leading-5 text-muted">
                Reading your check-in, goals, self-assessment and recent training. A few seconds.
              </p>
            </Card>
          ) : (
            <>
              <Card className={cardBorder}>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-bold uppercase tracking-wide ${ai ? 'text-success' : 'text-muted'}`}
                  >
                    {shownAi ? 'AI coach' : 'Today'}
                  </span>
                  {coach.status === 'loading' ? (
                    <span className="flex items-center gap-2 text-sm text-muted">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-success" />
                      Asking the coach…
                    </span>
                  ) : shownAi && coach.generatedAt ? (
                    <span className="text-sm text-muted">
                      updated {relativeTime(coach.generatedAt, now())}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-1 text-lg font-bold" data-nux="plan">
                  {shownAi ? shownAi.headline : rec.headline}
                </h2>
                <p className="mt-2 text-sm leading-5 text-muted">
                  {shownAi ? shownAi.rationale || rec.detail : rec.detail}
                </p>
                {nods.map((nod) => (
                  <p key={nod} className="mt-1.5 text-sm font-semibold text-primary">
                    {nod}
                  </p>
                ))}

                {/* Judged live from today's call and never saved, so nothing here
            outlives the entries it came from. */}
                {injuries.length > 0 && (
                  <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5">
                    <p className="text-sm font-bold uppercase tracking-wide text-warning">
                      Coach noticed
                    </p>
                    {injuries.map((injury) => (
                      <div key={`${injury.bodyPart}:${injury.note}`} className="mt-1.5">
                        <p className="text-sm leading-5">{injury.note}</p>
                        {injury.evidence ? (
                          <p className="mt-0.5 text-xs leading-4 text-muted">
                            You wrote: “{injury.evidence}”
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
                {hint && (
                  <p className="mt-3 text-xs leading-4 text-muted">
                    You wrote “{hint.evidence}”.{' '}
                    {coach.status === 'loading'
                      ? 'Asking the coach whether to train around it…'
                      : 'Stop anything that hurts in that spot.'}
                  </p>
                )}

                {state.insights.map((insight) => (
                  <div key={insight.id} className="mt-4">
                    <InsightCard
                      insight={insight}
                      onAccept={(i) => void decideInsight(i, true)}
                      onDismiss={(i) => void decideInsight(i, false)}
                      busy={decidingInsight}
                    />
                  </div>
                ))}

                {rec.climbing && rec.kind === 'train' && !restToday && (
                  <div className="mt-4 rounded-xl border border-border/70 bg-surface-alt/40 px-3 py-2.5">
                    <p className="text-sm font-bold uppercase tracking-wide text-muted">
                      What to climb
                    </p>
                    <p className="mt-1 text-sm leading-5">{rec.climbing.style}</p>
                    {rec.climbing.bands.work ? (
                      <p className="mt-1.5 text-sm font-semibold">
                        {formatBands(rec.climbing.bands)}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs leading-4 text-muted">{rec.climbing.because}</p>
                  </div>
                )}

                {planSteps.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <p className="text-sm font-bold uppercase tracking-wide text-muted">
                        Today&apos;s plan
                      </p>
                      {rec.kind !== 'rest' && (
                        <p className="text-sm text-muted">untick what you skip</p>
                      )}
                    </div>
                    {/* Steps start ticked, so a normal day is still one tap to log.
                Unticking is how "ran out of time before the core work" gets
                recorded — which the coach reads when planning tomorrow. */}
                    {displaySteps.map((planStep, i) => {
                      const step = planStep.text;
                      const done = !skippedSteps.includes(step);
                      const protocol = protocolById(planStep.protocolId ?? '');
                      const workout = planStep.workoutId ? workoutById(planStep.workoutId) : null;
                      const loggedToday = workout
                        ? state.todayLogs.find((l) => l.workoutId === workout.id)
                        : undefined;
                      return (
                        <div key={i}>
                          <button
                            type="button"
                            onClick={() => toggleStep(step)}
                            aria-pressed={done}
                            className="mt-1 flex w-full gap-2 text-left"
                          >
                            <span
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${
                                done
                                  ? 'border-primary bg-primary text-primary-text'
                                  : 'border-border text-transparent'
                              }`}
                            >
                              ✓
                            </span>
                            <span
                              className={`flex-1 text-sm leading-5 ${done ? '' : 'text-muted line-through'}`}
                            >
                              {step}
                            </span>
                          </button>
                          {/* The workout runs in its own screen: timer, set-by-set log,
                      and the next target. Logged sets are the record, so the
                      day's "log it" never writes a second number for them. */}
                          {workout && planStep.target && done && (
                            <div className="mt-2 ml-7 flex items-center gap-2">
                              {loggedToday ? (
                                <Link
                                  href={`/train/session/${workout.id}`}
                                  className="flex-1 truncate rounded-lg border border-success/50 bg-success/10 px-3 py-2 text-sm font-semibold text-success"
                                >
                                  ✓{' '}
                                  {describeSession(workout, summarizeSession(workout, loggedToday))}
                                </Link>
                              ) : (
                                <Link
                                  href={`/train/session/${workout.id}`}
                                  aria-label={`Start ${workout.name}: ${
                                    planStep.target.kind === 'test' ? 'test' : planStep.target.label
                                  }`}
                                  className="flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-bold text-primary-text shadow shadow-primary/25 active:scale-[0.98]"
                                >
                                  ▶ Start
                                  <span className="font-semibold opacity-90">
                                    {planStep.target.kind === 'test'
                                      ? 'test'
                                      : planStep.target.label.split(' · ')[0]}
                                  </span>
                                </Link>
                              )}
                            </div>
                          )}
                          {protocol && done && (
                            <ProtocolMetric
                              protocol={protocol}
                              value={metrics[protocol.id] ?? protocol.defaultValue}
                              previous={latestForTest(state.benchmarks, protocol.id)?.value ?? null}
                              onChange={(value) =>
                                setMetrics((m) => ({ ...m, [protocol.id]: value }))
                              }
                              disabled={marking}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!shownAi && rec.focusItems.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-muted">Target your weak spots</p>
                    {rec.focusItems.map((item) => (
                      <p key={item} className="mt-1 text-sm">
                        • {item}
                      </p>
                    ))}
                  </div>
                )}

                {shownAi && shownAi.watchOuts.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-muted">Watch out for</p>
                    {shownAi.watchOuts.map((w) => (
                      <p key={w} className="mt-1 text-sm">
                        • {w}
                      </p>
                    ))}
                  </div>
                )}

                {shownAi && (
                  <p className="mt-4 text-xs leading-4 text-muted">
                    Coach read {state.coachRead.join(' · ')}
                    {today.note ? ' · today’s note' : ''}
                  </p>
                )}

                {shownAi && (
                  <div className="mt-2 flex items-center gap-4 border-t border-border pt-2">
                    {feedback ? (
                      <span className="text-sm italic text-muted">
                        Thanks — this helps tune your coach.
                      </span>
                    ) : (
                      <>
                        <span className="text-sm text-muted">Was this helpful?</span>
                        <button
                          type="button"
                          onClick={() => sendFeedback('up')}
                          className="text-lg"
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          onClick={() => sendFeedback('down')}
                          className="text-lg"
                        >
                          👎
                        </button>
                      </>
                    )}
                  </div>
                )}
              </Card>

              {/* A budget rest day is a promise the climber made to themselves, not
          physiology — so if they're standing in the gym anyway, give them
          somewhere to go rather than sending them home. */}
              {rec.kind === 'rest' && rec.lightAlternative && (
                <Card className="border-muted/40">
                  <p className="text-sm font-bold uppercase tracking-wide text-muted">
                    If you&apos;re training anyway
                  </p>
                  <p className="mt-1 text-sm leading-5">
                    Keep it genuinely easy — {rec.lightAlternative.label.toLowerCase()}, nothing
                    near your limit.
                  </p>
                  {showLight ? (
                    <div className="mt-3">
                      {rec.lightAlternative.plan.map((step, i) => (
                        <div key={i} className="mt-1 flex">
                          <span className="w-5 text-sm font-bold text-muted">{i + 1}</span>
                          <span className="flex-1 text-sm leading-5">{step}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowLight(true)}
                      className="mt-2 text-sm font-semibold text-primary"
                    >
                      Show the light session
                    </button>
                  )}
                </Card>
              )}

              <WhyThisPlan
                microcycle={rec.microcycle}
                because={rec.because}
                blockLabel={state.blockLabel}
              />

              {coach.enabled && (
                <Button
                  variant="secondary"
                  onClick={coach.refresh}
                  disabled={coach.status === 'loading'}
                >
                  {coach.status === 'loading'
                    ? 'Asking your coach…'
                    : ai
                      ? 'Refresh AI suggestion'
                      : 'Get AI suggestion'}
                </Button>
              )}
              {coach.status === 'error' && (
                <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm leading-5 text-warning">
                  Coach error: {coach.errorMessage ?? "Couldn't reach the coach."} Showing the
                  built-in plan instead.
                </p>
              )}

              {!state.dayLogged && !restToday && displaySteps.length > 0 && (
                <Button
                  onClick={() => (run ? setRunOpen(true) : startRun(displaySteps))}
                  disabled={marking}
                >
                  {run
                    ? `▶ Resume session — step ${run.index + 1} of ${run.steps.length}`
                    : '▶ Start session'}
                </Button>
              )}
              {!state.dayLogged && (
                <Button
                  variant={restToday ? 'primary' : 'secondary'}
                  onClick={() => void markDone()}
                  disabled={marking}
                >
                  {marking
                    ? 'Saving…'
                    : restToday
                      ? 'Log today as a rest day'
                      : skippedSteps.length > 0
                        ? `Already done? Log it — ${planSteps.length - skippedSteps.length} of ${planSteps.length}`
                        : 'Already done? Log it'}
                </Button>
              )}
            </>
          )}

          <Link
            href={
              todayJournalId && !state.dayLogged
                ? `/train/journal/${todayJournalId}`
                : '/train/journal/new'
            }
          >
            <Button variant="secondary">
              {state.dayLogged
                ? 'Log another session'
                : todayJournalId
                  ? "Edit today's log"
                  : 'Log something else'}
            </Button>
          </Link>
          {/* Off the main path: the plan already says what to run. These are for
          a day that goes off-script, and they shouldn't compete with it. */}
          <details className="rounded-xl border border-border/70 px-4 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-muted">
              Off-plan tools
            </summary>
            <div className="mt-2 flex flex-col gap-2 pb-2">
              <Link href="/train/session" className="text-sm font-semibold text-primary">
                Run any workout →
              </Link>
              <Link href="/train/energy-emotion" className="text-sm font-semibold text-primary">
                Energy &amp; emotion check-in →
              </Link>
              <Link href="/train/exercises" className="text-sm font-semibold text-primary">
                Exercise library →
              </Link>
            </div>
          </details>
        </>
      )}
    </Screen>
  );
}
