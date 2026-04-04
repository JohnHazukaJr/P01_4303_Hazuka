/**
 * Synodos API — Node (Express). Same routes as the former Spring demo.
 */
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = Number(process.env.PORT) || 8080;

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

/** Root URL — the API has no HTML app here; avoid confusing “Cannot GET /” in the browser. */
app.get("/", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Synodos API</title></head>
<body style="font-family: system-ui; max-width: 36rem; margin: 2rem; line-height: 1.5;">
  <h1>Synodos API</h1>
  <p>This address is only the <strong>backend</strong>. There is no homepage here on purpose.</p>
  <ul>
    <li><a href="/api/health">GET /api/health</a> — health check (JSON)</li>
    <li><code>POST /api/auth/login</code> — used by <code>login.html</code> (JSON body)</li>
  </ul>
  <p>Open <strong>index.html</strong> from your project folder using a local server (e.g. VS Code Live Server), not this URL, to see the Synodos site.</p>
</body>
</html>`);
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 * Stub login — validates non-empty email and password.
 * Replace with real auth (database, JWT, sessions) for production.
 */
app.post("/api/auth/login", (req, res) => {
  const email = req.body?.email;
  const password = req.body?.password;

  if (email == null || String(email).trim() === "") {
    return res.status(400).json({ error: "Email is required" });
  }
  if (password == null || String(password).trim() === "") {
    return res.status(400).json({ error: "Password is required" });
  }

  const s = String(email);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (Math.imul(31, hash) + s.charCodeAt(i)) | 0;
  }
  const stubToken = "demo-" + (hash >>> 0).toString(16);

  res.json({
    token: stubToken,
    message: "Signed in (demo token only — add real auth next)",
  });
});

app.listen(PORT, () => {
  console.log(`Synodos API listening at http://localhost:${PORT}`);
});
