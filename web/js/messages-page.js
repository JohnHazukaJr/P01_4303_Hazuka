/** DM inbox. Requires auth.js. */
(function () {
  var token = null;
  var myUserId = null;
  var activeConvId = null;

  function showMsg(text, isError) {
    var msgEl = document.getElementById("messages-page-msg");
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.hidden = !text;
    msgEl.className =
      "dashboard-msg" + (isError ? " dashboard-msg--error" : "");
  }

  function parseConvIdFromQuery() {
    var q = new URLSearchParams(window.location.search).get("c");
    var n = q != null ? Number(q) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  function setUrlConv(id) {
    var u = new URL(window.location.href);
    if (id) u.searchParams.set("c", String(id));
    else u.searchParams.delete("c");
    window.history.replaceState({}, "", u.pathname + u.search);
  }

  async function loadMe() {
    var cached = window.synodosAuth.getCachedMe();
    if (cached && cached.profile_complete === false) {
      window.location.href = "profile-setup.html";
      return false;
    }
    if (cached && cached.id != null) {
      myUserId = Number(cached.id);
    }
    var result = await window.synodosAuth.apiFetch("/api/me", {});
    if (!result) {
      return false;
    }
    if (!result.res.ok) {
      showMsg("Could not load your account. Please try again.", true);
      return false;
    }
    var data = result.data;
    if (data.user && !data.user.profile_complete) {
      window.location.href = "profile-setup.html";
      return false;
    }
    if (data.user) {
      window.synodosAuth.setCachedMe(data.user);
    }
    myUserId = data.user && data.user.id != null ? Number(data.user.id) : null;
    return true;
  }

  function renderConvListItem(c, isActive) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "messages-conv-item" + (isActive ? " messages-conv-item--active" : "");
    btn.setAttribute("data-conv-id", String(c.id));
    var label = document.createElement("span");
    label.className = "messages-conv-item__name";
    label.textContent =
      (c.other_user && c.other_user.public_display_label) || "—";
    btn.appendChild(label);
    if (c.last_message_preview) {
      var prev = document.createElement("span");
      prev.className = "messages-conv-item__preview";
      prev.textContent = c.last_message_preview;
      btn.appendChild(prev);
    }
    btn.addEventListener("click", function () {
      selectConversation(Number(c.id));
    });
    return btn;
  }

  async function loadConversations() {
    var listEl = document.getElementById("messages-conv-list");
    var emptyEl = document.getElementById("messages-conv-empty");
    if (!listEl) return [];
    var convResult = await window.synodosAuth.apiFetch("/api/conversations", {});
    if (!convResult) {
      return [];
    }
    var res = convResult.res;
    var data = convResult.data;
    if (!res.ok) {
      showMsg("Could not load conversations. Please refresh.", true);
      if (emptyEl) emptyEl.hidden = true;
      return [];
    }
    var convs = data.conversations || [];
    listEl.innerHTML = "";
    if (emptyEl) emptyEl.hidden = convs.length > 0;
    for (var i = 0; i < convs.length; i++) {
      listEl.appendChild(
        renderConvListItem(convs[i], activeConvId === Number(convs[i].id))
      );
    }
    return convs;
  }

  function renderMessageBubble(m) {
    var mine =
      myUserId != null && Number(m.sender_user_id) === myUserId;
    var div = document.createElement("div");
    div.className =
      "messages-bubble" + (mine ? " messages-bubble--mine" : "");
    var p = document.createElement("p");
    p.className = "messages-bubble__body";
    p.textContent = m.body || "";
    p.style.whiteSpace = "pre-wrap";
    div.appendChild(p);
    var t = document.createElement("time");
    t.className = "messages-bubble__time";
    t.setAttribute("datetime", m.created_at || "");
    t.textContent = m.created_at || "";
    div.appendChild(t);
    return div;
  }

  async function loadMessages(convId) {
    var wrap = document.getElementById("messages-bubble-wrap");
    if (!wrap) return;
    wrap.innerHTML = "";
    var msgResult = await window.synodosAuth.apiFetch(
      "/api/conversations/" +
        encodeURIComponent(String(convId)) +
        "/messages?limit=80",
      {}
    );
    if (!msgResult) {
      return;
    }
    var res = msgResult.res;
    var data = msgResult.data;
    if (!res.ok) {
      showMsg(data.error || "Could not load messages", true);
      return;
    }
    var messages = data.messages || [];
    for (var i = messages.length - 1; i >= 0; i--) {
      wrap.appendChild(renderMessageBubble(messages[i]));
    }
    wrap.scrollTop = wrap.scrollHeight;
  }

  async function selectConversation(convId) {
    activeConvId = convId;
    setUrlConv(convId);
    var header = document.getElementById("messages-thread-header");
    var peerLink = document.getElementById("messages-thread-peer-link");
    var form = document.getElementById("messages-send-form");
    var placeholder = document.getElementById("messages-thread-placeholder");
    var convs = await loadConversations();
    var meta = null;
    for (var i = 0; i < convs.length; i++) {
      if (Number(convs[i].id) === Number(convId)) {
        meta = convs[i];
        break;
      }
    }
    if (header) header.hidden = false;
    if (placeholder) placeholder.hidden = true;
    if (form) form.hidden = false;
    if (peerLink && meta && meta.other_user) {
      var un = meta.other_user.username
        ? String(meta.other_user.username).trim()
        : "";
      peerLink.textContent = meta.other_user.public_display_label || un || "Peer";
      peerLink.href = un ? "user.html?u=" + encodeURIComponent(un) : "#";
    } else if (peerLink) {
      peerLink.textContent = "Conversation";
      peerLink.href = "#";
    }
    await loadMessages(convId);
    showMsg("", false);
  }

  async function init() {
    token =
      window.synodosAuth &&
      window.synodosAuth.getToken &&
      window.synodosAuth.getToken();
    if (!token) {
      window.location.href = "login.html";
      return;
    }
    var ok = await loadMe();
    if (!ok) return;

    var form = document.getElementById("messages-send-form");
    if (form) {
      form.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        if (!activeConvId) return;
        var ta = document.getElementById("messages-body");
        var body = ta ? String(ta.value || "").trim() : "";
        if (!body) return;
        showMsg("", false);
        var sendResult = await window.synodosAuth.apiFetch(
          "/api/conversations/" +
            encodeURIComponent(String(activeConvId)) +
            "/messages",
          {
            method: "POST",
            headers: window.synodosAuth.authHeaders({ json: true }),
            body: JSON.stringify({ body: body }),
          }
        );
        if (!sendResult) {
          return;
        }
        var res = sendResult.res;
        var data = sendResult.data;
        if (!res.ok) {
          showMsg(data.error || "Could not send", true);
          return;
        }
        if (ta) ta.value = "";
        await loadMessages(activeConvId);
        await loadConversations();
      });
    }

    await loadConversations();
    var fromQ = parseConvIdFromQuery();
    if (fromQ) {
      await selectConversation(fromQ);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
