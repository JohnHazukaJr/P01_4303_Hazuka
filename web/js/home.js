/** Logged-in home: recent projects + personalized activity feed. */
(function () {
  if (!window.synodosAuth) {
    if (typeof console !== "undefined" && console.error) {
      console.error("synodosAuth not found. Load js/auth.js before js/home.js.");
    }
    return;
  }
  if (!window.synodosProjectCard) {
    if (typeof console !== "undefined" && console.error) {
      console.error("synodosProjectCard not found. Load js/project-card.js before js/home.js.");
    }
    return;
  }
  if (!window.synodosSession) {
    if (typeof console !== "undefined" && console.error) {
      console.error("synodosSession not found. Load js/session-guard.js before js/home.js.");
    }
    return;
  }

  var PROJECTS_LIMIT = 15;
  var FEED_LIMIT = 20;

  var displayNameEl = document.getElementById("home-display-name");
  var avatarImg = document.getElementById("home-avatar-img");
  var menuAvatarImg = document.getElementById("home-menu-avatar-img");
  var userMenuBtn = document.getElementById("home-user-menu-btn");
  var userMenuDropdown = document.getElementById("home-user-menu-dropdown");
  var userMenuOpen = false;
  var outBtn = document.getElementById("home-sign-out");
  var msgEl = document.getElementById("home-msg");
  var projectsRoot = document.getElementById("home-projects-root");
  var projectsEmpty = document.getElementById("home-projects-empty");
  var projectsLoadMore = document.getElementById("home-projects-load-more");
  var activityRoot = document.getElementById("home-activity-root");
  var activityEmpty = document.getElementById("home-activity-empty");
  var activityLoadMore = document.getElementById("home-activity-load-more");

  var token = null;
  var userId = null;
  var cachedProjects = [];
  var projectsNextCursor = null;
  var projectsInflight = false;
  var feedEvents = [];
  var feedNextCursor = null;
  var feedInflight = false;

  function setAvatars(user) {
    if (avatarImg) {
      window.synodosAuth.applyUserAvatar(avatarImg, null, user || {});
    }
    if (menuAvatarImg) {
      window.synodosAuth.applyUserAvatar(menuAvatarImg, null, user || {});
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

  function msgForFetchFailure(err, fallback) {
    var isNetwork =
      err &&
      (err.name === "TypeError" ||
        /network|fetch|failed to fetch|load failed|aborted/i.test(String(err.message || "")));
    if (isNetwork) {
      return "Unable to reach synodos. Check your connection and try again.";
    }
    return (err && err.message) || fallback;
  }

  function showMsg(text, isError) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.hidden = !text;
    msgEl.className = "dashboard-msg" + (isError ? " dashboard-msg--error" : "");
    if (isError && text) {
      try {
        msgEl.focus({ preventScroll: true });
      } catch (e) {
        msgEl.focus();
      }
    }
  }

  async function loadMe() {
    token = window.synodosAuth.getToken();
    var cached = window.synodosAuth.getCachedMe();
    if (cached && displayNameEl) {
      var pub0 = String(cached.public_display_label || "").trim();
      var dn0 = String(cached.display_name || "").trim();
      displayNameEl.textContent = pub0 || dn0 || "Welcome back";
    }
    if (cached) {
      setAvatars(cached);
    }
    var gate = await window.synodosSession.ensureAuthedAndCompleteProfile({});
    if (!gate.ok) {
      if (gate.reason === "network") {
        showMsg(
          msgForFetchFailure(gate.error, "Could not load your account. Please try again."),
          true
        );
        return false;
      }
      if (gate.reason === "me-failed") {
        showMsg("Could not load your account. Please try again.", true);
        return false;
      }
      return false;
    }
    token = window.synodosAuth.getToken();
    var u = gate.user;
    userId = u && u.id;
    if (displayNameEl && u) {
      var pub = String(u.public_display_label || "").trim();
      var dn = String(u.display_name || "").trim();
      displayNameEl.textContent = pub || dn || "Welcome back";
    }
    if (u) {
      setAvatars(u);
    }
    return true;
  }

  function buildProjectsUrl(cursor) {
    var params = ["limit=" + encodeURIComponent(String(PROJECTS_LIMIT))];
    if (cursor != null) {
      params.push("cursor=" + encodeURIComponent(String(cursor)));
    }
    return "/api/projects?" + params.join("&");
  }

  function projectCardOptions() {
    return {
      userId: userId,
      hasToken: !!token,
      handlers: null,
    };
  }

  function syncProjectsLoadMore() {
    if (!projectsLoadMore) return;
    projectsLoadMore.hidden = !projectsNextCursor;
    projectsLoadMore.disabled = !!projectsInflight;
    projectsLoadMore.setAttribute("aria-busy", projectsInflight ? "true" : "false");
    projectsLoadMore.textContent = projectsInflight ? "Loading…" : "Load more projects";
  }

  function renderProjectsEmpty() {
    if (!projectsEmpty) return;
    if (cachedProjects.length > 0) {
      projectsEmpty.hidden = true;
      return;
    }
    projectsEmpty.textContent = "No projects yet — be the first to publish one from Projects.";
    projectsEmpty.hidden = false;
  }

  function renderProjectList() {
    if (!projectsRoot) return;
    projectsRoot.innerHTML = "";
    for (var j = 0; j < cachedProjects.length; j++) {
      projectsRoot.appendChild(
        window.synodosProjectCard.renderProjectCard(cachedProjects[j], projectCardOptions())
      );
    }
    renderProjectsEmpty();
    syncProjectsLoadMore();
  }

  async function loadProjectsInitial() {
    if (!projectsRoot) return;
    projectsInflight = true;
    syncProjectsLoadMore();
    if (window.synodosUi && typeof window.synodosUi.skeletonCards === "function") {
      window.synodosUi.skeletonCards(projectsRoot, 2);
    }
    if (projectsEmpty) projectsEmpty.hidden = true;
    try {
      var result = await window.synodosAuth.apiFetch(buildProjectsUrl(null), {});
      if (!result || !result.res.ok) {
        throw new Error("Could not load projects.");
      }
      var data = result.data || {};
      cachedProjects = data.projects || [];
      projectsNextCursor = data.next_cursor != null ? data.next_cursor : null;
      if (window.synodosUi) {
        window.synodosUi.clearSkeleton(projectsRoot);
      }
      renderProjectList();
    } catch (e) {
      if (window.synodosUi) {
        window.synodosUi.clearSkeleton(projectsRoot);
      }
      showMsg(msgForFetchFailure(e, "Could not load projects. Try again."), true);
      renderProjectsEmpty();
    } finally {
      projectsInflight = false;
      syncProjectsLoadMore();
    }
  }

  async function loadMoreProjects() {
    if (!projectsNextCursor || projectsInflight) return;
    projectsInflight = true;
    syncProjectsLoadMore();
    try {
      var result = await window.synodosAuth.apiFetch(buildProjectsUrl(projectsNextCursor), {});
      if (!result || !result.res.ok) {
        throw new Error("Could not load projects.");
      }
      var data = result.data || {};
      var more = data.projects || [];
      for (var j = 0; j < more.length; j++) {
        projectsRoot.appendChild(
          window.synodosProjectCard.renderProjectCard(more[j], projectCardOptions())
        );
      }
      cachedProjects = cachedProjects.concat(more);
      projectsNextCursor = data.next_cursor != null ? data.next_cursor : null;
      renderProjectsEmpty();
    } catch (e) {
      showMsg((e && e.message) || "Could not load more projects.", true);
    } finally {
      projectsInflight = false;
      syncProjectsLoadMore();
    }
  }

  function actorLink(ev) {
    var un = ev.actor_username != null ? String(ev.actor_username).trim() : "";
    if (!un) return null;
    var a = document.createElement("a");
    a.href = "user.html?u=" + encodeURIComponent(un);
    a.textContent = ev.actor_public_display_label || un;
    return a;
  }

  function projectLink(projectId, label) {
    var a = document.createElement("a");
    a.href = "project.html?id=" + encodeURIComponent(String(projectId));
    a.textContent = label != null && String(label).trim() ? String(label) : "Project";
    return a;
  }

  function appendActor(body, ev) {
    var link = actorLink(ev);
    if (link) {
      body.appendChild(link);
    } else {
      body.appendChild(document.createTextNode(ev.actor_public_display_label || "Someone"));
    }
  }

  function renderFeedEvent(ev) {
    var article = document.createElement("article");
    article.className = "feed-activity-item";
    article.setAttribute("role", "listitem");
    var meta = document.createElement("p");
    meta.className = "feed-activity-item__meta";
    if (ev.created_at) {
      try {
        meta.textContent = new Date(ev.created_at).toLocaleString();
      } catch (e) {
        meta.textContent = "";
      }
    }
    var body = document.createElement("p");
    body.className = "feed-activity-item__body";
    var p = ev.payload || {};
    var et = ev.event_type;

    if (et === "project_created") {
      appendActor(body, ev);
      body.appendChild(document.createTextNode(" published "));
      body.appendChild(projectLink(p.project_id, p.title || "a project"));
    } else if (et === "role_added") {
      appendActor(body, ev);
      body.appendChild(document.createTextNode(" added open role “"));
      body.appendChild(document.createTextNode(p.role_title || "Role"));
      body.appendChild(document.createTextNode("” on "));
      body.appendChild(projectLink(p.project_id, p.project_title || "project"));
    } else if (et === "join_accepted") {
      appendActor(body, ev);
      body.appendChild(document.createTextNode(" joined "));
      body.appendChild(projectLink(p.project_id, p.project_title || "a project"));
    } else if (et === "user_followed") {
      appendActor(body, ev);
      body.appendChild(document.createTextNode(" followed "));
      var tun = p.target_username != null ? String(p.target_username).trim() : "";
      if (tun) {
        var ta = document.createElement("a");
        ta.href = "user.html?u=" + encodeURIComponent(tun);
        ta.textContent = "@" + tun;
        body.appendChild(ta);
      } else {
        body.appendChild(document.createTextNode("someone"));
      }
    } else {
      body.appendChild(document.createTextNode("Something happened in the feed."));
    }

    article.appendChild(meta);
    article.appendChild(body);
    return article;
  }

  function buildFeedUrl(cursor) {
    var params = ["limit=" + encodeURIComponent(String(FEED_LIMIT))];
    if (cursor != null) {
      params.push("cursor=" + encodeURIComponent(String(cursor)));
    }
    return "/api/feed?" + params.join("&");
  }

  function syncActivityLoadMore() {
    if (!activityLoadMore) return;
    activityLoadMore.hidden = !feedNextCursor;
    activityLoadMore.disabled = !!feedInflight;
    activityLoadMore.setAttribute("aria-busy", feedInflight ? "true" : "false");
    activityLoadMore.textContent = feedInflight ? "Loading…" : "Load more";
  }

  function renderActivityEmpty() {
    if (!activityEmpty) return;
    if (feedEvents.length > 0) {
      activityEmpty.hidden = true;
      return;
    }
    activityEmpty.textContent =
      "No activity yet — follow people on the People page to see their updates here.";
    activityEmpty.hidden = false;
  }

  function renderActivityList() {
    if (!activityRoot) return;
    activityRoot.innerHTML = "";
    for (var i = 0; i < feedEvents.length; i++) {
      activityRoot.appendChild(renderFeedEvent(feedEvents[i]));
    }
    renderActivityEmpty();
    syncActivityLoadMore();
  }

  async function loadFeedInitial() {
    if (!activityRoot) return;
    feedInflight = true;
    syncActivityLoadMore();
    if (window.synodosUi && typeof window.synodosUi.skeletonLines === "function") {
      window.synodosUi.skeletonLines(activityRoot, 4);
    }
    if (activityEmpty) activityEmpty.hidden = true;
    try {
      var result = await window.synodosAuth.apiFetch(buildFeedUrl(null), {});
      if (!result || !result.res.ok) {
        throw new Error("Could not load activity");
      }
      var data = result.data || {};
      feedEvents = data.events || [];
      feedNextCursor = data.next_cursor != null ? data.next_cursor : null;
      if (window.synodosUi) {
        window.synodosUi.clearSkeleton(activityRoot);
      }
      renderActivityList();
    } catch (e) {
      if (window.synodosUi) {
        window.synodosUi.clearSkeleton(activityRoot);
      }
      showMsg(msgForFetchFailure(e, "Could not load activity. Try again."), true);
      renderActivityEmpty();
    } finally {
      feedInflight = false;
      syncActivityLoadMore();
    }
  }

  async function loadMoreFeed() {
    if (!feedNextCursor || feedInflight) return;
    feedInflight = true;
    syncActivityLoadMore();
    try {
      var result = await window.synodosAuth.apiFetch(buildFeedUrl(feedNextCursor), {});
      if (!result || !result.res.ok) {
        throw new Error("Could not load activity");
      }
      var data = result.data || {};
      var more = data.events || [];
      for (var i = 0; i < more.length; i++) {
        activityRoot.appendChild(renderFeedEvent(more[i]));
      }
      feedEvents = feedEvents.concat(more);
      feedNextCursor = data.next_cursor != null ? data.next_cursor : null;
      renderActivityEmpty();
    } catch (e) {
      showMsg(msgForFetchFailure(e, "Could not load more activity."), true);
    } finally {
      feedInflight = false;
      syncActivityLoadMore();
    }
  }

  async function init() {
    bindUserMenu();
    if (avatarImg) {
      window.synodosAuth.primeUserAvatar(avatarImg, null, {});
    }
    if (menuAvatarImg) {
      window.synodosAuth.primeUserAvatar(menuAvatarImg, null, {});
    }
    var ok = await loadMe();
    if (!ok) return;

    if (projectsLoadMore) {
      projectsLoadMore.addEventListener("click", loadMoreProjects);
    }
    if (activityLoadMore) {
      activityLoadMore.addEventListener("click", loadMoreFeed);
    }

    await loadProjectsInitial();
    await loadFeedInitial();
  }

  if (outBtn) {
    outBtn.addEventListener("click", function () {
      window.synodosAuth.clearToken();
      window.location.href = "login.html";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
