# What to build next (Synodos)

## Done recently

- **Dashboard:** filter / search open projects (title, description, owner email) and “My projects only”; new-project form uses `reportValidity()` for clearer HTML5 errors.
- **Theme:** appearance cycles **light → dark → system** (stored as `auto`); system preference updates live when in system mode.
- **Nav (mobile):** menu open/close uses height/opacity transition; menu icon rotates slightly when open.
- SQLite user store, bcrypt, JWT, register/login/dashboard.
- **Projects & open roles:** tables `projects` and `project_roles`, REST under `/api/projects`, dashboard UI to create projects and manage roles.
- **Profile:** `users.display_name` / `bio`, `GET/PATCH /api/me`, **profile-setup.html** after registration; dashboard redirects until profile is complete.
- **Project page:** **`project.html?id=…`** (public view + shareable link); dashboard cards link here.
- **Join requests:** table `project_join_requests`, REST (`POST/GET/PATCH/DELETE` under `/api/projects/:id/join-requests`, inbox at `GET /api/me/project-requests-inbox`), UI on project page and dashboard **Requests on my projects**.
- **Landing:** CTAs point to **register.html**; **`public-nav.js`** swaps header when a JWT is present.

## Suggested order

| Priority | Work |
|----------|------|
| **Deploy** | Host API (Render, Railway, Fly.io) and static site; set `JWT_SECRET`, `SYNODOS_API_BASE` on pages, tighten CORS. |
| **Profile** | **`profile.html`** edits the same fields as setup (live preview). |
| **Polish** | Messaging, team membership after accept, or richer discovery — as your syllabus allows. |

## Dev loop checklist

1. Terminal: `cd server` → `npm start` (API at `http://localhost:8080`).
2. **Live Server** on `index.html`.
3. Register → **profile-setup.html** → **dashboard.html** (or log in → dashboard). Create a project and open roles; open **project.html?id=…** to request to join; owners see pending requests on the dashboard.
4. Optional: `cd server` → `npm run verify` for `/api/health`.

## Course alignment

Match milestones to your syllabus (auth, DB, deployment) and update this file or issues as you go.
