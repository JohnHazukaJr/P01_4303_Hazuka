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

  var AVATAR_MAP_KEY = "synodos_avatar_url_map";

  function readAvatarMap() {
    try {
      var raw = sessionStorage.getItem(AVATAR_MAP_KEY);
      if (!raw) return { byId: {}, byUser: {} };
      var o = JSON.parse(raw);
      return {
        byId: o.byId && typeof o.byId === "object" ? o.byId : {},
        byUser: o.byUser && typeof o.byUser === "object" ? o.byUser : {},
      };
    } catch (e) {
      return { byId: {}, byUser: {} };
    }
  }

  function writeAvatarMap(map) {
    try {
      sessionStorage.setItem(AVATAR_MAP_KEY, JSON.stringify(map));
    } catch (e) {
      /* ignore */
    }
  }

  function clearAvatarSessionMap() {
    try {
      sessionStorage.removeItem(AVATAR_MAP_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function rememberAvatarKeys(user) {
    if (!user) return;
    var raw =
      user.avatar_url != null ? String(user.avatar_url).trim() : "";
    if (/^(?:data:|blob:)/i.test(raw)) return;
    var map = readAvatarMap();
    if (user.id != null) {
      var idKey = String(Number(user.id));
      if (idKey && idKey !== "NaN") {
        map.byId[idKey] = raw;
      }
    }
    if (user.username != null && String(user.username).trim()) {
      var uk = String(user.username).trim().toLowerCase();
      if (uk) {
        map.byUser[uk] = raw;
      }
    }
    writeAvatarMap(map);
  }

  function getJwtUserId(token) {
    try {
      var parts = String(token || "").split(".");
      if (parts.length < 2) return null;
      var b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var obj = JSON.parse(atob(b64));
      var sub = obj && obj.sub;
      var n = Number(sub);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch (e) {
      return null;
    }
  }

  function resolveAvatarSrc(auth, rawPath) {
    var p = rawPath != null ? String(rawPath).trim() : "";
    if (!p) return auth.getDefaultAvatarUrl();
    if (/^(?:https?:|data:|blob:)/i.test(p)) return p;
    return auth.assetUrl(p);
  }

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
    /** Numeric `sub` from the JWT, if present and valid (for client-only hints). */
    getTokenUserId: function () {
      return getJwtUserId(this.getToken());
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
      clearAvatarSessionMap();
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
    /**
     * Show the correct avatar on an <img> + placeholder pair; update session avatar cache
     * from API-shaped `user` when skipCacheWrite is false (default).
     */
    applyUserAvatar: function (img, ph, user, opts) {
      opts = opts || {};
      var skipCacheWrite = !!opts.skipCacheWrite;
      if (!img || !ph) return;
      if (!skipCacheWrite && user) {
        rememberAvatarKeys(user);
      }
      var pub =
        user && user.public_display_label != null
          ? String(user.public_display_label).trim()
          : "";
      var raw = user && user.avatar_url != null ? String(user.avatar_url).trim() : "";
      var alt = pub
        ? "Avatar for " + pub
        : user && user.display_name
          ? "Avatar for " + String(user.display_name).trim()
          : "Profile photo";
      img.alt = alt;
      var tryUploadedFirst = raw.length > 0;
      function reveal() {
        img.hidden = false;
        ph.hidden = true;
      }
      function showPlaceholder() {
        img.hidden = true;
        img.removeAttribute("src");
        ph.hidden = false;
      }
      img.onload = function () {
        reveal();
      };
      img.onerror = function () {
        if (tryUploadedFirst) {
          tryUploadedFirst = false;
          img.src = global.synodosAuth.getDefaultAvatarUrl();
        } else {
          showPlaceholder();
        }
      };
      img.src = resolveAvatarSrc(global.synodosAuth, raw);
      if (img.complete && img.naturalWidth > 0) {
        reveal();
      } else if (typeof img.decode === "function") {
        img.decode().then(reveal).catch(function () {});
      }
    },
    /**
     * Before /api/me or public profile fetch: paint from sessionStorage so the inline SVG
     * does not flash on full page loads (same tab).
     * options.username — public profile (?u=); omit for current user (JWT sub).
     */
    primeUserAvatar: function (img, ph, options) {
      if (!img || !ph) return;
      options = options || {};
      var path = null;
      var un = options.username != null ? String(options.username).trim().toLowerCase() : "";
      if (un) {
        var mapU = readAvatarMap();
        if (Object.prototype.hasOwnProperty.call(mapU.byUser, un)) {
          path = mapU.byUser[un];
        }
      } else {
        var tok = this.getToken();
        var uid = getJwtUserId(tok);
        if (uid != null) {
          var mapM = readAvatarMap();
          if (Object.prototype.hasOwnProperty.call(mapM.byId, String(uid))) {
            path = mapM.byId[String(uid)];
          }
        }
      }
      if (path === null) return;
      this.applyUserAvatar(
        img,
        ph,
        {
          avatar_url: path,
          public_display_label: options.public_display_label,
          display_name: options.display_name,
        },
        { skipCacheWrite: true }
      );
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
