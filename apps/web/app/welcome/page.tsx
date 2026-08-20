'use client';

/**
 * Guided sign-up: account → about you → goals → your week → done.
 *
 * The point of this flow is that a climber finishes it and immediately has a
 * real plan for today. Everything it asks for is something the scheduler or the
 * coach actually consumes — there are no "nice to have" questions here, because
 * every extra screen loses people before they see a workout.
 *
 * Answers are held in local state and written once at the end, so backing out
 * halfway leaves no half-configured profile behind.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ABILITY_TIERS,
  ABILITY_TIER_LABELS,
  AuthError,
  DEFAULT_EQUIPMENT,
  GOAL_HORIZONS,
  GOAL_HORIZON_LABELS,
  HttpRemoteStore,
  SESSION_LENGTHS,
  SESSION_LENGTH_LABELS,
  STYLE_FOCUSES,
  STYLE_FOCUS_LABELS,
  log,
  login,
  now,
  register,
  runSync,
  trackEvent,
  type AbilityTier,
  type EquipmentId,
  type GoalHorizon,
  type SessionLength,
  type StyleFocus,
} from '@tfc/core';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EquipmentPicker } from '../../components/EquipmentPicker';
import { OptionChips, type ChipOption } from '../../components/OptionChips';
import { Screen } from '../../components/Screen';
import { useRepository } from '../../lib/db/RepositoryProvider';
import { API_BASE } from '../../lib/config';
import { getSession, saveSession, type AuthSession } from '../../lib/auth/session';

const STEPS = ['Account', 'About you', 'Goals', 'Your week'] as const;

const inputClass =
  'w-full rounded-xl border border-border bg-surface-alt/60 px-4 py-2.5 text-base text-text placeholder:text-muted focus:border-primary focus:outline-none';

const TIER_OPTIONS: ChipOption<AbilityTier>[] = ABILITY_TIERS.map((t) => ({
  label: ABILITY_TIER_LABELS[t.id],
  value: t.id,
}));
const STYLE_OPTIONS: ChipOption<StyleFocus>[] = STYLE_FOCUSES.map((s) => ({
  label: STYLE_FOCUS_LABELS[s],
  value: s,
}));
const LENGTH_OPTIONS: ChipOption<SessionLength>[] = SESSION_LENGTHS.map((s) => ({
  label: SESSION_LENGTH_LABELS[s],
  value: s,
}));
const DAYS_OPTIONS: ChipOption<string>[] = ['1', '2', '3', '4', '5', '6'].map((d) => ({
  label: `${d} day${d === '1' ? '' : 's'}`,
  value: d,
}));
const HORIZON_OPTIONS: ChipOption<GoalHorizon>[] = GOAL_HORIZONS.map((h) => ({
  label: GOAL_HORIZON_LABELS[h.id],
  value: h.id,
}));

interface DraftGoal {
  title: string;
  horizon: GoalHorizon;
}

export default function Welcome() {
  const repo = useRepository();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Step 1 — account
  const [signedIn, setSignedIn] = useState(false);
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authStatus, setAuthStatus] = useState<string | null>(null);

  // Step 2 — about you
  const [abilityTier, setAbilityTier] = useState<AbilityTier>('intermediate');
  const [styleFocus, setStyleFocus] = useState<StyleFocus>('all-round');
  const [climberContext, setClimberContext] = useState('');

  // Step 3 — goals
  const [goals, setGoals] = useState<DraftGoal[]>([]);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalHorizon, setGoalHorizon] = useState<GoalHorizon>('medium');

  // Step 4 — your week
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [sessionLength, setSessionLength] = useState<SessionLength>('standard');
  const [equipment, setEquipment] = useState<EquipmentId[]>([...DEFAULT_EQUIPMENT]);

  useEffect(() => {
    setSignedIn(Boolean(getSession()?.token));
  }, []);

  const submitAuth = async () => {
    if (!email.trim() || !password) {
      window.alert('Enter your email and password.');
      return;
    }
    setBusy(true);
    setAuthStatus(mode === 'register' ? 'Creating account…' : 'Signing in…');
    try {
      const result =
        mode === 'register'
          ? await register(API_BASE, email.trim(), password)
          : await login(API_BASE, email.trim(), password);
      const session: AuthSession = {
        token: result.token,
        userId: result.user.id,
        email: result.user.email,
      };
      saveSession(session);
      trackEvent(mode === 'register' ? 'signed_up' : 'signed_in');
      setAuthStatus('Syncing…');
      await runSync(repo, new HttpRemoteStore(API_BASE, session.token));
      saveSession({ ...session, lastSyncedAt: now() });
      setPassword('');
      setSignedIn(true);
      setAuthStatus(null);
      setStep(1);
    } catch (err) {
      const message =
        err instanceof AuthError ? err.message : String((err as Error).message ?? err);
      log.error('onboarding auth failed', err);
      setAuthStatus(null);
      window.alert(message);
    } finally {
      setBusy(false);
    }
  };

  const addGoal = () => {
    const title = goalTitle.trim();
    if (!title) return;
    setGoals([...goals, { title, horizon: goalHorizon }]);
    setGoalTitle('');
  };

  const finish = async () => {
    setBusy(true);
    try {
      await repo.saveProfile({
        abilityTier,
        styleFocus,
        climberContext: climberContext.trim() || undefined,
        daysPerWeek,
        sessionLength,
        equipment,
        onboardedAt: now(),
      });
      for (const goal of goals) {
        await repo.saveGoal({ title: goal.title, horizon: goal.horizon });
      }
      trackEvent('onboarding_completed', { goals: goals.length, signedIn });
      router.push('/train');
    } catch (err) {
      log.error('onboarding save failed', err);
      window.alert('Could not save your setup. Please try again.');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <div>
        <p className="text-sm font-semibold text-muted">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
        <div className="mt-2 flex gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand' : 'bg-border'}`}
            />
          ))}
        </div>
      </div>

      {step === 0 && (
        <>
          <h1 className="display text-3xl font-extrabold">
            Let&apos;s build your <span className="text-gradient">training</span>
          </h1>
          <p className="text-sm leading-6 text-muted">
            A few questions and you&apos;ll get a workout every day — chosen from your goals, your
            gear, and what you trained this week. An account keeps it in sync and powers your coach.
          </p>

          {signedIn ? (
            <Card>
              <p className="font-semibold">You&apos;re signed in.</p>
              <p className="mt-1 text-sm text-muted">Carry on and tell us about your climbing.</p>
            </Card>
          ) : (
            <Card className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Email</label>
                <input
                  className={inputClass}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Password</label>
                <input
                  className={inputClass}
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              {authStatus ? <p className="text-sm text-primary">{authStatus}</p> : null}
            </Card>
          )}

          {signedIn ? (
            <Button onClick={() => setStep(1)}>Continue</Button>
          ) : (
            <>
              <Button onClick={submitAuth} disabled={busy}>
                {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
              >
                {mode === 'register' ? 'I already have an account' : 'Create a new account'}
              </Button>
              {/* Local-first is still the default: an account is how you get the
                  coach and sync, not how you get in. */}
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-2 text-center text-sm text-muted underline underline-offset-4"
              >
                Skip for now — keep everything on this device
              </button>
            </>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <h1 className="display text-3xl font-extrabold">About you</h1>
          <Card>
            <p className="mb-2 font-semibold">Where are you at?</p>
            <OptionChips options={TIER_OPTIONS} selected={abilityTier} onSelect={setAbilityTier} />
          </Card>
          <Card>
            <p className="mb-2 font-semibold">What are you optimising for?</p>
            <OptionChips options={STYLE_OPTIONS} selected={styleFocus} onSelect={setStyleFocus} />
          </Card>
          <Card>
            <p className="mb-1 font-semibold">Anything else worth knowing?</p>
            <p className="mb-2 text-sm leading-5 text-muted">
              What you climb, injuries you work around, what your gym is like, what you&apos;re
              training for. Your coach reads this every day — the more specific, the better the
              advice.
            </p>
            <textarea
              className={`${inputClass} min-h-32`}
              placeholder="e.g. Climbing 6 years, mostly V6 indoors and 5.11 outside. Left A2 pulley strain last autumn so I keep off full crimps. Gym has a Kilter board and a great steep wall but no campus board. Building for a sport trip in October."
              value={climberContext}
              onChange={(e) => setClimberContext(e.target.value)}
            />
          </Card>
          <Button onClick={() => setStep(2)}>Continue</Button>
          <Button variant="secondary" onClick={() => setStep(0)}>
            Back
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="display text-3xl font-extrabold">Your goals</h1>
          <p className="text-sm leading-6 text-muted">
            What are you working toward? Add as many as you like, short or long term — they shape
            what gets prioritised on any given day.
          </p>

          <Card className="flex flex-col gap-3">
            <input
              className={inputClass}
              placeholder="e.g. Send my first V7"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addGoal();
              }}
            />
            <OptionChips
              options={HORIZON_OPTIONS}
              selected={goalHorizon}
              onSelect={setGoalHorizon}
            />
            <Button variant="secondary" onClick={addGoal} disabled={!goalTitle.trim()}>
              + Add goal
            </Button>
          </Card>

          {goals.map((goal, i) => (
            <Card key={`${goal.title}-${i}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{goal.title}</p>
                  <p className="text-sm text-muted">{GOAL_HORIZON_LABELS[goal.horizon]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGoals(goals.filter((_, j) => j !== i))}
                  className="text-sm text-danger"
                >
                  Remove
                </button>
              </div>
            </Card>
          ))}

          <Button onClick={() => setStep(3)}>
            {goals.length > 0 ? 'Continue' : 'Skip for now'}
          </Button>
          <Button variant="secondary" onClick={() => setStep(1)}>
            Back
          </Button>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="display text-3xl font-extrabold">Your week</h1>
          <Card>
            <p className="mb-1 font-semibold">How many days a week can you train?</p>
            <p className="mb-2 text-sm leading-5 text-muted">
              Be honest — this is the budget your plan is built against, and it decides when
              you&apos;re told to rest.
            </p>
            <OptionChips
              options={DAYS_OPTIONS}
              selected={String(daysPerWeek)}
              onSelect={(v) => setDaysPerWeek(Number(v))}
            />
          </Card>
          <Card>
            <p className="mb-2 font-semibold">How long is a typical session?</p>
            <OptionChips
              options={LENGTH_OPTIONS}
              selected={sessionLength}
              onSelect={setSessionLength}
            />
          </Card>
          <Card>
            <p className="mb-1 font-semibold">What can you train on?</p>
            <p className="mb-3 text-sm leading-5 text-muted">
              You&apos;ll never be prescribed something you can&apos;t do. You can change this for
              any single day later.
            </p>
            <EquipmentPicker selected={equipment} onChange={setEquipment} />
          </Card>
          <Button onClick={finish} disabled={busy}>
            {busy ? 'Setting up…' : "Show me today's workout"}
          </Button>
          <Button variant="secondary" onClick={() => setStep(2)}>
            Back
          </Button>
        </>
      )}
    </Screen>
  );
}
