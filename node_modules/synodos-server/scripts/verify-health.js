/**
 * Checks GET /api/health (default local).
 * Local: npm start, then npm run verify
 * Production: set SYNODOS_VERIFY_HEALTH_URL=https://your-api.onrender.com/api/health
 *   or pass URL as first argument: node server/scripts/verify-health.js https://…/api/health
 */
const http = require("http");
const https = require("https");

const fromArg = process.argv[2] && String(process.argv[2]).trim();
const fromEnv = String(process.env.SYNODOS_VERIFY_HEALTH_URL || "").trim();
const url = fromArg || fromEnv || "http://127.0.0.1:8080/api/health";

const client = url.startsWith("https:") ? https : http;

client
  .get(url, (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => {
      try {
        const j = JSON.parse(data);
        if (res.statusCode !== 200) {
          console.error("verify-health: HTTP", res.statusCode, j);
          process.exit(1);
        }
        if (j.status === "ok" && j.database === "connected") {
          console.log("verify-health: OK", j);
          process.exit(0);
        }
        if (j.status === "ok" && j.database == null) {
          console.error(
            "verify-health: API returned legacy health JSON (no database field). Restart the server after pulling latest code."
          );
          process.exit(1);
        }
        if (j.status === "ok") {
          console.error("verify-health: expected database: connected, got:", j.database);
          process.exit(1);
        }
      } catch (_) {
        /* fall through */
      }
      console.error("verify-health: unexpected body:", data);
      process.exit(1);
    });
  })
  .on("error", (err) => {
    console.error("verify-health: could not reach API at", url);
    if (!fromArg && !fromEnv) {
      console.error("Start the server in another terminal: npm start");
    } else {
      console.error(
        "Check the URL, firewall, or set SYNODOS_VERIFY_HEALTH_URL / pass URL as argv[1]."
      );
    }
    console.error(err.message);
    process.exit(1);
  });
