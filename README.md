# Synodos

**Synodos** (Greek *σύνοδος* — gathering, assembly) is a peer-finding platform for people who want to build together: side projects, coursework teams, creative work, startups, or any collaboration where **complementary skills** matter more than who you already know.

Traditional networking leans on geography, conferences, and mutual connections. Synodos is **intent-first**: projects and open roles are visible, discovery is structured, and the social graph grows around **shipping work**, not idle scrolling.

## The problem

- Hard to find **specialists** (design, audio, data, writing, ops) when your circle is mostly devs—or the other way around.
- Generic social feeds and résumé sites don’t express **what you’re building right now** and **what you’re missing**.
- Real-life networking is uneven: time, confidence, and location shouldn’t decide who gets to collaborate.

## What Synodos is for

- Forming **project teams** with explicit roles, skills, and time commitment.
- Browsing **projects that need your specialty** instead of cold-DMing strangers.
- Leaving a **trail of contribution**: milestones, shipped artifacts, and credit on completed work.

## Core ideas

| Concept | Description |
|--------|-------------|
| **Project-first** | The main unit is a project (scope, timeline, artifact goals)—not just a profile. |
| **Open roles** | Slots like “UI design, ~8 hrs/wk” or “backend API, async” with required skills or tools. |
| **Structured discovery** | Search and filter by skills, commitment, domain, or tooling—not only by name or company. |
| **Human in the loop** | Join requests, approvals, and edits stay with people; automation supports matching and clarity, not spam. |

## Planned capabilities

These are the capabilities the product is designed around; implementation will grow over time.

- **Project hub** — description, milestones, links to repos or demos, status (recruiting / active / shipped).
- **Role-based recruiting** — defined seats, skill tags, optional time zones and weekly hours.
- **Peer discovery** — find projects seeking your skills; find people for open roles on your project.
- **Project timeline** — updates, decisions, and shipped checkpoints visible to the team (and optionally publicly).
- **Attribution** — contributor credits tied to a finished project for portfolios and references.

## Status

This repo contains a **working prototype**: static pages in [`web/`](web/) and a **Node.js + Express + SQLite** API in [`server/`](server/). Implemented today: accounts (register / login, JWT), profiles with work tags and avatars, projects with open roles, a dashboard feed, public project pages, and join requests (request, owner inbox, accept / decline). Roadmap items (timelines, richer discovery, attribution) are tracked in [`docs/NEXT.md`](docs/NEXT.md).

## Repository layout

| Path | Purpose |
|------|---------|
| [`web/`](web/) | **Static site** — HTML pages, [`web/css/`](web/css/), [`web/js/`](web/js/), [`web/images/`](web/images/). Deploy this folder (Netlify / GitHub Pages). |
| [`web/index.html`](web/index.html) | Landing page. |
| [`web/login.html`](web/login.html) | Sign-in — JWT stored for the dashboard. |
| [`web/register.html`](web/register.html) | Create account (`POST /api/auth/register`). |
| [`web/profile-setup.html`](web/profile-setup.html) | First-time profile after register (`PATCH /api/me`). |
| [`web/profile.html`](web/profile.html) | Edit profile (“Your space”). |
| [`web/dashboard.html`](web/dashboard.html) | Projects feed after login + completed profile. |
| [`web/project.html`](web/project.html) | Public project page (`?id=`). |
| [`server/`](server/) | **Node.js (Express)** REST API — see [`server/README.md`](server/README.md). |
| [`docs/NEXT.md`](docs/NEXT.md) | Roadmap and dev-loop checklist. |
| [`docs/STRUCTURE.md`](docs/STRUCTURE.md) | Folder overview. |
| [`index.html`](index.html) (repo root) | Redirects to [`web/index.html`](web/index.html) when you open the repo root in a browser (`file://` or a static server). |

## Getting started

**Backend (Node.js):** Use **Node.js 22.5+** (needed for built-in SQLite).

1. Install dependencies (once): from the **repo root** run `npm install --prefix server`, **or** `cd server` then `npm install`.
2. Start the API:
   - **From repo root:** `npm start` (uses the root `package.json` to run the server).
   - **From `server/`:** `npm start`.

The API listens at `http://localhost:8080` (`GET /api/health`; full routes in [`server/README.md`](server/README.md)).

**If `npm start` fails with “port 8080 already in use”:** another program (often a previous `npm start`) is using that port. Stop it, or use another port, e.g. in PowerShell: `$env:PORT=8081; npm start` (from root) or `cd server` then the same `PORT` line before `npm start`.

**If `npm` / `node` is not recognized:** install [Node.js LTS](https://nodejs.org/) and open a **new** terminal.

**Frontend:** Open **`web/index.html`** (or serve the **`web/`** folder) with Live Server so pages can reach the API. If the UI is hosted separately (e.g. GitHub Pages) and the API is on another origin, set **`window.SYNODOS_API_BASE`** to your API base URL (see script includes on pages that load [`web/js/auth.js`](web/js/auth.js)).

**Verify API (optional):** With the server running, from repo root run `npm run verify`, or `cd server` and `npm run verify`.

## What to do next

See **[`docs/NEXT.md`](docs/NEXT.md)** for the dev loop checklist (Live Server + login) and a **feature roadmap**. Align priorities with your course requirements.

## Contributing

If you are collaborating on this codebase or product design, use issues or your course’s workflow for proposals and review. Keep changes focused and documented so newcomers can run and understand the project quickly.

---

*Course / author note: P01_4303_Hazuka*
 