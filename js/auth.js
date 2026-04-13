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
  };
})(typeof window !== "undefined" ? window : this);
