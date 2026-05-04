/**
 * Writes web/js/netlify-api-base.js from SYNODOS_API_BASE (Netlify / CI).
 * Run from repo root: node web/scripts/write-netlify-api-base.js
 * From web/ (e.g. Render static rootDir): node scripts/write-netlify-api-base.js
 */
const fs = require("fs");
const path = require("path");

const out = path.join(__dirname, "..", "js", "netlify-api-base.js");
const base = String(process.env.SYNODOS_API_BASE || "").trim();

let body;
if (base) {
  if (!/^https?:\/\//i.test(base)) {
    console.warn(
      "[synodos] SYNODOS_API_BASE should start with http:// or https:// — got:",
      base.slice(0, 80)
    );
  }
  body =
    "/* Generated: SYNODOS_API_BASE at build */\n" +
    "window.SYNODOS_API_BASE = " +
    JSON.stringify(base.replace(/\/+$/, "")) +
    ";\n";
} else {
  body =
    "/* No SYNODOS_API_BASE at build. Set it in Netlify (Site → Environment) and rebuild, or use <meta name=\"synodos-api-base\" content=\"…\"> / localStorage synodos_api_base. */\n";
}

fs.writeFileSync(out, body, "utf8");
console.log(
  "[synodos] wrote",
  path.relative(process.cwd(), out),
  base ? "(" + base + ")" : "(stub)"
);
