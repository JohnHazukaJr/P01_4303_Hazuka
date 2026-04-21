/**
 * synodos API — Express + Postgres + JWT
 */
require("dotenv").config();
require("express-async-errors");

const express = require("express");
const fs = require("fs");
const path = require("path");
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
  enrichTag,
} = require("./profileFields");
const { publicDisplayLabel } = require("./displayLabel");

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
const optionalAuth = createOptionalAuth(db, JWT_SECRET);

const WORK_TAGS_MIN = 1;
const WORK_TAGS_MAX = 12;

async function loadUserWorkTags(userId) {
  var rows = await db.all(
    "SELECT work_field, work_subfield FROM user_work_tags WHERE user_id = $1 ORDER BY id ASC",
    [userId]
  );
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    out.push(enrichTag(rows[i].work_field, rows[i].work_subfield));
  }
  return out;
}

function signUserToken(userId, email) {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: "7d" });
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
app.use(express.json({ limit: "1mb" }));

app.use(
  "/uploads",
  express.static(path.join(__dirname, "data", "uploads"))
);

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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/register", async (req, res) => {
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
    return res.status(500).json({ error: "Could not create account" });
  }
});

app.post("/api/auth/login", async (req, res) => {
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

  if (!row || !bcrypt.compareSync(String(password), row.password_hash)) {
    return res
      .status(401)
      .json({ error: "Invalid email, username, or password" });
  }

  const token = signUserToken(row.id, row.email);
  res.json({
    token,
    message: "Signed in.",
  });
});

const DISPLAY_NAME_MAX = 100;
const BIO_MAX = 2000;
const AVATAR_MAX_BYTES = 512 * 1024;
const AVATAR_MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

function avatarUploadDir() {
  return path.join(__dirname, "data", "uploads", "avatars");
}

function removeUserAvatarFiles(userId) {
  var dir = avatarUploadDir();
  Object.keys(AVATAR_MIME_EXT).forEach(function (mime) {
    var ext = AVATAR_MIME_EXT[mime];
    try {
      fs.unlinkSync(path.join(dir, String(userId) + ext));
    } catch (_) {}
  });
}

function saveAvatarFromDataUrl(userId, dataUrl) {
  var m = /^data:(image\/[a-z0-9.+*-]+);base64,(.+)$/i.exec(String(dataUrl).trim());
  if (!m) {
    return { ok: false, error: "Invalid image data" };
  }
  var mime = m[1].toLowerCase();
  var ext = AVATAR_MIME_EXT[mime];
  if (!ext) {
    return { ok: false, error: "Use JPEG, PNG, GIF, or WebP" };
  }
  var buf;
  try {
    buf = Buffer.from(m[2], "base64");
  } catch (_) {
    return { ok: false, error: "Invalid image data" };
  }
  if (buf.length > AVATAR_MAX_BYTES) {
    return { ok: false, error: "Image too large (max 512 KB)" };
  }
  var dir = avatarUploadDir();
  fs.mkdirSync(dir, { recursive: true });
  removeUserAvatarFiles(userId);
  var filename = String(userId) + ext;
  fs.writeFileSync(path.join(dir, filename), buf);
  return { ok: true, url: "/uploads/avatars/" + filename };
}

function profileCompleteFromRow(row, tags) {
  var dnOk = String(row.display_name || "").trim().length >= 2;
  if (!dnOk) return false;
  if (tags && tags.length > 0) {
    for (var i = 0; i < tags.length; i++) {
      var t = tags[i];
      if (
        isValidWorkField(t.work_field) &&
        isValidWorkSubfield(t.work_field, t.work_subfield)
      ) {
        return true;
      }
    }
  }
  var wf = String(row.work_field || "").trim();
  var ws = String(row.work_subfield || "").trim();
  return (
    wf.length > 0 &&
    ws.length > 0 &&
    isValidWorkField(wf) &&
    isValidWorkSubfield(wf, ws)
  );
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
  var row = await db.get(
    "SELECT id, username, display_name, public_display_as, bio, avatar_url, work_field, work_subfield, verified FROM users WHERE id = $1",
    [req.user.id]
  );
  if (!row) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  var tags = await loadUserWorkTags(req.user.id);
  res.json({ user: userPayload(row, tags) });
});

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

  var row = await db.get(
    "SELECT id, username, display_name, public_display_as, bio, avatar_url, work_field, work_subfield, verified FROM users WHERE id = $1",
    [req.user.id]
  );
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
    removeUserAvatarFiles(req.user.id);
    nextAvatarUrl = "";
  } else if (typeof avatarData === "string" && avatarData.length > 0) {
    var saved = saveAvatarFromDataUrl(req.user.id, avatarData);
    if (!saved.ok) {
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

  var updated = await db.get(
    "SELECT id, username, display_name, public_display_as, bio, avatar_url, work_field, work_subfield, verified FROM users WHERE id = $1",
    [req.user.id]
  );
  var outTags = await loadUserWorkTags(req.user.id);
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
