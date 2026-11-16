'use client';

/**
 * The first-use tutorial, played on the real app rather than described on a
 * page: a spotlight on the tab or card to tap next, and one line on why.
 *
 * Which step they're on comes from their data (see `currentNuxStep`), so it
 * picks up where it left off after the app is closed. Until it's finished the
 * tutorial is the way in: a route outside the current step sends them back to
 * it, because a plan built without an assessment and a goal is the confusing
 * app a new climber met before.
 */
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  NUX_STEPS,
  currentNuxStep,
  dayIndex,
  isEstablishedAccount,
  log,
  now,
  trackEvent,
  type NuxStep,
} from '@tfc/core';
import { useRepository, useSync } from '../lib/db/RepositoryProvider';

interface Cue {
  /** `data-nux` of the element to spotlight, if any. */
  target?: string;
  text: string;
  /** Shown as a button; finishing is the only step that needs one. */
  finish?: string;
}

/** Where each step's work happens, and where a stray route is sent back to. */
const STEP_HOME: Record<NuxStep, string> = {
  assess: '/you',
  goal: '/you',
  checkin: '/train',
  plan: '/train',
};

const STEP_ROUTES: Record<NuxStep, string[]> = {
  assess: ['/train', '/you', '/assess'],
  // Saving the assessment moves them on to the goal before the page has even
  // left the form, and then they read their results. Neither may be snatched.
  goal: ['/train', '/you', '/plan/goals', '/assess'],
  checkin: ['/train', '/you'],
  plan: ['/train', '/you'],
};

/** Never interrupted: sign-up runs before the tutorial does. */
const UNGUARDED = ['/welcome'];

function under(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function cueFor(step: NuxStep, pathname: string): Cue {
  switch (step) {
    case 'assess':
      if (pathname.startsWith('/assess'))
        return { text: 'Rate each statement honestly. It takes about five minutes.' };
      if (pathname === '/you')
        return {
          target: 'you-assess',
          text: 'Start with the self-assessment. It finds your weakest area, and every plan leans into it.',
        };
      return {
        target: 'tab-/you',
        text: 'First, tell the app where you stand. Tap You — that’s where your setup lives.',
      };
    case 'goal':
      if (pathname.startsWith('/assess/results'))
        return { text: 'That’s where you stand. Tap Done, and next you’ll set a goal.' };
      if (pathname.startsWith('/plan/goals'))
        return {
          text: 'What are you chasing? Give it a deadline and your coach plans your season around it.',
        };
      if (pathname === '/you')
        return {
          target: 'you-goals',
          text: 'Now set a goal. Your coach plans toward it and holds you to the deadline.',
        };
      return { target: 'tab-/you', text: 'Next, a goal. Tap You.' };
    case 'checkin':
      if (pathname === '/train')
        return {
          target: 'checkin',
          text: 'This is Today — the only screen you need each day. Say where you are and how you feel, then confirm.',
        };
      return { target: 'tab-/train', text: 'Setup done. Head to Today.' };
    case 'plan':
      if (pathname === '/train')
        return {
          target: 'plan',
          text: 'Your session. Do it top to bottom — ▶ Start runs the timer and logs your sets. When you’re done, tap “I did this” and say how it went. That’s the whole app.',
          finish: 'Got it — let’s train',
        };
      return { target: 'tab-/train', text: 'Your plan is ready. Tap Today.' };
  }
}

/** The on-screen box of the first visible element with this `data-nux`. */
function useTargetRect(target: string | undefined): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    setRect(null);
    if (!target) return;
    let frame = 0;
    let scrolled = false;
    const tick = () => {
      const el = [...document.querySelectorAll<HTMLElement>(`[data-nux="${target}"]`)].find(
        (e) => e.getClientRects().length > 0,
      );
      if (el && !scrolled) {
        scrolled = true;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      const next = el?.getBoundingClientRect() ?? null;
      setRect((prev) =>
        prev?.top === next?.top &&
        prev?.left === next?.left &&
        prev?.width === next?.width &&
        prev?.height === next?.height
          ? prev
          : next,
      );
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return rect;
}

export function NuxGuide() {
  const repo = useRepository();
  const { dataVersion, localVersion } = useSync();
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [step, setStep] = useState<NuxStep | null>(null);

  useEffect(() => {
    let on = true;
    Promise.all([
      repo.getProfile(),
      repo.listAssessments(),
      repo.listGoals(),
      repo.listDailyContexts(),
      repo.listJournals(),
      repo.listClimbs(),
      repo.listExerciseLogs(),
    ]).then(([profile, assessments, goals, contexts, journals, climbs, logs]) => {
      if (!on) return;
      const nowMs = now();
      const activityDates = [...journals, ...climbs, ...logs].map((r) => r.date);
      if (profile && !profile.nuxCompletedAt && isEstablishedAccount({ activityDates, nowMs })) {
        // Training here before the tutorial existed. Settle it once, so a
        // pruned history can never send them back through it.
        void repo.saveProfile({ nuxCompletedAt: nowMs });
      }
      setStep(
        currentNuxStep({
          profile,
          assessments: assessments.length,
          goals: goals.length,
          checkedInToday: contexts.some((c) => dayIndex(c.date) === dayIndex(nowMs)),
          activityDates,
          nowMs,
        }),
      );
    });
    return () => {
      on = false;
    };
  }, [repo, dataVersion, localVersion, pathname]);

  const guarded = step !== null && !under(pathname, UNGUARDED);
  const strayed = guarded && !under(pathname, STEP_ROUTES[step]);

  useEffect(() => {
    if (!strayed || step === null) return;
    log.info('nux: back to the current step', { step, from: pathname });
    router.replace(STEP_HOME[step]);
  }, [strayed, step, pathname, router]);

  const cue = guarded ? cueFor(step, pathname) : null;
  const rect = useTargetRect(strayed ? undefined : cue?.target);

  const finish = useCallback(async () => {
    await repo.saveProfile({ nuxCompletedAt: now() });
    trackEvent('nux_completed');
    setStep(null);
  }, [repo]);

  if (!guarded || strayed || !cue) return null;
  const pad = 6;
  // Keep the bubble clear of what it points at.
  const bubbleAtTop = rect ? rect.top + rect.height / 2 > window.innerHeight / 2 : true;

  return (
    <>
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40 rounded-2xl ring-2 ring-primary transition-all duration-200"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)',
          }}
        />
      )}
      <div
        role="status"
        className={`fixed inset-x-4 z-50 mx-auto max-w-md rounded-2xl border border-primary/60 bg-surface px-4 py-3 shadow-xl ${
          bubbleAtTop ? 'top-[calc(env(safe-area-inset-top)+1rem)]' : 'bottom-24 md:bottom-6'
        }`}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          Getting started · {NUX_STEPS.indexOf(step) + 1} of {NUX_STEPS.length}
        </p>
        <p className="mt-1 text-sm leading-5">{cue.text}</p>
        {cue.finish && (
          <button
            type="button"
            onClick={() => void finish()}
            className="mt-3 w-full rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-primary-text"
          >
            {cue.finish}
          </button>
        )}
      </div>
    </>
  );
}
