# Training for Climbing — Web

A mobile-friendly, installable (PWA) web build of the Training for Climbing app.
Next.js (App Router) + Tailwind CSS v4, sharing all domain logic with the mobile
app via the `@tfc/core` workspace package.

- **Local-first:** data is stored in the browser (IndexedDB) and works offline.
- **Cloud-backed:** signing in backs up / syncs your data. Accounts, snapshots,
  and the AI coach are served by this app's own route handlers under `/api`,
  talking to Neon Postgres — same-origin, so there is no CORS to configure and no
  separate backend to deploy.

## Develop

From the repo root (npm workspaces):

```bash
npm install            # installs all workspaces (needs npm registry access)
npm run dev:web        # → http://localhost:3000
```

Create `apps/web/.env.local` — see `.env.example` for the full list:

```
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
JWT_SECRET=<a long random secret>
GEMINI_API_KEY=<optional; enables the AI coach>
```

All server-side only — none are `NEXT_PUBLIC_`, so none reach the browser. The
tables are created on the first request; `scripts/schema.sql` has the same DDL if
you'd rather apply it by hand.

## Build

```bash
npm run build:web
```

## Deploy (Vercel)

1. Import the repo into Vercel.
2. Set **Root Directory** to `apps/web` (Vercel auto-detects Next.js; the monorepo
   `@tfc/core` is transpiled via `transpilePackages` in `next.config.ts`).
3. Add `DATABASE_URL`, `JWT_SECRET`, and (optionally) `GEMINI_API_KEY` for
   production **and** preview. Use Neon's **pooled** connection string — the host
   containing `-pooler` — so many short-lived function instances don't exhaust
   Neon's connection limit.
4. Deploy, then check `https://<your-app>/api/health` — every field should be
   `true` (`coach` only once an LLM key is set).

No `vercel.json` is needed — the App Router handles routing, and the `/api/*`
route handlers are the backend.

The mobile app points at the same endpoints: set `EXPO_PUBLIC_SYNC_URL` to
`https://<your-app>/api`.

## Backend routes

| Method | Path                 | Auth   | Response                          |
| ------ | -------------------- | ------ | --------------------------------- |
| GET    | `/api/health`        | –      | `{ ok, coach, auth, db }`         |
| POST   | `/api/auth/register` | –      | `{ token, user }`                 |
| POST   | `/api/auth/login`    | –      | `{ token, user }`                 |
| GET    | `/api/snapshot`      | Bearer | `{ data: Snapshot \| null }`      |
| PUT    | `/api/snapshot`      | Bearer | `{ ok: true }`                    |
| DELETE | `/api/account`       | Bearer | `{ ok: true }`                    |
| POST   | `/api/coach`         | Bearer | `{ suggestion: CoachSuggestion }` |

`Bearer` is the JWT session token from register/login; each token maps to a
`user_id`, so every account reads and writes only its own snapshot. Passwords are
stored only as a bcrypt hash. With no LLM key set, `/api/coach` returns 503 and
the app falls back to its deterministic baseline.

## Architecture notes

- `lib/db/webRepository.ts` extends `@tfc/core`'s `InMemoryRepository`, hydrating
  from IndexedDB on init and persisting the snapshot (debounced) after each
  mutation — the same `exportSnapshot`/`applySnapshot` path cloud sync uses.
- `lib/auth/session.ts` + `lib/coach/cache.ts` persist to `localStorage`.
- `lib/server/` is the backend: `db.ts` (Neon pool + schema), `auth.ts` (bcrypt +
  JWT), `llm.ts` (provider-agnostic coach adapter), `handler.ts` (the shared
  auth/error wrapper that replaces Express middleware).
- Route handlers pin `runtime = 'nodejs'` — `pg`, `bcryptjs`, and `jsonwebtoken`
  all need it — and `dynamic = 'force-dynamic'` so nothing is statically cached.
- Icons and the PWA manifest are generated at build time (`app/icon.tsx`,
  `app/apple-icon.tsx`, `app/manifest.ts`) — no binary assets to maintain.
