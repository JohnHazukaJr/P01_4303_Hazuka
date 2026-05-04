const express = require("express");
const { publicDisplayLabel } = require("../displayLabel");

function parseCursor(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * @param {{ db: object, requireAuth: function }} deps
 */
function registerFeedRoutes(app, deps) {
  const { db, requireAuth } = deps;

  app.get("/api/feed", requireAuth, async (req, res) => {
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Math.min(
        50,
        Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 20)
      );
      const cursor = parseCursor(req.query.cursor);

      const followingRows = await db
        .prepare(
          `SELECT following_user_id FROM user_follows WHERE follower_user_id = ?`
        )
        .all(req.user.id);
      const actorIds = new Set([Number(req.user.id)]);
      for (let i = 0; i < followingRows.length; i++) {
        actorIds.add(Number(followingRows[i].following_user_id));
      }
      const ids = Array.from(actorIds);
      if (ids.length === 0) {
        return res.json({ events: [], next_cursor: null });
      }

      const placeholders = ids.map(() => "?").join(",");
      let sql = `
        SELECT e.id, e.actor_user_id, e.event_type, e.payload_json, e.created_at,
               u.username AS actor_username, u.display_name AS actor_display_name,
               u.public_display_as AS actor_public_display_as
        FROM feed_events e
        JOIN users u ON u.id = e.actor_user_id
        WHERE e.actor_user_id IN (${placeholders})
      `;
      const params = [...ids];
      if (cursor) {
        sql += ` AND e.id < ?`;
        params.push(cursor);
      }
      sql += ` ORDER BY e.id DESC LIMIT ?`;
      params.push(limit + 1);

      const rows = await db.prepare(sql).all(...params);
      const hasMore = rows.length > limit;
      const slice = hasMore ? rows.slice(0, limit) : rows;
      const events = slice.map((row) => {
        let payload = {};
        try {
          payload = JSON.parse(row.payload_json || "{}");
        } catch (_) {}
        return {
          id: row.id,
          actor_user_id: row.actor_user_id,
          actor_username:
            row.actor_username != null ? String(row.actor_username) : null,
          actor_public_display_label: publicDisplayLabel({
            username: row.actor_username,
            display_name: row.actor_display_name,
            public_display_as: row.actor_public_display_as,
          }),
          event_type: row.event_type,
          payload,
          created_at: row.created_at,
        };
      });
      const nextCursor =
        hasMore && slice.length > 0 ? slice[slice.length - 1].id : null;
      res.json({ events, next_cursor: nextCursor });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not load feed" });
    }
  });
}

module.exports = { registerFeedRoutes };
