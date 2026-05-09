/** Shared /api/me gate: JWT, profile_complete, cache refresh. Requires auth.js before this script. */
(function (global) {
  function goLogin(opts) {
    if (typeof opts.onRedirectLogin === "function") {
      opts.onRedirectLogin();
    } else {
      global.location.href = opts.loginUrl || "login.html";
    }
  }

  function goSetup(opts) {
    if (typeof opts.onRedirectSetup === "function") {
      opts.onRedirectSetup();
    } else {
      global.location.href = opts.setupUrl || "profile-setup.html";
    }
  }

  /**
   * @param {object} [opts]
   * @param {string} [opts.loginUrl]
   * @param {string} [opts.setupUrl]
   * @param {function(): void} [opts.onRedirectLogin]
   * @param {function(): void} [opts.onRedirectSetup]
   * @returns {Promise<{ ok: true, user: object } | { ok: false, reason: string, result?: object, error?: Error }>}
   */
  async function ensureAuthedAndCompleteProfile(opts) {
    opts = opts || {};
    var auth = global.synodosAuth;
    if (!auth) {
      return { ok: false, reason: "no-auth" };
    }
    var token = auth.getToken();
    if (!token || !String(token).trim()) {
      goLogin(opts);
      return { ok: false, reason: "no-token" };
    }
    var result;
    try {
      result = await auth.apiFetch("/api/me", {});
    } catch (e) {
      return { ok: false, reason: "network", error: e };
    }
    if (!result) {
      return { ok: false, reason: "unauthorized" };
    }
    if (!result.res.ok) {
      return { ok: false, reason: "me-failed", result: result };
    }
    var data = result.data || {};
    if (data.user && !data.user.profile_complete) {
      goSetup(opts);
      return { ok: false, reason: "incomplete-profile" };
    }
    if (data.user) {
      auth.setCachedMe(data.user);
    }
    return { ok: true, user: data.user };
  }

  global.synodosSession = {
    ensureAuthedAndCompleteProfile: ensureAuthedAndCompleteProfile,
  };
})(typeof window !== "undefined" ? window : this);
