# synodos

Peer-first platform for finding collaborators: projects, open roles, and structured profiles. **synodos** (Greek *σύνοδος* — assembly) emphasizes intent and complementary skills over generic feeds.

**Live site:** [synodos.netlify.app](https://synodos.netlify.app/)

## Stack

| Layer | Technology |
|--------|-------------|
| **Frontend** | Static HTML/CSS/JS in [`web/`](web/) |
| **Backend** | Node.js 22.5+, Express, JWT, bcrypt |
| **Database** | PostgreSQL via [`pg`](https://node-postgres.com/) — hosted on [Supabase](https://supabase.com/) |
| **Object storage** | Supabase Storage (avatars bucket, CDN-served) |

**Where application data lives:** everything the site persists goes to Supabase — not to SQLite or the API server’s disk. **PostgreSQL** (via `DATABASE_URL`) holds accounts, profiles and work tags, projects and roles, join requests and invitations, follows, feed events, direct messages, and notifications — see [`server/migrations/001_init.sql`](server/migrations/001_init.sql). **Supabase Storage** holds profile images (the only binary uploads today). The API is stateless: no local database file and no required persistent volume once you use this setup.

## Repository layout

```
├── web/                 # Static site — deploy this directory (Netlify, GitHub Pages)
├── server/              # REST API — see server/README.md
├── docs/                # Structure, roadmap, smoke tests — start at docs/README.md
├── .github/workflows/   # GitHub Pages workflow for web/
├── docker-compose.yml   # Optional local Postgres (see docs/SMOKECHECK_UI.md)
├── netlify.toml         # Publish root = web/
├── render.yaml          # Example Render services (set Supabase env in dashboard)
├── package.json         # npm start, migrate, verify, …
└── index.html           # Redirect at repo root → web/index.html
```

| Path | Role |
|------|------|
| [`web/index.html`](web/index.html) | Landing |
| [`web/login.html`](web/login.html) / [`web/register.html`](web/register.html) | Auth |
| [`web/profile-setup.html`](web/profile-setup.html) / [`web/profile.html`](web/profile.html) | Profile |
| [`web/dashboard.html`](web/dashboard.html) | Projects feed |
| [`web/project.html`](web/project.html) | Public project (`?id=`) |
| [`web/user.html`](web/user.html) | Public profile (`?u=`) |
| [`server/`](server/) | API, migrations, scripts |
| [`docs/README.md`](docs/README.md) | Index of all docs |

## Quick start

**Requirements:** [Node.js 22.5+](https://nodejs.org/) (LTS recommended) and a [Supabase](https://supabase.com/) project.

1. **Provision Supabase** (one-time): create a project, then copy the pooled `DATABASE_URL`, the `SUPABASE_URL`, and the `service_role` key. Create a public bucket named `avatars`. Full walkthrough in [`server/README.md`](server/README.md#3-provision-supabase-one-time).

2. **Install API dependencies** (from repo root):

   ```bash
   npm install --prefix server
   ```

3. **Configure env**: copy `server/.env.example` to `server/.env` (or set the same variables in your shell / host dashboard). Required: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Recommended: `JWT_SECRET`, `ALLOWED_ORIGINS`. Full table in [`server/README.md`](server/README.md#environment-variables).

4. **Apply migrations** (one-time per database):

   ```bash
   npm run migrate
   ```

5. **Run the API:**

   ```bash
   npm start
   ```

   Default URL: `http://localhost:8080` · health check: [`GET /api/health`](http://localhost:8080/api/health).

   Port in use? Example (PowerShell): `$env:PORT=8081; npm start`

6. **Run the frontend:** serve [`web/`](web/) with a static server (e.g. VS Code Live Server) so `fetch` can reach the API. For a non-default API URL, set `window.SYNODOS_API_BASE` before scripts that load [`web/js/auth.js`](web/js/auth.js).

7. **Optional:** with the API running, `npm run verify` checks `/api/health` (includes a live database ping).

**After filling Supabase values in `server/.env`:** `npm run check-env` (validates vars), `npm run verify-schema` (confirms tables after migrate), `npm run health-check` (starts API on a temp port and checks DB connectivity). Full browser checklist: [`docs/SMOKECHECK_UI.md`](docs/SMOKECHECK_UI.md).

Full route list: [`server/README.md`](server/README.md).

## Documentation

- [`docs/README.md`](docs/README.md) — index of docs (structure, roadmap, smoke tests)  
- [`server/README.md`](server/README.md) — API routes and environment variables  

## Deployment

- **Static site (Netlify):** [https://synodos.netlify.app/](https://synodos.netlify.app/) — publish root is `web/` (see [`netlify.toml`](netlify.toml)). **Required:** add environment variable **`SYNODOS_API_BASE`** = your API origin (e.g. `https://synodos-api.onrender.com`, no trailing slash). Each build runs `node web/scripts/write-netlify-api-base.js`, which writes `web/js/netlify-api-base.js` so login/register call the real API instead of `localhost:8080`. GitHub Pages: see [`.github/workflows/deploy-github-pages.yml`](.github/workflows/deploy-github-pages.yml) — set the same variable in the workflow if you use it.
- **API:** not hosted on Netlify; run separately (e.g. Railway, Render, Fly).

### Deploying the API

Because the database lives in Supabase and avatars live in Supabase Storage, the API host is stateless — **no persistent disk required**.

1. Set the environment variables on the host (see the [env table](server/README.md#environment-variables)):
   - **Required:** `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
   - **Recommended for production:** `JWT_SECRET`, `ALLOWED_ORIGINS` (comma-separated, e.g. `https://synodos.netlify.app`).
   - Optional: `SUPABASE_AVATAR_BUCKET` (defaults to `avatars`), `PORT`.
2. Build / install: `npm install --prefix server`.
3. Start: `npm start` (or `node server/index.js`).
4. **Once per database**, apply migrations: `npm run migrate` (idempotent; tracks applied files in `schema_migrations`).
5. Point the live UI at the deployed API: on **Netlify** set **`SYNODOS_API_BASE`** (see above). Alternatively use a `<meta name="synodos-api-base" content="https://…">` tag or `localStorage.setItem("synodos_api_base", "https://…")` (see [`web/js/config.js`](web/js/config.js)).

## License / attribution

Course project (TTU CS 4303 P01). All rights reserved unless you add an explicit license.
