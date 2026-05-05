/**
 * synodos API — Express + Postgres + JWT
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
/* Map common Render/dashboard typos to names the code reads (see server/.env.example). */
(function applyCommonEnvAliases() {
  const e = process.env;
  if (!e.DATABASE_URL && e.Database_URL) e.DATABASE_URL = e.Database_URL;
  if (!e.SUPABASE_URL && e.Supabase_URL) e.SUPABASE_URL = e.Supabase_URL;
  if (!e.SUPABASE_SERVICE_ROLE_KEY && e.Supabase_Serivce_Role_Key) {
    e.SUPABASE_SERVICE_ROLE_KEY = e.Supabase_Serivce_Role_Key;
  }
  if (!e.SUPABASE_SERVICE_ROLE_KEY && e.Supabase_Service_Role_Key) {
    e.SUPABASE_SERVICE_ROLE_KEY = e.Supabase_Service_Role_Key;
  }
  if (!e.ALLOWED_ORIGINS && e.Allowed_Origins) e.ALLOWED_ORIGINS = e.Allowed_Origins;
  if (!e.JWT_SECRET && e.Jwt_Secret) e.JWT_SECRET = e.Jwt_Secret;
})();
require("express-async-errors");

const express = require("express");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  normalizeEmail,
  normalizeUsername,
  validateUsername,
  looksLikeEmail,
} = require("./db");
const db = require("./dbPool");
const storage = require("./storage");
const { createRequireAuth, createOptionalAuth } = require("./authMiddleware");
const { createProjectsRouter } = require("./routes/projects");
const {
  registerProjectJoinRoutes,
  registerMeJoinRoutes,
} = require("./routes/joinRequests");
const { createUsersRouter } = require("./routes/users");
const { registerFeedRoutes } = require("./routes/feed");
const { registerConversationRoutes } = require("./routes/conversations");
const { registerNotificationRoutes } = require("./routes/notifications");
const {
  registerProjectInviteRoutes,
  registerMeProjectInviteRoutes,
} = require("./routes/projectInvites");
const {
  isValidWorkField,
  isValidWorkSubfield,
  profileFieldsPayload,
} = require("./profileFields");
const { publicDisplayLabel } = require("./displayLabel");
const { registerAdminRoutes, createIsAdmin } = require("./routes/admin");
const {
  loadUserProfileRow,
  loadUserWorkTags,
  profileCompleteFromRow,
} = require("./userQueries");

const app = express();
/* Respect X-Forwarded-For when behind Render/reverse proxy (rate limit + logs). */
app.set("trust proxy", 1);
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
const optionalAuth = createOptionalAuth(db, JWT_SECRET);
const isAdminUser = createIsAdmin(db);

const WORK_TAGS_MIN = 1;
const WORK_TAGS_MAX = 12;

function signUserToken(userId, email) {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: "7d" });
}

/** True when Postgres/Node indicates the pool cannot talk to the database (not a normal app error). */
function isDatabaseConnectivityError(err) {
  if (!err) return false;
  const c = err.code;
  if (
    c === "ECONNREFUSED" ||
    c === "ETIMEDOUT" ||
    c === "ENOTFOUND" ||
    c === "EAI_AGAIN"
  ) {
    return true;
  }
  if (typeof c === "string") {
    if (c === "28P01") return true; /* invalid_password — usually wrong DATABASE_URL */
    if (c === "57P01" || c === "57P03") return true;
    if (c.startsWith("08")) return true; /* Class 08 — connection_exception */
  }
  const msg = String(err.message || "").toLowerCase();
  if (
    msg.includes("connection terminated") ||
    msg.includes("connect econnrefused") ||
    msg.includes("timeout") && msg.includes("connection")
  ) {
    return true;
  }
  return false;
}

function parseAllowedOrigins() {
  const raw = String(process.env.ALLOWED_ORIGINS || "").trim();
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins();
app.use(
  cors({
    origin: allowedOrigins && allowedOrigins.length ? allowedOrigins : true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
/* PATCH /api/me may include base64 avatar_data + work_tags; allow headroom. */
app.use(express.json({ limit: "4mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many attempts. Try again in a few minutes.",
    });
  },
});

app.get("/", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>synodos API</title></head>
<body style="font-family: system-ui; max-width: 36rem; margin: 2rem; line-height: 1.5;">
  <h1>synodos API</h1>
  <p>This address is only the <strong>backend</strong>.</p>
  <ul>
    <li><a href="/api/health">GET /api/health</a></li>
    <li><code>POST /api/auth/register</code> — create account (JSON: <code>username</code>, <code>email</code>, <code>password</code>)</li>
    <li><code>POST /api/auth/login</code> — sign in (JSON: <code>identifier</code> or <code>email</code> + <code>password</code>; identifier = email or username)</li>
    <li><code>GET /api/me</code> — current user + profile (<code>Authorization: Bearer …</code>)</li>
    <li><code>GET /api/profile-fields</code> — work field / subfield options (JSON)</li>
    <li><code>PATCH /api/me</code> — update profile (JSON, auth): <code>work_tags</code> (array of <code>{ work_field, work_subfield }</code>, 1–12), or legacy <code>work_field</code>+<code>work_subfield</code>; plus <code>display_name</code>, <code>public_display_as</code> (<code>full_name</code> or <code>username</code>), <code>bio</code>, optional <code>avatar_data</code>, <code>avatar_reset</code></li>
    <li><code>PATCH /api/admin/users/:username/badges</code> — set <code>verified</code> and/or <code>official_account</code> (JSON booleans); <strong>admin only</strong> (<code>SYNODOS_ADMIN_USER_IDS</code> and/or <code>SYNODOS_ADMIN_USERNAMES</code> in <code>server/.env</code>)</li>
    <li><code>GET /api/projects</code> — list projects + open roles; with <code>Authorization: Bearer …</code>, each project includes <code>feed_match_count</code> (tag overlap with you) and list is sorted by match then date</li>
    <li><code>POST /api/projects</code> — create project (JSON, auth)</li>
    <li><code>GET /api/projects/:id</code> — project detail</li>
    <li><code>DELETE /api/projects/:id</code> — delete (owner, auth)</li>
    <li><code>POST /api/projects/:id/roles</code> — add open role (owner, auth)</li>
    <li><code>DELETE /api/projects/:id/roles/:roleId</code> — remove role (owner, auth)</li>
    <li><code>POST /api/projects/:id/join-requests</code> — request to join (auth, not owner); JSON <code>role_id</code> optional, <code>note</code> optional</li>
    <li><code>GET /api/projects/:id/join-requests</code> — list requests (owner, auth); <code>?status=pending|all|…</code></li>
    <li><code>PATCH /api/projects/:id/join-requests/:requestId</code> — accept or decline (owner); JSON <code>status</code></li>
    <li><code>DELETE /api/projects/:id/join-requests/:requestId</code> — withdraw your pending request (requester)</li>
    <li><code>GET /api/me/join-requests</code> — your outgoing join requests (auth)</li>
    <li><code>GET /api/me/project-requests-inbox</code> — pending requests on projects you own (auth)</li>
    <li><code>GET /api/me/notifications/unread-count</code> — badge count (auth)</li>
    <li><code>GET /api/me/notifications</code> — list notifications (auth); <code>PATCH …/:id/read</code>; <code>POST …/read-all</code></li>
    <li><code>POST /api/projects/:id/invites</code> — invite by username (owner, auth); JSON <code>username</code>, optional <code>note</code></li>
    <li><code>GET /api/me/project-invitations</code> — your pending invites (auth)</li>
    <li><code>PATCH /api/me/project-invitations/:id</code> — accept or decline (auth); JSON <code>status</code></li>
    <li><code>GET /api/users/:username</code> — public profile (optional <code>Authorization</code> adds <code>viewer_follows</code>)</li>
    <li><code>POST /api/users/:username/follow</code> / <code>DELETE …/follow</code> — follow or unfollow (auth)</li>
    <li><code>GET /api/feed</code> — activity from you and people you follow (auth); <code>?cursor=</code> <code>&limit=</code></li>
    <li><code>GET /api/conversations</code> — your DM threads (auth)</li>
    <li><code>POST /api/conversations</code> — open or create 1:1 thread (auth); JSON <code>with_username</code></li>
    <li><code>GET /api/conversations/:id/messages</code> — messages (auth, participant); <code>?cursor=</code> <code>&limit=</code></li>
    <li><code>POST /api/conversations/:id/messages</code> — send (auth); JSON <code>body</code></li>
  </ul>
  <p>Open <strong>web/index.html</strong> via Live Server to use the site.</p>
</body>
</html>`);
});

app.get("/api/health", async (_req, res) => {
  try {
    await db.query("SELECT 1 AS ok");
    res.json({ status: "ok", database: "connected" });
  } catch (e) {
    console.error("[synodos] /api/health database check failed", e);
    res
      .status(503)
      .json({ status: "error", database: "unavailable" });
  }
});

/**
 * Optional: set SYNODOS_DEBUG_SURFACE=1 on the host, GET this once, then remove the flag.
 * Returns booleans only (no secret values) so you can confirm Render env names resolved.
 */
app.get("/api/debug/env-check", (_req, res) => {
  if (String(process.env.SYNODOS_DEBUG_SURFACE || "").trim() !== "1") {
    return res.status(404).json({ error: "Not found" });
  }
  const e = process.env;
  res.json({
    hasDatabaseUrl: !!(e.DATABASE_URL && String(e.DATABASE_URL).trim()),
    hasSupabaseUrl: !!(e.SUPABASE_URL && String(e.SUPABASE_URL).trim()),
    hasServiceRole: !!(
      e.SUPABASE_SERVICE_ROLE_KEY && String(e.SUPABASE_SERVICE_ROLE_KEY).trim()
    ),
    hasJwtSecret: !!(e.JWT_SECRET && String(e.JWT_SECRET).trim()),
    allowedOriginsConfigured: !!(
      e.ALLOWED_ORIGINS && String(e.ALLOWED_ORIGINS).trim()
    ),
  });
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const usernameCheck = validateUsername(req.body?.username);

  if (!usernameCheck.ok) {
    return res.status(400).json({ error: usernameCheck.error });
  }
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  if (!password || String(password).length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
  }

  const passwordHash = bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
  const username = usernameCheck.value;

  try {
    const inserted = await db.get(
      "INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id",
      [email, passwordHash, username]
    );

    const token = signUserToken(Number(inserted.id), email);
    return res.status(201).json({
      token,
      message: "Account created. Welcome to synodos.",
    });
  } catch (e) {
    if (e && e.code === "23505") {
      const msg = String(e.constraint || e.detail || e.message || "");
      if (msg.toLowerCase().includes("email")) {
        return res
          .status(409)
          .json({ error: "That email is already registered" });
      }
      if (msg.toLowerCase().includes("username")) {
        return res.status(409).json({ error: "That username is already taken" });
      }
      return res
        .status(409)
        .json({ error: "That email or username is already registered" });
    }
    console.error(e);
    if (isDatabaseConnectivityError(e)) {
      return res.status(503).json({
        error:
          "The server could not reach the database. On the host, check DATABASE_URL (use Supabase transaction pooler, port 6543, and the real DB password).",
      });
    }
    return res.status(500).json({ error: "Could not create account" });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const raw =
    req.body?.identifier != null && req.body.identifier !== ""
      ? String(req.body.identifier).trim()
      : String(req.body?.email || "").trim();
  const password = req.body?.password;

  if (!raw) {
    return res
      .status(400)
      .json({ error: "Email or username is required" });
  }
  if (!password || String(password).trim() === "") {
    return res.status(400).json({ error: "Password is required" });
  }

  try {
    var row;
    if (looksLikeEmail(raw)) {
      row = await db.get(
        "SELECT id, email, password_hash FROM users WHERE email = $1",
        [normalizeEmail(raw)]
      );
    } else {
      row = await db.get(
        "SELECT id, email, password_hash FROM users WHERE username = $1",
        [normalizeUsername(raw)]
      );
    }

    if (
      !row ||
      row.password_hash == null ||
      String(row.password_hash).trim() === ""
    ) {
      return res
        .status(401)
        .json({ error: "Invalid email, username, or password" });
    }

    var passwordOk = false;
    try {
      passwordOk = bcrypt.compareSync(
        String(password),
        String(row.password_hash)
      );
    } catch (bcErr) {
      console.warn("[synodos] login bcrypt.compareSync", bcErr);
      passwordOk = false;
    }
    if (!passwordOk) {
      return res
        .status(401)
        .json({ error: "Invalid email, username, or password" });
    }

    const token = signUserToken(Number(row.id), row.email);
    return res.json({
      token,
      message: "Signed in.",
    });
  } catch (e) {
    console.error("[synodos] POST /api/auth/login failed", e);
    if (isDatabaseConnectivityError(e)) {
      return res.status(503).json({
        error:
          "The server could not reach the database. On the host, check DATABASE_URL (use Supabase transaction pooler, port 6543, and the real DB password).",
      });
    }
    return res.status(500).json({
      error: "Sign-in temporarily unavailable. Try again later.",
    });
  }
});

const DISPLAY_NAME_MAX = 100;
const BIO_MAX = 2000;

async function saveAvatarFromDataUrl(userId, dataUrl) {
  var m = /^data:(image\/[a-z0-9.+*-]+);base64,(.+)$/i.exec(String(dataUrl).trim());
  if (!m) {
    return { ok: false, error: "Invalid image data" };
  }
  var mime = m[1].toLowerCase();
  /* Some UAs use image/jpg; map to image/jpeg for storage. */
  if (mime === "image/jpg" || mime === "image/pjpeg") {
    mime = "image/jpeg";
  }
  if (!storage.AVATAR_MIME_EXT[mime]) {
    return { ok: false, error: "Use JPEG, PNG, GIF, or WebP" };
  }
  var buf;
  try {
    buf = Buffer.from(m[2], "base64");
  } catch (_) {
    return { ok: false, error: "Invalid image data" };
  }
  if (buf.length > storage.AVATAR_MAX_BYTES) {
    return { ok: false, error: "Image too large (max 512 KB)" };
  }
  var saved = await storage.uploadAvatar(userId, buf, mime);
  if (!saved.ok) return saved;
  // Bucket overwrites the same key on re-upload, so the bare URL would not
  // change. Append a cache-buster so <img src> reloads immediately.
  return { ok: true, url: saved.url + "?v=" + Date.now() };
}

function userPayload(row, tags) {
  tags = tags || [];
  var displayName = row.display_name != null ? String(row.display_name) : "";
  var bio = row.bio != null ? String(row.bio) : "";
  var primary = tags[0];
  return {
    id: row.id,
    username: row.username != null ? String(row.username) : null,
    display_name: displayName,
    public_display_as:
      row.public_display_as != null
        ? String(row.public_display_as)
        : "username",
    public_display_label: publicDisplayLabel(row),
    verified: Number(row.verified) === 1,
    official_account:
      row.official_account === true || Number(row.official_account) === 1,
    bio: bio,
    avatar_url: row.avatar_url != null ? String(row.avatar_url) : "",
    work_field: primary
      ? primary.work_field
      : row.work_field != null
        ? String(row.work_field)
        : "",
    work_subfield: primary
      ? primary.work_subfield
      : row.work_subfield != null
        ? String(row.work_subfield)
        : "",
    work_tags: tags,
    profile_complete: profileCompleteFromRow(row, tags),
  };
}

app.get("/api/profile-fields", (_req, res) => {
  res.json(profileFieldsPayload());
});

app.get("/api/me", requireAuth, async (req, res) => {
  var row = await loadUserProfileRow(db, req.user.id);
  if (!row) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  var tags = await loadUserWorkTags(db, req.user.id);
  res.json({ user: userPayload(row, tags) });
});

registerAdminRoutes(app, { db, requireAuth, isAdmin: isAdminUser });

registerMeJoinRoutes(app, { db, requireAuth });
registerMeProjectInviteRoutes(app, { db, requireAuth });
registerNotificationRoutes(app, { db, requireAuth });
registerFeedRoutes(app, { db, requireAuth });
registerConversationRoutes(app, { db, requireAuth });

const usersRouter = createUsersRouter({ db, requireAuth, optionalAuth });
app.use("/api/users", usersRouter);

app.patch("/api/me", requireAuth, async (req, res) => {
  var body = req.body || {};
  var displayNameIn = body.display_name;
  var bioIn = body.bio;
  var wfIn = body.work_field;
  var wsIn = body.work_subfield;
  var workTagsIn = body.work_tags;
  var avatarReset = body.avatar_reset === true;
  var avatarData = body.avatar_data;
  var publicDisplayAsIn = body.public_display_as;

  if (displayNameIn !== undefined && displayNameIn !== null) {
    var dn = String(displayNameIn).trim();
    if (dn.length < 2) {
      return res
        .status(400)
        .json({ error: "Display name must be at least 2 characters" });
    }
    if (dn.length > DISPLAY_NAME_MAX) {
      return res.status(400).json({
        error: "Display name must be at most " + DISPLAY_NAME_MAX + " characters",
      });
    }
  }

  var bioStr =
    bioIn === undefined || bioIn === null ? undefined : String(bioIn);
  if (bioStr !== undefined && bioStr.length > BIO_MAX) {
    return res
      .status(400)
      .json({ error: "Bio must be at most " + BIO_MAX + " characters" });
  }

  var tagsToSave = null;
  if (workTagsIn !== undefined) {
    if (!Array.isArray(workTagsIn)) {
      return res.status(400).json({ error: "work_tags must be an array" });
    }
    if (
      workTagsIn.length < WORK_TAGS_MIN ||
      workTagsIn.length > WORK_TAGS_MAX
    ) {
      return res.status(400).json({
        error:
          "Add between " +
          WORK_TAGS_MIN +
          " and " +
          WORK_TAGS_MAX +
          " field/subfield pairs",
      });
    }
    var seen = new Set();
    for (var ti = 0; ti < workTagsIn.length; ti++) {
      var tag = workTagsIn[ti];
      var twf = String(tag.work_field || "").trim();
      var tws = String(tag.work_subfield || "").trim();
      if (!isValidWorkField(twf) || !isValidWorkSubfield(twf, tws)) {
        return res.status(400).json({
          error: "Invalid work field or subfield in work_tags",
        });
      }
      var k = twf + "\0" + tws;
      if (seen.has(k)) {
        return res.status(400).json({
          error: "Duplicate field/subfield pair in work_tags",
        });
      }
      seen.add(k);
    }
    tagsToSave = workTagsIn.map(function (t) {
      return {
        work_field: String(t.work_field).trim(),
        work_subfield: String(t.work_subfield).trim(),
      };
    });
  } else if (wfIn !== undefined || wsIn !== undefined) {
    if (wfIn === undefined || wsIn === undefined) {
      return res.status(400).json({
        error: "work_field and work_subfield must be sent together",
      });
    }
    var wf = String(wfIn).trim();
    var ws = String(wsIn).trim();
    if (!isValidWorkField(wf) || !isValidWorkSubfield(wf, ws)) {
      return res.status(400).json({ error: "Invalid work field or subfield" });
    }
    tagsToSave = [{ work_field: wf, work_subfield: ws }];
  }

  if (avatarReset && typeof avatarData === "string" && avatarData.length > 0) {
    return res.status(400).json({
      error: "Choose either a new photo or default avatar, not both",
    });
  }

  var nextPublicDisplayAs = null;
  if (publicDisplayAsIn !== undefined && publicDisplayAsIn !== null) {
    var pda = String(publicDisplayAsIn).toLowerCase();
    if (pda !== "full_name" && pda !== "username") {
      return res.status(400).json({
        error: 'public_display_as must be "full_name" or "username"',
      });
    }
    nextPublicDisplayAs = pda;
  }

  var row = await loadUserProfileRow(db, req.user.id);
  if (!row) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  var nextDisplay =
    displayNameIn !== undefined && displayNameIn !== null
      ? String(displayNameIn).trim()
      : String(row.display_name || "").trim();
  var nextBio =
    bioStr !== undefined ? bioStr : String(row.bio || "");

  var nextPda =
    nextPublicDisplayAs != null
      ? nextPublicDisplayAs
      : String(row.public_display_as || "username").toLowerCase();

  var nextWf = String(row.work_field || "").trim();
  var nextWs = String(row.work_subfield || "").trim();

  if (tagsToSave !== null) {
    await db.run("DELETE FROM user_work_tags WHERE user_id = $1", [req.user.id]);
    for (var j = 0; j < tagsToSave.length; j++) {
      var tg = tagsToSave[j];
      await db.run(
        "INSERT INTO user_work_tags (user_id, work_field, work_subfield) VALUES ($1, $2, $3)",
        [req.user.id, tg.work_field, tg.work_subfield]
      );
    }
    nextWf = tagsToSave[0].work_field;
    nextWs = tagsToSave[0].work_subfield;
  }

  var nextAvatarUrl =
    row.avatar_url != null ? String(row.avatar_url) : "";

  if (avatarReset) {
    await storage.deleteAvatar(req.user.id);
    nextAvatarUrl = "";
  } else if (typeof avatarData === "string" && avatarData.length > 0) {
    var saved = await saveAvatarFromDataUrl(req.user.id, avatarData);
    if (!saved.ok) {
      console.warn("[synodos] PATCH /api/me avatar upload failed:", saved.error);
      return res.status(400).json({ error: saved.error });
    }
    nextAvatarUrl = saved.url;
  }

  if (nextDisplay.length < 2) {
    return res
      .status(400)
      .json({ error: "Display name must be at least 2 characters" });
  }

  await db.run(
    "UPDATE users SET display_name = $1, bio = $2, avatar_url = $3, work_field = $4, work_subfield = $5, public_display_as = $6 WHERE id = $7",
    [nextDisplay, nextBio, nextAvatarUrl, nextWf, nextWs, nextPda, req.user.id]
  );

  var updated = await loadUserProfileRow(db, req.user.id);
  var outTags = await loadUserWorkTags(db, req.user.id);
  res.json({ user: userPayload(updated, outTags) });
});

const projectsRouter = createProjectsRouter({
  db,
  requireAuth,
  optionalAuth,
});
registerProjectJoinRoutes(projectsRouter, { db, requireAuth });
registerProjectInviteRoutes(projectsRouter, { db, requireAuth });
app.use("/api/projects", projectsRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, _req, res, _next) => {
  console.error("[synodos] Unhandled error:", err);
  if (res.headersSent) return;
  let status = err && typeof err.status === "number" ? err.status : 500;
  if (err && err.type === "entity.too.large") {
    status = 413;
  }
  let msg =
    err && err.expose && err.message
      ? err.message
      : "Internal server error";
  if (status === 413) {
    msg = "Request too large (try a smaller photo or save without changing the picture).";
  }
  res.status(status).json({ error: msg });
});

const server = app.listen(PORT, () => {
  console.log(`synodos API listening at http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `[synodos] Port ${PORT} is already in use (EADDRINUSE). Another process is listening on this port — often another \`npm start\` in a different terminal.\n` +
        `  Fix: stop that process, or run on another port, e.g. PowerShell:  $env:PORT=8081; npm start`
    );
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
