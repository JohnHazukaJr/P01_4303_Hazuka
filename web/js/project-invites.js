/** Owner-only project invitations on project.html. Requires project-page.js. */
(function () {
  function wire() {
    var pg = window.synodosProjectPage;
    if (!pg) return;
    var prev = pg.onViewerReady;
    pg.onViewerReady = function () {
      if (typeof prev === "function") prev();
      var sec = document.getElementById("project-invite-section");
      var form = document.getElementById("project-invite-form");
      if (!sec || !form) return;
      if (!pg.isOwner()) {
        sec.hidden = true;
        return;
      }
      sec.hidden = false;
      var pid = pg.getProjectId();
      if (!pid) return;
      if (form.dataset.synodosInviteWired === "1") return;
      form.dataset.synodosInviteWired = "1";
      form.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        var token = pg.getToken();
        if (!token) return;
        var fd = new FormData(form);
        var username = String(fd.get("username") || "").trim();
        var note = String(fd.get("note") || "").trim();
        pg.showMsg("", false);
        try {
          var invRes = await window.synodosAuth.apiFetch("/api/projects/" + pid + "/invites", {
            method: "POST",
            headers: window.synodosAuth.authHeaders({ json: true }),
            body: JSON.stringify({ username: username, note: note }),
          });
          if (!invRes) {
            return;
          }
          var res = invRes.res;
          var data = invRes.data;
          if (!res.ok) {
            pg.showMsg(data.error || "Could not send invitation", true);
            return;
          }
          pg.showMsg("Invitation sent.", false);
          form.reset();
          if (typeof window.synodosRefreshNotificationBadge === "function") {
            window.synodosRefreshNotificationBadge();
          }
        } catch (e) {
          pg.showMsg("Could not send invitation.", true);
        }
      });
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
