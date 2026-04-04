# Synodos — Node.js backend (Express)

REST API for the Synodos project. Requires **[Node.js 18+](https://nodejs.org/)** (LTS recommended).

## Setup

### 1. Install Node.js (includes `npm`)

Download the **LTS** installer from [https://nodejs.org/](https://nodejs.org/) and run it. Leave **“Add to PATH”** enabled if the wizard offers it.

### 2. Confirm the tools are available

Open a **new** terminal (Command Prompt or PowerShell) and run:

```bash
node -v
npm -v
```

You should see version numbers. If you get `command not found` / `not recognized`, Node is not on your **PATH**:

- Re-run the Node installer and ensure it finishes successfully, or  
- Add the folder that contains `node.exe` to your user **PATH** (often `C:\Program Files\nodejs\`), then **close and reopen** all terminals.

### 3. Install dependencies and run

From this `server/` directory:

```bash
npm install
npm start
```

With the server running in another terminal, you can run **`npm run verify`** to confirm `GET /api/health` returns `{"status":"ok"}`.

The API listens on **http://localhost:8080** (override with `PORT`, e.g. `set PORT=3000` on Windows CMD).

### “Cannot GET /” in the browser

`http://localhost:8080/` is **only the API**. Opening that link now shows a short help page. The **landing page** is **`index.html`** in the project root — open it with **Live Server** (or similar), not by using the `:8080` URL.

To verify the server: visit **`http://localhost:8080/api/health`** — you should see `{"status":"ok"}`.

### If `npm install` still fails

- Copy the **full error message** from the terminal (network errors, permission errors, and `EACCES` all mean different fixes).
- Try: `npm install --verbose` for more detail.
- Corporate networks sometimes block the registry; you may need offline help from your school IT.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check — returns `{ "status": "ok" }` |
| `POST` | `/api/auth/login` | Stub login — JSON body `{ "email", "password" }` |

## Frontend

Open `login.html` via a local static server (e.g. VS Code Live Server) so the browser can call `http://localhost:8080`. The client script in `js/main.js` posts to `/api/auth/login`.

## Notes

- Login is a **demo** only (no database, no real passwords). Replace the handler in `index.js` when you add persistence.
- **CORS** is enabled for browser development (`origin: true`). Restrict origins before production.
