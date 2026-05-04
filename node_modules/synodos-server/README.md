# synodos — Node.js backend (Express)

REST API for the synodos project. Requires **[Node.js 22.5+](https://nodejs.org/)** and a [Supabase](https://supabase.com/) project (hosted Postgres + object storage).

**Docs index** (structure, roadmap, smoke tests): [`../docs/README.md`](../docs/README.md).

## Stack

- **Express** — HTTP API
- **PostgreSQL** via [`pg`](https://node-postgres.com/) — schema in [`migrations/`](migrations), applied with `npm run migrate`
- **Supabase Storage** via [`@supabase/supabase-js`](https://github.com/supabase/supabase-js) — avatars bucket (CDN-served, survives redeploys)
- **bcryptjs** — password hashing
- **jsonwebtoken** — JWT bearer tokens (7-day expiry)
- **express-rate-limit** — limits `POST /api/auth/login` and `POST /api/auth/register` (abuse / brute-force mitigation)

**API errors:** Unhandled route failures return JSON `{ error: "Internal server error" }` via a final Express error handler (with `express-async-errors`, async route throws are included). Unknown `/api/*` paths return **404** `{ error: "Not found" }`.

All relational data for the app (users, projects, roles, join requests, invitations, follows, feed events, DMs, notifications, etc.) is stored **only** in Postgres on Supabase via `DATABASE_URL`. The API does not use a local SQLite file or any server-local database. Profile photos are the only blobs; they go to Storage, not the database.

## Environment variables

Copy `.env.example` to `.env` (or set these in your host's dashboard):

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Supabase **Pooled** connection string (port `6543`). Used by `pg.Pool`. |
| `JWT_SECRET` | prod | Secret used to sign session JWTs. A default is used for local dev only. |
| `SUPABASE_URL` | yes | `https://<project-ref>.supabase.co` — used to build avatar public URLs. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service-role key for server-side uploads. **Never** ship to the browser. |
| `SUPABASE_AVATAR_BUCKET` | no | Storage bucket name. Defaults to `avatars`. |
| `ALLOWED_ORIGINS` | prod | Comma-separated CORS allowlist (e.g. `https://synodos.netlify.app`). Omit in dev to allow all. |
| `PORT` | no | API port. Defaults to `8080`. |
| `PGSSLMODE` | no | Set to `disable` for local Postgres without TLS. Otherwise leave unset (Supabase requires TLS). |
| `SYNODOS_ADMIN_USER_IDS` | no | Comma-separated numeric user IDs allowed to call `PATCH /api/admin/users/:username/badges`. |
| `SYNODOS_ADMIN_USERNAMES` | no | Comma-separated **usernames** (e.g. `synodos`) — same admin powers as IDs. Easiest if you do not know your numeric id. |

## Setup

### 1. Install Node.js (includes `npm`)

Download the **LTS** installer from [https://nodejs.org/](https://nodejs.org/) and run it. Leave **“Add to PATH”** enabled if the wizard offers it.

### 2. Confirm the tools are available

Open a **new** terminal and run `node -v` and `npm -v`.

### Legacy `synodos.db` on disk

Older clones may still have `server/data/synodos.db`. The current API **does not open that file** — all SQL goes to `DATABASE_URL`. Delete it when nothing has the file open (e.g. close DB browser tabs), e.g. `Remove-Item server/data/synodos.db` in PowerShell, to avoid confusion.

### 3. Provision Supabase (one-time)

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. **Project Settings → Database → Connection string**: copy the **Pooled** URI (port `6543`). Set it as `DATABASE_URL`.
3. **Project Settings → API**: copy the **Project URL** → `SUPABASE_URL`, and the **`service_role`** key → `SUPABASE_SERVICE_ROLE_KEY`. Treat the service-role key like a password.
4. **Storage → New bucket**: create a **public** bucket named `avatars` (or any name; set `SUPABASE_AVATAR_BUCKET` to match).

### 4. Install dependencies, migrate, and run

From this `server/` directory:

```bash
npm install
npm run migrate   # applies migrations/*.sql to DATABASE_URL (idempotent)
npm start
```

With the server running in another terminal, **`npm run verify`** checks `GET /api/health` (includes a database ping).

Optional scripted checks (after `server/.env` is filled with real Supabase values):

| Script | What it does |
|--------|----------------|
| `npm run check-env` | Validates `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `npm run verify-schema` | Confirms every table from `migrations/` exists (run after migrate) |
| `npm run health-check` | Boots the API on port **19876**, asserts `/api/health` returns `database: connected`, then exits |

The API listens on **http://localhost:8080** (override with `PORT`).

### Carrying over legacy on-disk avatars (optional, one-time)

If you still have files under `data/uploads/avatars/` from an older deployment that saved avatars on the API host, run:

```bash
npm run migrate-avatars
```

It uploads each matching `users.avatar_url` (`/uploads/avatars/…`) to the bucket and rewrites the column. Idempotent.

### “Cannot GET /” in the browser

`http://localhost:8080/` is **only the API**. Open **`web/index.html`** with **Live Server** (or serve the `web/` folder) for the site. Use **`http://localhost:8080/api/health`** to verify the API.

### If `npm install` still fails

Copy the full error message. Try `npm install --verbose`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check — `200` with DB connected, or `503` if Postgres is unreachable |
| `POST` | `/api/auth/register` | Create account — JSON `{ "username", "email", "password" }` (username 3–32 chars; password min 8) |
| `POST` | `/api/auth/login` | Sign in — JSON `{ "identifier", "password" }` or legacy `{ "email", "password" }` — `identifier` is email **or** username — returns `{ token, message }` |
| `GET` | `/api/profile-fields` | Work taxonomy — JSON `{ fields: { tech, art, blue_collar: { label, subfields[] } } }` (no auth) |
| `GET` | `/api/me` | Current user — `Authorization: Bearer <jwt>` — includes `work_tags[]`, `verified` (identity), `official_account` (platform), `avatar_url`, `profile_complete`, etc. |
| `PATCH` | `/api/me` | Update profile — **auth** — `work_tags`: 1–12 × `{ work_field, work_subfield }`, or legacy single pair; plus `display_name`, `bio?`, optional `avatar_data`, `avatar_reset` |
| `PATCH` | `/api/admin/users/:username/badges` | **Admin only** (`SYNODOS_ADMIN_USER_IDS` and/or `SYNODOS_ADMIN_USERNAMES` in `.env`) — JSON `{ "verified"?: boolean, "official_account"?: boolean }` |
| `GET` | `/api/projects` | List projects (`roles[]`, `role_count`). With `Authorization: Bearer <jwt>`, each project has `feed_match_count` (how many of your field/subfield tags match the owner’s); results sorted by match count then recency |
| `POST` | `/api/projects` | Create project — JSON `{ "title", "description?" }` — **auth** |
| `GET` | `/api/projects/:id` | Project detail + roles |
| `DELETE` | `/api/projects/:id` | Delete project — **owner, auth** |
| `POST` | `/api/projects/:id/roles` | Add open role — JSON `{ "title", "skills?", "slots?" }` — **owner, auth** |
| `DELETE` | `/api/projects/:id/roles/:roleId` | Remove open role — **owner, auth** |
| `POST` | `/api/projects/:id/join-requests` | Request to join — **auth**, not owner — JSON `{ "role_id?": number, "note?": string }` |
| `GET` | `/api/projects/:id/join-requests` | List join requests — **owner, auth** — query `?status=pending` (default), `all`, or a specific status |
| `PATCH` | `/api/projects/:id/join-requests/:requestId` | Accept or decline — **owner** — JSON `{ "status": "accepted" \| "declined" }` |
| `DELETE` | `/api/projects/:id/join-requests/:requestId` | Withdraw your pending request — **requester** |
| `GET` | `/api/me/join-requests` | Your outgoing join requests (all statuses) — **auth** |
| `GET` | `/api/me/project-requests-inbox` | Pending requests across projects you own — **auth** |
| `GET` | `/api/me/notifications/unread-count` | Unread count for the header badge — **auth** |
| `GET` | `/api/me/notifications` | Notification list — **auth** — optional `?limit=` |
| `PATCH` | `/api/me/notifications/:id/read` | Mark one read — **auth** |
| `POST` | `/api/me/notifications/read-all` | Mark all read — **auth** |
| `POST` | `/api/projects/:id/invites` | Invite a user by username — **owner** — JSON `username`, optional `note` |
| `GET` | `/api/me/project-invitations` | Pending invitations to you — **auth** |
| `PATCH` | `/api/me/project-invitations/:id` | Accept or decline — **auth** — JSON `{ "status": "accepted" \| "declined" }` |
| `GET` | `/api/users/:username` | Public profile (no email). With **optional** `Authorization`, includes `viewer_follows` |
| `POST` | `/api/users/:username/follow` | Follow user — **auth** (idempotent if already following) |
| `DELETE` | `/api/users/:username/follow` | Unfollow — **auth** |
| `GET` | `/api/feed` | Activity from you and accounts you follow — **auth** — `?cursor=` (event id), `?limit=` (default 20, max 50) |
| `GET` | `/api/conversations` | Your DM threads — **auth** |
| `POST` | `/api/conversations` | Open or create 1:1 thread — **auth** — JSON `{ "with_username": "…" }` |
| `GET` | `/api/conversations/:id/messages` | Messages — **auth**, participant only — `?cursor=`, `?limit=` |
| `POST` | `/api/conversations/:id/messages` | Send message — **auth** — JSON `{ "body": "…" }` (max 8000 chars) |

## Frontend

Use **Live Server** on `web/index.html` (workspace folder `web/`). Flow: **register.html** → **profile-setup.html** → **dashboard.html**; or **login.html** → **dashboard.html** (or **profile-setup.html** / **profile.html** if profile is incomplete). Edit anytime via **profile.html** (“Your space”). JWT in `localStorage`.

## Notes

- **CORS** is open for development (`origin: true`). Restrict before production.

### Sign-in returns 500 / “Internal server error” on the host

Usually the API cannot query Postgres. On **Render**, open **Logs** and look for `POST /api/auth/login failed` plus a Postgres or TLS error. Typical fixes:

1. **`DATABASE_URL`** — Use Supabase **transaction pooler** URI (host like `aws-0-…pooler.supabase.com`, port **6543**), not the direct `5432` session string, which often times out from cloud hosts.
2. **Password** — Use the real database password in the URI (not the placeholder). URL-encode special characters in the password.
3. **`PGSSLMODE`** — Leave unset for Supabase (TLS required). Only set `PGSSLMODE=disable` for local Postgres without TLS.
4. After deploying this version, failed logins caused by DB connectivity return **503** with a clearer JSON `error` instead of a generic 500.
