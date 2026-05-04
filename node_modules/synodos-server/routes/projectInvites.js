const { normalizeUsername } = require("../db");
const { publicDisplayLabel } = require("../displayLabel");
const {
  insertNotification,
  NOTIFICATION_TYPES,
} = require("../userNotifications");

const NOTE_MAX = 500;

function parseId(param) {
  const n = Number(param);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * @param {import("express").Router} router mounted at /api/projects
 * @param {{ db: object, requireAuth: function }} deps
 */
function registerProjectInviteRoutes(router, deps) {
  const { db, requireAuth } = deps;

  router.post("/:id/invites", requireAuth, async (req, res) => {
    const projectId = parseId(req.params.id);
    if (!projectId) {
      return res.status(404).json({ error: "Not found" });
    }
    const project = await db
      .prepare("SELECT id, owner_user_id, title FROM projects WHERE id = ?")
      .get(projectId);
    if (!project) {
      return res.status(404).json({ error: "Not found" });
    }
    if (Number(project.owner_user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: "Only the project owner can invite" });
    }
    const uname = normalizeUsername(req.body?.username);
    if (!uname) {
      return res.status(400).json({ error: "username is required" });
    }
    const note = String(req.body?.note || "").trim().slice(0, NOTE_MAX);
    const invitee = await db
      .prepare(
        `SELECT id, username, display_name, public_display_as FROM users WHERE username = ?`
      )
      .get(uname);
    if (!invitee) {
      return res.status(404).json({ error: "User not found" });
    }
    if (Number(invitee.id) === Number(req.user.id)) {
      return res.status(400).json({ error: "You cannot invite yourself" });
    }
    const pendingJr = await db
      .prepare(
        `SELECT 1 FROM project_join_requests
         WHERE project_id = ? AND requester_user_id = ? AND status = 'pending'`
      )
      .get(projectId, invitee.id);
    if (pendingJr) {
      return res.status(409).json({
        error: "That user already has a pending join request for this project",
      });
    }
    const pendingInv = await db
      .prepare(
        `SELECT 1 FROM project_invitations
         WHERE project_id = ? AND invitee_user_id = ? AND status = 'pending'`
      )
      .get(projectId, invitee.id);
    if (pendingInv) {
      return res.status(409).json({
        error: "You already have a pending invitation out to this person for this project",
      });
    }
    const inviter = await db
      .prepare(
        `SELECT username, display_name, public_display_as FROM users WHERE id = ?`
      )
      .get(req.user.id);
    try {
      const info = await db
        .prepare(
          `INSERT INTO project_invitations (project_id, inviter_user_id, invitee_user_id, note, status)
           VALUES (?, ?, ?, ?, 'pending') RETURNING id`
        )
        .run(projectId, req.user.id, invitee.id, note);
      const invId = info && info.rows && info.rows[0] ? Number(info.rows[0].id) : null;
      if (!invId) {
        return res.status(500).json({ error: "Could not create invitation" });
      }
      await insertNotification(db, invitee.id, NOTIFICATION_TYPES.PROJECT_INVITE_RECEIVED, {
        invitation_id: invId,
        project_id: projectId,
        project_title:
          project.title != null ? String(project.title) : "",
        inviter_user_id: req.user.id,
        inviter_username:
          inviter && inviter.username != null ? String(inviter.username) : null,
        inviter_public_display_label: inviter
          ? publicDisplayLabel(inviter)
          : null,
      });
      res.status(201).json({
        invitation: {
          id: invId,
          project_id: projectId,
          invitee_username:
            invitee.username != null ? String(invitee.username) : null,
        },
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not create invitation" });
    }
  });
}

/**
 * @param {import("express").Express} app
 * @param {{ db: object, requireAuth: function }} deps
 */
function registerMeProjectInviteRoutes(app, deps) {
  const { db, requireAuth } = deps;

  app.get("/api/me/project-invitations", requireAuth, async (req, res) => {
    try {
      const rows = await db
        .prepare(
          `SELECT i.id, i.project_id, i.note, i.created_at,
                  p.title AS project_title,
                  u.id AS inviter_id, u.username AS inviter_username,
                  u.display_name AS inviter_display_name, u.public_display_as AS inviter_public_display_as
           FROM project_invitations i
           JOIN projects p ON p.id = i.project_id
           JOIN users u ON u.id = i.inviter_user_id
           WHERE i.invitee_user_id = ? AND i.status = 'pending'
           ORDER BY i.created_at ASC`
        )
        .all(req.user.id);
      const invitations = rows.map((row) => ({
        id: row.id,
        project_id: row.project_id,
        project_title: row.project_title != null ? String(row.project_title) : "",
        note: row.note != null ? String(row.note) : "",
        created_at: row.created_at,
        inviter: {
          id: row.inviter_id,
          username:
            row.inviter_username != null ? String(row.inviter_username) : null,
          public_display_label: publicDisplayLabel({
            username: row.inviter_username,
            display_name: row.inviter_display_name,
            public_display_as: row.inviter_public_display_as,
          }),
        },
      }));
      res.json({ invitations });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not load invitations" });
    }
  });

  app.patch("/api/me/project-invitations/:inviteId", requireAuth, async (req, res) => {
    const inviteId = parseId(req.params.inviteId);
    if (!inviteId) {
      return res.status(404).json({ error: "Not found" });
    }
    const next = String(req.body?.status || "").toLowerCase();
    if (next !== "accepted" && next !== "declined") {
      return res
        .status(400)
        .json({ error: 'status must be "accepted" or "declined"' });
    }
    const row = await db
      .prepare(
        `SELECT id, project_id, inviter_user_id, invitee_user_id, status FROM project_invitations WHERE id = ?`
      )
      .get(inviteId);
    if (!row || Number(row.invitee_user_id) !== Number(req.user.id)) {
      return res.status(404).json({ error: "Not found" });
    }
    if (row.status !== "pending") {
      return res.status(400).json({ error: "This invitation is no longer pending" });
    }
    await db.prepare(
      `UPDATE project_invitations SET status = ?, resolved_at = now() WHERE id = ?`
    ).run(next, inviteId);
    if (next === "accepted") {
      const proj = await db
        .prepare("SELECT id, title FROM projects WHERE id = ?")
        .get(row.project_id);
      const inviteeRow = await db
        .prepare(
          `SELECT username, display_name, public_display_as FROM users WHERE id = ?`
        )
        .get(req.user.id);
      const title =
        proj && proj.title != null ? String(proj.title) : "";
      await insertNotification(db, row.inviter_user_id, NOTIFICATION_TYPES.PROJECT_INVITE_ACCEPTED, {
        invitation_id: inviteId,
        project_id: row.project_id,
        project_title: title,
        invitee_user_id: req.user.id,
        invitee_username:
          inviteeRow && inviteeRow.username != null
            ? String(inviteeRow.username)
            : null,
        invitee_public_display_label: inviteeRow
          ? publicDisplayLabel(inviteeRow)
          : null,
      });
      await insertNotification(db, req.user.id, NOTIFICATION_TYPES.PROJECT_YOU_WERE_ADDED, {
        invitation_id: inviteId,
        project_id: row.project_id,
        project_title: title,
      });
    }
    res.json({ ok: true, status: next });
  });
}

module.exports = {
  registerProjectInviteRoutes,
  registerMeProjectInviteRoutes,
};
