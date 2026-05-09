const express = require("express");
const { insertFeedEvent, EVENT_TYPES } = require("../feedEvents");
const { parseId, parseCursor } = require("../routeUtils");

const MAX_LIST_LIMIT = 50;
const DEFAULT_LIST_LIMIT = 20;
const MAX_QUERY_LEN = 100;

function clampLimit(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIST_LIMIT;
  return Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(n)));
}

function escapeLikeTerm(s) {
  /* Escape Postgres ILIKE wildcards in user input. Default escape char is backslash. */
  return String(s).replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function ownerPublicDisplay(username, displayName, preference) {
  const pref = String(preference || "username").toLowerCase();
  const un = username != null ? String(username).trim() : "";
  const dn = displayName != null ? String(displayName).trim() : "";
  if (pref === "full_name" && dn.length >= 2) return dn;
  if (un) return un;
  if (dn.length >= 2) return dn;
  return un || "Member";
}

async function loadProject(db, id) {
  const row = await db
    .prepare(
      `SELECT p.id, p.owner_user_id, p.title, p.description, p.created_at,
              u.username AS owner_username,
              u.display_name AS owner_display_name,
              u.public_display_as AS owner_public_display_as,
              u.verified AS owner_verified,
              u.official_account AS owner_official_account
       FROM projects p
       JOIN users u ON u.id = p.owner_user_id
       WHERE p.id = ?`
    )
    .get(id);
  if (!row) return null;
  return {
    id: row.id,
    owner_user_id: row.owner_user_id,
    title: row.title,
    description: row.description,
    created_at: row.created_at,
    owner_display: ownerPublicDisplay(
      row.owner_username,
      row.owner_display_name,
      row.owner_public_display_as
    ),
    owner_username: row.owner_username != null ? String(row.owner_username) : null,
    owner_verified: row.owner_verified === true || Number(row.owner_verified) === 1,
    owner_official_account:
      row.owner_official_account === true || Number(row.owner_official_account) === 1,
  };
}

async function loadRoles(db, projectId) {
  return await db
    .prepare(
      `SELECT id, project_id, title, skills, slots, created_at
       FROM project_roles
       WHERE project_id = ?
       ORDER BY id ASC`
    )
    .all(projectId);
}

function workTagKey(field, sub) {
  return String(field).trim() + "\0" + String(sub).trim();
}

/** Sets of "field\0subfield" for overlap scoring when signed in. */
async function loadUserTagSet(db, userId) {
  const rows = await db
    .prepare("SELECT work_field, work_subfield FROM user_work_tags WHERE user_id = ?")
    .all(userId);
  const set = new Set();
  for (let i = 0; i < rows.length; i++) {
    set.add(workTagKey(rows[i].work_field, rows[i].work_subfield));
  }
  if (set.size === 0) {
    const u = await db
      .prepare("SELECT work_field, work_subfield FROM users WHERE id = ?")
      .get(userId);
    if (u && String(u.work_field || "").trim() && String(u.work_subfield || "").trim()) {
      set.add(workTagKey(u.work_field, u.work_subfield));
    }
  }
  return set;
}

function feedMatchCount(viewerSet, ownerSet) {
  let n = 0;
  viewerSet.forEach((k) => {
    if (ownerSet.has(k)) n++;
  });
  return n;
}

/** @param {{ db: object, requireAuth: function, optionalAuth: function }} deps */
function createProjectsRouter(deps) {
  const { db, requireAuth, optionalAuth } = deps;
  const router = express.Router();

  router.get("/", optionalAuth, async (req, res) => {
    try {
      const limit = clampLimit(req.query.limit);
      const cursor = parseCursor(req.query.cursor);
      const qRaw = String(req.query.q || "")
        .trim()
        .slice(0, MAX_QUERY_LEN);
      const mineOnly =
        String(req.query.mine || "").trim() === "1" && req.user && req.user.id != null;

      const where = [];
      const params = [];
      if (qRaw) {
        const like = "%" + escapeLikeTerm(qRaw) + "%";
        params.push(like);
        const i1 = params.length;
        params.push(like);
        const i2 = params.length;
        where.push(`(p.title ILIKE $${i1} OR p.description ILIKE $${i2})`);
      }
      if (mineOnly) {
        params.push(req.user.id);
        where.push(`p.owner_user_id = $${params.length}`);
      }
      if (cursor) {
        params.push(cursor);
        where.push(`p.id < $${params.length}`);
      }

      const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
      params.push(limit + 1);
      const limitIdx = params.length;

      const sql = `
        SELECT p.id, p.title, p.description, p.created_at,
               p.owner_user_id,
               u.username AS owner_username,
               u.display_name AS owner_display_name,
               u.public_display_as AS owner_public_display_as,
               u.verified AS owner_verified,
               u.official_account AS owner_official_account,
               (SELECT COUNT(*) FROM project_roles r WHERE r.project_id = p.id) AS role_count
        FROM projects p
        JOIN users u ON u.id = p.owner_user_id
        ${whereSql}
        ORDER BY p.id DESC
        LIMIT $${limitIdx}
      `;
      const rows = await db.all(sql, params);
      const hasMore = rows.length > limit;
      const projects = hasMore ? rows.slice(0, limit) : rows;

      const viewerSet =
        req.user && req.user.id != null ? await loadUserTagSet(db, req.user.id) : null;
      const personalize = viewerSet != null && viewerSet.size > 0;

      for (let i = 0; i < projects.length; i++) {
        const p = projects[i];
        p.owner_display = ownerPublicDisplay(
          p.owner_username,
          p.owner_display_name,
          p.owner_public_display_as
        );
        p.owner_username = p.owner_username != null ? String(p.owner_username) : null;
        delete p.owner_display_name;
        delete p.owner_public_display_as;
        p.owner_verified = p.owner_verified === true || Number(p.owner_verified) === 1;
        p.owner_official_account =
          p.owner_official_account === true || Number(p.owner_official_account) === 1;
        p.roles = await loadRoles(db, p.id);
        if (personalize) {
          const ownerSet = await loadUserTagSet(db, p.owner_user_id);
          p.feed_match_count = feedMatchCount(viewerSet, ownerSet);
        } else {
          p.feed_match_count = 0;
        }
      }

      const nextCursor =
        hasMore && projects.length > 0 ? Number(projects[projects.length - 1].id) : null;

      res.json({ projects, next_cursor: nextCursor });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not load projects" });
    }
  });

  router.post("/", requireAuth, async (req, res) => {
    const title = String(req.body?.title || "").trim();
    const description = String(req.body?.description || "").trim();
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }
    if (title.length > 200) {
      return res.status(400).json({ error: "Title is too long (max 200 characters)" });
    }
    if (description.length > 8000) {
      return res.status(400).json({ error: "Description is too long" });
    }
    try {
      const info = await db
        .prepare(
          "INSERT INTO projects (owner_user_id, title, description) VALUES (?, ?, ?) RETURNING id"
        )
        .run(req.user.id, title, description);
      const id = info && info.rows && info.rows[0] ? Number(info.rows[0].id) : null;
      if (!id) {
        return res.status(500).json({ error: "Could not create project" });
      }
      const project = await loadProject(db, id);
      await insertFeedEvent(db, req.user.id, EVENT_TYPES.PROJECT_CREATED, {
        project_id: id,
        title: project.title,
      });
      res.status(201).json({ project });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not create project" });
    }
  });

  router.get("/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).json({ error: "Not found" });
    }
    const project = await loadProject(db, id);
    if (!project) {
      return res.status(404).json({ error: "Not found" });
    }
    const roles = await loadRoles(db, id);
    res.json({ project, roles });
  });

  router.delete("/:id", requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).json({ error: "Not found" });
    }
    const project = await db.prepare("SELECT id, owner_user_id FROM projects WHERE id = ?").get(id);
    if (!project) {
      return res.status(404).json({ error: "Not found" });
    }
    if (Number(project.owner_user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: "Only the owner can delete this project" });
    }
    await db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    res.status(204).end();
  });

  router.post("/:id/roles", requireAuth, async (req, res) => {
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
      return res.status(403).json({ error: "Only the owner can add roles" });
    }

    const title = String(req.body?.title || "").trim();
    const skills = String(req.body?.skills || "").trim();
    let slots = Number(req.body?.slots);
    if (!Number.isFinite(slots) || slots < 0) {
      slots = 1;
    }
    slots = Math.min(999, Math.floor(slots));
    if (!title) {
      return res.status(400).json({ error: "Role title is required" });
    }
    if (title.length > 200) {
      return res.status(400).json({ error: "Role title is too long" });
    }
    if (skills.length > 2000) {
      return res.status(400).json({ error: "Skills text is too long" });
    }

    try {
      const info = await db
        .prepare(
          `INSERT INTO project_roles (project_id, title, skills, slots)
           VALUES (?, ?, ?, ?) RETURNING id`
        )
        .run(projectId, title, skills, slots);
      const rid = info && info.rows && info.rows[0] ? Number(info.rows[0].id) : null;
      if (!rid) {
        return res.status(500).json({ error: "Could not add role" });
      }
      const role = await db.prepare("SELECT * FROM project_roles WHERE id = ?").get(rid);
      const projRow = await db.prepare("SELECT title FROM projects WHERE id = ?").get(projectId);
      await insertFeedEvent(db, req.user.id, EVENT_TYPES.ROLE_ADDED, {
        project_id: projectId,
        project_title: projRow ? projRow.title : "",
        role_id: role.id,
        role_title: role.title,
      });
      res.status(201).json({ role });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not add role" });
    }
  });

  router.delete("/:id/roles/:roleId", requireAuth, async (req, res) => {
    const projectId = parseId(req.params.id);
    const roleId = parseId(req.params.roleId);
    if (!projectId || !roleId) {
      return res.status(404).json({ error: "Not found" });
    }
    const project = await db
      .prepare("SELECT id, owner_user_id FROM projects WHERE id = ?")
      .get(projectId);
    if (!project) {
      return res.status(404).json({ error: "Not found" });
    }
    if (Number(project.owner_user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: "Only the owner can remove roles" });
    }
    const role = await db
      .prepare("SELECT id FROM project_roles WHERE id = ? AND project_id = ?")
      .get(roleId, projectId);
    if (!role) {
      return res.status(404).json({ error: "Not found" });
    }
    await db.prepare("DELETE FROM project_roles WHERE id = ?").run(roleId);
    res.status(204).end();
  });

  return router;
}

module.exports = { createProjectsRouter };
