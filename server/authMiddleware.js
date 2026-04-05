const jwt = require("jsonwebtoken");

function createRequireAuth(db, jwtSecret) {
  return function requireAuth(req, res, next) {
    const h = req.headers.authorization;
    if (!h || !h.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const payload = jwt.verify(h.slice(7), jwtSecret);
      const row = db.prepare("SELECT id, email FROM users WHERE id = ?").get(payload.sub);
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

module.exports = { createRequireAuth };
