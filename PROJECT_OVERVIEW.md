# Project overview

Concise answers for write-ups or submissions. Adjust hosting rows if your deployment differs.

---

## What is this?

**synodos** is a peer-first web app for finding collaborators: users create **projects**, post **open roles**, complete **profiles** with work areas and skills, and connect through **follows**, **join requests**, **invitations**, **direct messages**, and **notifications**. The marketing site introduces the product; signed-in users use Home (feed and recent projects), Projects (dashboard), People search, profiles, and project pages.

---

## Why does it exist?

Generic social feeds optimize for attention; **synodos** focuses on **assembly**—matching people to real work (projects, roles, and intent) so discovery stays structured and human-approved instead of algorithm-only. It targets **finding the right collaborators** and **showing what you contribute**, not endless generic scrolling.

---

## What tools did you use?

| Area                 | Choice                                            | Why it fits                                                                                                  |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Frontend**         | HTML, CSS, vanilla JavaScript in `web/`           | No bundler required; straightforward deploy to static hosting; direct control over markup and accessibility. |
| **Backend**          | Node.js, **Express**                              | REST API, widely used, pairs cleanly with JWT JSON APIs.                                                     |
| **Auth**             | **JWT** (bearer tokens), **bcrypt** for passwords | Stateless API; standard pattern for a separate frontend and backend.                                         |
| **Database**         | **PostgreSQL** via `pg`, hosted on **Supabase**   | Managed Postgres, SQL migrations in the repo, pooled connections for production.                             |
| **Storage**          | **Supabase Storage** (avatars bucket)             | Profile images off the app server; public URLs suitable for `<img>` tags.                                    |
| **Frontend hosting** | **Netlify** (`netlify.toml`)                      | Publishes `web/`; build step injects `SYNODOS_API_BASE` for production.                                      |
| **API hosting**      | e.g. **Render** (see `render.yaml`)               | Express with `NODE_ENV`, CORS (`ALLOWED_ORIGINS`), and secrets in the host dashboard.                        |

---

## How to access it

**Live site:** [https://synodos.netlify.app/](https://synodos.netlify.app/)

**API:** Use the same base URL configured as `SYNODOS_API_BASE` on Netlify (generated into `web/js/netlify-api-base.js` at build time).

---

## What changed from Project 01 to Project 02?

- **Database and platform:** Moved to **Supabase** for **PostgreSQL** (replacing earlier local/simple storage). All relational data (users, profiles, projects, roles, joins, follows, feed, messages, notifications, etc.) lives in Postgres via `DATABASE_URL`; the API is stateless.
- **Storage and uploads:** **Supabase Storage** for **avatar** uploads (service-role uploads on the server, CDN-backed public URLs) instead of keeping binaries on the API machine.
- **Backend robustness:** Clearer **error handling** (consistent JSON errors, async error middleware, structured responses); **rate limiting** on auth and global API routes; production requirements for `JWT_SECRET` and `ALLOWED_ORIGINS`.
- **Performance and UX:** Pooled DB connections, sensible API design, and frontend improvements (caching `/api/me` and avatars, prefetch after login, fewer flashes between pages) so the app feels responsive on top of the new stack.
- **Frontend polish:** CSS structure (tokens + imports), shared session/profile gate, accessibility and copy improvements on key flows, and visual refinements aligned with the product story.

---
