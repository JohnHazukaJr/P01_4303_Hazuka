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

    const { rows: cols } = await pool.query(
      `SELECT column_name, udt_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users'
         AND column_name IN ('username', 'email')`
    );
    const byName = Object.fromEntries(
      cols.map((c) => [c.column_name, { udt: c.udt_name, dtype: c.data_type }])
    );
    for (const col of ["username", "email"]) {
      const meta = byName[col];
      if (!meta) {
        die("[verify-schema] Missing column users." + col);
      }
      const udt = String(meta.udt || "").toLowerCase();
      if (udt !== "citext") {
        die(
          "[verify-schema] users." +
            col +
            " must be type citext (found udt_name=" +
            JSON.stringify(meta.udt) +
            ", data_type=" +
            JSON.stringify(meta.dtype) +
            "). Re-run migrations or alter the column to citext for case-insensitive uniqueness."
        );
      }
    }
    console.log("[verify-schema] users.username and users.email are citext.");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[verify-schema] failed", e);
  process.exit(1);
});
