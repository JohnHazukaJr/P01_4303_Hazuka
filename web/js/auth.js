/** JWT in localStorage and API base URL (`synodosAuth`). */
(function (global) {
  var TOKEN_KEY = "synodos_token";
  var LAST_ACTIVE_KEY = "synodos_last_active_at";
  var SIGN_OUT_REASON_KEY = "synodos_sign_out_reason";
  var IDLE_MS = 10 * 60 * 1000; // 10 minutes
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
        localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
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
    touchActivity: function () {
      try {
        if (!this.getToken()) return;
        localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
      } catch (e) {
        /* ignore */
      }
    },
    getSignOutReason: function () {
      try {
        return localStorage.getItem(SIGN_OUT_REASON_KEY);
      } catch (e) {
        return null;
      }
    },
    clearSignOutReason: function () {
      try {
        localStorage.removeItem(SIGN_OUT_REASON_KEY);
      } catch (e) {
        /* ignore */
      }
    },
    /**
     * Clear session and go to sign-in (e.g. expired or invalid token on /api/me).
     */
    handleUnauthorized: function () {
      this.clearToken();
      if (win && win.location) {
        win.location.href = "login.html";
      }
    },
  };

  function pathIsAuthPage(pathname) {
    var p = String(pathname || "").toLowerCase();
    return (
      p.endsWith("/login.html") ||
      p.endsWith("\\login.html") ||
      p.endsWith("/register.html") ||
      p.endsWith("\\register.html")
    );
  }

  function startIdleLogout() {
    if (!win || !win.document) return;
    var doc = win.document;

    var lastTouch = 0;
    function onActivity() {
      var now = Date.now();
      if (now - lastTouch < 1000) return; // throttle
      lastTouch = now;
      if (global.synodosAuth) global.synodosAuth.touchActivity();
    }

    ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach(function (
      evt
    ) {
      doc.addEventListener(evt, onActivity, { passive: true });
    });

    setInterval(function () {
      if (!global.synodosAuth) return;
      var token = global.synodosAuth.getToken();
      if (!token) return;

      var last = 0;
      try {
        last = Number(localStorage.getItem(LAST_ACTIVE_KEY) || "0");
      } catch (e) {
        last = 0;
      }
      if (!Number.isFinite(last) || last <= 0) {
        global.synodosAuth.touchActivity();
        return;
      }
      if (Date.now() - last < IDLE_MS) return;

      try {
        localStorage.setItem(SIGN_OUT_REASON_KEY, "inactive");
      } catch (e) {}
      global.synodosAuth.clearToken();
      if (win.location && !pathIsAuthPage(win.location.pathname || "")) {
        win.location.href = "login.html";
      }
    }, 5000);
  }

  startIdleLogout();
})(typeof window !== "undefined" ? window : this);
