# synodos — Node.js backend (Express)

REST API for the synodos project. Requires **[Node.js 22.5+](https://nodejs.org/)** (built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html); no native addon install).

## Stack

- **Express** — HTTP API
- **`node:sqlite`** (`DatabaseSync`) — local database file `data/synodos.db` (created on first run; gitignored)
- **bcryptjs** — password hashing
- **jsonwebtoken** — JWT bearer tokens (7-day expiry)

Set **`JWT_SECRET`** in production (environment variable). A default is used for local dev only.

## Setup

### 1. Install Node.js (includes `npm`)

Download the **LTS** installer from [https://nodejs.org/](https://nodejs.org/) and run it. Leave **“Add to PATH”** enabled if the wizard offers it.

### 2. Confirm the tools are available

Open a **new** terminal and run `node -v` and `npm -v`.

### 3. Install dependencies and run

From this `server/` directory:

```bash
npm install
npm start
```

With the server running in another terminal, **`npm run verify`** checks `GET /api/health`.

The API listens on **http://localhost:8080** (override with `PORT`).

### “Cannot GET /” in the browser

`http://localhost:8080/` is **only the API**. Open **`web/index.html`** with **Live Server** (or serve the `web/` folder) for the site. Use **`http://localhost:8080/api/health`** to verify the API.

### If `npm install` still fails

Copy the full error message. Try `npm install --verbose`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/register` | Create account — JSON `{ "username", "email", "password" }` (username 3–32 chars; password min 8) |
| `POST` | `/api/auth/login` | Sign in — JSON `{ "identifier", "password" }` or legacy `{ "email", "password" }` — `identifier` is email **or** username — returns `{ token, message }` |
| `GET` | `/api/profile-fields` | Work taxonomy — JSON `{ fields: { tech, art, blue_collar: { label, subfields[] } } }` (no auth) |
| `GET` | `/api/me` | Current user — `Authorization: Bearer <jwt>` — includes `work_tags[]` (labels + ids), legacy `work_field` / `work_subfield` (first tag), `avatar_url`, `profile_complete`, etc. |
| `PATCH` | `/api/me` | Update profile — **auth** — `work_tags`: 1–12 × `{ work_field, work_subfield }`, or legacy single pair; plus `display_name`, `bio?`, optional `avatar_data`, `avatar_reset` |
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
