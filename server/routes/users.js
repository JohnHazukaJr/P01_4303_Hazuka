const express = require("express");
const { normalizeUsername } = require("../db");
const {
  enrichTag,
  isValidWorkField,
  isValidWorkSubfield,
} = require("../profileFields");
const { publicDisplayLabel } = require("../displayLabel");
const { insertFeedEvent, EVENT_TYPES } = require("../feedEvents");

function loadUserWorkTags(db, userId) {
  return db
    .all(
      "SELECT work_field, work_subfield FROM user_work_tags WHERE user_id = $1 ORDER BY id ASC",
      [userId]
    )
    .then(function (rows) {
      const out = [];
      for (let i = 0; i < rows.length; i++) {
        out.push(enrichTag(rows[i].work_field, rows[i].work_subfield));
      }
      return out;
    });
}

function profileCompleteFromRow(row, tags) {
  const dnOk = String(row.display_name || "").trim().length >= 2;
  if (!dnOk) return false;
  if (tags && tags.length > 0) {
    for (let i = 0; i < tags.length; i++) {
      const t = tags[i];
      if (
        isValidWorkField(t.work_field) &&
        isValidWorkSubfield(t.work_field, t.work_subfield)
      ) {
        return true;
      }
    }
  }
  const wf = String(row.work_field || "").trim();
  const ws = String(row.work_subfield || "").trim();
  return (
    wf.length > 0 &&
    ws.length > 0 &&
    isValidWorkField(wf) &&
    isValidWorkSubfield(wf, ws)
  );
}

/**
 * @param {{ db: object, requireAuth: function, optionalAuth: function }} deps
 */
function createUsersRouter(deps) {
  const { db, requireAuth, optionalAuth } = deps;
  const router = express.Router();

  router.get("/:username", optionalAuth, async (req, res) => {
    const uname = normalizeUsername(req.params.username);
    if (!uname) {
      return res.status(404).json({ error: "Not found" });
    }
    const row = await db.get(
      `SELECT id, username, display_name, public_display_as, bio, avatar_url, work_field, work_subfield, verified, official_account
       FROM users WHERE username = $1`,
      [uname]
    );
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
      official_account:
        row.official_account === true || Number(row.official_account) === 1,
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
    const target = await db.get(
      "SELECT id, username FROM users WHERE username = $1",
      [uname]
    );
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
        target_username:
          target.username != null ? String(target.username) : null,
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
    const target = await db.get(
      "SELECT id FROM users WHERE username = $1",
      [uname]
    );
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
