# What to build next (Synodos)

## Done recently

- SQLite user store, bcrypt, JWT, register/login/dashboard.
- **Projects & open roles:** tables `projects` and `project_roles`, REST under `/api/projects`, dashboard UI to create projects and manage roles.
- **Profile:** `users.display_name` / `bio`, `GET/PATCH /api/me`, **profile-setup.html** after registration; dashboard redirects until profile is complete.

## Suggested order

| Priority | Work |
|----------|------|
| **Deploy** | Host API (Render, Railway, Fly.io) and static site; set `JWT_SECRET`, `SYNODOS_API_BASE` on pages, tighten CORS. |
| **Profile** | **`profile.html`** edits the same fields as setup (live preview). |
| **Polish** | Join requests, messaging, or richer discovery — as your syllabus allows. |

## Dev loop checklist

1. Terminal: `cd server` → `npm start` (API at `http://localhost:8080`).
2. **Live Server** on `index.html`.
3. Register → **profile-setup.html** → **dashboard.html** (or log in → dashboard). Create a project and open roles.
4. Optional: `cd server` → `npm run verify` for `/api/health`.

## Course alignment

Match milestones to your syllabus (auth, DB, deployment) and update this file or issues as you go.
