const NOTE_MAX = 500;
const { publicDisplayLabel } = require("../displayLabel");
const { insertFeedEvent, EVENT_TYPES } = require("../feedEvents");
const { insertNotification, NOTIFICATION_TYPES: NTYPE } = require("../userNotifications");

function parseId(param) {
  const n = Number(param);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function requestRowToJSON(row, roleTitle) {
  return {
    id: row.id,
    project_id: row.project_id,
    project_role_id: row.project_role_id,
    role_title: roleTitle != null ? roleTitle : null,
    note: row.note != null ? String(row.note) : "",
    status: row.status,
    created_at: row.created_at,
    resolved_at: row.resolved_at != null ? row.resolved_at : null,
    requester:
      row.requester_id != null
        ? {
            id: row.requester_id,
            username: row.requester_username != null ? String(row.requester_username) : null,
            public_display_label: publicDisplayLabel({
              username: row.requester_username,
              display_name: row.requester_display_name,
              public_display_as: row.requester_public_display_as,
            }),
          }
        : null,
  };
}

/**
 * @param {import("express").Router} router mounted at /api/projects
 * @param {{ db: object, requireAuth: function }} deps
 */
function registerProjectJoinRoutes(router, deps) {
  const { db, requireAuth } = deps;

  router.get("/:id/join-requests", requireAuth, async (req, res) => {
    const projectId = parseId(req.params.id);
    if (!projectId) {
      return res.status(404).json({ error: "Not found" });
    }
    const project = await db
      .prepare("SELECT id, owner_user_id FROM projects WHERE id = ?")
      .get(projectId);
    if (!project) {
      return res.status(404).json({ error: "Not found" });
    }
    if (Number(project.owner_user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: "Only the project owner can view join requests" });
    }
    const statusFilter = String(req.query.status || "pending").toLowerCase();
    let rows;
    if (statusFilter === "all") {
      rows = await db
        .prepare(
          `SELECT r.id, r.project_id, r.requester_user_id, r.project_role_id, r.note, r.status, r.created_at, r.resolved_at,
                  u.id AS requester_id, u.username AS requester_username, u.display_name AS requester_display_name,
                  u.public_display_as AS requester_public_display_as,
                  pr.title AS role_title
           FROM project_join_requests r
           JOIN users u ON u.id = r.requester_user_id
           LEFT JOIN project_roles pr ON pr.id = r.project_role_id
           WHERE r.project_id = ?
           ORDER BY r.created_at DESC`
        )
        .all(projectId);
    } else if (
      statusFilter === "pending" ||
      statusFilter === "accepted" ||
      statusFilter === "declined" ||
      statusFilter === "withdrawn"
    ) {
      rows = await db
        .prepare(
          `SELECT r.id, r.project_id, r.requester_user_id, r.project_role_id, r.note, r.status, r.created_at, r.resolved_at,
                  u.id AS requester_id, u.username AS requester_username, u.display_name AS requester_display_name,
                  u.public_display_as AS requester_public_display_as,
                  pr.title AS role_title
           FROM project_join_requests r
           JOIN users u ON u.id = r.requester_user_id
           LEFT JOIN project_roles pr ON pr.id = r.project_role_id
           WHERE r.project_id = ? AND r.status = ?
           ORDER BY r.created_at DESC`
        )
        .all(projectId, statusFilter);
    } else {
      return res.status(400).json({ error: "Invalid status filter" });
    }
    const out = rows.map((row) =>
      requestRowToJSON(
        {
          id: row.id,
          project_id: row.project_id,
          project_role_id: row.project_role_id,
          note: row.note,
          status: row.status,
          created_at: row.created_at,
          resolved_at: row.resolved_at,
          requester_id: row.requester_id,
          requester_username: row.requester_username,
          requester_display_name: row.requester_display_name,
          requester_public_display_as: row.requester_public_display_as,
        },
        row.role_title
      )
    );
    res.json({ requests: out });
  });

  router.post("/:id/join-requests", requireAuth, async (req, res) => {
    const projectId = parseId(req.params.id);
    if (!projectId) {
      return res.status(404).json({ error: "Not found" });
    }
    const project = await db
      .prepare("SELECT id, owner_user_id FROM projects WHERE id = ?")
      .get(projectId);
    if (!project) {
      return res.status(404).json({ error: "Not found" });
    }
    if (Number(project.owner_user_id) === Number(req.user.id)) {
      return res.status(403).json({ error: "You cannot request to join your own project" });
    }
    let roleId = null;
    if (req.body && req.body.role_id != null && req.body.role_id !== "") {
      roleId = parseId(req.body.role_id);
      if (!roleId) {
        return res.status(400).json({ error: "Invalid role" });
      }
      const role = await db
        .prepare("SELECT id FROM project_roles WHERE id = ? AND project_id = ?")
        .get(roleId, projectId);
      if (!role) {
        return res.status(400).json({ error: "That role is not on this project" });
      }
    }
    const note = String(req.body?.note || "")
      .trim()
      .slice(0, NOTE_MAX);
    const pending = await db
      .prepare(
        `SELECT id FROM project_join_requests
         WHERE project_id = ? AND requester_user_id = ? AND status = 'pending'`
      )
      .get(projectId, req.user.id);
    if (pending) {
      return res.status(409).json({
        error: "You already have a pending request for this project",
      });
    }
    try {
      const info = await db
        .prepare(
          `INSERT INTO project_join_requests (project_id, requester_user_id, project_role_id, note, status)
           VALUES (?, ?, ?, ?, 'pending') RETURNING id`
        )
        .run(projectId, req.user.id, roleId, note);
      const id = info && info.rows && info.rows[0] ? Number(info.rows[0].id) : null;
      if (!id) {
        return res.status(500).json({ error: "Could not create join request" });
      }
      const row = await db
        .prepare(
          `SELECT r.id, r.project_id, r.requester_user_id, r.project_role_id, r.note, r.status, r.created_at, r.resolved_at,
                  u.id AS requester_id, u.username AS requester_username, u.display_name AS requester_display_name,
                  u.public_display_as AS requester_public_display_as,
                  pr.title AS role_title
           FROM project_join_requests r
           JOIN users u ON u.id = r.requester_user_id
           LEFT JOIN project_roles pr ON pr.id = r.project_role_id
           WHERE r.id = ?`
        )
        .get(id);
      const projRow = await db
        .prepare("SELECT owner_user_id, title FROM projects WHERE id = ?")
        .get(projectId);
      if (projRow) {
        await insertNotification(db, projRow.owner_user_id, NTYPE.JOIN_REQUEST_RECEIVED, {
          project_id: projectId,
          project_title: projRow.title != null ? String(projRow.title) : "",
          join_request_id: id,
          requester_user_id: req.user.id,
          requester_username:
            row.requester_username != null ? String(row.requester_username) : null,
          requester_public_display_label: publicDisplayLabel({
            username: row.requester_username,
            display_name: row.requester_display_name,
            public_display_as: row.requester_public_display_as,
          }),
        });
      }
      res.status(201).json({
        request: requestRowToJSON(
          {
            id: row.id,
            project_id: row.project_id,
            project_role_id: row.project_role_id,
            note: row.note,
            status: row.status,
            created_at: row.created_at,
            resolved_at: row.resolved_at,
            requester_id: row.requester_id,
            requester_username: row.requester_username,
            requester_display_name: row.requester_display_name,
            requester_public_display_as: row.requester_public_display_as,
          },
          row.role_title
        ),
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not create join request" });
    }
  });

  router.patch("/:id/join-requests/:requestId", requireAuth, async (req, res) => {
    const projectId = parseId(req.params.id);
    const requestId = parseId(req.params.requestId);
    if (!projectId || !requestId) {
      return res.status(404).json({ error: "Not found" });
    }
    const project = await db
      .prepare("SELECT id, owner_user_id FROM projects WHERE id = ?")
      .get(projectId);
    if (!project) {
      return res.status(404).json({ error: "Not found" });
    }
    if (Number(project.owner_user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: "Only the owner can update requests" });
    }
    const nextStatus = String(req.body?.status || "").toLowerCase();
    if (nextStatus !== "accepted" && nextStatus !== "declined") {
      return res.status(400).json({ error: 'status must be "accepted" or "declined"' });
    }
    const row = await db
      .prepare(
        `SELECT id, project_id, status, requester_user_id FROM project_join_requests WHERE id = ? AND project_id = ?`
      )
      .get(requestId, projectId);
    if (!row) {
      return res.status(404).json({ error: "Not found" });
    }
    if (row.status !== "pending") {
      const full = await db
        .prepare(
          `SELECT r.id, r.project_id, r.requester_user_id, r.project_role_id, r.note, r.status, r.created_at, r.resolved_at,
                    u.id AS requester_id, u.username AS requester_username, u.display_name AS requester_display_name,
                    u.public_display_as AS requester_public_display_as,
                    pr.title AS role_title
             FROM project_join_requests r
             JOIN users u ON u.id = r.requester_user_id
             LEFT JOIN project_roles pr ON pr.id = r.project_role_id
             WHERE r.id = ?`
        )
        .get(requestId);
      return res.json({
        request: requestRowToJSON(
          {
            id: full.id,
            project_id: full.project_id,
            project_role_id: full.project_role_id,
            note: full.note,
            status: full.status,
            created_at: full.created_at,
            resolved_at: full.resolved_at,
            requester_id: full.requester_id,
            requester_username: full.requester_username,
            requester_display_name: full.requester_display_name,
            requester_public_display_as: full.requester_public_display_as,
          },
          full.role_title
        ),
      });
    }
    await db
      .prepare(`UPDATE project_join_requests SET status = ?, resolved_at = now() WHERE id = ?`)
      .run(nextStatus, requestId);
    const proj = await db.prepare("SELECT id, title FROM projects WHERE id = ?").get(projectId);
    const projTitle = proj && proj.title != null ? String(proj.title) : "";
    if (nextStatus === "accepted") {
      if (proj) {
        await insertFeedEvent(db, row.requester_user_id, EVENT_TYPES.JOIN_ACCEPTED, {
          project_id: proj.id,
          project_title: projTitle,
        });
      }
      await insertNotification(db, row.requester_user_id, NTYPE.JOIN_REQUEST_ACCEPTED, {
        project_id: projectId,
        project_title: projTitle,
        join_request_id: requestId,
      });
    } else if (nextStatus === "declined") {
      await insertNotification(db, row.requester_user_id, NTYPE.JOIN_REQUEST_DECLINED, {
        project_id: projectId,
        project_title: projTitle,
        join_request_id: requestId,
      });
    }
    const updated = await db
      .prepare(
        `SELECT r.id, r.project_id, r.requester_user_id, r.project_role_id, r.note, r.status, r.created_at, r.resolved_at,
                  u.id AS requester_id, u.username AS requester_username, u.display_name AS requester_display_name,
                  u.public_display_as AS requester_public_display_as,
                  pr.title AS role_title
           FROM project_join_requests r
           JOIN users u ON u.id = r.requester_user_id
           LEFT JOIN project_roles pr ON pr.id = r.project_role_id
           WHERE r.id = ?`
      )
      .get(requestId);
    res.json({
      request: requestRowToJSON(
        {
          id: updated.id,
          project_id: updated.project_id,
          project_role_id: updated.project_role_id,
          note: updated.note,
          status: updated.status,
          created_at: updated.created_at,
          resolved_at: updated.resolved_at,
          requester_id: updated.requester_id,
          requester_username: updated.requester_username,
          requester_display_name: updated.requester_display_name,
          requester_public_display_as: updated.requester_public_display_as,
        },
        updated.role_title
      ),
    });
  });

  router.delete("/:id/join-requests/:requestId", requireAuth, async (req, res) => {
    const projectId = parseId(req.params.id);
    const requestId = parseId(req.params.requestId);
    if (!projectId || !requestId) {
      return res.status(404).json({ error: "Not found" });
    }
    const row = await db
      .prepare(
        `SELECT id, requester_user_id, status FROM project_join_requests WHERE id = ? AND project_id = ?`
      )
      .get(requestId, projectId);
    if (!row) {
      return res.status(404).json({ error: "Not found" });
    }
    if (Number(row.requester_user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: "Only you can withdraw your request" });
    }
    if (row.status !== "pending") {
      return res.status(400).json({ error: "Only pending requests can be withdrawn" });
    }
    await db
      .prepare(
        `UPDATE project_join_requests SET status = 'withdrawn', resolved_at = now() WHERE id = ?`
      )
      .run(requestId);
    res.status(204).end();
  });
}

/**
 * @param {import("express").Express} app
 * @param {{ db: object, requireAuth: function }} deps
 */
function registerMeJoinRoutes(app, deps) {
  const { db, requireAuth } = deps;

  app.get("/api/me/join-requests", requireAuth, async (req, res) => {
    try {
      const rows = await db
        .prepare(
          `SELECT r.id, r.project_id, r.requester_user_id, r.project_role_id, r.note, r.status, r.created_at, r.resolved_at,
                  p.title AS project_title,
                  pr.title AS role_title
           FROM project_join_requests r
           JOIN projects p ON p.id = r.project_id
           LEFT JOIN project_roles pr ON pr.id = r.project_role_id
           WHERE r.requester_user_id = ?
           ORDER BY r.created_at DESC`
        )
        .all(req.user.id);
      const requests = rows.map((row) => ({
        id: row.id,
        project_id: row.project_id,
        project_title: row.project_title,
        project_role_id: row.project_role_id,
        role_title: row.role_title,
        note: row.note != null ? String(row.note) : "",
        status: row.status,
        created_at: row.created_at,
        resolved_at: row.resolved_at,
      }));
      res.json({ requests });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not load your requests" });
    }
  });

  app.get("/api/me/project-requests-inbox", requireAuth, async (req, res) => {
    try {
      const rows = await db
        .prepare(
          `SELECT r.id, r.project_id, r.requester_user_id, r.project_role_id, r.note, r.status, r.created_at, r.resolved_at,
                  p.title AS project_title,
                  u.id AS requester_id, u.username AS requester_username, u.display_name AS requester_display_name,
                  u.public_display_as AS requester_public_display_as,
                  pr.title AS role_title
           FROM project_join_requests r
           JOIN projects p ON p.id = r.project_id
           JOIN users u ON u.id = r.requester_user_id
           LEFT JOIN project_roles pr ON pr.id = r.project_role_id
           WHERE p.owner_user_id = ? AND r.status = 'pending'
           ORDER BY r.created_at ASC`
        )
        .all(req.user.id);
      const requests = rows.map((row) => ({
        ...requestRowToJSON(
          {
            id: row.id,
            project_id: row.project_id,
            project_role_id: row.project_role_id,
            note: row.note,
            status: row.status,
            created_at: row.created_at,
            resolved_at: row.resolved_at,
            requester_id: row.requester_id,
            requester_username: row.requester_username,
            requester_display_name: row.requester_display_name,
            requester_public_display_as: row.requester_public_display_as,
          },
          row.role_title
        ),
        project_title: row.project_title,
      }));
      res.json({ requests });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not load inbox" });
    }
  });
}

module.exports = {
  registerProjectJoinRoutes,
  registerMeJoinRoutes,
};
