# Repository structure

```
├── web/                    Static site (HTML, CSS, JS, images) — Netlify publish root
├── server/                 Express API (Node), Postgres via Supabase, optional scripts
│   ├── index.js            App entry, auth, profile, mounts routers
│   ├── dbPool.js           PostgreSQL pool (`DATABASE_URL`)
│   ├── storage.js          Supabase Storage (avatars)
│   ├── migrations/         SQL migrations (run `npm run migrate`)
│   ├── routes/             Feature routers (projects, users, feed, DMs, …)
│   ├── scripts/            migrate, verify-health, check-env, verify-schema, dev-health-check
│   ├── package.json
│   └── README.md           API reference and env table
├── docs/                   This folder — structure, roadmap, smoke tests
├── .github/workflows/      GitHub Pages deploy for `web/`
├── docker-compose.yml      Optional local Postgres (schema tests without Supabase)
├── netlify.toml            Static site → `web/`; build writes `web/js/netlify-api-base.js` from `SYNODOS_API_BASE`
├── render.yaml             Example Render blueprint (API + static; env set in dashboard)
├── package.json            Root: `npm start`, `npm run migrate`, `npm run verify`, …
├── index.html              Repo-root redirect → `web/index.html`
└── README.md               Project overview and quick start
```

## `server/data/` (local only)

The directory `server/data/` is **gitignored**. It may hold legacy files (e.g. old SQLite or `uploads/`). The running app does **not** use a local database file; data lives in **Supabase Postgres** and **Supabase Storage**.

## Frontend entry points

| Path | Role |
|------|------|
| `web/index.html` | Landing |
| `web/login.html` / `web/register.html` | Auth |
| `web/profile-setup.html` / `web/profile.html` | Profile |
| `web/dashboard.html` | Projects feed |
| `web/project.html` | Public project (`?id=`) |
| `web/user.html` | Public profile (`?u=username`) |
| `web/messages.html` / `web/notifications.html` | Comms |
| `web/404.html` | Static “page not found” (Netlify / Render static serve this for unknown URLs) |

**Local workflow:** `npm start` at repo root (or `cd server && npm start`), then serve `web/` with Live Server so `fetch` reaches the API.

**Frontend resilience:** `web/js/global-errors.js` shows a one-time dismissible banner on uncaught JS errors / unhandled promise rejections (included on pages that load `config.js` + `auth.js`).
