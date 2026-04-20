/** Projects and open roles UI. Requires auth.js before this script. */
(function () {
  if (!window.synodosAuth) {
    if (typeof console !== "undefined" && console.error) {
      console.error(
        "synodosAuth not found. Load js/auth.js before js/dashboard.js."
      );
    }
    return;
  }

  var API_BASE = window.synodosAuth.apiBase;
  var displayNameEl = document.getElementById("dashboard-display-name");
  var dashAvatarImg = document.getElementById("dashboard-avatar-img");
  var dashAvatarPh = document.getElementById("dashboard-avatar-placeholder");
  var outBtn = document.getElementById("dashboard-sign-out");
  var projectsRoot = document.getElementById("projects-root");
  var projectsEmpty = document.getElementById("projects-empty");
  var projectsFilterInput = document.getElementById("projects-filter");
  var projectsFilterMine = document.getElementById("projects-filter-mine");
  var formNew = document.getElementById("form-new-project");
  var msgEl = document.getElementById("dashboard-msg");
  var inboxSection = document.getElementById("dash-requests-inbox-section");
  var inboxRoot = document.getElementById("dash-requests-inbox-root");

  var token = null;
  var userId = null;
  var cachedProjects = [];

  function setDashboardAvatar(user) {
    if (!dashAvatarImg || !dashAvatarPh) return;
    var pub =
      user && user.public_display_label != null
        ? String(user.public_display_label).trim()
        : "";
    var url = user && user.avatar_url ? String(user.avatar_url).trim() : "";
    var alt = pub
      ? "Avatar for " + pub
      : user && user.display_name
        ? "Avatar for " + String(user.display_name).trim()
        : "Profile photo";
    dashAvatarImg.alt = alt;
    var tryUploadedFirst = url.length > 0;
    function revealDashAvatar() {
      dashAvatarImg.hidden = false;
      dashAvatarPh.hidden = true;
    }
    function showDashSvgPlaceholder() {
      dashAvatarImg.hidden = true;
      dashAvatarImg.removeAttribute("src");
      dashAvatarPh.hidden = false;
    }
    dashAvatarImg.onload = function () {
      revealDashAvatar();
    };
    dashAvatarImg.onerror = function () {
      if (tryUploadedFirst) {
        tryUploadedFirst = false;
        dashAvatarImg.src = window.synodosAuth.getDefaultAvatarUrl();
      } else {
        showDashSvgPlaceholder();
      }
    };
    dashAvatarImg.src = tryUploadedFirst
      ? window.synodosAuth.assetUrl(url)
      : window.synodosAuth.getDefaultAvatarUrl();
    /* Cached images may skip `load`; reveal when pixels are ready (`decode` or sync dimensions). */
    if (dashAvatarImg.complete && dashAvatarImg.naturalWidth > 0) {
      revealDashAvatar();
    } else if (typeof dashAvatarImg.decode === "function") {
      dashAvatarImg.decode().then(revealDashAvatar).catch(function () {});
    }
  }

  function showMsg(text, isError) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.hidden = !text;
    msgEl.className =
      "dashboard-msg" + (isError ? " dashboard-msg--error" : "");
  }

  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    if (token) {
      h.Authorization = "Bearer " + token;
    }
    return h;
  }

  async function loadMe() {
    token = window.synodosAuth.getToken();
    if (!token) {
      window.location.href = "login.html";
      return false;
    }
    var res = await fetch(API_BASE + "/api/me", {
      headers: { Authorization: "Bearer " + token },
    });
    // #region agent log
    window.synodosAuth.agentDebug({
      hypothesisId: "H3",
      location: "dashboard.js:loadMe",
      message: "GET /api/me",
      data: { status: res.status, ok: res.ok },
    });
    // #endregion
    if (!res.ok) {
      window.synodosAuth.clearToken();
      window.location.href = "login.html";
      return false;
    }
    var data = await res.json();
    if (data.user && !data.user.profile_complete) {
      window.location.href = "profile-setup.html";
      return false;
    }
    userId = data.user && data.user.id;
    if (displayNameEl && data.user) {
      var pub = String(data.user.public_display_label || "").trim();
      var dn = String(data.user.display_name || "").trim();
      displayNameEl.textContent = pub || dn || "Welcome back";
    }
    if (data.user) {
      setDashboardAvatar(data.user);
    }
    return true;
  }

  async function fetchProjects() {
    var res = await fetch(API_BASE + "/api/projects", {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    if (!res.ok) {
      throw new Error("Could not load projects");
    }
    return res.json();
  }

  function isOwner(project) {
    return userId != null && Number(project.owner_user_id) === Number(userId);
  }

  function filterProjects(list) {
    var q = (
      (projectsFilterInput && projectsFilterInput.value) ||
      ""
    )
      .trim()
      .toLowerCase();
    var mineOnly = projectsFilterMine && projectsFilterMine.checked;
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (mineOnly && !isOwner(p)) continue;
      if (q) {
        var title = String(p.title || "").toLowerCase();
        var desc = String(p.description || "").toLowerCase();
        var ownerLabel = String(p.owner_display || "").toLowerCase();
        if (
          title.indexOf(q) === -1 &&
          desc.indexOf(q) === -1 &&
          ownerLabel.indexOf(q) === -1
        ) {
          continue;
        }
      }
      out.push(p);
    }
    return out;
  }

  function renderProjectList() {
    if (!projectsRoot) return;
    var list = filterProjects(cachedProjects);
    projectsRoot.innerHTML = "";
    var hasAny = cachedProjects.length > 0;
    if (projectsEmpty) {
      if (!hasAny) {
        projectsEmpty.textContent = "No projects yet — create one above.";
        projectsEmpty.hidden = false;
      } else if (list.length === 0) {
        projectsEmpty.textContent =
          "No projects match your filter — try different words or clear the search.";
        projectsEmpty.hidden = false;
      } else {
        projectsEmpty.hidden = true;
      }
    }
    for (var j = 0; j < list.length; j++) {
      projectsRoot.appendChild(renderProjectCard(list[j]));
    }
  }

  function renderProjects(data) {
    cachedProjects = (data && data.projects) || [];
    renderProjectList();
  }

  function renderProjectCard(project) {
    var own = isOwner(project);
    var card = document.createElement("article");
    card.className =
      "project-card" + (own ? " project-card--own" : "");
    card.setAttribute("data-project-id", String(project.id));

    var title = document.createElement("h3");
    title.className = "project-card__title";
    var titleLink = document.createElement("a");
    titleLink.className = "project-card__title-link";
    titleLink.href =
      "project.html?id=" + encodeURIComponent(String(project.id));
    titleLink.textContent = project.title || "Untitled";
    title.appendChild(titleLink);

    var meta = document.createElement("p");
    meta.className = "project-card__meta";
    meta.textContent =
      "Owner: " + (project.owner_display || "?");
    var feedN = Number(project.feed_match_count);
    if (token && Number.isFinite(feedN) && feedN > 0) {
      var feedBadge = document.createElement("span");
      feedBadge.className = "project-card__feed-match";
      feedBadge.setAttribute(
        "title",
        "Overlaps with your field/subfield tags — ranked higher in your feed"
      );
      feedBadge.textContent =
        feedN === 1
          ? "1 match with your fields"
          : feedN + " matches with your fields";
      meta.appendChild(document.createTextNode(" · "));
      meta.appendChild(feedBadge);
    }

    var desc = document.createElement("p");
    desc.className = "project-card__desc";
    desc.textContent = project.description || "";

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(desc);

    var rolesWrap = document.createElement("div");
    rolesWrap.className = "project-roles";
    var rh = document.createElement("h4");
    rh.className = "project-roles__heading";
    rh.textContent = "Open roles";
    rolesWrap.appendChild(rh);

    var roles = project.roles || [];
    if (roles.length === 0) {
      var empty = document.createElement("p");
      empty.className = "project-roles__empty";
      empty.textContent = "No open roles yet.";
      rolesWrap.appendChild(empty);
    } else {
      for (var r = 0; r < roles.length; r++) {
        rolesWrap.appendChild(renderRoleRow(project, roles[r], own));
      }
    }
    card.appendChild(rolesWrap);

    if (own) {
      var addForm = document.createElement("form");
      addForm.className = "role-form";
      addForm.innerHTML =
        '<label class="role-form__label"><span>Role title</span>' +
        '<input name="title" type="text" required maxlength="200" placeholder="e.g. UI design">' +
        "</label>" +
        '<label class="role-form__label"><span>Skills / tools</span>' +
        '<input name="skills" type="text" maxlength="2000" placeholder="Figma, accessibility">' +
        "</label>" +
        '<label class="role-form__label role-form__label--narrow"><span>Openings</span>' +
        '<input name="slots" type="number" min="0" max="999" value="1">' +
        "</label>" +
        '<button type="submit" class="btn btn-primary btn-block">Add open role</button>';
      addForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var fd = new FormData(addForm);
        addRole(project.id, {
          title: fd.get("title"),
          skills: fd.get("skills") || "",
          slots: fd.get("slots"),
        });
      });
      card.appendChild(addForm);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-ghost btn-block project-card__delete";
      delBtn.textContent = "Delete project";
      delBtn.addEventListener("click", function () {
        if (
          window.confirm(
            "Delete this project and all of its open roles? This cannot be undone."
          )
        ) {
          deleteProject(project.id);
        }
      });
      card.appendChild(delBtn);
    }

    return card;
  }

  function renderRoleRow(project, role, canDelete) {
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
    if (canDelete) {
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn btn-ghost role-row__remove";
      rm.setAttribute("aria-label", "Remove role");
      rm.textContent = "Remove";
      rm.addEventListener("click", function () {
        deleteRole(project.id, role.id);
      });
      row.appendChild(rm);
    }
    return row;
  }

  async function refresh() {
    showMsg("", false);
    try {
      var data = await fetchProjects();
      renderProjects(data);
    } catch (err) {
      showMsg(
        (err && err.message) || "Something went wrong loading projects.",
        true
      );
    }
    await loadInbox();
  }

  function renderInboxCard(req) {
    var card = document.createElement("article");
    card.className = "requests-inbox-card";
    var title = document.createElement("h3");
    title.className = "requests-inbox-card__project";
    var projLink = document.createElement("a");
    projLink.href =
      "project.html?id=" + encodeURIComponent(String(req.project_id));
    projLink.textContent = req.project_title || "Project";
    title.appendChild(projLink);
    card.appendChild(title);
    var who = document.createElement("p");
    who.className = "requests-inbox-card__who";
    who.textContent =
      "From: " +
      (req.requester && req.requester.public_display_label
        ? req.requester.public_display_label
        : "?");
    card.appendChild(who);
    if (req.role_title) {
      var role = document.createElement("p");
      role.className = "requests-inbox-card__role";
      role.textContent = "Interested in: " + req.role_title;
      card.appendChild(role);
    }
    if (req.note) {
      var note = document.createElement("p");
      note.className = "requests-inbox-card__note";
      note.textContent = req.note;
      card.appendChild(note);
    }
    var actions = document.createElement("div");
    actions.className = "requests-inbox-card__actions";
    var acc = document.createElement("button");
    acc.type = "button";
    acc.className = "btn btn-primary";
    acc.textContent = "Accept";
    acc.addEventListener("click", function () {
      resolveInboxRequest(req.project_id, req.id, "accepted");
    });
    var dec = document.createElement("button");
    dec.type = "button";
    dec.className = "btn btn-ghost";
    dec.textContent = "Decline";
    dec.addEventListener("click", function () {
      resolveInboxRequest(req.project_id, req.id, "declined");
    });
    actions.appendChild(acc);
    actions.appendChild(dec);
    card.appendChild(actions);
    return card;
  }

  async function loadInbox() {
    if (!inboxSection || !inboxRoot || !token) return;
    try {
      var res = await fetch(API_BASE + "/api/me/project-requests-inbox", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) return;
      var data = await res.json();
      var list = data.requests || [];
      inboxSection.hidden = list.length === 0;
      inboxRoot.innerHTML = "";
      for (var i = 0; i < list.length; i++) {
        inboxRoot.appendChild(renderInboxCard(list[i]));
      }
    } catch (e) {
      /* ignore */
    }
  }

  async function resolveInboxRequest(projectId, requestId, status) {
    showMsg("", false);
    try {
      var res = await fetch(
        API_BASE +
          "/api/projects/" +
          projectId +
          "/join-requests/" +
          requestId,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status: status }),
        }
      );
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        showMsg(data.error || "Could not update request", true);
        return;
      }
      await refresh();
    } catch (e) {
      showMsg("Could not update request.", true);
    }
  }

  async function addRole(projectId, body) {
    showMsg("", false);
    try {
      var res = await fetch(
        API_BASE + "/api/projects/" + projectId + "/roles",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(body),
        }
      );
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        showMsg(data.error || "Could not add role", true);
        return;
      }
      await refresh();
    } catch (e) {
      showMsg("Could not add role.", true);
    }
  }

  async function deleteRole(projectId, roleId) {
    showMsg("", false);
    try {
      var res = await fetch(
        API_BASE +
          "/api/projects/" +
          projectId +
          "/roles/" +
          roleId,
        { method: "DELETE", headers: authHeaders() }
      );
      if (!res.ok) {
        var data = await res.json().catch(function () {
          return {};
        });
        showMsg(data.error || "Could not remove role", true);
        return;
      }
      await refresh();
    } catch (e) {
      showMsg("Could not remove role.", true);
    }
  }

  async function deleteProject(projectId) {
    showMsg("", false);
    try {
      var res = await fetch(API_BASE + "/api/projects/" + projectId, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        var data = await res.json().catch(function () {
          return {};
        });
        showMsg(data.error || "Could not delete project", true);
        return;
      }
      await refresh();
    } catch (e) {
      showMsg("Could not delete project.", true);
    }
  }

  async function init() {
    var ok = await loadMe();
    if (!ok) return;

    function onProjectsFilterChange() {
      renderProjectList();
    }
    if (projectsFilterInput) {
      projectsFilterInput.addEventListener("input", onProjectsFilterChange);
    }
    if (projectsFilterMine) {
      projectsFilterMine.addEventListener("change", onProjectsFilterChange);
    }

    if (formNew) {
      formNew.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        if (typeof formNew.reportValidity === "function" && !formNew.checkValidity()) {
          formNew.reportValidity();
          return;
        }
        showMsg("", false);
        var fd = new FormData(formNew);
        var payload = {
          title: fd.get("title"),
          description: fd.get("description") || "",
        };
        try {
          var res = await fetch(API_BASE + "/api/projects", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(payload),
          });
          var data = await res.json().catch(function () {
            return {};
          });
          if (!res.ok) {
            showMsg(data.error || "Could not create project", true);
            return;
          }
          formNew.reset();
          await refresh();
        } catch (e) {
          showMsg("Could not create project.", true);
        }
      });
    }

    await refresh();
  }

  if (outBtn) {
    outBtn.addEventListener("click", function () {
      window.synodosAuth.clearToken();
      window.location.href = "login.html";
    });
  }

  init();
})();
