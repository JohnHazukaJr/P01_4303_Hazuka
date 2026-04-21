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
        '<p class="dashboard-lead" style="margin-bottom:0">You own this project. Manage open roles and respond to join requests on your <a href="dashboard.html">dashboard</a>.</p>';
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

    var API_BASE = window.synodosAuth.apiBase;
    var meRes = await fetch(API_BASE + "/api/me", {
      headers: { Authorization: "Bearer " + token },
    });
    if (!meRes.ok) {
      pan.innerHTML =
        '<p class="dashboard-lead">Could not load your account. Try signing in again.</p>';
      return;
    }
    var meData = await meRes.json();
    if (meData.user && !meData.user.profile_complete) {
      pan.innerHTML =
        '<p class="dashboard-lead">Finish your profile before requesting to join.</p>' +
        '<p style="margin:0"><a class="btn btn-primary" href="profile-setup.html">Complete profile</a></p>';
      return;
    }

    var jrRes = await fetch(API_BASE + "/api/me/join-requests", {
      headers: { Authorization: "Bearer " + token },
    });
    if (!jrRes.ok) {
      pan.innerHTML =
        '<p class="dashboard-lead">Could not load your join requests.</p>';
      return;
    }
    var jrData = await jrRes.json();
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
      '<label for="join-note">Note to the owner (optional, max ' +
      NOTE_MAX +
      ")</label>" +
      '<textarea id="join-note" name="note" class="field-textarea" rows="2" maxlength="' +
      NOTE_MAX +
      '" placeholder="Skills, availability, link to work…"></textarea>' +
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
    var API_BASE = window.synodosAuth.apiBase;
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
      var res = await fetch(
        API_BASE + "/api/projects/" + pg.getProjectId() + "/join-requests",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify(body),
        }
      );
      var data = await res.json().catch(function () {
        return {};
      });
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
    var API_BASE = window.synodosAuth.apiBase;
    pg.showMsg("", false);
    try {
      var res = await fetch(
        API_BASE +
          "/api/projects/" +
          pg.getProjectId() +
          "/join-requests/" +
          requestId,
        { method: "DELETE", headers: { Authorization: "Bearer " + token } }
      );
      if (!res.ok && res.status !== 204) {
        var data = await res.json().catch(function () {
          return {};
        });
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
