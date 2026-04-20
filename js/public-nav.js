/** Toggle guest vs signed-in nav links. Requires auth.js. */
(function () {
  function sync() {
    if (!window.synodosAuth) return;
    var token = window.synodosAuth.getToken();
    var isAuthed = !!token;
    document.querySelectorAll("[data-nav-guest]").forEach(function (el) {
      el.hidden = isAuthed;
    });
    document.querySelectorAll("[data-nav-user]").forEach(function (el) {
      el.hidden = !isAuthed;
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
