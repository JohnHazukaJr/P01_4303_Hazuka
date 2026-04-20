/** Toggle guest vs signed-in nav. Syncs every `[data-nav-group]` on the page; uses attribute toggling so `[hidden]` works reliably with flex layouts. Requires auth.js. */
(function () {
  function isAuthed() {
    if (!window.synodosAuth) return false;
    var t = window.synodosAuth.getToken();
    return !!(t && String(t).trim());
  }

  function setHidden(el, hide) {
    if (hide) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  function sync() {
    var authed = isAuthed();
    document.querySelectorAll('[data-nav-group="guest"]').forEach(function (g) {
      setHidden(g, authed);
    });
    document.querySelectorAll('[data-nav-group="user"]').forEach(function (g) {
      setHidden(g, !authed);
    });
    document.querySelectorAll("[data-nav-guest]").forEach(function (el) {
      setHidden(el, authed);
    });
    document.querySelectorAll("[data-nav-user]").forEach(function (el) {
      setHidden(el, !authed);
    });
  }

  function onSignOut() {
    if (!window.synodosAuth) return;
    window.synodosAuth.clearToken();
    window.location.href = "login.html";
  }

  function bind() {
    document.querySelectorAll("[data-nav-sign-out]").forEach(function (btn) {
      btn.addEventListener("click", onSignOut);
    });
  }

  function init() {
    sync();
    bind();
    requestAnimationFrame(sync);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
