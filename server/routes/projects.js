const express = require("express");

function parseId(param) {
  const n = Number(param);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function loadProject(db, id) {
  return db
    .prepare(
      `SELECT p.id, p.owner_user_id, p.title, p.description, p.created_at, u.email AS owner_email
       FROM projects p
       JOIN users u ON u.id = p.owner_user_id
       WHERE p.id = ?`
    )
    .get(id);
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

/** @param {{ db: object, requireAuth: function }} deps */
function createProjectsRouter(deps) {
  const { db, requireAuth } = deps;
  const router = express.Router();

  router.get("/", (_req, res) => {
    try {
      const projects = db
        .prepare(
          `SELECT p.id, p.title, p.description, p.created_at,
                  p.owner_user_id, u.email AS owner_email,
                  (SELECT COUNT(*) FROM project_roles r WHERE r.project_id = p.id) AS role_count
           FROM projects p
           JOIN users u ON u.id = p.owner_user_id
           ORDER BY datetime(p.created_at) DESC`
        )
        .all();
      for (let i = 0; i < projects.length; i++) {
        const p = projects[i];
        p.roles = loadRoles(db, p.id);
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
