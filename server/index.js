/**
 * Synodos API — Express + SQLite + JWT
 */
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db, normalizeEmail } = require("./db");
const { createRequireAuth } = require("./authMiddleware");
const { createProjectsRouter } = require("./routes/projects");

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const JWT_SECRET =
  process.env.JWT_SECRET || "synodos-dev-secret-change-in-production";
const BCRYPT_ROUNDS = 10;

if (!process.env.JWT_SECRET) {
  console.warn(
    "[synodos] Using default JWT_SECRET. Set JWT_SECRET in production."
  );
}

const requireAuth = createRequireAuth(db, JWT_SECRET);

function signUserToken(userId, email) {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: "7d" });
}

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Synodos API</title></head>
<body style="font-family: system-ui; max-width: 36rem; margin: 2rem; line-height: 1.5;">
  <h1>Synodos API</h1>
  <p>This address is only the <strong>backend</strong>.</p>
  <ul>
    <li><a href="/api/health">GET /api/health</a></li>
    <li><code>POST /api/auth/register</code> — create account (JSON)</li>
    <li><code>POST /api/auth/login</code> — sign in (JSON)</li>
    <li><code>GET /api/me</code> — current user (<code>Authorization: Bearer …</code>)</li>
    <li><code>GET /api/projects</code> — list projects + open roles</li>
    <li><code>POST /api/projects</code> — create project (JSON, auth)</li>
    <li><code>GET /api/projects/:id</code> — project detail</li>
    <li><code>DELETE /api/projects/:id</code> — delete (owner, auth)</li>
    <li><code>POST /api/projects/:id/roles</code> — add open role (owner, auth)</li>
    <li><code>DELETE /api/projects/:id/roles/:roleId</code> — remove role (owner, auth)</li>
  </ul>
  <p>Open <strong>index.html</strong> via Live Server to use the site.</p>
</body>
</html>`);
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/register", (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  if (!password || String(password).length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
  }

  const passwordHash = bcrypt.hashSync(String(password), BCRYPT_ROUNDS);

  try {
    const info = db
      .prepare(
        "INSERT INTO users (email, password_hash) VALUES (?, ?)"
      )
      .run(email, passwordHash);

    const token = signUserToken(Number(info.lastInsertRowid), email);
    return res.status(201).json({
      token,
      message: "Account created. Welcome to Synodos.",
    });
  } catch (e) {
    const unique =
      e &&
      (e.errcode === 2067 ||
        String(e.message || "").includes("UNIQUE constraint"));
    if (unique) {
      return res.status(409).json({ error: "That email is already registered" });
    }
    console.error(e);
    return res.status(500).json({ error: "Could not create account" });
  }
});

app.post("/api/auth/login", (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  if (!password || String(password).trim() === "") {
    return res.status(400).json({ error: "Password is required" });
  }

  const row = db
    .prepare(
      "SELECT id, email, password_hash FROM users WHERE email = ?"
    )
    .get(email);

  if (!row || !bcrypt.compareSync(String(password), row.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signUserToken(row.id, row.email);
  res.json({
    token,
    message: "Signed in.",
  });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({
    user: { id: req.user.id, email: req.user.email },
  });
});

app.use(
  "/api/projects",
  createProjectsRouter({ db, requireAuth })
);

app.listen(PORT, () => {
  console.log(`Synodos API listening at http://localhost:${PORT}`);
});
