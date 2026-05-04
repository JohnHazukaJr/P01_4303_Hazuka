/**
 * Checks GET http://127.0.0.1:8080/api/health
 * Run with the API already up: npm start (other terminal), then npm run verify
 */
const http = require("http");

const url = "http://127.0.0.1:8080/api/health";

http
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
          console.error(
            "verify-health: expected database: connected, got:",
            j.database
          );
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
    console.error("Start the server in another terminal: npm start");
    console.error(err.message);
    process.exit(1);
  });
