const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "synodos.db");
const db = new DatabaseSync(dbPath);

db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS project_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    skills TEXT NOT NULL DEFAULT '',
    slots INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (slots >= 0)
  );
`);

/** Idempotent: add profile columns on existing DBs (SQLite has no IF NOT EXISTS for columns). */
function migrateUserProfileColumns() {
  const rows = db.prepare("PRAGMA table_info(users)").all();
  var names = {};
  for (var i = 0; i < rows.length; i++) {
    names[rows[i].name] = true;
  }
  if (!names.display_name) {
    db.exec(
      "ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''"
    );
  }
  if (!names.bio) {
    db.exec("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''");
  }
}

migrateUserProfileColumns();

/** Idempotent: login handle, unique when set (NULL allowed for legacy rows). */
function migrateUsernameColumn() {
  const rows = db.prepare("PRAGMA table_info(users)").all();
  var names = {};
  for (var i = 0; i < rows.length; i++) {
    names[rows[i].name] = true;
  }
  if (!names.username) {
    /* SQLite rejects ADD COLUMN ... UNIQUE; enforce with a unique index instead. */
    db.exec("ALTER TABLE users ADD COLUMN username TEXT");
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE)"
    );
  }
}

migrateUsernameColumn();

/** Avatar path (empty = default) + work taxonomy for matching. */
function migrateProfileExtendedColumns() {
  const rows = db.prepare("PRAGMA table_info(users)").all();
  var names = {};
  for (var i = 0; i < rows.length; i++) {
    names[rows[i].name] = true;
  }
  if (!names.avatar_url) {
    db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''");
  }
  if (!names.work_field) {
    db.exec("ALTER TABLE users ADD COLUMN work_field TEXT NOT NULL DEFAULT ''");
  }
  if (!names.work_subfield) {
    db.exec("ALTER TABLE users ADD COLUMN work_subfield TEXT NOT NULL DEFAULT ''");
  }
}

migrateProfileExtendedColumns();

/** Multiple field/subfield pairs per user (feed + profile). */
function migrateUserWorkTagsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_work_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      work_field TEXT NOT NULL,
      work_subfield TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, work_field, work_subfield)
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_work_tags_user ON user_work_tags(user_id);
  `);
  try {
    db.exec(`
      INSERT OR IGNORE INTO user_work_tags (user_id, work_field, work_subfield)
      SELECT id, work_field, work_subfield FROM users
      WHERE TRIM(COALESCE(work_field, '')) != '' AND TRIM(COALESCE(work_subfield, '')) != '';
    `);
  } catch (_) {
    /* ignore if columns missing on very old DBs */
  }
}

migrateUserWorkTagsTable();

/** full_name = peers see display_name; username = peers see login handle. Email is never public. */
function migratePublicDisplayAsColumn() {
  const rows = db.prepare("PRAGMA table_info(users)").all();
  var names = {};
  for (var i = 0; i < rows.length; i++) {
    names[rows[i].name] = true;
  }
  if (!names.public_display_as) {
    db.exec(
      "ALTER TABLE users ADD COLUMN public_display_as TEXT NOT NULL DEFAULT 'username'"
    );
  }
}

migratePublicDisplayAsColumn();

/** Verified accounts (official / notable). */
function migrateVerifiedColumn() {
  const rows = db.prepare("PRAGMA table_info(users)").all();
  var names = {};
  for (var i = 0; i < rows.length; i++) {
    names[rows[i].name] = true;
  }
  if (!names.verified) {
    db.exec("ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0");
  }
  try {
    // Seed official account(s).
    db.prepare(
      "UPDATE users SET verified = 1 WHERE username = ? COLLATE NOCASE"
    ).run("synodos");
  } catch (_) {}
}

migrateVerifiedColumn();

function migrateProjectJoinRequestsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_join_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      requester_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_role_id INTEGER REFERENCES project_roles(id) ON DELETE SET NULL,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'withdrawn', 'accepted', 'declined')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pjr_project ON project_join_requests(project_id);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pjr_requester ON project_join_requests(requester_user_id);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pjr_project_status ON project_join_requests(project_id, status);
  `);
}

migrateProjectJoinRequestsTable();

function migrateUserFollowsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_follows (
      follower_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (follower_user_id, following_user_id),
      CHECK (follower_user_id != following_user_id)
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_user_id);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_user_id);
  `);
}

migrateUserFollowsTable();

function migrateFeedEventsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS feed_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_feed_events_actor_time ON feed_events(actor_user_id, created_at DESC);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_feed_events_created ON feed_events(created_at DESC);
  `);
}

migrateFeedEventsTable();

function migrateDmTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dm_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS dm_participants (
      conversation_id INTEGER NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (conversation_id, user_id)
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dm_participants_user ON dm_participants(user_id);
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS dm_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
      sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dm_messages_conv_time ON dm_messages(conversation_id, created_at DESC);
  `);
}

migrateDmTables();

function migrateUserNotificationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notification_type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
    ON user_notifications(user_id, read_at);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
    ON user_notifications(user_id, created_at DESC);
  `);
}

migrateUserNotificationsTable();

function migrateProjectInvitationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      inviter_user_id INTEGER NOT NULL REFERENCES users(id),
      invitee_user_id INTEGER NOT NULL REFERENCES users(id),
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pinv_invitee ON project_invitations(invitee_user_id, status);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pinv_project ON project_invitations(project_id);
  `);
}

migrateProjectInvitationsTable();

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeUsername(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

/** 3–32 chars: letters, numbers, . _ - ; must start and end with alphanumeric. */
function validateUsername(s) {
  var u = normalizeUsername(s);
  if (u.length < 3 || u.length > 32) {
    return {
      ok: false,
      error: "Username must be 3–32 characters",
    };
  }
  if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(u)) {
    return {
      ok: false,
      error:
        "Username may only use letters, numbers, periods, underscores, and hyphens (start and end with a letter or number)",
    };
  }
  return { ok: true, value: u };
}

function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

module.exports = {
  db,
  normalizeEmail,
  normalizeUsername,
  validateUsername,
  looksLikeEmail,
};
