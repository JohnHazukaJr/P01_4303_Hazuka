const jwt = require("jsonwebtoken");

function createRequireAuth(db, jwtSecret) {
  return async function requireAuth(req, res, next) {
    const h = req.headers.authorization;
    if (!h || !h.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const payload = jwt.verify(h.slice(7), jwtSecret);
      const row = await db.get("SELECT id, email FROM users WHERE id = $1", [payload.sub]);
      if (!row) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      req.user = row;
      next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  };
}

function createOptionalAuth(db, jwtSecret) {
  return async function optionalAuth(req, res, next) {
    req.user = null;
    const h = req.headers.authorization;
    if (!h || !h.startsWith("Bearer ")) {
      return next();
    }
    try {
      const payload = jwt.verify(h.slice(7), jwtSecret);
      const row = await db.get("SELECT id, email FROM users WHERE id = $1", [payload.sub]);
      if (row) req.user = row;
    } catch {
      /* invalid token — treat as anonymous */
    }
    next();
  };
}

module.exports = { createRequireAuth, createOptionalAuth };
