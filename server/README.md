# Synodos — Node.js backend (Express)

REST API for the Synodos project. Requires **[Node.js 22.5+](https://nodejs.org/)** (built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html); no native addon install).

## Stack

- **Express** — HTTP API
- **`node:sqlite`** (`DatabaseSync`) — local database file `data/synodos.db` (created on first run; gitignored)
- **bcryptjs** — password hashing
- **jsonwebtoken** — JWT bearer tokens (7-day expiry)

Set **`JWT_SECRET`** in production (environment variable). A default is used for local dev only.

## Setup

### 1. Install Node.js (includes `npm`)

Download the **LTS** installer from [https://nodejs.org/](https://nodejs.org/) and run it. Leave **“Add to PATH”** enabled if the wizard offers it.

### 2. Confirm the tools are available

Open a **new** terminal and run `node -v` and `npm -v`.

### 3. Install dependencies and run

From this `server/` directory:

```bash
npm install
npm start
```

With the server running in another terminal, **`npm run verify`** checks `GET /api/health`.

The API listens on **http://localhost:8080** (override with `PORT`).

### “Cannot GET /” in the browser

`http://localhost:8080/` is **only the API**. Open **`index.html`** with **Live Server** for the site. Use **`http://localhost:8080/api/health`** to verify the API.

### If `npm install` still fails

Copy the full error message. Try `npm install --verbose`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/register` | Create account — JSON `{ "email", "password" }` (password min 8 chars) |
| `POST` | `/api/auth/login` | Sign in — JSON `{ "email", "password" }` — returns `{ token, message }` |
| `GET` | `/api/me` | Current user — header `Authorization: Bearer <jwt>` — returns `{ user: { id, email } }` |
| `GET` | `/api/projects` | List projects (each includes `roles[]` and `role_count`) |
| `POST` | `/api/projects` | Create project — JSON `{ "title", "description?" }` — **auth** |
| `GET` | `/api/projects/:id` | Project detail + roles |
| `DELETE` | `/api/projects/:id` | Delete project — **owner, auth** |
| `POST` | `/api/projects/:id/roles` | Add open role — JSON `{ "title", "skills?", "slots?" }` — **owner, auth** |
| `DELETE` | `/api/projects/:id/roles/:roleId` | Remove open role — **owner, auth** |

## Frontend

Use **Live Server** on `index.html`. Flow: **register.html** or **login.html** → JWT in `localStorage` → **dashboard.html** (`/api/me`, projects & roles).

## Notes

- **CORS** is open for development (`origin: true`). Restrict before production.
