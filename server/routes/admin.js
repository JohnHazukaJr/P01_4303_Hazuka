const express = require("express");
const { normalizeUsername } = require("../db");
const { loadUserProfileRow } = require("../userQueries");

function parseAdminUserIds() {
  const raw = String(process.env.SYNODOS_ADMIN_USER_IDS || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
  );
}

/** Comma-separated usernames (same rules as login — normalized lower-case). */
function parseAdminUsernames() {
  const raw = String(process.env.SYNODOS_ADMIN_USERNAMES || "").trim();
  if (!raw) return new Set();
  const out = new Set();
  raw.split(",").forEach(function (part) {
    const u = normalizeUsername(part);
    if (u) out.add(u);
  });
  return out;
}

/**
 * @param {object} db - pg pool wrapper
 */
function createIsAdmin(db) {
  const ids = parseAdminUserIds();
  const names = parseAdminUsernames();
  return async function isAdmin(userId) {
    if (ids.has(Number(userId))) return true;
    if (names.size === 0) return false;
    const row = await db.get("SELECT username FROM users WHERE id = $1", [
      userId,
    ]);
    if (!row || row.username == null) return false;
    const u = normalizeUsername(row.username);
    return names.has(u);
  };
}

/**
 * @param {import('express').Express} app
 * @param {{ db: object, requireAuth: function, isAdmin: function }} deps
 */
function registerAdminRoutes(app, deps) {
  const { db, requireAuth, isAdmin } = deps;

  app.patch(
    "/api/admin/users/:username/badges",
    requireAuth,
    async (req, res) => {
      if (!(await isAdmin(req.user.id))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const uname = normalizeUsername(req.params.username);
      if (!uname) {
        return res.status(400).json({ error: "Invalid username" });
      }
      const body = req.body || {};
      const hasVerified = Object.prototype.hasOwnProperty.call(body, "verified");
      const hasOfficial = Object.prototype.hasOwnProperty.call(
        body,
        "official_account"
      );
      if (!hasVerified && !hasOfficial) {
        return res
          .status(400)
          .json({ error: "Send verified and/or official_account (booleans)" });
      }
      if (hasVerified && typeof body.verified !== "boolean") {
        return res.status(400).json({ error: "verified must be a boolean" });
      }
      if (hasOfficial && typeof body.official_account !== "boolean") {
        return res
          .status(400)
          .json({ error: "official_account must be a boolean" });
      }

      const target = await db.get(
        "SELECT id FROM users WHERE username = $1",
        [uname]
      );
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }

      const nextVerified = hasVerified ? body.verified : null;
      const nextOfficial = hasOfficial ? body.official_account : null;

      if (hasVerified && hasOfficial) {
        await db.run(
          "UPDATE users SET verified = $1, official_account = $2 WHERE id = $3",
          [nextVerified, nextOfficial, target.id]
        );
      } else if (hasVerified) {
        await db.run("UPDATE users SET verified = $1 WHERE id = $2", [
          nextVerified,
          target.id,
        ]);
      } else {
        await db.run("UPDATE users SET official_account = $1 WHERE id = $2", [
          nextOfficial,
          target.id,
        ]);
      }

      const row = await loadUserProfileRow(db, target.id);
      res.json({
        user: {
          id: row.id,
          username: row.username != null ? String(row.username) : null,
          verified: Number(row.verified) === 1,
          official_account: Number(row.official_account) === 1,
        },
      });
    }
  );
}

module.exports = { registerAdminRoutes, createIsAdmin };
