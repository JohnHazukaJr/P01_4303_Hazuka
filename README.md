# synodos

Peer-first platform for finding collaborators: projects, open roles, and structured profiles. **synodos** (Greek *σύνοδος* — assembly) emphasizes intent and complementary skills over generic feeds.

**Live site:** [synodos.netlify.app](https://synodos.netlify.app/)

## Stack

| Layer | Technology |
|--------|-------------|
| **Frontend** | Static HTML/CSS/JS in [`web/`](web/) |
| **Backend** | Node.js 22.5+, Express, JWT, bcrypt |
| **Database** | SQLite (`node:sqlite`), file under `server/data/` (gitignored) |

## Repository layout

```
├── web/           # Static site — deploy this directory (Netlify, GitHub Pages, etc.)
├── server/        # REST API — see server/README.md
├── docs/          # Roadmap and structure notes
├── package.json   # Root scripts: npm start, npm run verify
└── index.html     # Optional redirect at repo root → web/index.html
```

| Path | Role |
|------|------|
| [`web/index.html`](web/index.html) | Landing |
| [`web/login.html`](web/login.html) / [`web/register.html`](web/register.html) | Auth |
| [`web/profile-setup.html`](web/profile-setup.html) / [`web/profile.html`](web/profile.html) | Profile |
| [`web/dashboard.html`](web/dashboard.html) | Projects feed |
| [`web/project.html`](web/project.html) | Public project (`?id=`) |
| [`server/`](server/) | API and data layer |

## Quick start

**Requirements:** [Node.js 22.5+](https://nodejs.org/) (LTS recommended).

1. **Install API dependencies** (from repo root):

   ```bash
   npm install --prefix server
   ```

2. **Run the API:**

   ```bash
   npm start
   ```

   Default URL: `http://localhost:8080` · health check: [`GET /api/health`](http://localhost:8080/api/health).

   Port in use? Example (PowerShell): `$env:PORT=8081; npm start`

3. **Run the frontend:** serve [`web/`](web/) with a static server (e.g. VS Code Live Server) so `fetch` can reach the API. For a non-default API URL, set `window.SYNODOS_API_BASE` before scripts that load [`web/js/auth.js`](web/js/auth.js).

4. **Optional:** with the API running, `npm run verify` checks `/api/health`.

Full route list and env notes: [`server/README.md`](server/README.md).

## Documentation

- [`docs/STRUCTURE.md`](docs/STRUCTURE.md) — folder overview  
- [`docs/NEXT.md`](docs/NEXT.md) — roadmap and local dev checklist  

## Deployment

- **Static site (Netlify):** [https://synodos.netlify.app/](https://synodos.netlify.app/) — publish root is `web/` (see [`netlify.toml`](netlify.toml)). GitHub Pages workflow: [`.github/workflows/deploy-github-pages.yml`](.github/workflows/deploy-github-pages.yml).
- **API:** not hosted on Netlify; run separately (e.g. Railway, Render). Set `JWT_SECRET`, tighten CORS, and point the live UI at that API with `window.SYNODOS_API_BASE` if it is not on `localhost:8080`.

## License / attribution

Course project (TTU CS 4303 P01). All rights reserved unless you add an explicit license.
