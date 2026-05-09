/** Public project detail + join requests. Requires auth.js (API base + token). */
(function () {
  var msgEl = document.getElementById("project-page-msg");
  var loadingEl = document.getElementById("project-page-loading");
  var rootEl = document.getElementById("project-root");
  var backLink = document.getElementById("project-back-link");
  var titleEl = document.getElementById("pd-title");
  var metaEl = document.getElementById("pd-meta");
  var descEl = document.getElementById("pd-desc");
  var rolesListEl = document.getElementById("pd-roles-list");
  var joinSection = document.getElementById("project-join-section");
  var joinPanel = document.getElementById("project-join-panel");

  var projectId = null;
  var cachedProject = null;
  var cachedRoles = [];
  var token = null;
  var userId = null;
  var isOwner = false;

  function showMsg(text, isError) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.hidden = !text;
    msgEl.className =
      "dashboard-msg" + (isError ? " dashboard-msg--error" : "");
  }

  function syncBackLink() {
    var hasToken = !!(
      window.synodosAuth &&
      window.synodosAuth.getToken &&
      window.synodosAuth.getToken()
    );
    if (backLink) {
      backLink.setAttribute("href", hasToken ? "home.html" : "index.html");
      backLink.textContent = hasToken ? "← Back to home" : "← Back to marketing site";
    }
  }

  function parseProjectId() {
    var q = new URLSearchParams(window.location.search).get("id");
    var n = q != null ? Number(q) : NaN;
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
  }

  function renderRoles(roles) {
    if (!rolesListEl) return;
    rolesListEl.innerHTML = "";
    if (!roles || roles.length === 0) {
      var empty = document.createElement("p");
      empty.className = "project-roles__empty";
      empty.textContent = "No open roles yet.";
      rolesListEl.appendChild(empty);
      return;
    }
    for (var r = 0; r < roles.length; r++) {
      rolesListEl.appendChild(renderRoleRow(roles[r]));
    }
  }

  function renderRoleRow(role) {
    var row = document.createElement("div");
    row.className = "role-row";
    var main = document.createElement("div");
    main.className = "role-row__main";
    var t = document.createElement("strong");
    t.className = "role-row__title";
    t.textContent = role.title || "";
    main.appendChild(t);
    if (role.skills) {
      var sk = document.createElement("span");
      sk.className = "role-row__skills";
      sk.textContent = role.skills;
      main.appendChild(sk);
    }
    var slots = document.createElement("span");
    slots.className = "role-row__slots";
    slots.textContent =
      "Openings: " + String(role.slots != null ? role.slots : 1);
    main.appendChild(slots);
    row.appendChild(main);
    return row;
  }

  function renderProject(data) {
    var proj = data && data.project;
    var roles = (data && data.roles) || [];
    if (!proj) return;
    cachedProject = proj;
    cachedRoles = roles;
    if (titleEl) {
      titleEl.textContent = proj.title || "Untitled";
    }
    if (metaEl) {
      metaEl.textContent = "";
      var posted = document.createTextNode("Posted by ");
      metaEl.appendChild(posted);
      var un = proj.owner_username
        ? String(proj.owner_username).trim()
        : "";
      if (un) {
        var a = document.createElement("a");
        a.href = "user.html?u=" + encodeURIComponent(un);
        a.className = "project-owner-link";
        a.textContent = proj.owner_display || un;
        metaEl.appendChild(a);
        if (window.synodosUserBadges) {
          var ob = document.createElement("span");
          ob.className = "project-card__owner-badges";
          metaEl.appendChild(ob);
          window.synodosUserBadges.renderBadgesOnly(ob, {
            verified: proj.owner_verified,
            official_account: proj.owner_official_account,
          });
        }
      } else {
        metaEl.appendChild(
          document.createTextNode(proj.owner_display || "—")
        );
      }
    }
    if (descEl) {
      descEl.textContent = proj.description || "";
      descEl.style.whiteSpace = "pre-wrap";
    }
    renderRoles(roles);
    if (loadingEl) loadingEl.hidden = true;
    if (rootEl) rootEl.hidden = false;
  }

  async function loadProject(id) {
    showMsg("", false);
    var result = await window.synodosAuth.apiFetch("/api/projects/" + id, {});
    if (!result) {
      return;
    }
    var res = result.res;
    var data = result.data;
    if (!res.ok) {
      if (loadingEl) loadingEl.hidden = true;
      showMsg(data.error || "Project not found.", true);
      return;
    }
    renderProject(data);
  }

  async function loadMeForJoin() {
    token =
      window.synodosAuth && window.synodosAuth.getToken
        ? window.synodosAuth.getToken()
        : null;
    userId = null;
    isOwner = false;
    if (!projectId || !cachedProject) {
      return;
    }
    if (!token) {
      if (
        window.synodosProjectPage &&
        window.synodosProjectPage.onViewerReady
      ) {
        window.synodosProjectPage.onViewerReady();
      }
      return;
    }
    var result = await window.synodosAuth.apiFetch("/api/me", {});
    if (!result) {
      return;
    }
    var res = result.res;
    var data = result.data;
    if (!res.ok) {
      if (
        window.synodosProjectPage &&
        window.synodosProjectPage.onViewerReady
      ) {
        window.synodosProjectPage.onViewerReady();
      }
      return;
    }
    if (data.user && !data.user.profile_complete) {
      if (
        window.synodosProjectPage &&
        window.synodosProjectPage.onViewerReady
      ) {
        window.synodosProjectPage.onViewerReady();
      }
      return;
    }
    if (data.user) {
      window.synodosAuth.setCachedMe(data.user);
    }
    userId = data.user && data.user.id;
    isOwner =
      userId != null &&
      Number(cachedProject.owner_user_id) === Number(userId);
    if (
      window.synodosProjectPage &&
      window.synodosProjectPage.onViewerReady
    ) {
      window.synodosProjectPage.onViewerReady();
    }
  }

  /** Exposed for join-request UI (dashboard inbox script may skip). */
  window.synodosProjectPage = {
    getProjectId: function () {
      return projectId;
    },
    getProject: function () {
      return cachedProject;
    },
    getRoles: function () {
      return cachedRoles;
    },
    getToken: function () {
      return token;
    },
    getUserId: function () {
      return userId;
    },
    isOwner: function () {
      return isOwner;
    },
    authHeaders: function () {
      return window.synodosAuth.authHeaders({ json: true });
    },
    showMsg: showMsg,
    refreshJoinPanel: function () {},
    onViewerReady: function () {},
  };

  async function init() {
    projectId = parseProjectId();
    syncBackLink();
    if (!projectId) {
      if (loadingEl) loadingEl.hidden = true;
      showMsg("Missing or invalid project link. Use a URL like project.html?id=1.", true);
      return;
    }
    try {
      await loadProject(projectId);
      token =
        window.synodosAuth && window.synodosAuth.getToken
          ? window.synodosAuth.getToken()
          : null;
      await loadMeForJoin();
      syncBackLink();
    } catch (e) {
      if (loadingEl) loadingEl.hidden = true;
      showMsg("Could not load this project.", true);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
