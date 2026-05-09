/** Join request UI on project.html. Requires project-page.js + auth.js. */
(function () {
  var NOTE_MAX = 500;

  function panel() {
    return document.getElementById("project-join-panel");
  }
  function section() {
    return document.getElementById("project-join-section");
  }

  function page() {
    return window.synodosProjectPage;
  }

  async function renderJoinPanel() {
    var pg = page();
    var sec = section();
    var pan = panel();
    if (!pg || !sec || !pan || !pg.getProjectId()) return;

    if (pg.isOwner()) {
      sec.hidden = false;
      pan.innerHTML =
        '<p class="dashboard-lead" style="margin-bottom:0">You own this project. Manage open roles and respond to join requests on <a href="dashboard.html">Projects</a>.</p>';
      return;
    }

    sec.hidden = false;
    var token = pg.getToken();
    if (!token) {
      pan.innerHTML =
        '<p class="dashboard-lead">Log in to request to join this project.</p>' +
        '<p style="margin:0;display:flex;flex-wrap:wrap;gap:0.5rem">' +
        '<a class="btn btn-ghost" href="login.html">Log in</a>' +
        '<a class="btn btn-primary" href="register.html">Get started</a>' +
        "</p>";
      return;
    }

    var meUser = null;
    var cached = window.synodosAuth.getCachedMe();
    if (cached && cached.profile_complete) {
      meUser = cached;
    } else {
      var meResult = await window.synodosAuth.apiFetch("/api/me", {});
      if (!meResult || !meResult.res.ok) {
        if (!meResult) {
          return;
        }
        pan.innerHTML =
          '<p class="dashboard-lead">Could not load your account. Try signing in again.</p>';
        return;
      }
      meUser = meResult.data.user;
      if (meUser) {
        window.synodosAuth.setCachedMe(meUser);
      }
    }
    var meData = { user: meUser };
    if (meData.user && !meData.user.profile_complete) {
      pan.innerHTML =
        '<p class="dashboard-lead">Finish your profile before requesting to join.</p>' +
        '<p style="margin:0"><a class="btn btn-primary" href="profile-setup.html">Complete profile</a></p>';
      return;
    }

    var jrResult = await window.synodosAuth.apiFetch("/api/me/join-requests", {});
    if (!jrResult || !jrResult.res.ok) {
      if (!jrResult) {
        return;
      }
      pan.innerHTML =
        '<p class="dashboard-lead">Could not load your join requests.</p>';
      return;
    }
    var jrData = jrResult.data;
    var pid = Number(pg.getProjectId());
    var mine = (jrData.requests || []).filter(function (r) {
      return Number(r.project_id) === pid;
    });
    var latest = mine[0];

    if (latest && latest.status === "pending") {
      pan.innerHTML =
        '<p class="dashboard-lead" id="join-status-pending">Your request is <strong>pending</strong>.</p>' +
        '<p style="margin:0"><button type="button" class="btn btn-ghost" id="join-withdraw-btn">Withdraw request</button></p>';
      var w = document.getElementById("join-withdraw-btn");
      if (w) {
        w.addEventListener("click", function () {
          withdrawRequest(latest.id, token, pg);
        });
      }
      return;
    }

    if (latest && latest.status === "accepted") {
      pan.innerHTML =
        '<p class="dashboard-lead" style="margin-bottom:0">The project owner <strong>accepted</strong> your request.</p>';
      return;
    }
    var prefix = "";
    if (latest && latest.status === "declined") {
      prefix =
        '<p class="dashboard-lead">Your request was <strong>declined</strong>. You can send another request below.</p>';
    } else if (latest && latest.status === "withdrawn") {
      prefix =
        '<p class="dashboard-lead">You withdrew a previous request. You can send a new one below.</p>';
    }

    var roles = pg.getRoles() || [];
    var roleOpts =
      '<option value="">General — any open role</option>' +
      roles
        .map(function (r) {
          return (
            '<option value="' +
            String(r.id) +
            '">' +
            escapeHtml(r.title || "Role") +
            "</option>"
          );
        })
        .join("");

    pan.innerHTML =
      prefix +
      '<form id="join-request-form" class="project-form">' +
      '<div class="field">' +
      '<label for="join-role">Interested in</label>' +
      '<select id="join-role" name="role_id">' +
      roleOpts +
      "</select>" +
      "</div>" +
      '<div class="field">' +
      '<label for="join-note">Optional message to the project owner</label>' +
      '<textarea id="join-note" name="note" class="field-textarea" rows="2" maxlength="' +
      NOTE_MAX +
      '" placeholder="Relevant experience, availability, or a link to your work"></textarea>' +
      "</div>" +
      '<button type="submit" class="btn btn-primary">Send join request</button>' +
      "</form>";

    var form = document.getElementById("join-request-form");
    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        submitJoin(token, pg, form);
      });
    }
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  async function submitJoin(token, pg, form) {
    var fd = new FormData(form);
    var roleVal = fd.get("role_id");
    var body = {
      note: String(fd.get("note") || "").trim().slice(0, NOTE_MAX),
    };
    if (roleVal && String(roleVal).trim() !== "") {
      body.role_id = Number(roleVal);
    }
    pg.showMsg("", false);
    try {
      var jrPost = await window.synodosAuth.apiFetch(
        "/api/projects/" + pg.getProjectId() + "/join-requests",
        {
          method: "POST",
          headers: window.synodosAuth.authHeaders({ json: true }),
          body: JSON.stringify(body),
        }
      );
      if (!jrPost) {
        return;
      }
      var res = jrPost.res;
      var data = jrPost.data;
      if (!res.ok) {
        pg.showMsg(data.error || "Could not send request", true);
        return;
      }
      pg.showMsg("Request sent.", false);
      document.dispatchEvent(new CustomEvent("synodos:notifications-refresh"));
      await renderJoinPanel();
    } catch (e) {
      pg.showMsg("Could not send request.", true);
    }
  }

  async function withdrawRequest(requestId, token, pg) {
    pg.showMsg("", false);
    try {
      var wd = await window.synodosAuth.apiFetch(
        "/api/projects/" +
          pg.getProjectId() +
          "/join-requests/" +
          requestId,
        { method: "DELETE" }
      );
      if (!wd) {
        return;
      }
      var res = wd.res;
      if (!res.ok && res.status !== 204) {
        var data = wd.data;
        pg.showMsg(data.error || "Could not withdraw", true);
        return;
      }
      await renderJoinPanel();
    } catch (e) {
      pg.showMsg("Could not withdraw.", true);
    }
  }

  function wire() {
    var pg = page();
    if (!pg) return;
    var prevReady = pg.onViewerReady;
    pg.onViewerReady = function () {
      if (typeof prevReady === "function") prevReady();
      renderJoinPanel();
    };
    pg.refreshJoinPanel = renderJoinPanel;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
