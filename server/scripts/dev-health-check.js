/**
 * Starts the API briefly, polls GET /api/health until database: connected, then exits.
 * Use when server/.env is filled — proves migrate + pool + health route.
 */
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

/** Ephemeral port so this does not fight a dev server on 8080. */
const TEST_PORT = Number(process.env.HEALTH_CHECK_PORT) || 19876;

function getHealth() {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${TEST_PORT}/api/health`, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function waitForHealth(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await getHealth();
      if (
        r.statusCode === 200 &&
        r.body &&
        r.body.status === "ok" &&
        r.body.database === "connected"
      ) {
        return r.body;
      }
    } catch (_) {
      /* server not ready */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[dev-health-check] DATABASE_URL missing — fill server/.env first.");
    process.exit(1);
  }

  const srvDir = path.join(__dirname, "..");
  const child = spawn(process.execPath, ["index.js"], {
    cwd: srvDir,
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  if (child.stderr) {
    child.stderr.on("data", (c) => {
      stderr += String(c);
    });
  }

  let body;
  try {
    body = await waitForHealth(20000);
  } finally {
    try {
      child.kill();
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!body) {
    console.error(
      "[dev-health-check] Timed out waiting for 200 { status: ok, database: connected }"
    );
    if (stderr.trim()) console.error(stderr.trim());
    process.exit(1);
  }

  console.log("[dev-health-check] OK", body);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
