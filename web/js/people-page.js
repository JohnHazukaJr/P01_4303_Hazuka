/** Find people page: server-side user search via /api/users/search. */
(function () {
  if (!window.synodosAuth) {
    if (typeof console !== "undefined" && console.error) {
      console.error("synodosAuth not found. Load js/auth.js before js/people-page.js.");
    }
    return;
  }

  var input = document.getElementById("people-search");
  var resultsRoot = document.getElementById("people-results");
  var emptyEl = document.getElementById("people-empty");
  var msgEl = document.getElementById("people-msg");

  var debounceTimer = null;
  var searchToken = 0;
  var nextCursor = null;
  var loadMoreBtn = null;
  var inflight = false;
  var currentQuery = "";

  function showMsg(text, isError) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.hidden = !text;
    msgEl.className = "dashboard-msg" + (isError ? " dashboard-msg--error" : "");
  }

  function setEmpty(text) {
    if (!emptyEl) return;
    if (!text) {
      emptyEl.hidden = true;
      return;
    }
    emptyEl.textContent = text;
    emptyEl.hidden = false;
  }

  function ensureLoadMore() {
    if (loadMoreBtn || !resultsRoot || !resultsRoot.parentNode) return;
    loadMoreBtn = document.createElement("button");
    loadMoreBtn.type = "button";
    loadMoreBtn.className = "btn btn-ghost projects-load-more";
    loadMoreBtn.textContent = "Load more people";
    loadMoreBtn.hidden = true;
    loadMoreBtn.addEventListener("click", function () {
      loadMore();
    });
    resultsRoot.parentNode.insertBefore(loadMoreBtn, resultsRoot.nextSibling);
  }

  function syncLoadMore() {
    if (!loadMoreBtn) return;
    loadMoreBtn.hidden = !nextCursor;
    loadMoreBtn.disabled = !!inflight;
    loadMoreBtn.textContent = inflight ? "Loading…" : "Load more people";
  }

  function renderUserCard(user) {
    var card = document.createElement("article");
    card.className = "project-card";

    var head = document.createElement("div");
    head.className = "user-public-head";
    head.style.alignItems = "center";

    var avatarWrap = document.createElement("span");
    avatarWrap.className = "profile-avatar-preview profile-avatar-preview--xs";
    var img = document.createElement("img");
    img.className = "profile-avatar-img";
    img.alt = "";
    img.width = 32;
    img.height = 32;
    img.src = "images/default-avatar.png";
    avatarWrap.appendChild(img);
    if (window.synodosAuth && typeof window.synodosAuth.applyUserAvatar === "function") {
      window.synodosAuth.applyUserAvatar(img, null, user || {});
    }
    head.appendChild(avatarWrap);

    var headText = document.createElement("div");
    headText.className = "user-public-head__text";
    var titleEl = document.createElement("h2");
    titleEl.className = "project-card__title people-card__title-wrap";
    titleEl.style.margin = "0";
    var titleRow = document.createElement("div");
    titleRow.className = "people-card__title-row";
    var titleLink = document.createElement("a");
    titleLink.className = "project-card__title-link";
    var uname = user && user.username ? String(user.username).trim() : "";
    titleLink.href = "user.html?u=" + encodeURIComponent(uname || "");
    titleLink.textContent = user.public_display_label || user.display_name || uname || "Member";
    titleRow.appendChild(titleLink);
    var badgeHost = document.createElement("span");
    badgeHost.className = "people-card__badges";
    titleRow.appendChild(badgeHost);
    if (window.synodosUserBadges) {
      window.synodosUserBadges.renderBadgesOnly(badgeHost, user);
    }
    titleEl.appendChild(titleRow);
    headText.appendChild(titleEl);
    if (uname) {
      var unameEl = document.createElement("p");
      unameEl.className = "user-public-username";
      unameEl.style.margin = "0";
      unameEl.textContent = "@" + uname;
      headText.appendChild(unameEl);
    }
    head.appendChild(headText);
    card.appendChild(head);

    if (user.bio) {
      var bio = document.createElement("p");
      bio.className = "project-card__desc";
      bio.textContent = user.bio.length > 240 ? user.bio.slice(0, 237) + "…" : user.bio;
      card.appendChild(bio);
    }

    var tags = user && Array.isArray(user.work_tags) ? user.work_tags : [];
    if (tags.length > 0) {
      var tagList = document.createElement("ul");
      tagList.className = "user-public-tags";
      var max = Math.min(6, tags.length);
      for (var i = 0; i < max; i++) {
        var t = tags[i];
        if (!t) continue;
        var li = document.createElement("li");
        li.className = "user-public-tag";
        var label =
          (t.work_subfield ? String(t.work_subfield) : "") ||
          (t.work_field ? String(t.work_field) : "");
        if (t.work_field && t.work_subfield) {
          label = String(t.work_field) + " / " + String(t.work_subfield);
        }
        li.textContent = label;
        tagList.appendChild(li);
      }
      card.appendChild(tagList);
    }

    return card;
  }

  function renderUsers(users, append) {
    if (!resultsRoot) return;
    if (!append) resultsRoot.innerHTML = "";
    for (var i = 0; i < users.length; i++) {
      resultsRoot.appendChild(renderUserCard(users[i]));
    }
  }

  function buildUrl(opts) {
    opts = opts || {};
    var q = currentQuery;
    var params = ["q=" + encodeURIComponent(q)];
    if (opts.cursor != null) {
      params.push("cursor=" + encodeURIComponent(String(opts.cursor)));
    }
    return "/api/users/search?" + params.join("&");
  }

  async function runSearch() {
    if (!input) return;
    currentQuery = String(input.value || "").trim();
    var token = ++searchToken;
    nextCursor = null;
    if (currentQuery.length < 2) {
      if (resultsRoot) resultsRoot.innerHTML = "";
      setEmpty("Type at least 2 characters to search.");
      syncLoadMore();
      return;
    }
    setEmpty(null);
    if (resultsRoot && window.synodosUi && typeof window.synodosUi.skeletonCards === "function") {
      window.synodosUi.skeletonCards(resultsRoot, 3);
    } else {
      setEmpty("Searching…");
    }
    inflight = true;
    syncLoadMore();
    try {
      var result = await window.synodosAuth.apiFetch(buildUrl({}), {});
      if (token !== searchToken) return;
      if (!result) return;
      if (!result.res.ok) {
        showMsg("Could not search.", true);
        if (resultsRoot) resultsRoot.innerHTML = "";
        setEmpty(null);
        return;
      }
      var data = result.data || {};
      var users = Array.isArray(data.users) ? data.users : [];
      nextCursor = data.next_cursor != null ? data.next_cursor : null;
      renderUsers(users, false);
      if (users.length === 0) {
        setEmpty("No people match — try different words.");
      } else {
        setEmpty(null);
      }
    } catch (err) {
      if (token !== searchToken) return;
      showMsg("Could not search.", true);
    } finally {
      if (token === searchToken) {
        inflight = false;
        syncLoadMore();
      }
    }
  }

  async function loadMore() {
    if (!nextCursor || inflight) return;
    inflight = true;
    syncLoadMore();
    try {
      var result = await window.synodosAuth.apiFetch(buildUrl({ cursor: nextCursor }), {});
      if (!result || !result.res.ok) return;
      var data = result.data || {};
      var users = Array.isArray(data.users) ? data.users : [];
      renderUsers(users, true);
      nextCursor = data.next_cursor != null ? data.next_cursor : null;
    } finally {
      inflight = false;
      syncLoadMore();
    }
  }

  function init() {
    ensureLoadMore();
    if (input) {
      input.addEventListener("input", function () {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(runSearch, 250);
      });
      input.addEventListener("search", function () {
        if (debounceTimer) clearTimeout(debounceTimer);
        runSearch();
      });
      var qParam = new URLSearchParams(window.location.search).get("q");
      if (qParam) {
        input.value = qParam;
        runSearch();
      }
    }
  }

  init();
})();
