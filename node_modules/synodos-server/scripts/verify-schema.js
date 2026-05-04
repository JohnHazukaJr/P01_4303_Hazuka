/**
 * Confirms public tables exist after npm run migrate (replaces manual Studio check).
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Pool } = require("pg");

const EXPECTED = [
  "schema_migrations",
  "users",
  "projects",
  "project_roles",
  "user_work_tags",
  "project_join_requests",
  "user_follows",
  "feed_events",
  "dm_conversations",
  "dm_participants",
  "dm_messages",
  "user_notifications",
  "project_invitations",
];

function die(msg) {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) die("[verify-schema] DATABASE_URL is required (server/.env)");

  const pool = new Pool({
    connectionString: url,
    ssl:
      process.env.PGSSLMODE === "disable"
        ? false
        : { rejectUnauthorized: false },
  });

  try {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    const have = new Set(rows.map((r) => r.table_name));
    const missing = EXPECTED.filter((t) => !have.has(t));
    if (missing.length) {
      console.error("[verify-schema] Missing tables:", missing.join(", "));
      console.error("  Run: npm run migrate");
      process.exit(1);
    }
    console.log("[verify-schema] All", EXPECTED.length, "expected tables present.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[verify-schema] failed", e);
  process.exit(1);
});
