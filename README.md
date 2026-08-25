# training-for-climbing

A local-first, cross-platform mobile companion app for **Eric J. Hörst's _Training for Climbing_ (3rd ed.)**. It's built around the **daily improvement loop**: tell it your goals, your gear and your week once, then open it each morning and be told exactly what to train — chosen from your weakest area, what you trained in the last few days, and the weekly frequency rules that govern each kind of training. A deterministic scheduler decides _what_ may be trained; a free AI coach writes _how_, inside constraints it can't break. Log the day in a sentence and tomorrow's plan accounts for it.

> Personal-use companion. It does not reproduce the book — it complements it. You should own/read the book to get full value. The source PDF is intentionally git-ignored.

## Stack

- **Expo (React Native) + TypeScript** — one codebase for iOS & Android
- **React Navigation** — bottom tabs (Assess · Plan · Train · Progress · More)
- **expo-sqlite** behind a `Repository` interface — local-first persistence, sync-ready
- **Jest + React Native Testing Library** — unit & component tests
- **ESLint + Prettier + Husky** — quality gates; **GitHub Actions** CI on every push/PR

## Prerequisites

- Node 20+ (this repo was bootstrapped with Node via `nvm`)
- The Expo Go app on your phone, or an iOS/Android simulator

## Getting started

```bash
npm install
npm start          # launch the Expo dev server, then open in Expo Go / a simulator
```

## Scripts

| Script                               | What it does                                        |
| ------------------------------------ | --------------------------------------------------- |
| `npm start`                          | Expo dev server                                     |
| `npm run typecheck`                  | `tsc --noEmit`                                      |
| `npm run lint`                       | ESLint                                              |
| `npm run format` / `format:check`    | Prettier write / check                              |
| `npm test` / `npm run test:coverage` | Jest (with coverage)                                |
| `npm run ci`                         | typecheck + lint + tests with coverage (mirrors CI) |

## Project structure

```
src/
  content/      # book-derived data: self-assessment, fitness tests, glossary
  features/
    assess/     # Self-Assessment + Fitness Evaluation + reassess nudge, tested
    plan/       # goals + program builder + macrocycle planner, with tested logic
    journal/    # daily journal entry form (free text + activity tags + intensity)
    train/      # rest/streak, energy-emotion, exercise library (triad/hierarchy tagged)
    today/      # daily "what to work on" — deterministic ordered plan (tested)
    coach/      # AI coach: context builder + client + cache + fallback (tested)
    progress/   # climb logging + dashboard (trends, consistency, benchmarks) (tested)
    auth/       # accounts: username/password sign-in, session, Account screen
    sync/       # backend-agnostic snapshot sync engine + HTTP remote
    review/     # "More": settings/profile entry, glossary, account
    settings/   # Profile/Settings singleton (ability tier, AI toggle, cadence)
  db/           # Repository interface + InMemory + SQLite implementations
  lib/          # logger + structured usage events, ids
  providers/    # Repository provider, error boundary
  navigation/   # tabs + stacks
  components/    # shared UI (Screen, Button, Card, TriadBars, RatingSelector)
  theme/        # design tokens
```

## Engineering practices

- **Logging:** all logging goes through `src/lib/logger.ts`. Usage is captured as typed
  structured events (`trackEvent(...)`) persisted to a local `events` table for analysis.
- **Testing:** pure logic (scoring, repository, glossary filter) is unit-tested; the
  assessment flow has a component test. Coverage is gated in CI with a baseline threshold
  that ratchets up as more of the UI is covered.
- **CI:** `.github/workflows/ci.yml` runs typecheck + lint + format check + tests on every
  push/PR and must stay green.

## Accounts & cloud sync (optional)

The app is local-first and works fully offline. Sign-in is opt-in: each user creates an
**account** (username + password) and gets their **own private data**, so friends can share one
server without seeing each other's training. Sync uses a **snapshot + last-write-wins** model
(merged per record by `updatedAt`; deletes propagate via tombstones), talking to the **web
app's own API routes** on Vercel, backed by Neon Postgres.

1. Deploy the web app to Vercel with `DATABASE_URL`, `JWT_SECRET`, and (optionally)
   `GEMINI_API_KEY` set — see [`apps/web/README.md`](apps/web/README.md). You get an HTTPS URL.
2. Set `EXPO_PUBLIC_SYNC_URL` to that URL **plus `/api`** (copy `.env.example` to `.env`) so it's
   baked into the build and nobody types it.
3. In the app: **More → Account**, create an account (or sign in) with a username + password — the
   first sync runs automatically, and the AI coach (if enabled) authenticates as the same user.

An email is optional at sign-up and used only to recover the account. It is never verified and
never sent to, so requiring one would collect an unusable address while turning away anyone
unwilling to give it. Without an email a forgotten password means losing the cloud backup; data
on the device is unaffected. Signing in accepts either the username or the recovery email.

Auth is a JWT session token; passwords are stored only as a bcrypt hash server-side. The merge
engine (`packages/core/src/features/sync/`) is backend-agnostic and unit-tested with an in-memory
remote; `HttpRemoteStore` and the auth client are unit-tested with a mocked `fetch`. A rejected
token (expired, or the signing secret rotated) clears the session and prompts a fresh sign-in
rather than retrying forever.

## Status

- **Phase 1 — Assess (done):** the **Self-Assessment** — 30 questions → Mental/Technical/Physical
  triad scoring, weakest-area callout, flagged weaknesses with coaching tips and chapter
  references, saved attempts, and a history/trend view — plus a searchable **Glossary**.
- **Phase 2 — Plan (done):** **Goals** across short/medium/long horizons (each with a mission,
  a "what I'll give up", an optional deadline, and a triad link) with add/edit/complete/delete,
  and a **Program builder** that turns an ability tier + chosen focus areas into an ordered
  session plan with rest guidance.
- **Phase 3 — Train (done):** a **Daily Journal** (a quick free-text "what I did / went well /
  didn't" plus light activity tags + optional intensity — recording the day, not a workout) with a
  **rest/streak indicator** (a training day = a journal with real activity or a climb; warns at 3+
  days in a row), the **Energy-Emotion Levels** check-in (energy 0–10 × emotion −5..+5 → quadrants
  plus an hourly line chart), and a browsable **exercise library** (Ch 6–7), each exercise tagged
  with its triad area and within-session hierarchy.
- **Guided sign-up (done):** `/welcome` walks a new climber through account → about you (ability,
  what you're optimising for, a freeform "here's me" blurb the coach reads verbatim) → goals →
  your week (days available, session length, equipment, with one-tap gym presets), and lands them
  on a real plan for today. Existing users are detected by their data and never sent through it.
- **Daily check-in (done):** a collapsed chip row above the plan — where you are, how long you
  have, how you feel, what's available. Pre-filled from yesterday's answers so the common case is
  zero taps; readiness deliberately resets each day. Changing it rebuilds the plan.
- **Microcycle scheduler (done):** the app understands a training _week_. `content/trainingContext`
  holds a **session-focus catalog** where each focus carries its weekly ceiling, recovery gap,
  target dose, required equipment, and ability gate (max strength ≤2×/week and 48h apart; power
  endurance ≤3×/week; aerobic work uncapped). `features/plan/microcycle` counts recent load against
  those rules and returns which focuses are **due**, **available**, or **blocked** — each with a
  human-readable reason — plus whole-day rest verdicts (three hard days running, the week's quota
  spent, or an injury flag). `features/train/load` classifies what was actually trained, from a
  recorded plan focus where there is one and conservatively inferred from activity tags otherwise.
  This is deliberately **deterministic code, not prompt text**: the rules are counting problems
  over recent history, and a model asked to hold them in its head will violate them convincingly.
- **Today recommendation (done):** the Train tab opens with a **concrete, ordered plan** built from
  the scheduler's choice — warm-up → the day's focus → supporting work → cool-down — naming only
  exercises you have the equipment for. A **"Why this plan"** panel shows the working: your recent
  sessions, the week so far, and every focus ruled in or out with its reason.
- **AI coach (done, on by default & free):** your daily card is generated by an AI from your
  assessments, benchmarks, recent climbs, goals, journal free text, and — leading the context —
  `recentDays`, the last seven sessions newest-first with `daysAgo`, focus, intensity and how they
  felt. The scheduler's verdict travels with it as a **hard constraint**: the model chooses _how_
  to train within the allowed focuses, never _whether_. The rest-day rule is enforced, not
  requested — the model must restate the verdict, and a plan that trains through a rest day is
  rejected so the client falls back to the deterministic one. Free at this scale (default
  **Gemini 2.5 Flash** free tier), cached for offline display, regenerated when today's check-in
  changes, and **falls back to the deterministic baseline** whenever it's off, offline, or
  rate-limited. See [`apps/web/README.md`](apps/web/README.md).
- **Closing the loop (done):** "I did this — log it" records today's journal with the focus that
  was actually prescribed, so tomorrow's 48-hour rules run on fact rather than inference, then
  opens the log for the free text the coach reads next morning.
- **Phase 4 — Track (done):** the **Fitness self-tests** (Chapters 8 & 9 — 9 finger and
  pull-muscle benchmarks with per-test trend and a retest reminder) and the **Macrocycle planner**
  (Appendix B — annual training blocks with training days pulled from your journal + climbs).
- **Progress tab (done):** log ascents (indoor/outdoor, boulder/lead/top-rope, grade, outcome)
  and a dashboard — personal bests, send pyramids, send/onsight rates, 30-day volume, the triad
  trend, **weekly training consistency**, **fitness-benchmark trends**, and a **reassessment nudge**
  (cadence from Profile).
- **Profile/Settings (done):** a singleton profile — ability tier, default discipline, reassess
  cadence, and the AI-coach toggle — under the **More** tab.
- **Accounts & cloud sync (done):** optional username/password accounts on your own Vercel
  deployment, each with private snapshot sync across devices (see above).

See the plan file for the full phased roadmap.
