/** JWT in localStorage and API base URL (`synodosAuth`). */
(function (global) {
  var TOKEN_KEY = "synodos_token";
  var win = typeof window !== "undefined" ? window : null;
  var apiFromWindow =
    win &&
    win.SYNODOS_API_BASE &&
    String(win.SYNODOS_API_BASE).trim();

  global.synodosAuth = {
    apiBase: apiFromWindow || "http://localhost:8080", // set window.SYNODOS_API_BASE if API is not localhost:8080
    /**
     * Resolve stored paths like `/uploads/avatars/1.png` against `apiBase`.
     * Avoids broken `src` when the base has a trailing slash or `+` would duplicate slashes.
     * Returns absolute http(s) URLs unchanged.
     */
    assetUrl: function (pathOrUrl) {
      var p = String(pathOrUrl || "").trim();
      if (!p) return "";
      if (/^https?:\/\//i.test(p)) return p;
      var base = String(this.apiBase || "http://localhost:8080").trim();
      if (!base) return p;
      var path = p.startsWith("/") ? p : "/" + p;
      try {
        var root = base.endsWith("/") ? base : base + "/";
        return new URL(path, root).href;
      } catch (e) {
        return base.replace(/\/+$/, "") + path;
      }
    },
    /**
     * Bundled default profile image when the user has no custom upload.
     * Resolved relative to the current HTML page (works with file:// and static hosts).
     */
    getDefaultAvatarUrl: function () {
      var w = typeof window !== "undefined" ? window : null;
      if (!w || !w.location || !w.location.href) {
        return "images/default-avatar.png";
      }
      try {
        return new URL("images/default-avatar.png", w.location.href).href;
      } catch (e) {
        return "images/default-avatar.png";
      }
    },
    getToken: function () {
      try {
        return localStorage.getItem(TOKEN_KEY);
      } catch (e) {
        return null;
      }
    },
    setToken: function (token) {
      try {
        localStorage.setItem(TOKEN_KEY, token);
      } catch (e) {
        /* ignore */
      }
    },
    clearToken: function () {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch (e) {
        /* ignore */
      }
    },
    /** Debug session NDJSON via POST /api/debug/client-log (localhost / file only). */
    agentDebug: function (payload) {
      var w = typeof window !== "undefined" ? window : null;
      if (!w || !w.fetch) return;
      var host = w.location && w.location.hostname;
      if (
        host &&
        host !== "localhost" &&
        host !== "127.0.0.1" &&
        host !== "[::1]"
      ) {
        return;
      }
      var base = String(this.apiBase || "http://localhost:8080")
        .trim()
        .replace(/\/+$/, "");
      if (!base) return;
      // #region agent log
      w.fetch(base + "/api/debug/client-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.assign(
            { sessionId: "4f232d", timestamp: Date.now() },
            payload || {}
          )
        ),
      }).catch(function () {});
      // #endregion
    },
  };
  // #region agent log
  global.synodosAuth.agentDebug({
    hypothesisId: "H1",
    location: "auth.js:boot",
    message: "synodosAuth init",
    data: {
      apiBase: global.synodosAuth.apiBase,
      hasToken: !!global.synodosAuth.getToken(),
      path: win && win.location && win.location.pathname,
    },
  });
  // #endregion
})(typeof window !== "undefined" ? window : this);
