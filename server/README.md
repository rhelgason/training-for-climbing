# Sync server (Railway)

A tiny Express + Postgres service that stores one JSON snapshot per user for the
Training for Climbing app's cloud sync. The app's sync engine is backend-agnostic;
this is just a remote store behind `GET/PUT /snapshot`.

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
4. **Generate a domain** (Settings → Networking → Generate Domain). That HTTPS URL
   is your sync server URL.
5. Verify: `curl https://<your-domain>/health` → `{"ok":true}`.

## Use it in the app

In the app: **Review → Cloud sync**, enter the server URL and the same `SYNC_TOKEN`,
then **Connect & sync**. (You can also set a default URL via `EXPO_PUBLIC_SYNC_URL`.)

## Endpoints

| Method | Path        | Auth   | Body          | Response                     |
| ------ | ----------- | ------ | ------------- | ---------------------------- |
| GET    | `/health`   | –      | –             | `{ ok: true }`               |
| GET    | `/snapshot` | Bearer | –             | `{ data: Snapshot \| null }` |
| PUT    | `/snapshot` | Bearer | Snapshot JSON | `{ ok: true }`               |

`SYNC_TOKEN` is a shared secret that gates a single snapshot — perfect for one
person syncing across devices. Per-user accounts can be added later by mapping
tokens to `user_id`.
