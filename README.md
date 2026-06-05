# training-for-climbing

A local-first, cross-platform mobile companion app for **Eric J. Hörst's _Training for Climbing_ (3rd ed.)**. It turns the book's structured tools into an interactive experience: self-assess across the performance triad, set goals, plan training, and track improvement over time.

> Personal-use companion. It does not reproduce the book — it complements it. You should own/read the book to get full value. The source PDF is intentionally git-ignored.

## Stack

- **Expo (React Native) + TypeScript** — one codebase for iOS & Android
- **React Navigation** — bottom tabs (Assess · Plan · Train · Review)
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
    assess/     # Self-Assessment flow, scoring logic (pure, tested), results, history
    plan/       # goals (CRUD) + program builder, with tested logic
    train/      # (roadmap) session logger, exercise library, check-ins
    review/     # glossary browser, chapter summaries (roadmap)
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

## Status

- **Phase 1 — Assess (done):** the **Self-Assessment** — 30 questions → Mental/Technical/Physical
  triad scoring, weakest-area callout, flagged weaknesses with coaching tips and chapter
  references, saved attempts, and a history/trend view — plus a searchable **Glossary**.
- **Phase 2 — Plan (done):** **Goals** across short/medium/long horizons (each with a mission,
  a "what I'll give up", an optional deadline, and a triad link) with add/edit/complete/delete,
  and a **Program builder** that turns an ability tier + chosen focus areas into an ordered
  session plan with rest guidance.
- **Next:** Phase 3 — Train (session logger, exercise library, energy/emotion check-in).

Train is stubbed with its roadmap. See the plan file for the full phased roadmap.
