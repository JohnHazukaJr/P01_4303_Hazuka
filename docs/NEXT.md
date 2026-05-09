# Roadmap

## Shipped in this repo

- **Data:** PostgreSQL on Supabase (`DATABASE_URL`), avatars in Supabase Storage; optional local Postgres via `docker-compose.yml` for migrations only
- Accounts: registration, login, JWT in `localStorage`, profile completion gate
- Profiles: display name, bio, work tags, avatars (`PATCH /api/me`); public badges: `verified` (identity) and `official_account` (admin-granted)
- Projects: create, list, filter, open roles, public project page (`project.html?id=…`)
- Join requests: request/withdraw, owner inbox, accept/decline
- UI: light/dark/system theme, responsive nav, guest vs signed-in header/footer

## Next (suggested)

| Area        | Ideas                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| **Hosting** | Deploy API (e.g. Railway, Render, Fly.io); set `JWT_SECRET`; tighten CORS |
| **Product** | Team membership after accept, messaging, richer discovery                 |
| **Quality** | Tests, rate limiting, input hardening                                     |

## Local development

1. `npm start` from repo root (or `npm start` inside `server/`).
2. Serve `web/` over HTTP (not `file://` for API calls).
3. Flow: register → profile setup → dashboard; exercise project page and join requests.

Optional: `npm run verify` with the API running.
