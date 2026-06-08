# training-for-climbing

A local-first, cross-platform mobile companion app for **Eric J. Hörst's _Training for Climbing_ (3rd ed.)**. It's built around the **daily improvement loop**: self-assess across the performance triad, record each day in a quick journal, get a concrete suggestion for what to work on (a deterministic baseline, optionally upgraded by a free AI coach), and watch progress trend over time.

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
    sync/       # backend-agnostic snapshot sync engine + HTTP (Railway) remote
    review/     # "More": settings/profile entry, glossary, cloud sync
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

## Cloud sync (optional)

The app is local-first and works fully offline. Cloud sync is opt-in and uses a **snapshot +
last-write-wins** model (the whole dataset is merged per record by `updatedAt`; deletes
propagate via tombstones). It talks to your own small sync server — a tiny Express + Postgres
service in [`server/`](server/) designed to deploy to **Railway**.

1. Deploy the sync server to Railway (Postgres plugin + a service rooted at `server/`, with a
   `SYNC_TOKEN` secret) — see [`server/README.md`](server/README.md). You get an HTTPS URL.
2. Optionally copy `.env.example` to `.env` and set `EXPO_PUBLIC_SYNC_URL` to prefill the URL.
3. In the app: **More → Cloud sync**, enter the server URL and the `SYNC_TOKEN`, then
   **Connect & sync**.

The merge engine (`src/features/sync/`) is backend-agnostic and unit-tested with an in-memory
remote; `HttpRemoteStore` (the Railway client) is unit-tested with a mocked `fetch`.

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
- **Today recommendation (done):** the Train tab opens with a **"Today"** card giving a **concrete,
  ordered plan** — warm-up → drills weighted to your weakest area (physical pulls named exercises
  from the tagged library in hierarchy order; mental/technical pull skill drills) → cool-down;
  rest-aware, and prompts the assessment first if you haven't taken one.
- **AI coach (done, opt-in & free):** when enabled in Profile and a server LLM key is set, your
  daily card is generated by an AI from your assessments, benchmarks, recent climbs, goals, and the
  last ~10 journal entries (structured `{ focusArea, headline, plan, rationale, watchOuts }`). It's
  free at this scale (default **Gemini 2.5 Flash** free tier), cached for offline display, and
  **falls back to the deterministic baseline** whenever it's off, offline, or rate-limited. See
  [`server/README.md`](server/README.md).
- **Phase 4 — Track (done):** the **Fitness Evaluation** (Appendix D — 10 benchmarks with
  per-test trend and an annual-retest reminder) and the **Macrocycle planner** (Appendix B —
  annual training blocks with training days pulled from your journal + climbs).
- **Progress tab (done):** log ascents (indoor/outdoor, boulder/lead/top-rope, grade, outcome)
  and a dashboard — personal bests, send pyramids, send/onsight rates, 30-day volume, the triad
  trend, **weekly training consistency**, **fitness-benchmark trends**, and a **reassessment nudge**
  (cadence from Profile).
- **Profile/Settings (done):** a singleton profile — ability tier, default discipline, reassess
  cadence, and the AI-coach toggle — under the **More** tab.
- **Cloud sync (done):** optional snapshot sync to your own Railway server (see above).

See the plan file for the full phased roadmap.
