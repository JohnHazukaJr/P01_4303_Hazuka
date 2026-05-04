# Full UI smoke test (Supabase)

Use **Live Server** on `web/index.html`. Ensure `server/.env` is filled and `npm run migrate` has been applied.

Also run:

- `npm run check-env` — validates env vars from the dashboard
- `npm run verify-schema` — confirms all tables exist (after migrate)
- `npm run health-check` — boots API on a temp port and checks `/api/health` includes `database: connected`

## Manual checklist (same as local smoketest plan)

1. **Register** user `alice` → confirm row in Supabase **Table Editor → users**.
2. **Login** as alice → JWT in `localStorage`.
3. **Profile setup**: display name, ≥1 work tag, **upload avatar** (~100 KB) → `users.avatar_url` is a `https://…supabase.co/storage/…` URL; **Storage → avatars** shows object; image renders.
4. **Reset avatar** → `avatar_url` empty; bucket object removed for that user.
5. **Create project** + one **open role** → `projects`, `project_roles`.
6. **Register** `bob` (private window). Bob **follows** alice → `user_follows`. Bob **join request** on role → `project_join_requests`, `user_notifications` for alice.
7. Alice **accepts** request → request status `accepted`, notifications / `feed_events` as applicable.
8. **DM** alice ↔ bob → `dm_conversations`, `dm_participants`, `dm_messages`.
9. Refresh both browsers — data persists.

## Restart proof

1. Stop API (`Ctrl+C`), run `npm start` again.
2. Refresh pages — avatars (Supabase URLs), messages, projects still load.

## Optional: Docker Postgres (schema/migrate only)

If you only want to verify SQL migrations without a Supabase project yet:

```bash
docker compose up -d
```

Set in `server/.env`:

```env
DATABASE_URL=postgresql://postgres:synodos_smoke@127.0.0.1:55432/synodos
PGSSLMODE=disable
```

Leave `SUPABASE_*` unset for DB-only checks; avatar upload will fail until you add Supabase.

```bash
npm run migrate
npm run verify-schema
```

Stop container: `docker compose down`.
