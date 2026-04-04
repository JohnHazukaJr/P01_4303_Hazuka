# What to build next (Synodos)

Use this as a roadmap. Pick items that match **your course syllabus** and assignment rubric.

## Suggested order

| Priority | Work |
|----------|------|
| **Real accounts** | Replace the stub in `server/index.js` with password hashing (e.g. bcrypt), users in SQLite or Postgres, and sessions or JWTs instead of `demo-…` tokens. |
| **Sign up** | New page + `POST /api/auth/register` + validation. |
| **Core data** | Models for **projects** and **roles** (see `README.md`), CRUD routes, then connect UI. |
| **Deploy** | Host API (Render, Railway, Fly.io) and static site (GitHub Pages, Netlify) when required. |

## Dev loop checklist

1. Terminal: `cd server` → `npm start` (API at `http://localhost:8080`).
2. Cursor: **Open with Live Server** on `index.html` (browser on `http://127.0.0.1:5500` or similar).
3. Open `login.html` from Live Server, submit the form — should succeed if the API is running.
4. Optional: with the server running, `cd server` → `npm run verify` checks `GET /api/health`.

## Course alignment

When your instructor assigns milestones (auth, DB, deployment), tick them here or in issues so the repo matches expectations.
