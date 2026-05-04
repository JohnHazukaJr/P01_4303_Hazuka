/**
 * Verifies required env vars for local dev against a real Supabase project.
 * Run from repo root: npm run check-env
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function ok(name, passed, detail) {
  console.log(passed ? "  OK " + name : "  !! " + name, detail || "");
  return passed;
}

function main() {
  console.log("[check-env] Reading server/.env\n");

  let all = true;
  const db = String(process.env.DATABASE_URL || "").trim();
  all =
    ok(
      "DATABASE_URL",
      db.length > 12 && /^postgres(ql)?:\/\//i.test(db),
      db ? "(set)" : "(missing)"
    ) && all;

  const supa = String(process.env.SUPABASE_URL || "").trim();
  const supaOk =
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supa) &&
    !/YOUR_PROJECT|placeholder|example/i.test(supa);
  all = ok("SUPABASE_URL", supaOk, supa || "(missing)") && all;

  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  all =
    ok(
      "SUPABASE_SERVICE_ROLE_KEY",
      key.length > 20,
      key ? "(set)" : "(missing)"
    ) && all;

  const jwt = String(process.env.JWT_SECRET || "").trim();
  if (jwt.length > 0) {
    ok("JWT_SECRET", true, "(set)");
  } else {
    console.log(
      "  … JWT_SECRET — optional for local dev (server uses a default warning)"
    );
  }

  const bucket = String(
    process.env.SUPABASE_AVATAR_BUCKET || "avatars"
  ).trim();
  console.log("  … SUPABASE_AVATAR_BUCKET =", bucket || "avatars");

  console.log(
    "\n[check-env] Also confirm in Supabase dashboard: Storage → bucket",
    bucket || "avatars",
    "→ Public ON.\n"
  );

  if (!all) {
    console.error(
      "[check-env] Fix server/.env then re-run. See server/README.md (Provision Supabase).\n"
    );
    process.exit(1);
  }
  console.log("[check-env] All required variables look good.\n");
}

main();
