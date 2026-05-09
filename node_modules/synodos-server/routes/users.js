const express = require("express");
const { normalizeUsername } = require("../db");
const { publicDisplayLabel } = require("../displayLabel");
const { insertFeedEvent, EVENT_TYPES } = require("../feedEvents");
const {
  loadUserWorkTags,
  profileCompleteFromRow,
  sqlSelectUserProfileByUsername,
} = require("../userQueries");
const { parseCursor } = require("../routeUtils");

const SEARCH_MAX_LIMIT = 50;
const SEARCH_DEFAULT_LIMIT = 20;
const SEARCH_QUERY_MAX = 100;
const SEARCH_QUERY_MIN = 2;

function clampSearchLimit(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return SEARCH_DEFAULT_LIMIT;
  return Math.min(SEARCH_MAX_LIMIT, Math.max(1, Math.floor(n)));
}

function escapeLikeTerm(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * @param {{ db: object, requireAuth: function, optionalAuth: function }} deps
 */
function createUsersRouter(deps) {
  const { db, requireAuth, optionalAuth } = deps;
  const router = express.Router();

  /**
   * GET /api/users/search?q=&cursor=&limit=
   * Searches usernames, display names, bios, and work tag fields/subfields.
   * Cursor is the smallest user id from the previous page.
   */
  router.get("/search", optionalAuth, async (req, res) => {
    try {
      const limit = clampSearchLimit(req.query.limit);
      const cursor = parseCursor(req.query.cursor);
      const qRaw = String(req.query.q || "")
        .trim()
        .slice(0, SEARCH_QUERY_MAX);
      if (qRaw.length < SEARCH_QUERY_MIN) {
        return res.json({ users: [], next_cursor: null });
      }
      const like = "%" + escapeLikeTerm(qRaw) + "%";
      const params = [like, like, like, like];
      const where = [
        `(
          (u.username::text) ILIKE $1
          OR u.display_name ILIKE $2
          OR u.bio ILIKE $3
          OR EXISTS (
            SELECT 1 FROM user_work_tags wt
            WHERE wt.user_id = u.id
              AND (wt.work_field ILIKE $4 OR wt.work_subfield ILIKE $4)
          )
        )`,
      ];
      if (cursor) {
        params.push(cursor);
        where.push(`u.id < $${params.length}`);
      }
      params.push(limit + 1);
      const limitIdx = params.length;

      const sql = `
        SELECT u.id, u.username, u.display_name, u.bio, u.avatar_url,
               u.public_display_as, u.verified, u.official_account
        FROM users u
        WHERE ${where.join(" AND ")}
        ORDER BY u.id DESC
        LIMIT $${limitIdx}
      `;
      const rows = await db.all(sql, params);
      const hasMore = rows.length > limit;
      const slice = hasMore ? rows.slice(0, limit) : rows;

      const users = [];
      for (let i = 0; i < slice.length; i++) {
        const row = slice[i];
        const tags = await loadUserWorkTags(db, row.id);
        users.push({
          id: row.id,
          username: row.username != null ? String(row.username) : null,
          display_name: row.display_name != null ? String(row.display_name) : "",
          public_display_label: publicDisplayLabel(row),
          verified: Number(row.verified) === 1 || row.verified === true,
          official_account: row.official_account === true || Number(row.official_account) === 1,
          bio: row.bio != null ? String(row.bio) : "",
          avatar_url: row.avatar_url != null ? String(row.avatar_url) : "",
          work_tags: tags,
        });
      }

      const nextCursor = hasMore && slice.length > 0 ? Number(slice[slice.length - 1].id) : null;
      res.json({ users, next_cursor: nextCursor });
    } catch (e) {
      console.error("[synodos] GET /api/users/search failed", e);
      res.status(500).json({ error: "Could not search users" });
    }
  });

  router.get("/:username", optionalAuth, async (req, res) => {
    const uname = normalizeUsername(req.params.username);
    if (!uname) {
      return res.status(404).json({ error: "Not found" });
    }
    const row = await db.get(sqlSelectUserProfileByUsername(), [uname]);
    if (!row) {
      return res.status(404).json({ error: "Not found" });
    }
    const tags = await loadUserWorkTags(db, row.id);
    const user = {
      id: row.id,
      username: row.username != null ? String(row.username) : null,
      display_name: row.display_name != null ? String(row.display_name) : "",
      public_display_label: publicDisplayLabel(row),
      verified: Number(row.verified) === 1,
      official_account: row.official_account === true || Number(row.official_account) === 1,
      bio: row.bio != null ? String(row.bio) : "",
      avatar_url: row.avatar_url != null ? String(row.avatar_url) : "",
      work_tags: tags,
      profile_complete: profileCompleteFromRow(row, tags),
    };
    let viewer_follows = false;
    if (req.user && Number(req.user.id) !== Number(row.id)) {
      const f = await db.get(
        "SELECT 1 FROM user_follows WHERE follower_user_id = $1 AND following_user_id = $2",
        [req.user.id, row.id]
      );
      viewer_follows = !!f;
    }
    if (req.user && Number(req.user.id) === Number(row.id)) {
      viewer_follows = false;
    }
    res.json({ user, viewer_follows });
  });

  router.post("/:username/follow", requireAuth, async (req, res) => {
    const uname = normalizeUsername(req.params.username);
    if (!uname) {
      return res.status(404).json({ error: "Not found" });
    }
    const target = await db.get("SELECT id, username FROM users WHERE username = $1", [uname]);
    if (!target) {
      return res.status(404).json({ error: "Not found" });
    }
    const tid = Number(target.id);
    const me = Number(req.user.id);
    if (tid === me) {
      return res.status(400).json({ error: "You cannot follow yourself" });
    }
    const existing = await db.get(
      "SELECT 1 FROM user_follows WHERE follower_user_id = $1 AND following_user_id = $2",
      [me, tid]
    );
    if (existing) {
      return res.status(200).json({ ok: true, following: true });
    }
    try {
      await db.run(
        "INSERT INTO user_follows (follower_user_id, following_user_id) VALUES ($1, $2)",
        [me, tid]
      );
      await insertFeedEvent(db, me, EVENT_TYPES.USER_FOLLOWED, {
        target_user_id: tid,
        target_username: target.username != null ? String(target.username) : null,
      });
      res.status(201).json({ ok: true, following: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not follow user" });
    }
  });

  router.delete("/:username/follow", requireAuth, async (req, res) => {
    const uname = normalizeUsername(req.params.username);
    if (!uname) {
      return res.status(404).json({ error: "Not found" });
    }
    const target = await db.get("SELECT id FROM users WHERE username = $1", [uname]);
    if (!target) {
      return res.status(404).json({ error: "Not found" });
    }
    await db.run(
      "DELETE FROM user_follows WHERE follower_user_id = $1 AND following_user_id = $2",
      [req.user.id, target.id]
    );
    res.status(204).end();
  });

  return router;
}

module.exports = { createUsersRouter };
