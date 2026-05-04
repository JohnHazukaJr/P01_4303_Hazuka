/** Guest vs signed-in nav + standard bell dropdown notifications. Requires auth.js; optional notification-helpers.js. */
(function () {
  var POLL_MS = 55000;
  var badgePollTimer = null;
  var menuOpen = false;

  function isAuthed() {
    if (!window.synodosAuth) return false;
    var t = window.synodosAuth.getToken();
    return !!(t && String(t).trim());
  }

  function setHidden(el, hide) {
    if (hide) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  function H() {
    return window.synodosNotificationHelpers || null;
  }

  function labelForType(type, payload) {
    var h = H();
    if (h) return h.labelForType(type, payload);
    return type || "Notification";
  }

  function primaryLink(type, payload) {
    var h = H();
    if (h) return h.primaryLink(type, payload);
    var p = payload || {};
    if (p.project_id) {
      return "project.html?id=" + encodeURIComponent(String(p.project_id));
    }
    return null;
  }

  function ensureNotifyMenu() {
    if (document.getElementById("synodos-notify-menu")) return;
    var actions = document.querySelector("#site-nav .top-actions, header .top-actions");
    if (!actions) return;

    var wrap = document.createElement("div");
    wrap.id = "synodos-notify-menu";
    wrap.className = "notify-menu";
    wrap.setAttribute("data-nav-group", "user");
    wrap.setAttribute("hidden", "");
    wrap.innerHTML =
      '<button type="button" class="btn btn-ghost notify-menu__btn" id="synodos-notify-btn" aria-expanded="false" aria-controls="synodos-notify-dropdown" title="Notifications" aria-label="Notifications">' +
      '<svg class="notify-menu__icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
      '<span class="notify-menu__badge" id="synodos-notify-badge" hidden>0</span></button>' +
      '<div class="notify-menu__dropdown" id="synodos-notify-dropdown" role="menu" aria-label="Notifications" hidden>' +
      '<div class="notify-menu__head"><div class="notify-menu__title">Notifications</div>' +
      '<button type="button" class="btn btn-ghost notify-menu__markall" id="synodos-notify-markall">Mark all read</button></div>' +
      '<div class="notify-menu__scroll">' +
      '<div class="notify-menu__section" id="synodos-notify-invites-wrap" hidden><div class="notify-menu__section-title">Invitations</div><div id="synodos-notify-invites"></div></div>' +
      '<div class="notify-menu__section"><div class="notify-menu__section-title">What\u0027s new</div><div id="synodos-notify-new"></div><p class="notify-menu__empty" id="synodos-notify-new-empty" hidden>Nothing new.</p></div>' +
      '<div class="notify-menu__section"><div class="notify-menu__section-title">Earlier</div><div id="synodos-notify-earlier"></div><p class="notify-menu__empty" id="synodos-notify-earlier-empty" hidden>No older items yet.</p></div>' +
      "</div>" +
      '<a class="notify-menu__footer" href="notifications.html">Open full notifications</a>' +
      "</div>";

    var theme = actions.querySelector("[data-theme-toggle]");
    if (theme && theme.parentNode === actions) theme.after(wrap);
    else actions.insertBefore(wrap, actions.firstChild);

    bindNotifyMenu();
  }

  function setMenuOpen(open) {
    menuOpen = open;
    var btn = document.getElementById("synodos-notify-btn");
    var dd = document.getElementById("synodos-notify-dropdown");
    if (!btn || !dd) return;
    dd.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) loadDropdown();
  }

  function bindNotifyMenu() {
    var btn = document.getElementById("synodos-notify-btn");
    var dd = document.getElementById("synodos-notify-dropdown");
    var markAll = document.getElementById("synodos-notify-markall");
    if (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(!menuOpen);
      });
    }
    if (dd) {
      dd.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }
    if (markAll) {
      markAll.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        markAllRead();
      });
    }
    document.addEventListener("click", function () {
      if (menuOpen) setMenuOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuOpen) setMenuOpen(false);
    });
  }

  function applyBadgeCount(n) {
    var b = document.getElementById("synodos-notify-badge");
    if (!b) return;
    if (n > 0) {
      b.textContent = n > 99 ? "99+" : String(n);
      b.removeAttribute("hidden");
    } else {
      b.setAttribute("hidden", "");
      b.textContent = "0";
    }
  }

  function fetchNotifyCount() {
    if (!window.synodosAuth || !isAuthed()) return;
    var token = window.synodosAuth.getToken();
    if (!token) return;
    var base = window.synodosAuth.apiBase || "http://localhost:8080";
    fetch(base + "/api/me/notifications/unread-count", {
      headers: { Authorization: "Bearer " + token },
    })
      .then(function (res) {
        if (res.status === 401) {
          if (window.synodosAuth && window.synodosAuth.handleUnauthorized) {
            window.synodosAuth.handleUnauthorized();
          }
          return null;
        }
        if (!res.ok) {
          if (typeof console !== "undefined" && console.warn) {
            console.warn("[synodos] unread-count fetch failed", res.status);
          }
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        var n = Number(data.unread_count);
        applyBadgeCount(Number.isFinite(n) ? n : 0);
        if (menuOpen) loadDropdown();
      })
      .catch(function (e) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[synodos] unread-count request failed", e);
        }
      });
  }

  function startPolling() {
    if (badgePollTimer) return;
    fetchNotifyCount();
    badgePollTimer = setInterval(fetchNotifyCount, POLL_MS);
  }

  function stopPolling() {
    if (badgePollTimer) {
      clearInterval(badgePollTimer);
      badgePollTimer = null;
    }
  }

  function onVisibility() {
    if (document.visibilityState === "visible" && isAuthed()) {
      fetchNotifyCount();
    }
  }

  function markNotifRead(id) {
    if (!window.synodosAuth || !isAuthed()) return Promise.resolve();
    var base = window.synodosAuth.apiBase || "http://localhost:8080";
    var token = window.synodosAuth.getToken();
    return fetch(base + "/api/me/notifications/" + id + "/read", {
      method: "PATCH",
      headers: { Authorization: "Bearer " + token },
    }).catch(function (e) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[synodos] mark notification read failed", e);
      }
    });
  }

  function renderNotifItem(n) {
    var item = document.createElement("div");
    item.className = "notify-menu__item" + (n.read_at ? "" : " notify-menu__item--unread");
    var href = primaryLink(n.notification_type, n.payload);
    var text = labelForType(n.notification_type, n.payload);
    var p = document.createElement("p");
    p.className = "notify-menu__item-text";
    if (href) {
      var a = document.createElement("a");
      a.href = href;
      a.textContent = text;
      p.appendChild(a);
    } else {
      p.textContent = text;
    }
    var time = document.createElement("time");
    time.className = "notify-menu__item-time";
    time.setAttribute("datetime", n.created_at || "");
    time.textContent = n.created_at || "";
    item.appendChild(p);
    item.appendChild(time);
    item.addEventListener("click", function (ev) {
      if (ev.target.closest("a")) return;
      if (!n.read_at) {
        markNotifRead(n.id).then(function () {
          item.classList.remove("notify-menu__item--unread");
          fetchNotifyCount();
        });
      }
      if (href) window.location.href = href;
    });
    return item;
  }

  function renderInviteItem(inv, base, token) {
    var row = document.createElement("div");
    row.className = "notify-menu__invite";
    var title = document.createElement("p");
    title.className = "notify-menu__invite-title";
    var a = document.createElement("a");
    a.href = "project.html?id=" + encodeURIComponent(String(inv.project_id));
    a.textContent = inv.project_title || "Project";
    title.appendChild(a);
    row.appendChild(title);
    var who = document.createElement("p");
    who.className = "notify-menu__invite-who";
    who.textContent =
      "From " +
      (inv.inviter && inv.inviter.public_display_label
        ? inv.inviter.public_display_label
        : "?");
    row.appendChild(who);
    var actions = document.createElement("div");
    actions.className = "notify-menu__invite-actions";
    function patch(status) {
      return fetch(base + "/api/me/project-invitations/" + inv.id, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ status: status }),
      });
    }
    var acc = document.createElement("button");
    acc.type = "button";
    acc.className = "btn btn-primary btn-sm";
    acc.textContent = "Accept";
    var dec = document.createElement("button");
    dec.type = "button";
    dec.className = "btn btn-ghost btn-sm";
    dec.textContent = "Decline";
    acc.addEventListener("click", function (e) {
      e.stopPropagation();
      patch("accepted").then(function (r) {
        if (r.ok) {
          fetchNotifyCount();
          loadDropdown();
          document.dispatchEvent(new CustomEvent("synodos:notifications-refresh"));
        }
      });
    });
    dec.addEventListener("click", function (e) {
      e.stopPropagation();
      patch("declined").then(function (r) {
        if (r.ok) {
          fetchNotifyCount();
          loadDropdown();
          document.dispatchEvent(new CustomEvent("synodos:notifications-refresh"));
        }
      });
    });
    actions.appendChild(acc);
    actions.appendChild(dec);
    row.appendChild(actions);
    return row;
  }

  function ensureDropdownLoadErrorEl() {
    var scroll = document.querySelector("#synodos-notify-dropdown .notify-menu__scroll");
    if (!scroll) return null;
    var el = document.getElementById("synodos-notify-load-error");
    if (!el) {
      el = document.createElement("p");
      el.id = "synodos-notify-load-error";
      el.className = "notify-menu__load-error";
      el.setAttribute("role", "status");
      scroll.insertBefore(el, scroll.firstChild);
    }
    return el;
  }

  function setDropdownLoadError(msg) {
    var el = ensureDropdownLoadErrorEl();
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.removeAttribute("hidden");
    } else {
      el.textContent = "";
      el.setAttribute("hidden", "");
    }
  }

  async function loadDropdown() {
    if (!window.synodosAuth || !isAuthed()) return;
    var base = window.synodosAuth.apiBase || "http://localhost:8080";
    var token = window.synodosAuth.getToken();
    var headers = { Authorization: "Bearer " + token };

    var invWrap = document.getElementById("synodos-notify-invites-wrap");
    var invRoot = document.getElementById("synodos-notify-invites");
    var newRoot = document.getElementById("synodos-notify-new");
    var earlierRoot = document.getElementById("synodos-notify-earlier");
    var newEmpty = document.getElementById("synodos-notify-new-empty");
    var earlierEmpty = document.getElementById("synodos-notify-earlier-empty");

    var notifFailed = false;
    var invFailed = false;

    try {
      var res = await fetch(base + "/api/me/notifications?limit=50", { headers: headers });
      if (res.status === 401) {
        if (window.synodosAuth && window.synodosAuth.handleUnauthorized) {
          window.synodosAuth.handleUnauthorized();
        }
        return;
      }
      if (!res.ok) {
        notifFailed = true;
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[synodos] notifications dropdown list failed", res.status);
        }
        if (newRoot) newRoot.innerHTML = "";
        if (earlierRoot) earlierRoot.innerHTML = "";
        if (newEmpty) newEmpty.setAttribute("hidden", "");
        if (earlierEmpty) earlierEmpty.setAttribute("hidden", "");
      } else {
        var data = await res.json();
        var list = (data && data.notifications) || [];
        var unread = list.filter(function (n) { return !n.read_at; });
        var read = list.filter(function (n) { return !!n.read_at; }).slice(0, 20);

        if (newRoot) {
          newRoot.innerHTML = "";
          for (var i = 0; i < unread.length; i++) newRoot.appendChild(renderNotifItem(unread[i]));
        }
        if (newEmpty) newEmpty.hidden = unread.length > 0;

        if (earlierRoot) {
          earlierRoot.innerHTML = "";
          for (var j = 0; j < read.length; j++) earlierRoot.appendChild(renderNotifItem(read[j]));
        }
        if (earlierEmpty) earlierEmpty.hidden = read.length > 0;
      }
    } catch (e) {
      notifFailed = true;
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[synodos] notifications dropdown", e);
      }
    }

    try {
      var invRes = await fetch(base + "/api/me/project-invitations", { headers: headers });
      if (invRes.status === 401) {
        if (window.synodosAuth && window.synodosAuth.handleUnauthorized) {
          window.synodosAuth.handleUnauthorized();
        }
        return;
      }
      if (!invRes.ok) {
        invFailed = true;
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[synodos] project-invitations fetch failed", invRes.status);
        }
        if (invWrap) invWrap.hidden = true;
        if (invRoot) invRoot.innerHTML = "";
      } else {
        var invData = await invRes.json();
        var invs = (invData && invData.invitations) || [];
        if (invWrap && invRoot) {
          invRoot.innerHTML = "";
          invWrap.hidden = invs.length === 0;
          for (var k = 0; k < invs.length; k++) invRoot.appendChild(renderInviteItem(invs[k], base, token));
        }
      }
    } catch (e2) {
      invFailed = true;
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[synodos] project-invitations", e2);
      }
      if (invWrap) invWrap.hidden = true;
    }

    if (notifFailed || invFailed) {
      setDropdownLoadError("Couldn't load notifications.");
    } else {
      setDropdownLoadError("");
    }
  }

  async function markAllRead() {
    if (!window.synodosAuth || !isAuthed()) return;
    var base = window.synodosAuth.apiBase || "http://localhost:8080";
    var token = window.synodosAuth.getToken();
    try {
      await fetch(base + "/api/me/notifications/read-all", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
    } catch (_) {}
    fetchNotifyCount();
    loadDropdown();
    document.dispatchEvent(new CustomEvent("synodos:notifications-refresh"));
  }

  function sync() {
    var authed = isAuthed();
    document.querySelectorAll('[data-nav-group="guest"]').forEach(function (g) { setHidden(g, authed); });
    document.querySelectorAll('[data-nav-group="user"]').forEach(function (g) { setHidden(g, !authed); });
    document.querySelectorAll("[data-nav-guest]").forEach(function (el) { setHidden(el, authed); });
    document.querySelectorAll("[data-nav-user]").forEach(function (el) { setHidden(el, !authed); });

    ensureNotifyMenu();
    if (authed) {
      startPolling();
      document.removeEventListener("visibilitychange", onVisibility);
      document.addEventListener("visibilitychange", onVisibility);
    } else {
      stopPolling();
      setMenuOpen(false);
      applyBadgeCount(0);
      document.removeEventListener("visibilitychange", onVisibility);
    }
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

  window.synodosRefreshNotificationBadge = fetchNotifyCount;
  document.addEventListener("synodos:notifications-refresh", fetchNotifyCount);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
