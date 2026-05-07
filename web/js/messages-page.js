/** DM inbox. Requires auth.js. */
(function () {
  var token = null;
  var myUserId = null;
  var activeConvId = null;
  var threadNewestId = null;
  var olderCursor = null;
  var pollTimer = null;
  var messageIdsInThread = null;
  var loadingOlder = false;

  var PAGE_LIMIT = 80;
  var POLL_MS = 12000;

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

  function clearPoll() {
    if (pollTimer != null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startPoll() {
    clearPoll();
    if (!activeConvId) return;
    pollTimer = setInterval(pollNewMessages, POLL_MS);
  }

  function formatMessageDisplayTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);

    var now = Date.now();
    var diffMs = now - d.getTime();
    if (diffMs < 0) diffMs = 0;
    var sec = Math.floor(diffMs / 1000);
    if (sec < 60) return "Just now";
    var min = Math.floor(sec / 60);
    if (min < 60) return min + "m ago";
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + "h ago";
    var opt = {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    };
    if (d.getFullYear() !== new Date().getFullYear()) {
      opt.year = "numeric";
    }
    return d.toLocaleString(undefined, opt);
  }

  function adjustTextareaHeight(ta) {
    if (!ta) return;
    ta.style.height = "auto";
    var maxPx = 200;
    var next = Math.min(ta.scrollHeight, maxPx);
    ta.style.height = next + "px";
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
    div.setAttribute("data-message-id", String(m.id));
    var p = document.createElement("p");
    p.className = "messages-bubble__body";
    p.textContent = m.body || "";
    p.style.whiteSpace = "pre-wrap";
    div.appendChild(p);
    var t = document.createElement("time");
    t.className = "messages-bubble__time";
    var iso = m.created_at || "";
    t.setAttribute("datetime", iso);
    t.setAttribute("title", iso ? String(iso) : "");
    t.textContent = formatMessageDisplayTime(iso);
    div.appendChild(t);
    return div;
  }

  function updateLoadOlderUi() {
    var wrap = document.getElementById("messages-load-older-wrap");
    var btn = document.getElementById("messages-load-older");
    if (!wrap || !btn) return;
    var show = activeConvId != null && olderCursor != null;
    wrap.hidden = !show;
    btn.disabled = loadingOlder;
  }

  function ingestMessagesArray(messages, mode) {
    var wrap = document.getElementById("messages-bubble-wrap");
    if (!wrap || !messageIdsInThread) return;

    if (mode === "replace") {
      wrap.innerHTML = "";
      messageIdsInThread = new Set();
      threadNewestId = null;
      return;
    }

    var list = messages || [];

    if (mode === "prepend") {
      var prevH = wrap.scrollHeight;
      var prevTop = wrap.scrollTop;
      for (var i = list.length - 1; i >= 0; i--) {
        var pm = list[i];
        var pid = Number(pm.id);
        if (messageIdsInThread.has(pid)) continue;
        messageIdsInThread.add(pid);
        wrap.insertBefore(renderMessageBubble(pm), wrap.firstChild);
      }
      wrap.scrollTop = prevTop + (wrap.scrollHeight - prevH);
      updateLoadOlderUi();
      return;
    }

    var maxSeen =
      threadNewestId != null ? Number(threadNewestId) : null;

    if (mode === "append") {
      for (var j = 0; j < list.length; j++) {
        var am = list[j];
        var aid = Number(am.id);
        if (messageIdsInThread.has(aid)) continue;
        messageIdsInThread.add(aid);
        wrap.appendChild(renderMessageBubble(am));
        if (maxSeen == null || aid > maxSeen) maxSeen = aid;
      }
      threadNewestId = maxSeen;
      wrap.scrollTop = wrap.scrollHeight;
      updateLoadOlderUi();
      return;
    }

    if (mode === "chronological") {
      for (var k = list.length - 1; k >= 0; k--) {
        var rm = list[k];
        var rid = Number(rm.id);
        if (messageIdsInThread.has(rid)) continue;
        messageIdsInThread.add(rid);
        wrap.appendChild(renderMessageBubble(rm));
        if (maxSeen == null || rid > maxSeen) maxSeen = rid;
      }
      threadNewestId = maxSeen;
      wrap.scrollTop = wrap.scrollHeight;
      updateLoadOlderUi();
    }
  }

  async function fetchMessagesPage(convId, cursor) {
    var q =
      "/api/conversations/" +
      encodeURIComponent(String(convId)) +
      "/messages?limit=" +
      encodeURIComponent(String(PAGE_LIMIT));
    if (cursor != null) {
      q += "&cursor=" + encodeURIComponent(String(cursor));
    }
    var msgResult = await window.synodosAuth.apiFetch(q, {});
    if (!msgResult) {
      return null;
    }
    return msgResult;
  }

  async function loadMessagesInitial(convId) {
    var wrap = document.getElementById("messages-bubble-wrap");
    if (!wrap) return;
    ingestMessagesArray([], "replace");

    var msgResult = await fetchMessagesPage(convId, null);
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
    olderCursor = data.next_cursor != null ? Number(data.next_cursor) : null;

    ingestMessagesArray(messages, "chronological");
  }

  async function loadOlderMessages() {
    if (!activeConvId || olderCursor == null || loadingOlder) return;
    loadingOlder = true;
    updateLoadOlderUi();
    var msgResult = await fetchMessagesPage(activeConvId, olderCursor);
    loadingOlder = false;
    updateLoadOlderUi();
    if (!msgResult) {
      return;
    }
    var res = msgResult.res;
    var data = msgResult.data;
    if (!res.ok) {
      showMsg(data.error || "Could not load older messages", true);
      return;
    }
    var messages = data.messages || [];
    olderCursor = data.next_cursor != null ? Number(data.next_cursor) : null;
    ingestMessagesArray(messages, "prepend");
  }

  async function pollNewMessages() {
    if (!activeConvId || document.visibilityState === "hidden") return;
    var msgResult = await fetchMessagesPage(activeConvId, null);
    if (!msgResult || !msgResult.res.ok) return;
    var data = msgResult.data;
    var list = data.messages || [];
    if (threadNewestId == null) return;
    var newest = Number(threadNewestId);
    var toAdd = [];
    for (var i = 0; i < list.length; i++) {
      if (Number(list[i].id) > newest) {
        toAdd.push(list[i]);
      }
    }
    toAdd.sort(function (a, b) {
      return Number(a.id) - Number(b.id);
    });
    if (toAdd.length) {
      ingestMessagesArray(toAdd, "append");
    }
  }

  async function selectConversation(convId) {
    clearPoll();
    activeConvId = convId;
    messageIdsInThread = new Set();
    threadNewestId = null;
    olderCursor = null;
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
    await loadMessagesInitial(convId);
    showMsg("", false);
    startPoll();
  }

  function wireComposer() {
    var form = document.getElementById("messages-send-form");
    var ta = document.getElementById("messages-body");
    if (ta) {
      ta.addEventListener("input", function () {
        adjustTextareaHeight(ta);
      });
      ta.addEventListener("keydown", function (ev) {
        if (ev.key !== "Enter") return;
        if (ev.shiftKey) return;
        ev.preventDefault();
        if (form) {
          if (typeof form.requestSubmit === "function") {
            form.requestSubmit();
          } else {
            form.dispatchEvent(
              new Event("submit", { cancelable: true, bubbles: true })
            );
          }
        }
      });
    }
  }

  function showSkeletons() {
    if (!window.synodosUi) return;
    var convList = document.getElementById("messages-conv-list");
    var convEmpty = document.getElementById("messages-conv-empty");
    if (convList) window.synodosUi.skeletonLines(convList, 4);
    if (convEmpty) convEmpty.hidden = true;
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
    showSkeletons();
    var ok = await loadMe();
    if (!ok) return;

    wireComposer();

    var loadOlderBtn = document.getElementById("messages-load-older");
    if (loadOlderBtn) {
      loadOlderBtn.addEventListener("click", function () {
        loadOlderMessages();
      });
    }

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && activeConvId) {
        pollNewMessages();
      }
    });

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
        if (ta) {
          ta.value = "";
          adjustTextareaHeight(ta);
        }
        if (data.message) {
          ingestMessagesArray([data.message], "append");
        }
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
