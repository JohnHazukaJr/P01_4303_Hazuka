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
        if (j.status === "ok") {
          console.log("verify-health: OK", j);
          process.exit(0);
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
