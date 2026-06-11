# Sync server (Railway)

An Express + Postgres service that backs the Training for Climbing app:
**per-user accounts** (email + password), one private JSON snapshot per account
for cloud sync, and (optionally) the **AI coach** behind `POST /coach`. The app's
sync engine is backend-agnostic; this is a remote store plus a thin LLM proxy so
the app never holds an LLM key.

Each account signs in with email + password and gets its own data — friends can
all use the same server without seeing each other's training.

## Deploy to Railway

1. **Create a project** and add a **Postgres** database (New → Database → Postgres).
2. **Add a service from this repo** pointing at the `server/` directory
   (New → GitHub Repo → set the service **Root Directory** to `server`).
   Railway/Nixpacks detects Node and runs `npm start`.
3. **Variables** on the service:
   - `DATABASE_URL` → reference the Postgres plugin's `DATABASE_URL`
     (Variables → Add Reference → Postgres → `DATABASE_URL`).
   - `JWT_SECRET` → a long random secret used to sign session tokens
     (e.g. `openssl rand -hex 32`). Falls back to `SYNC_TOKEN` if you still have
     that set from an earlier deploy.
   - `PORT` is provided by Railway automatically.
   - _(optional, enables the AI coach)_ `GEMINI_API_KEY` → a **free** key from
     <https://aistudio.google.com/apikey>. See "AI coach" below.
4. **Generate a domain** (Settings → Networking → Generate Domain). That HTTPS URL
   is your sync server URL.
5. Verify: `curl https://<your-domain>/health` →
   `{"ok":true,"coach":true,"auth":true}` (`coach` true once an LLM key is set;
   `auth` true once `JWT_SECRET`/`SYNC_TOKEN` is set).

## Use it in the app

Bake the server URL into the app build via `EXPO_PUBLIC_SYNC_URL` (see the app
`.env.example`) so users never type it. Then in the app: **More → Account**,
**create an account** (or sign in) with an email + password — the first sync runs
automatically. Each account's data is private.

## Accounts & auth

Sign-in is email + password. `POST /auth/register` and `POST /auth/login` return a
**JWT session token** (passwords are stored only as a bcrypt hash). The token is
sent as a `Bearer` header on `/snapshot`, `/coach`, and `/account`; the server
resolves it to a `user_id` and scopes all data to that user. `DELETE /account`
removes the account and its snapshot (cascades via the FK). Registration is
currently open (fine for a small friends-and-family deployment); add an allow-list
or invite code later if you want to lock it down.

## AI coach

The coach is **opt-in and free at this scale**. The app sends a compact training
context (assessment, benchmarks, recent climbs, goals, last ~10 journal entries,
streak) to `POST /coach`; the server calls an LLM through a provider-agnostic
adapter (`llm.js`) and returns a structured suggestion. When no LLM key is set,
`/coach` returns `503` and the app falls back to its deterministic baseline.

Provider env (default **Google Gemini 2.5 Flash**, whose free tier covers a few
users × a handful of prompts/week at \$0):

| Variable         | Default          | Notes                                                     |
| ---------------- | ---------------- | --------------------------------------------------------- |
| `LLM_PROVIDER`   | `gemini`         | `gemini` or `groq`                                        |
| `GEMINI_API_KEY` | –                | free key: <https://aistudio.google.com/apikey>            |
| `GROQ_API_KEY`   | –                | free alt (Llama-3.3-70B): <https://console.groq.com/keys> |
| `LLM_MODEL`      | provider default | override the model name                                   |

Swapping to a paid / no-train provider (Anthropic, OpenAI) later is a one-module
change in `llm.js` — the app and the `/coach` route are unchanged.

> **Privacy:** with the coach enabled, your own training data + journal text are
> sent to your Railway server, which forwards them to the LLM provider. Free tiers
> may use inputs to improve their models. This is surfaced in the app's Profile
> screen and is off by default.

## Endpoints

| Method | Path             | Auth   | Body                  | Response                          |
| ------ | ---------------- | ------ | --------------------- | --------------------------------- |
| GET    | `/health`        | –      | –                     | `{ ok, coach, auth }`             |
| POST   | `/auth/register` | –      | `{ email, password }` | `{ token, user }`                 |
| POST   | `/auth/login`    | –      | `{ email, password }` | `{ token, user }`                 |
| GET    | `/snapshot`      | Bearer | –                     | `{ data: Snapshot \| null }`      |
| PUT    | `/snapshot`      | Bearer | Snapshot JSON         | `{ ok: true }`                    |
| DELETE | `/account`       | Bearer | –                     | `{ ok: true }`                    |
| POST   | `/coach`         | Bearer | `{ context }`         | `{ suggestion: CoachSuggestion }` |

`Bearer` is the JWT session token returned by register/login. Each token maps to a
`user_id`, so every account reads/writes only its own snapshot.
