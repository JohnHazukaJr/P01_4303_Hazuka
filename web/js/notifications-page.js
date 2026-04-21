/** Notifications list + invitation actions. Requires auth.js + public-nav (badge). */
(function () {
  var API_BASE =
    window.synodosAuth && window.synodosAuth.apiBase
      ? window.synodosAuth.apiBase
      : "http://localhost:8080";

  function authHeaders(json) {
    var h = {};
    if (json) h["Content-Type"] = "application/json";
    var t = window.synodosAuth.getToken();
    if (t) h.Authorization = "Bearer " + t;
    return h;
  }

  function bumpBadge() {
    if (typeof window.synodosRefreshNotificationBadge === "function") {
      window.synodosRefreshNotificationBadge();
    }
  }

  function labelForType(type, payload) {
    var H = window.synodosNotificationHelpers;
    if (H) return H.labelForType(type, payload);
    return type || "Notification";
  }

  function primaryLink(type, payload) {
    var H = window.synodosNotificationHelpers;
    if (H) return H.primaryLink(type, payload);
    var p = payload || {};
    if (p.project_id) {
      return "project.html?id=" + encodeURIComponent(String(p.project_id));
    }
    return null;
  }

  async function markRead(id) {
    await fetch(API_BASE + "/api/me/notifications/" + id + "/read", {
      method: "PATCH",
      headers: authHeaders(false),
    });
    bumpBadge();
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
    var res = await fetch(
      API_BASE + "/api/me/project-invitations/" + id,
      {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ status: status }),
      }
    );
    if (!res.ok) {
      var d = await res.json().catch(function () {
        return {};
      });
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
    var meRes = await fetch(API_BASE + "/api/me", { headers: authHeaders(false) });
    if (!meRes.ok) {
      window.location.href = "login.html";
      return;
    }
    var meData = await meRes.json();
    if (meData.user && !meData.user.profile_complete) {
      window.location.href = "profile-setup.html";
      return;
    }

    var invRes = await fetch(API_BASE + "/api/me/project-invitations", {
      headers: authHeaders(false),
    });
    var invRoot = document.getElementById("notifications-invites-root");
    var invEmpty = document.getElementById("notifications-invites-empty");
    if (invRes.ok && invRoot) {
      var invData = await invRes.json();
      var invs = invData.invitations || [];
      invRoot.innerHTML = "";
      if (invEmpty) invEmpty.hidden = invs.length > 0;
      for (var i = 0; i < invs.length; i++) {
        invRoot.appendChild(renderInviteCard(invs[i]));
      }
    }

    var listRes = await fetch(API_BASE + "/api/me/notifications?limit=80", {
      headers: authHeaders(false),
    });
    var listRoot = document.getElementById("notifications-list-root");
    var listEmpty = document.getElementById("notifications-list-empty");
    if (listRes.ok && listRoot) {
      var listData = await listRes.json();
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
    await fetch(API_BASE + "/api/me/notifications/read-all", {
      method: "POST",
      headers: authHeaders(false),
    });
    bumpBadge();
    await refresh();
  }

  function init() {
    var btn = document.getElementById("notifications-mark-all");
    if (btn) btn.addEventListener("click", markAllRead);
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
