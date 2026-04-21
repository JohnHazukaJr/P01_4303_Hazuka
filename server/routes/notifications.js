/**
 * @param {import("express").Express} app
 * @param {{ db: object, requireAuth: function }} deps
 */
function registerNotificationRoutes(app, deps) {
  const { db, requireAuth } = deps;

  app.get("/api/me/notifications/unread-count", requireAuth, (req, res) => {
    try {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS n FROM user_notifications
           WHERE user_id = ? AND read_at IS NULL`
        )
        .get(req.user.id);
      const n = row && row.n != null ? Number(row.n) : 0;
      res.json({ unread_count: Number.isFinite(n) ? n : 0 });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not load count" });
    }
  });

  app.get("/api/me/notifications", requireAuth, (req, res) => {
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Math.min(
        100,
        Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 40)
      );
      const rows = db
        .prepare(
          `SELECT id, notification_type, payload_json, read_at, created_at
           FROM user_notifications
           WHERE user_id = ?
           ORDER BY id DESC
           LIMIT ?`
        )
        .all(req.user.id, limit);
      const notifications = rows.map((row) => {
        let payload = {};
        try {
          payload = JSON.parse(row.payload_json || "{}");
        } catch (_) {}
        return {
          id: row.id,
          notification_type: row.notification_type,
          payload,
          read_at: row.read_at != null ? row.read_at : null,
          created_at: row.created_at,
        };
      });
      res.json({ notifications });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not load notifications" });
    }
  });

  app.patch("/api/me/notifications/:id/read", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(404).json({ error: "Not found" });
    }
    const info = db
      .prepare(
        `UPDATE user_notifications SET read_at = datetime('now')
         WHERE id = ? AND user_id = ? AND read_at IS NULL`
      )
      .run(id, req.user.id);
    if (Number(info.changes) === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    res.status(204).end();
  });

  app.post("/api/me/notifications/read-all", requireAuth, (req, res) => {
    try {
      db.prepare(
        `UPDATE user_notifications SET read_at = datetime('now')
         WHERE user_id = ? AND read_at IS NULL`
      ).run(req.user.id);
      res.status(204).end();
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not update" });
    }
  });
}

module.exports = { registerNotificationRoutes };
