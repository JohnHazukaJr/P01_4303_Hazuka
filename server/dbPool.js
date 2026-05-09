const { Pool } = require("pg");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error("[synodos] Missing required env var: " + name);
  }
  return v;
}

let pool = null;

function getPool() {
  if (pool) return pool;
  const url = requireEnv("DATABASE_URL");
  pool = new Pool({
    connectionString: url,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
  });
  return pool;
}

function translateQuestionMarks(sql) {
  const s = String(sql || "");
  if (!s.includes("?")) return s;
  let i = 0;
  return s.replace(/\?/g, function () {
    i += 1;
    return "$" + i;
  });
}

async function query(sql, params) {
  const p = getPool();
  return await p.query(sql, params || []);
}

async function get(sql, params) {
  const res = await query(sql, params);
  return res.rows && res.rows.length ? res.rows[0] : null;
}

async function all(sql, params) {
  const res = await query(sql, params);
  return res.rows || [];
}

async function run(sql, params) {
  const res = await query(sql, params);
  return { rowCount: res.rowCount || 0, rows: res.rows || [] };
}

function prepare(sql) {
  const translated = translateQuestionMarks(sql);
  return {
    get: async function (...args) {
      return await get(translated, args);
    },
    all: async function (...args) {
      return await all(translated, args);
    },
    run: async function (...args) {
      return await run(translated, args);
    },
  };
}

module.exports = { query, get, all, run, prepare };
