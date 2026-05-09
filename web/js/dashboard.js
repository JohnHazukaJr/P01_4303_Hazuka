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
  if (!window.synodosProjectCard) {
    if (typeof console !== "undefined" && console.error) {
      console.error(
        "synodosProjectCard not found. Load js/project-card.js before js/dashboard.js."
      );
    }
    return;
  }

  var displayNameEl = document.getElementById("dashboard-display-name");
  var dashAvatarImg = document.getElementById("dashboard-avatar-img");
  var dashMenuAvatarImg = document.getElementById("dashboard-menu-avatar-img");
  var userMenuBtn = document.getElementById("dashboard-user-menu-btn");
  var userMenuDropdown = document.getElementById("dashboard-user-menu-dropdown");
  var userMenuOpen = false;
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
  var nextCursor = null;
  var loadMoreBtn = null;
  var searchDebounceTimer = null;
  var lastSearchToken = 0;
  var inflightProjectsLoad = false;

  function setDashboardAvatar(user) {
    if (dashAvatarImg) {
      window.synodosAuth.applyUserAvatar(dashAvatarImg, null, user || {});
    }
    if (dashMenuAvatarImg) {
      window.synodosAuth.applyUserAvatar(dashMenuAvatarImg, null, user || {});
    }
  }

  function setUserMenuOpen(open) {
    userMenuOpen = open;
    if (userMenuDropdown) {
      userMenuDropdown.hidden = !open;
    }
    if (userMenuBtn) {
      userMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  function bindUserMenu() {
    if (!userMenuBtn || !userMenuDropdown) return;
    userMenuBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      setUserMenuOpen(!userMenuOpen);
    });
    userMenuDropdown.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    document.addEventListener("click", function () {
      if (userMenuOpen) setUserMenuOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && userMenuOpen) setUserMenuOpen(false);
    });
  }

  function showMsg(text, isError) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.hidden = !text;
    msgEl.className =
      "dashboard-msg" + (isError ? " dashboard-msg--error" : "");
  }

  function jsonAuthHeaders() {
    return window.synodosAuth.authHeaders({ json: true });
  }

  function projectCardOptions() {
    return {
      userId: userId,
      hasToken: !!token,
      handlers: {
        addRole: addRole,
        deleteRole: deleteRole,
        deleteProject: deleteProject,
      },
    };
  }

  async function loadMe() {
    token = window.synodosAuth.getToken();
    if (!token) {
      window.location.href = "login.html";
      return false;
    }
    var cached = window.synodosAuth.getCachedMe();
    if (cached && displayNameEl) {
      var pub0 = String(cached.public_display_label || "").trim();
      var dn0 = String(cached.display_name || "").trim();
      displayNameEl.textContent = pub0 || dn0 || "Welcome back";
    }
    if (cached) {
      setDashboardAvatar(cached);
    }
    var result = await window.synodosAuth.apiFetch("/api/me", {});
    if (!result) {
      return false;
    }
    var res = result.res;
    var data = result.data;
    if (!res.ok) {
      showMsg("Could not load your account. Please try again.", true);
      return false;
    }
    if (data.user && !data.user.profile_complete) {
      window.location.href = "profile-setup.html";
      return false;
    }
    if (data.user) {
      window.synodosAuth.setCachedMe(data.user);
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

  function buildProjectsUrl(opts) {
    opts = opts || {};
    var params = [];
    var q = (
      (projectsFilterInput && projectsFilterInput.value) ||
      ""
    ).trim();
    if (q) params.push("q=" + encodeURIComponent(q));
    if (projectsFilterMine && projectsFilterMine.checked) {
      params.push("mine=1");
    }
    if (opts.cursor != null) {
      params.push("cursor=" + encodeURIComponent(String(opts.cursor)));
    }
    if (opts.limit != null) {
      params.push("limit=" + encodeURIComponent(String(opts.limit)));
    }
    return "/api/projects" + (params.length ? "?" + params.join("&") : "");
  }

  async function fetchProjects(opts) {
    var url = buildProjectsUrl(opts || {});
    var result = await window.synodosAuth.apiFetch(url, {});
    if (!result) {
      return null;
    }
    if (!result.res.ok) {
      throw new Error("Could not load projects");
    }
    return result.data;
  }

  function renderEmptyState() {
    if (!projectsEmpty) return;
    var hasAny = cachedProjects.length > 0;
    var q = (projectsFilterInput && projectsFilterInput.value || "").trim();
    var mineOnly = !!(projectsFilterMine && projectsFilterMine.checked);
    if (hasAny) {
      projectsEmpty.hidden = true;
      return;
    }
    if (q || mineOnly) {
      projectsEmpty.textContent =
        "No projects match — try different words or clear the search.";
    } else {
      projectsEmpty.textContent = "No projects yet — create one above.";
    }
    projectsEmpty.hidden = false;
  }

  function ensureLoadMoreButton() {
    if (loadMoreBtn || !projectsRoot || !projectsRoot.parentNode) return;
    loadMoreBtn = document.createElement("button");
    loadMoreBtn.type = "button";
    loadMoreBtn.className = "btn btn-ghost projects-load-more";
    loadMoreBtn.textContent = "Load more projects";
    loadMoreBtn.hidden = true;
    loadMoreBtn.addEventListener("click", function () {
      loadMoreProjects();
    });
    projectsRoot.parentNode.insertBefore(loadMoreBtn, projectsRoot.nextSibling);
  }

  function syncLoadMoreVisibility() {
    if (!loadMoreBtn) return;
    loadMoreBtn.hidden = !nextCursor;
    loadMoreBtn.disabled = !!inflightProjectsLoad;
    if (loadMoreBtn.disabled) {
      loadMoreBtn.textContent = "Loading…";
    } else {
      loadMoreBtn.textContent = "Load more projects";
    }
  }

  function renderProjectList() {
    if (!projectsRoot) return;
    projectsRoot.innerHTML = "";
    for (var j = 0; j < cachedProjects.length; j++) {
      projectsRoot.appendChild(
        window.synodosProjectCard.renderProjectCard(
          cachedProjects[j],
          projectCardOptions()
        )
      );
    }
    renderEmptyState();
    syncLoadMoreVisibility();
  }

  function appendProjects(list) {
    if (!projectsRoot || !list || list.length === 0) return;
    for (var j = 0; j < list.length; j++) {
      projectsRoot.appendChild(
        window.synodosProjectCard.renderProjectCard(list[j], projectCardOptions())
      );
    }
  }

  function renderProjects(data) {
    cachedProjects = (data && data.projects) || [];
    nextCursor = data && data.next_cursor != null ? data.next_cursor : null;
    renderProjectList();
  }

  async function loadMoreProjects() {
    if (!nextCursor || inflightProjectsLoad) return;
    inflightProjectsLoad = true;
    syncLoadMoreVisibility();
    try {
      var data = await fetchProjects({ cursor: nextCursor });
      if (data === null) return;
      var more = (data && data.projects) || [];
      appendProjects(more);
      cachedProjects = cachedProjects.concat(more);
      nextCursor = data && data.next_cursor != null ? data.next_cursor : null;
    } catch (err) {
      showMsg(
        (err && err.message) || "Could not load more projects.",
        true
      );
    } finally {
      inflightProjectsLoad = false;
      syncLoadMoreVisibility();
    }
  }

  function showSkeletonProjects() {
    if (!projectsRoot) return;
    if (window.synodosUi && typeof window.synodosUi.skeletonCards === "function") {
      window.synodosUi.skeletonCards(projectsRoot, 3);
    }
    if (projectsEmpty) projectsEmpty.hidden = true;
  }

  async function reloadProjects() {
    var token = ++lastSearchToken;
    inflightProjectsLoad = true;
    syncLoadMoreVisibility();
    showSkeletonProjects();
    try {
      var data = await fetchProjects({ cursor: null });
      if (token !== lastSearchToken) return;
      if (data === null) return;
      renderProjects(data);
    } catch (err) {
      if (token !== lastSearchToken) return;
      if (projectsRoot && window.synodosUi) {
        window.synodosUi.clearSkeleton(projectsRoot);
      }
      showMsg(
        (err && err.message) || "Something went wrong loading projects.",
        true
      );
    } finally {
      if (token === lastSearchToken) {
        inflightProjectsLoad = false;
        syncLoadMoreVisibility();
      }
    }
  }

  async function refresh() {
    showMsg("", false);
    await reloadProjects();
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
    who.appendChild(document.createTextNode("From: "));
    if (
      req.requester &&
      req.requester.username &&
      String(req.requester.username).trim()
    ) {
      var whoLink = document.createElement("a");
      whoLink.href =
        "user.html?u=" +
        encodeURIComponent(String(req.requester.username).trim());
      whoLink.textContent =
        req.requester.public_display_label ||
        req.requester.username ||
        "?";
      who.appendChild(whoLink);
    } else {
      who.appendChild(
        document.createTextNode(
          req.requester && req.requester.public_display_label
            ? req.requester.public_display_label
            : "?"
        )
      );
    }
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
      var inboxResult = await window.synodosAuth.apiFetch(
        "/api/me/project-requests-inbox",
        {}
      );
      if (!inboxResult) {
        return;
      }
      var res = inboxResult.res;
      var data = inboxResult.data;
      if (!res.ok) return;
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
      var joinResult = await window.synodosAuth.apiFetch(
        "/api/projects/" +
          projectId +
          "/join-requests/" +
          requestId,
        {
          method: "PATCH",
          headers: jsonAuthHeaders(),
          body: JSON.stringify({ status: status }),
        }
      );
      if (!joinResult) {
        return;
      }
      var res = joinResult.res;
      var data = joinResult.data;
      if (!res.ok) {
        showMsg(data.error || "Could not update request", true);
        return;
      }
      document.dispatchEvent(new CustomEvent("synodos:notifications-refresh"));
      await refresh();
    } catch (e) {
      showMsg("Could not update request.", true);
    }
  }

  async function addRole(projectId, body) {
    showMsg("", false);
    try {
      var roleResult = await window.synodosAuth.apiFetch(
        "/api/projects/" + projectId + "/roles",
        {
          method: "POST",
          headers: jsonAuthHeaders(),
          body: JSON.stringify(body),
        }
      );
      if (!roleResult) {
        return;
      }
      var res = roleResult.res;
      var data = roleResult.data;
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
      var delRoleResult = await window.synodosAuth.apiFetch(
        "/api/projects/" +
          projectId +
          "/roles/" +
          roleId,
        { method: "DELETE" }
      );
      if (!delRoleResult) {
        return;
      }
      var res = delRoleResult.res;
      if (!res.ok) {
        var data = delRoleResult.data;
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
      var delProjResult = await window.synodosAuth.apiFetch(
        "/api/projects/" + projectId,
        { method: "DELETE" }
      );
      if (!delProjResult) {
        return;
      }
      var res = delProjResult.res;
      if (!res.ok && res.status !== 204) {
        var data = delProjResult.data;
        showMsg(data.error || "Could not delete project", true);
        return;
      }
      await refresh();
    } catch (e) {
      showMsg("Could not delete project.", true);
    }
  }

  async function init() {
    bindUserMenu();
    if (dashAvatarImg) {
      window.synodosAuth.primeUserAvatar(dashAvatarImg, null, {});
    }
    if (dashMenuAvatarImg) {
      window.synodosAuth.primeUserAvatar(dashMenuAvatarImg, null, {});
    }
    var ok = await loadMe();
    if (!ok) return;

    ensureLoadMoreButton();

    function scheduleSearchReload() {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
      searchDebounceTimer = setTimeout(function () {
        searchDebounceTimer = null;
        reloadProjects();
      }, 250);
    }
    if (projectsFilterInput) {
      projectsFilterInput.addEventListener("input", scheduleSearchReload);
      projectsFilterInput.addEventListener("search", scheduleSearchReload);
    }
    if (projectsFilterMine) {
      projectsFilterMine.addEventListener("change", function () {
        if (searchDebounceTimer) {
          clearTimeout(searchDebounceTimer);
          searchDebounceTimer = null;
        }
        reloadProjects();
      });
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
          var createResult = await window.synodosAuth.apiFetch("/api/projects", {
            method: "POST",
            headers: jsonAuthHeaders(),
            body: JSON.stringify(payload),
          });
          if (!createResult) {
            return;
          }
          var res = createResult.res;
          var data = createResult.data;
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
