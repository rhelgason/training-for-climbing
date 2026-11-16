'use client';

/**
 * The first-use tutorial, played on the real app rather than described on a
 * page: a pulsing ring on the one thing to tap next, and one line on why.
 * While a step points at something, nothing else on screen takes a tap, so
 * there's no wandering off mid-setup.
 *
 * Which step they're on comes from their data (see `currentNuxStep`), so it
 * picks up where it left off after the app is closed. Until it's finished the
 * tutorial is the way in: a route outside the current step sends them back to
 * it, because a plan built without an assessment and a goal is the confusing
 * app a new climber met before.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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
  text: string;
  /** `data-nux` hooks to ring: the thing to tap next. */
  ring?: string[];
  /** Also lit and tappable, without a ring (a form being filled in). */
  open?: string[];
  /** Inside `open` but not tappable yet (Done before the note is written). */
  shut?: string[];
  /** Shown as a button in the bubble; finishing is the only step that needs one. */
  finish?: string;
}

/** What's on screen right now, for cues that follow the climber's taps. */
interface Ui {
  checkinOpen: boolean;
  noteWritten: boolean;
  coachWriting: boolean;
}

const NO_UI: Ui = { checkinOpen: false, noteWritten: false, coachWriting: false };

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
  // The first goal moves them on; more goals are welcome on the way to Today.
  checkin: ['/train', '/you', '/plan/goals'],
  plan: ['/train', '/you'],
};

/** Never interrupted: sign-up runs before the tutorial does. */
const UNGUARDED = ['/welcome'];

function under(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function cueFor(step: NuxStep, pathname: string, ui: Ui): Cue {
  switch (step) {
    case 'assess':
      if (pathname.startsWith('/assess'))
        return { text: 'Rate each statement honestly. It takes about five minutes.' };
      if (pathname === '/you')
        return {
          ring: ['you-assess'],
          text: 'Start with the self-assessment. It finds your weakest area, and every plan leans into it.',
        };
      return {
        ring: ['tab-/you'],
        text: 'First, tell the app where you stand. Tap You, where your setup lives.',
      };
    case 'goal':
      if (pathname.startsWith('/assess/results'))
        return {
          ring: ['results-done'],
          text: 'That’s where you stand. Read it over, then tap Done, and next you’ll set a goal.',
        };
      if (pathname.startsWith('/plan/goals'))
        return {
          text: 'What are you chasing? Give it a deadline and your coach plans your season around it.',
        };
      if (pathname === '/you')
        return {
          ring: ['you-goals'],
          text: 'Now set a goal. Your coach plans toward it and holds you to the deadline.',
        };
      return { ring: ['tab-/you'], text: 'Next, a goal. Tap You.' };
    case 'checkin':
      if (pathname === '/plan/goals')
        return {
          ring: ['goals-add', 'tab-/train'],
          text: 'Chasing more than one thing? Add another goal. Otherwise tap Today.',
        };
      if (pathname.startsWith('/plan/goals'))
        return { text: 'What else are you chasing? Give it a deadline too.' };
      if (pathname !== '/train')
        return {
          ring: ['you-goals', 'tab-/train'],
          text: 'Goal set. Add another from Goals if you have one, or tap Today to plan your day.',
        };
      if (!ui.checkinOpen)
        return {
          ring: ['checkin-change'],
          text: 'This is Today, the only screen you need each day. It starts with a check-in. Tap Change.',
        };
      if (!ui.noteWritten)
        return {
          ring: ['checkin-note'],
          open: ['checkin'],
          shut: ['checkin-done'],
          text: 'Look over each one: where you are, how long you have, how you feel, what’s there to use. Then write a line about today at the bottom: sleep, soreness, mood, anything.',
        };
      return {
        ring: ['checkin-done'],
        open: ['checkin'],
        text: 'Now tap Done. That sends your day to your coach, who writes the plan around it. Do this every time you train.',
      };
    case 'plan':
      if (pathname !== '/train')
        return { ring: ['tab-/train'], text: 'Your plan is ready. Tap Today.' };
      if (ui.coachWriting)
        return {
          ring: ['coach-writing'],
          text: 'Your coach is reading your check-in, goals and assessment, and writing today’s plan. Change the check-in later and it rewrites it.',
        };
      return {
        ring: ['plan'],
        text: 'Here’s today’s plan. Tap ▶ Start session and it walks you through each step, timers included. At the end, say how it went. That’s the whole app.',
        finish: 'Got it — let’s train',
      };
  }
}

function visible(hook: string): HTMLElement | null {
  return (
    [...document.querySelectorAll<HTMLElement>(`[data-nux="${hook}"]`)].find(
      (e) => e.getClientRects().length > 0,
    ) ?? null
  );
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

const sameBoxes = (a: Box[], b: Box[]) =>
  a.length === b.length &&
  a.every(
    (x, i) =>
      x.top === b[i].top &&
      x.left === b[i].left &&
      x.width === b[i].width &&
      x.height === b[i].height,
  );

/**
 * Where the lit things are, every frame, so the ring stays glued to them
 * through scrolling and layout changes. No easing: an eased ring trails the
 * page and reads as lag.
 */
interface Scene {
  rings: Box[];
  holes: Box[];
  ui: Ui;
  /** The thing to tap has been missing a while: a slow or changed page. */
  lost: boolean;
}

/** How long a ringed element may be missing before the lock lets go. */
const LOST_MS = 1500;

function useScene(cue: Cue | null): Scene {
  const [scene, setScene] = useState<Scene>({ rings: [], holes: [], ui: NO_UI, lost: false });
  const ringKey = cue?.ring?.join(' ') ?? '';
  const openKey = cue?.open?.join(' ') ?? '';
  useEffect(() => {
    const ring = ringKey ? ringKey.split(' ') : [];
    const open = openKey ? openKey.split(' ') : [];
    let frame = 0;
    let scrolled = false;
    let missingAt: number | null = null;
    const tick = () => {
      const ringEls = ring.map(visible).filter((e): e is HTMLElement => e !== null);
      const openEls = open.map(visible).filter((e): e is HTMLElement => e !== null);
      // Bring the thing to tap on screen once; after that, scrolling is theirs.
      const first = ringEls[0];
      if (first && !scrolled) {
        scrolled = true;
        const r = first.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) {
          first.scrollIntoView({
            block: r.height > window.innerHeight * 0.6 ? 'start' : 'center',
            behavior: 'smooth',
          });
        }
      }
      const note = visible('checkin-note') as HTMLInputElement | null;
      const ui: Ui = {
        checkinOpen: note !== null,
        noteWritten: Boolean(note?.value.trim()),
        coachWriting: visible('coach-writing') !== null,
      };
      if (ring.length > 0 && ringEls.length === 0) missingAt ??= performance.now();
      else missingAt = null;
      const lost = missingAt !== null && performance.now() - missingAt > LOST_MS;
      const rings = ringEls.map(boxOf);
      const holes = [...openEls, ...ringEls].map(boxOf);
      setScene((prev) =>
        sameBoxes(prev.rings, rings) &&
        sameBoxes(prev.holes, holes) &&
        prev.ui.checkinOpen === ui.checkinOpen &&
        prev.ui.noteWritten === ui.noteWritten &&
        prev.ui.coachWriting === ui.coachWriting &&
        prev.lost === lost
          ? prev
          : { rings, holes, ui, lost },
      );
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [ringKey, openKey]);
  return scene;
}

/**
 * While a cue points at something, a tap anywhere else does nothing. Taps are
 * caught on the way down, before the page sees them, so links and buttons
 * outside the lit area can't fire. Scrolling is never blocked.
 */
function useTapLock(cue: Cue | null, active: boolean) {
  const cueRef = useRef(cue);
  cueRef.current = cue;
  useEffect(() => {
    if (!active) return;
    const allowed = (target: EventTarget | null) => {
      const el = target instanceof Element ? target : null;
      if (!el) return false;
      if (el.closest('[data-nux-bubble]')) return true;
      const c = cueRef.current;
      const inside = (hooks?: string[]) =>
        (hooks ?? []).some((h) => el.closest(`[data-nux="${h}"]`) !== null);
      if (inside(c?.shut)) return false;
      return inside(c?.ring) || inside(c?.open);
    };
    const stop = (e: Event) => {
      if (allowed(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const stopKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') stop(e);
    };
    window.addEventListener('click', stop, true);
    window.addEventListener('mousedown', stop, true);
    window.addEventListener('keydown', stopKey, true);
    return () => {
      window.removeEventListener('click', stop, true);
      window.removeEventListener('mousedown', stop, true);
      window.removeEventListener('keydown', stopKey, true);
    };
  }, [active]);
}

const PAD = 6;

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

  // The cue depends on what's on screen, which the scene reads; the scene
  // depends on the cue. Read with the last frame's view, settle on the next.
  const [ui, setUi] = useState<Ui>(NO_UI);
  const cue = guarded && !strayed ? cueFor(step, pathname, ui) : null;
  const scene = useScene(cue);
  useEffect(() => {
    if (
      scene.ui.checkinOpen !== ui.checkinOpen ||
      scene.ui.noteWritten !== ui.noteWritten ||
      scene.ui.coachWriting !== ui.coachWriting
    )
      setUi(scene.ui);
  }, [scene.ui, ui]);

  // Locked from the moment a cue points somewhere, including the frames
  // while the page swaps one target for the next. If the target never shows
  // up, let go, so a slow page can't leave them with nothing that works.
  const locked = Boolean(cue?.ring?.length) && !scene.lost;
  useTapLock(cue, locked);

  const finish = useCallback(async () => {
    await repo.saveProfile({ nuxCompletedAt: now() });
    trackEvent('nux_completed');
    setStep(null);
  }, [repo]);

  if (!cue || step === null) return null;
  const anchor = scene.rings[0];
  // Keep the bubble clear of what it points at.
  const bubbleAtTop = anchor ? anchor.top + anchor.height / 2 > window.innerHeight / 2 : true;

  return (
    <>
      {locked && (
        <svg aria-hidden className="pointer-events-none fixed inset-0 z-40 h-full w-full">
          <defs>
            <mask id="nux-holes">
              <rect width="100%" height="100%" fill="white" />
              {scene.holes.map((b, i) => (
                <rect
                  key={i}
                  x={b.left - PAD}
                  y={b.top - PAD}
                  width={b.width + PAD * 2}
                  height={b.height + PAD * 2}
                  rx={14}
                  fill="black"
                />
              ))}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgb(0 0 0 / 0.6)" mask="url(#nux-holes)" />
        </svg>
      )}
      {scene.rings.map((b, i) => (
        <div
          key={i}
          aria-hidden
          className="nux-ring pointer-events-none fixed z-40 rounded-2xl"
          style={{
            top: b.top - PAD,
            left: b.left - PAD,
            width: b.width + PAD * 2,
            height: b.height + PAD * 2,
          }}
        />
      ))}
      <div
        role="status"
        data-nux-bubble
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
