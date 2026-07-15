# Training for Climbing — Web

A mobile-friendly, installable (PWA) web build of the Training for Climbing app.
Next.js (App Router) + Tailwind CSS v4, sharing all domain logic with the mobile
app via the `@tfc/core` workspace package.

- **Local-first:** data is stored in the browser (IndexedDB) and works offline.
- **Cloud-backed:** signing in backs up / syncs your data to the existing Railway
  backend. All backend calls go through same-origin Next route handlers under
  `/api` (which proxy to Railway), so there is no CORS to configure and the
  backend URL stays server-side.

## Develop

From the repo root (npm workspaces):

```bash
npm install            # installs all workspaces (needs npm registry access)
npm run dev:web        # → http://localhost:3000
```

Create `apps/web/.env.local`:

```
RAILWAY_API_URL=https://your-app.up.railway.app
```

(Server-side only — never exposed to the browser. See `.env.example`.)

## Build

```bash
npm run build:web
```

## Deploy (Vercel)

1. Import the repo into Vercel.
2. Set **Root Directory** to `apps/web` (Vercel auto-detects Next.js; the monorepo
   `@tfc/core` is transpiled via `transpilePackages` in `next.config.ts`).
3. Add the environment variable `RAILWAY_API_URL` (production + preview).
4. Deploy. No `vercel.json` is needed — the App Router handles routing, and the
   `/api/*` route handlers proxy to Railway.

The Railway backend (Express + Postgres, in `server/` at the repo root) is
unchanged and needs no CORS.

## Architecture notes

- `lib/db/webRepository.ts` extends `@tfc/core`'s `InMemoryRepository`, hydrating
  from IndexedDB on init and persisting the snapshot (debounced) after each
  mutation — the same `exportSnapshot`/`applySnapshot` path cloud sync uses.
- `lib/auth/session.ts` + `lib/coach/cache.ts` persist to `localStorage`.
- Icons and the PWA manifest are generated at build time (`app/icon.tsx`,
  `app/apple-icon.tsx`, `app/manifest.ts`) — no binary assets to maintain.
