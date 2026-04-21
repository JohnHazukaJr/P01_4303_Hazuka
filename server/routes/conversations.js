const express = require("express");
const { normalizeUsername } = require("../db");
const { publicDisplayLabel } = require("../displayLabel");

const DM_BODY_MAX = 8000;

function parseId(param) {
  const n = Number(param);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseCursor(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function findPairConversationId(db, userA, userB) {
  const a = Math.min(userA, userB);
  const b = Math.max(userA, userB);
  const row = db
    .prepare(
      `SELECT c.id FROM dm_conversations c
       JOIN dm_participants p1 ON p1.conversation_id = c.id AND p1.user_id = ?
       JOIN dm_participants p2 ON p2.conversation_id = c.id AND p2.user_id = ?
       WHERE (SELECT COUNT(*) FROM dm_participants WHERE conversation_id = c.id) = 2`
    )
    .get(a, b);
  return row ? Number(row.id) : null;
}

function findOrCreatePairConversation(db, userA, userB) {
  const existing = findPairConversationId(db, userA, userB);
  if (existing) return existing;
  const info = db
    .prepare(`INSERT INTO dm_conversations DEFAULT VALUES`)
    .run();
  const cid = Number(info.lastInsertRowid);
  db.prepare(
    `INSERT INTO dm_participants (conversation_id, user_id) VALUES (?, ?)`
  ).run(cid, userA);
  db.prepare(
    `INSERT INTO dm_participants (conversation_id, user_id) VALUES (?, ?)`
  ).run(cid, userB);
  return cid;
}

function userInConversation(db, conversationId, userId) {
  const row = db
    .prepare(
      `SELECT 1 FROM dm_participants WHERE conversation_id = ? AND user_id = ?`
    )
    .get(conversationId, userId);
  return !!row;
}

function otherParticipantRow(db, conversationId, myUserId) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.public_display_as
       FROM dm_participants p
       JOIN users u ON u.id = p.user_id
       WHERE p.conversation_id = ? AND p.user_id != ?`
    )
    .get(conversationId, myUserId);
}

/**
 * @param {{ db: object, requireAuth: function }} deps
 */
function registerConversationRoutes(app, deps) {
  const { db, requireAuth } = deps;

  app.get("/api/conversations", requireAuth, (req, res) => {
    try {
      const rows = db
        .prepare(
          `SELECT c.id, c.updated_at,
                  (SELECT body FROM dm_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) AS last_body,
                  (SELECT created_at FROM dm_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) AS last_at
           FROM dm_conversations c
           JOIN dm_participants p ON p.conversation_id = c.id AND p.user_id = ?
           ORDER BY COALESCE(
             (SELECT created_at FROM dm_messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1),
             c.updated_at
           ) DESC`
        )
        .all(req.user.id);

      const list = rows.map((r) => {
        const other = otherParticipantRow(db, r.id, req.user.id);
        const preview =
          r.last_body != null
            ? String(r.last_body).slice(0, 160)
            : null;
        return {
          id: r.id,
          other_user: other
            ? {
                id: other.id,
                username:
                  other.username != null ? String(other.username) : null,
                public_display_label: publicDisplayLabel(other),
              }
            : null,
          last_message_preview: preview,
          last_message_at: r.last_at != null ? r.last_at : null,
        };
      });
      res.json({ conversations: list });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not load conversations" });
    }
  });

  app.post("/api/conversations", requireAuth, (req, res) => {
    const uname = normalizeUsername(req.body?.with_username);
    if (!uname) {
      return res.status(400).json({ error: "with_username is required" });
    }
    const other = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(uname);
    if (!other) {
      return res.status(404).json({ error: "User not found" });
    }
    const oid = Number(other.id);
    const me = Number(req.user.id);
    if (oid === me) {
      return res.status(400).json({ error: "Cannot start a conversation with yourself" });
    }
    try {
      const cid = findOrCreatePairConversation(db, me, oid);
      res.status(200).json({ conversation: { id: cid } });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not create conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", requireAuth, (req, res) => {
    const cid = parseId(req.params.id);
    if (!cid) {
      return res.status(404).json({ error: "Not found" });
    }
    if (!userInConversation(db, cid, req.user.id)) {
      return res.status(403).json({ error: "Not a participant" });
    }
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Math.min(
        100,
        Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 40)
      );
      const cursor = parseCursor(req.query.cursor);
      let sql = `
        SELECT id, sender_user_id, body, created_at
        FROM dm_messages
        WHERE conversation_id = ?
      `;
      const params = [cid];
      if (cursor) {
        sql += ` AND id < ?`;
        params.push(cursor);
      }
      sql += ` ORDER BY id DESC LIMIT ?`;
      params.push(limit + 1);
      const rows = db.prepare(sql).all(...params);
      const hasMore = rows.length > limit;
      const slice = hasMore ? rows.slice(0, limit) : rows;
      const messages = slice.map((m) => ({
        id: m.id,
        sender_user_id: m.sender_user_id,
        body: m.body != null ? String(m.body) : "",
        created_at: m.created_at,
      }));
      const nextCursor =
        hasMore && slice.length > 0 ? slice[slice.length - 1].id : null;
      res.json({ messages, next_cursor: nextCursor });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not load messages" });
    }
  });

  app.post("/api/conversations/:id/messages", requireAuth, (req, res) => {
    const cid = parseId(req.params.id);
    if (!cid) {
      return res.status(404).json({ error: "Not found" });
    }
    if (!userInConversation(db, cid, req.user.id)) {
      return res.status(403).json({ error: "Not a participant" });
    }
    const body = String(req.body?.body || "").trim();
    if (!body) {
      return res.status(400).json({ error: "Message body is required" });
    }
    if (body.length > DM_BODY_MAX) {
      return res.status(400).json({
        error: "Message is too long (max " + DM_BODY_MAX + " characters)",
      });
    }
    try {
      const info = db
        .prepare(
          `INSERT INTO dm_messages (conversation_id, sender_user_id, body) VALUES (?, ?, ?)`
        )
        .run(cid, req.user.id, body);
      db.prepare(
        `UPDATE dm_conversations SET updated_at = datetime('now') WHERE id = ?`
      ).run(cid);
      const msg = db
        .prepare(
          `SELECT id, sender_user_id, body, created_at FROM dm_messages WHERE id = ?`
        )
        .get(Number(info.lastInsertRowid));
      res.status(201).json({
        message: {
          id: msg.id,
          sender_user_id: msg.sender_user_id,
          body: msg.body,
          created_at: msg.created_at,
        },
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not send message" });
    }
  });
}

module.exports = { registerConversationRoutes };
