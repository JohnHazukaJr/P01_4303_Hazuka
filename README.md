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

This repository is the home for the Synodos project. Application code, stack choices, and deployment instructions will be added as the build progresses.

## Repository layout

| Path | Purpose |
|------|---------|
| [`index.html`](index.html) | Landing page entry (open locally or serve from repo root). |
| [`login.html`](login.html) | Sign-in with email or username — JWT stored for `dashboard.html`. |
| [`register.html`](register.html) | Create account with username, email, and password (`POST /api/auth/register`). |
| [`profile-setup.html`](profile-setup.html) | First-time profile (after register) — full profile + live preview (`PATCH /api/me`). |
| [`profile.html`](profile.html) | Edit your Synodos space anytime (same fields + preview). |
| [`dashboard.html`](dashboard.html) | After login and completed profile — projects and `GET /api/me`. |
| [`project.html`](project.html) | Public project page (`?id=`) — open roles and join requests. |
| [`css/`](css/) | Stylesheets (`style.css`). |
| [`js/`](js/) | `auth.js`, `public-nav.js`, `theme-init.js`, `theme.js`, `site-nav.js`, `login.js`, `register.js`, `profile-form.js`, `dashboard.js`, `project-page.js`, `project-join.js`, etc. |
| [`assets/`](assets/) | Images, icons, or other static files (optional). |
| [`server/`](server/) | **Node.js (Express)** REST API — see [`server/README.md`](server/README.md). |
| [`NEXT.md`](NEXT.md) | Roadmap and dev-loop checklist. |

## Getting started

**Backend (Node.js):** Use **Node.js 22.5+** (needed for built-in SQLite). In the `server` folder run `npm install` then `npm start`. The API serves at `http://localhost:8080` (`GET /api/health`, auth routes in [`server/README.md`](server/README.md)).

**Frontend:** Open `index.html` or `login.html` through a local web server (for example Live Server) so the login page can reach the API. With the server stopped, sign-in shows a short alert explaining how to start it.

**Verify API (optional):** With `npm start` running in another terminal, from `server/` run `npm run verify` — it checks `GET /api/health`.

## What to do next

See **[`NEXT.md`](NEXT.md)** for the dev loop checklist (Live Server + login) and a **feature roadmap** (real auth, sign-up, projects, deploy). Align priorities with your course requirements.

## Contributing

If you are collaborating on this codebase or product design, use issues or your course’s workflow for proposals and review. Keep changes focused and documented so newcomers can run and understand the project quickly.

---

*Course / author note: P01_4303_Hazuka*
 