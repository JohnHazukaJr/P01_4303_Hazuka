const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Pool } = require("pg");

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  die("[migrate] DATABASE_URL is required");
}

const migrationsDir = path.join(__dirname, "..", "migrations");
if (!fs.existsSync(migrationsDir)) {
  die("[migrate] migrations directory not found: " + migrationsDir);
}

function listMigrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d+_.+\.sql$/i.test(f))
    .sort((a, b) => a.localeCompare(b));
}

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function alreadyApplied(pool) {
  await ensureMigrationsTable(pool);
  const { rows } = await pool.query("SELECT id FROM schema_migrations");
  const set = new Set();
  for (const r of rows) set.add(String(r.id));
  return set;
}

async function applyOne(pool, id, sql) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
      [id]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  const pool = new Pool({
    connectionString: url,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
  });

  try {
    const files = listMigrationFiles();
    const applied = await alreadyApplied(pool);

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const full = path.join(migrationsDir, file);
      const sql = fs.readFileSync(full, "utf8");
      console.log("[migrate] applying", file);
      await applyOne(pool, file, sql);
      ran++;
    }

    console.log("[migrate] done. applied:", ran);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[migrate] failed", e);
  process.exit(1);
});
