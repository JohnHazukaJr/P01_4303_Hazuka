/**
 * One-time helper: copy avatars from legacy local disk (data/uploads/avatars/)
 * into Supabase Storage and rewrite users.avatar_url.
 *
 * Idempotent — only touches rows whose avatar_url still starts with
 * /uploads/avatars/. Safe to re-run.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const fs = require("fs");
const { Pool } = require("pg");
const storage = require("../storage");

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) die("[migrate-avatars] DATABASE_URL is required");

const EXT_TO_MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

async function main() {
  const pool = new Pool({
    connectionString: url,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
  });

  const localDir = path.join(__dirname, "..", "data", "uploads", "avatars");
  let updated = 0;
  let skipped = 0;

  try {
    const { rows } = await pool.query("SELECT id, avatar_url FROM users WHERE avatar_url LIKE $1", [
      "/uploads/avatars/%",
    ]);

    for (const row of rows) {
      const rel = String(row.avatar_url || "");
      const base = path.basename(rel);
      const filepath = path.join(localDir, base);
      if (!fs.existsSync(filepath)) {
        console.warn("[migrate-avatars] skip user", row.id, "(file missing):", filepath);
        skipped++;
        continue;
      }
      const ext = path.extname(base).toLowerCase();
      const mime = EXT_TO_MIME[ext];
      if (!mime) {
        console.warn("[migrate-avatars] skip user", row.id, "(unknown ext):", ext);
        skipped++;
        continue;
      }
      const buf = fs.readFileSync(filepath);
      const saved = await storage.uploadAvatar(row.id, buf, mime);
      if (!saved.ok) {
        console.error("[migrate-avatars] upload failed user", row.id, saved.error);
        skipped++;
        continue;
      }
      const publicUrl = saved.url + "?v=" + Date.now();
      await pool.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [publicUrl, row.id]);
      updated++;
      console.log("[migrate-avatars] user", row.id, "→", publicUrl);
    }

    console.log("[migrate-avatars] done. updated:", updated, "skipped:", skipped);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[migrate-avatars] failed", e);
  process.exit(1);
});
