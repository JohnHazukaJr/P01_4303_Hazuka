const express = require("express");

function parseId(param) {
  const n = Number(param);
  return Number.isInteger(n) && n > 0 ? n : null;
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

function loadProject(db, id) {
  const row = db
    .prepare(
      `SELECT p.id, p.owner_user_id, p.title, p.description, p.created_at,
              u.username AS owner_username,
              u.display_name AS owner_display_name,
              u.public_display_as AS owner_public_display_as
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
  };
}

function loadRoles(db, projectId) {
  return db
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
function loadUserTagSet(db, userId) {
  const rows = db
    .prepare(
      "SELECT work_field, work_subfield FROM user_work_tags WHERE user_id = ?"
    )
    .all(userId);
  const set = new Set();
  for (let i = 0; i < rows.length; i++) {
    set.add(workTagKey(rows[i].work_field, rows[i].work_subfield));
  }
  if (set.size === 0) {
    const u = db
      .prepare("SELECT work_field, work_subfield FROM users WHERE id = ?")
      .get(userId);
    if (
      u &&
      String(u.work_field || "").trim() &&
      String(u.work_subfield || "").trim()
    ) {
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

  router.get("/", optionalAuth, (req, res) => {
    try {
      const projects = db
        .prepare(
          `SELECT p.id, p.title, p.description, p.created_at,
                  p.owner_user_id,
                  u.username AS owner_username,
                  u.display_name AS owner_display_name,
                  u.public_display_as AS owner_public_display_as,
                  (SELECT COUNT(*) FROM project_roles r WHERE r.project_id = p.id) AS role_count
           FROM projects p
           JOIN users u ON u.id = p.owner_user_id
           ORDER BY datetime(p.created_at) DESC`
        )
        .all();

      const viewerSet =
        req.user && req.user.id != null
          ? loadUserTagSet(db, req.user.id)
          : null;
      const personalize =
        viewerSet != null && viewerSet.size > 0;

      for (let i = 0; i < projects.length; i++) {
        const p = projects[i];
        p.owner_display = ownerPublicDisplay(
          p.owner_username,
          p.owner_display_name,
          p.owner_public_display_as
        );
        delete p.owner_username;
        delete p.owner_display_name;
        delete p.owner_public_display_as;
        p.roles = loadRoles(db, p.id);
        if (personalize) {
          const ownerSet = loadUserTagSet(db, p.owner_user_id);
          p.feed_match_count = feedMatchCount(viewerSet, ownerSet);
        } else {
          p.feed_match_count = 0;
        }
      }

      if (personalize) {
        projects.sort((a, b) => {
          if (b.feed_match_count !== a.feed_match_count) {
            return b.feed_match_count - a.feed_match_count;
          }
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
        });
      }

      res.json({ projects });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not load projects" });
    }
  });

  router.post("/", requireAuth, (req, res) => {
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
      const info = db
        .prepare(
          "INSERT INTO projects (owner_user_id, title, description) VALUES (?, ?, ?)"
        )
        .run(req.user.id, title, description);
      const id = Number(info.lastInsertRowid);
      const project = loadProject(db, id);
      res.status(201).json({ project });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not create project" });
    }
  });

  router.get("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).json({ error: "Not found" });
    }
    const project = loadProject(db, id);
    if (!project) {
      return res.status(404).json({ error: "Not found" });
    }
    const roles = loadRoles(db, id);
    res.json({ project, roles });
  });

  router.delete("/:id", requireAuth, (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).json({ error: "Not found" });
    }
    const project = db
      .prepare("SELECT id, owner_user_id FROM projects WHERE id = ?")
      .get(id);
    if (!project) {
      return res.status(404).json({ error: "Not found" });
    }
    if (Number(project.owner_user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: "Only the owner can delete this project" });
    }
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    res.status(204).end();
  });

  router.post("/:id/roles", requireAuth, (req, res) => {
    const projectId = parseId(req.params.id);
    if (!projectId) {
      return res.status(404).json({ error: "Not found" });
    }
    const project = db
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
      const info = db
        .prepare(
          `INSERT INTO project_roles (project_id, title, skills, slots)
           VALUES (?, ?, ?, ?)`
        )
        .run(projectId, title, skills, slots);
      const role = db
        .prepare("SELECT * FROM project_roles WHERE id = ?")
        .get(Number(info.lastInsertRowid));
      res.status(201).json({ role });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not add role" });
    }
  });

  router.delete("/:id/roles/:roleId", requireAuth, (req, res) => {
    const projectId = parseId(req.params.id);
    const roleId = parseId(req.params.roleId);
    if (!projectId || !roleId) {
      return res.status(404).json({ error: "Not found" });
    }
    const project = db
      .prepare("SELECT id, owner_user_id FROM projects WHERE id = ?")
      .get(projectId);
    if (!project) {
      return res.status(404).json({ error: "Not found" });
    }
    if (Number(project.owner_user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: "Only the owner can remove roles" });
    }
    const role = db
      .prepare(
        "SELECT id FROM project_roles WHERE id = ? AND project_id = ?"
      )
      .get(roleId, projectId);
    if (!role) {
      return res.status(404).json({ error: "Not found" });
    }
    db.prepare("DELETE FROM project_roles WHERE id = ?").run(roleId);
    res.status(204).end();
  });

  return router;
}

module.exports = { createProjectsRouter };
