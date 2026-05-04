/**
 * @param {import("express").Express} app
 * @param {{ db: object, requireAuth: function }} deps
 */
function registerNotificationRoutes(app, deps) {
  const { db, requireAuth } = deps;

  app.get("/api/me/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const row = await db
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

  app.get("/api/me/notifications", requireAuth, async (req, res) => {
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Math.min(
        100,
        Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 40)
      );
      const rows = await db
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

  app.patch("/api/me/notifications/:id/read", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(404).json({ error: "Not found" });
    }
    const info = await db
      .prepare(
        `UPDATE user_notifications SET read_at = now()
         WHERE id = ? AND user_id = ? AND read_at IS NULL`
      )
      .run(id, req.user.id);
    if (!info || Number(info.rowCount) === 0) {
      return res.status(404).json({ error: "Not found" });
    }
    res.status(204).end();
  });

  app.post("/api/me/notifications/read-all", requireAuth, async (req, res) => {
    try {
      await db.prepare(
        `UPDATE user_notifications SET read_at = now()
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
