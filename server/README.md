# Sync server (Railway)

A tiny Express + Postgres service that stores one JSON snapshot per user for the
Training for Climbing app's cloud sync, and (optionally) powers the **AI coach**
behind `POST /coach`. The app's sync engine is backend-agnostic; this is just a
remote store plus a thin LLM proxy so the app never holds an LLM key.

## Deploy to Railway

1. **Create a project** and add a **Postgres** database (New → Database → Postgres).
2. **Add a service from this repo** pointing at the `server/` directory
   (New → GitHub Repo → set the service **Root Directory** to `server`).
   Railway/Nixpacks detects Node and runs `npm start`.
3. **Variables** on the service:
   - `DATABASE_URL` → reference the Postgres plugin's `DATABASE_URL`
     (Variables → Add Reference → Postgres → `DATABASE_URL`).
   - `SYNC_TOKEN` → a long random secret (e.g. `openssl rand -hex 32`).
   - `PORT` is provided by Railway automatically.
   - _(optional, enables the AI coach)_ `GEMINI_API_KEY` → a **free** key from
     <https://aistudio.google.com/apikey>. See "AI coach" below.
4. **Generate a domain** (Settings → Networking → Generate Domain). That HTTPS URL
   is your sync server URL.
5. Verify: `curl https://<your-domain>/health` → `{"ok":true,"coach":true}`
   (`coach` is `true` once an LLM key is set).

## Use it in the app

In the app: **Review → Cloud sync**, enter the server URL and the same `SYNC_TOKEN`,
then **Connect & sync**. (You can also set a default URL via `EXPO_PUBLIC_SYNC_URL`.)

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

| Method | Path        | Auth   | Body          | Response                          |
| ------ | ----------- | ------ | ------------- | --------------------------------- |
| GET    | `/health`   | –      | –             | `{ ok: true, coach: boolean }`    |
| GET    | `/snapshot` | Bearer | –             | `{ data: Snapshot \| null }`      |
| PUT    | `/snapshot` | Bearer | Snapshot JSON | `{ ok: true }`                    |
| POST   | `/coach`    | Bearer | `{ context }` | `{ suggestion: CoachSuggestion }` |

`SYNC_TOKEN` is a shared secret that gates a single snapshot — perfect for one
person syncing across devices. Per-user accounts can be added later by mapping
tokens to `user_id`.
