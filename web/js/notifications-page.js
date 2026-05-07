/** Notifications list + invitation actions. Requires auth.js + public-nav (badge). */
(function () {
  function H() {
    return window.synodosNotificationHelpers || null;
  }

  function bumpBadge() {
    if (typeof window.synodosRefreshNotificationBadge === "function") {
      window.synodosRefreshNotificationBadge();
    }
  }

  function labelForType(type, payload) {
    var h = H();
    if (h) return h.labelForType(type, payload);
    return type || "Notification";
  }

  function primaryLink(type, payload) {
    var h = H();
    if (h) return h.primaryLink(type, payload);
    return null;
  }

  async function markRead(id) {
    var mr = await window.synodosAuth.apiFetch(
      "/api/me/notifications/" + id + "/read",
      { method: "PATCH" }
    );
    if (mr) bumpBadge();
  }

  function renderNotificationRow(n) {
    var article = document.createElement("article");
    article.className =
      "notification-row" + (n.read_at ? "" : " notification-row--unread");
    article.setAttribute("data-notification-id", String(n.id));
    var p = document.createElement("p");
    p.className = "notification-row__text";
    var href = primaryLink(n.notification_type, n.payload);
    if (href) {
      var a = document.createElement("a");
      a.href = href;
      a.textContent = labelForType(n.notification_type, n.payload);
      p.appendChild(a);
    } else {
      p.textContent = labelForType(n.notification_type, n.payload);
    }
    var time = document.createElement("time");
    time.className = "notification-row__time";
    time.setAttribute("datetime", n.created_at || "");
    time.textContent = n.created_at || "";
    article.appendChild(p);
    article.appendChild(time);
    article.addEventListener("click", function (ev) {
      if (ev.target.closest("a")) return;
      if (!n.read_at) {
        markRead(n.id).then(function () {
          article.classList.remove("notification-row--unread");
        });
      }
      if (href) window.location.href = href;
    });
    return article;
  }

  function renderInviteCard(inv) {
    var card = document.createElement("article");
    card.className = "notification-invite-card";
    var title = document.createElement("h3");
    title.className = "notification-invite-card__title";
    var pl = document.createElement("a");
    pl.href =
      "project.html?id=" + encodeURIComponent(String(inv.project_id));
    pl.textContent = inv.project_title || "Project";
    title.appendChild(pl);
    card.appendChild(title);
    var who = document.createElement("p");
    who.className = "notification-invite-card__who";
    who.textContent =
      "From " +
      (inv.inviter && inv.inviter.public_display_label
        ? inv.inviter.public_display_label
        : "?");
    card.appendChild(who);
    if (inv.note) {
      var note = document.createElement("p");
      note.className = "notification-invite-card__note";
      note.textContent = inv.note;
      card.appendChild(note);
    }
    var actions = document.createElement("div");
    actions.className = "notification-invite-card__actions";
    var acc = document.createElement("button");
    acc.type = "button";
    acc.className = "btn btn-primary";
    acc.textContent = "Accept";
    var dec = document.createElement("button");
    dec.type = "button";
    dec.className = "btn btn-ghost";
    dec.textContent = "Decline";
    acc.addEventListener("click", function () {
      resolveInvite(inv.id, "accepted");
    });
    dec.addEventListener("click", function () {
      resolveInvite(inv.id, "declined");
    });
    actions.appendChild(acc);
    actions.appendChild(dec);
    card.appendChild(actions);
    return card;
  }

  function showPageMsg(text, isError) {
    var el = document.getElementById("notifications-page-msg");
    if (!el) return;
    el.textContent = text || "";
    el.hidden = !text;
    el.className =
      "dashboard-msg" + (isError ? " dashboard-msg--error" : "");
  }

  async function resolveInvite(id, status) {
    showPageMsg("", false);
    var rv = await window.synodosAuth.apiFetch(
      "/api/me/project-invitations/" + id,
      {
        method: "PATCH",
        headers: window.synodosAuth.authHeaders({ json: true }),
        body: JSON.stringify({ status: status }),
      }
    );
    if (!rv) {
      return;
    }
    var res = rv.res;
    var d = rv.data;
    if (!res.ok) {
      showPageMsg(d.error || "Could not update invitation", true);
      return;
    }
    bumpBadge();
    await refresh();
  }

  async function refresh() {
    var token = window.synodosAuth.getToken();
    if (!token) {
      window.location.href = "login.html";
      return;
    }
    var cached = window.synodosAuth.getCachedMe();
    if (cached && cached.profile_complete === false) {
      window.location.href = "profile-setup.html";
      return;
    }
    var meResult = await window.synodosAuth.apiFetch("/api/me", {});
    if (!meResult) {
      return;
    }
    if (!meResult.res.ok) {
      showPageMsg("Could not load your account. Please try again.", true);
      return;
    }
    var meData = meResult.data;
    if (meData.user && !meData.user.profile_complete) {
      window.location.href = "profile-setup.html";
      return;
    }
    if (meData.user) {
      window.synodosAuth.setCachedMe(meData.user);
    }

    var invResult = await window.synodosAuth.apiFetch(
      "/api/me/project-invitations",
      {}
    );
    var invRoot = document.getElementById("notifications-invites-root");
    var invEmpty = document.getElementById("notifications-invites-empty");
    if (!invResult) {
      return;
    }
    var invRes = invResult.res;
    if (!invRes.ok) {
      showPageMsg("Could not load notifications. Please refresh.", true);
    } else if (invRoot) {
      var invData = invResult.data;
      var invs = invData.invitations || [];
      invRoot.innerHTML = "";
      if (invEmpty) invEmpty.hidden = invs.length > 0;
      for (var i = 0; i < invs.length; i++) {
        invRoot.appendChild(renderInviteCard(invs[i]));
      }
    }

    var listResult = await window.synodosAuth.apiFetch(
      "/api/me/notifications?limit=80",
      {}
    );
    var listRoot = document.getElementById("notifications-list-root");
    var listEmpty = document.getElementById("notifications-list-empty");
    if (!listResult) {
      return;
    }
    var listRes = listResult.res;
    if (!listRes.ok) {
      showPageMsg("Could not load notifications. Please refresh.", true);
    } else if (listRoot) {
      var listData = listResult.data;
      var notes = listData.notifications || [];
      listRoot.innerHTML = "";
      if (listEmpty) listEmpty.hidden = notes.length > 0;
      for (var j = 0; j < notes.length; j++) {
        listRoot.appendChild(renderNotificationRow(notes[j]));
      }
    }
    bumpBadge();
  }

  async function markAllRead() {
    await window.synodosAuth.apiFetch("/api/me/notifications/read-all", {
      method: "POST",
    });
    bumpBadge();
    await refresh();
  }

  function showSkeletons() {
    if (!window.synodosUi) return;
    var listRoot = document.getElementById("notifications-list-root");
    var invRoot = document.getElementById("notifications-invites-root");
    var listEmpty = document.getElementById("notifications-list-empty");
    var invEmpty = document.getElementById("notifications-invites-empty");
    if (listRoot) window.synodosUi.skeletonLines(listRoot, 5);
    if (invRoot) window.synodosUi.skeletonCards(invRoot, 1);
    if (listEmpty) listEmpty.hidden = true;
    if (invEmpty) invEmpty.hidden = true;
  }

  function init() {
    var btn = document.getElementById("notifications-mark-all");
    if (btn) btn.addEventListener("click", markAllRead);
    showSkeletons();
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
