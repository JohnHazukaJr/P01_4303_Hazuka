/** Public user profile: ?u=username. Requires auth.js. */
(function () {
  function qsUser() {
    var q = new URLSearchParams(window.location.search).get("u");
    return q != null ? String(q).trim().toLowerCase() : "";
  }

  function showMsg(el, text, isError) {
    if (!el) return;
    el.textContent = text || "";
    el.hidden = !text;
    el.className =
      "dashboard-msg" + (isError ? " dashboard-msg--error" : "");
  }

  async function openOrGetConversation(username) {
    if (!window.synodosAuth.getToken()) return null;
    var result = await window.synodosAuth.apiFetch("/api/conversations", {
      method: "POST",
      headers: window.synodosAuth.authHeaders({ json: true }),
      body: JSON.stringify({ with_username: username }),
    });
    if (!result) return null;
    var data = result.data;
    if (!result.res.ok || !data.conversation) return null;
    return data.conversation.id;
  }

  async function init() {
    var uname = qsUser();
    var msgEl = document.getElementById("user-page-msg");
    var loadingEl = document.getElementById("user-page-loading");
    var root = document.getElementById("user-page-root");
    var back = document.getElementById("user-page-back");
    var titleEl = document.getElementById("user-page-title");
    var usernameEl = document.getElementById("user-page-username");
    var bioEl = document.getElementById("user-page-bio");
    var tagsEl = document.getElementById("user-page-tags");
    var actions = document.getElementById("user-page-actions");
    var btnFollow = document.getElementById("user-page-follow-btn");
    var btnUnfollow = document.getElementById("user-page-unfollow-btn");
    var btnEdit = document.getElementById("user-page-edit-link");
    var btnMsg = document.getElementById("user-page-message-btn");
    var hint = document.getElementById("user-page-login-hint");

    if (!uname) {
      if (loadingEl) loadingEl.hidden = true;
      showMsg(msgEl, "No user specified. Add ?u=username to the URL.", true);
      return;
    }

    var avatarImg = document.getElementById("user-page-avatar-img");
    if (avatarImg) {
      window.synodosAuth.primeUserAvatar(avatarImg, null, {
        username: uname,
      });
    }

    var meId = null;
    var existingToken =
      window.synodosAuth &&
      window.synodosAuth.getToken &&
      window.synodosAuth.getToken();
    if (existingToken) {
      var cachedMe = window.synodosAuth.getCachedMe();
      if (cachedMe && cachedMe.id != null) {
        meId = Number(cachedMe.id);
      }
      var meResult = await window.synodosAuth.apiFetch("/api/me", {
        skipUnauthorized: true,
      });
      if (meResult && meResult.res.ok && meResult.data.user) {
        window.synodosAuth.setCachedMe(meResult.data.user);
        meId = Number(meResult.data.user.id);
      }
    }
    if (back) {
      back.setAttribute("href", meId ? "home.html" : "index.html");
      back.textContent = meId ? "← Back to home" : "← Back to marketing site";
    }

    var profResult = await window.synodosAuth.apiFetch(
      "/api/users/" + encodeURIComponent(uname),
      {}
    );
    if (!profResult) {
      return;
    }
    var res = profResult.res;
    var data = profResult.data;
    if (loadingEl) loadingEl.hidden = true;
    if (!res.ok) {
      showMsg(msgEl, data.error || "Profile not found.", true);
      return;
    }
    var user = data.user;
    if (!user) {
      showMsg(msgEl, "Profile not found.", true);
      return;
    }
    if (root) root.hidden = false;

    if (titleEl) {
      var label = user.public_display_label || user.username || "—";
      titleEl.textContent = label;
      if (window.synodosUserBadges && typeof window.synodosUserBadges.appendToTitle === "function") {
        window.synodosUserBadges.appendToTitle(titleEl, user);
      }
    }
    if (usernameEl) {
      usernameEl.textContent = user.username ? "@" + user.username : "";
    }
    if (bioEl) {
      bioEl.textContent = user.bio || "";
      bioEl.style.whiteSpace = "pre-wrap";
    }
    if (tagsEl) {
      tagsEl.innerHTML = "";
      var tags = user.work_tags || [];
      if (tags.length === 0) {
        var li = document.createElement("li");
        li.className = "user-public-tags__empty";
        li.textContent = "No work tags listed yet.";
        tagsEl.appendChild(li);
      } else {
        for (var i = 0; i < tags.length; i++) {
          var t = tags[i];
          var item = document.createElement("li");
          item.className = "work-tag-pill";
          item.textContent =
            (t.label || t.work_field || "") +
            (t.sub_label || t.work_subfield
              ? " · " + (t.sub_label || t.work_subfield)
              : "");
          tagsEl.appendChild(item);
        }
      }
    }

    if (avatarImg) {
      window.synodosAuth.applyUserAvatar(avatarImg, null, user);
    }

    var isSelf = meId != null && Number(user.id) === meId;
    var token = window.synodosAuth.getToken();

    if (actions) actions.hidden = false;
    if (hint) hint.hidden = true;

    if (isSelf) {
      if (btnFollow) btnFollow.hidden = true;
      if (btnUnfollow) btnUnfollow.hidden = true;
      if (btnMsg) btnMsg.hidden = true;
      if (btnEdit) btnEdit.hidden = false;
    } else if (token) {
      if (btnEdit) btnEdit.hidden = true;
      if (btnFollow) btnFollow.hidden = data.viewer_follows === true;
      if (btnUnfollow) btnUnfollow.hidden = data.viewer_follows !== true;
      if (btnMsg) btnMsg.hidden = false;

      if (btnFollow) {
        btnFollow.onclick = async function () {
          showMsg(msgEl, "", false);
          var fr = await window.synodosAuth.apiFetch(
            "/api/users/" + encodeURIComponent(user.username) + "/follow",
            {
              method: "POST",
              headers: window.synodosAuth.authHeaders({ json: true }),
            }
          );
          if (!fr) return;
          var r = fr.res;
          var d = fr.data;
          if (!r.ok) {
            showMsg(msgEl, d.error || "Could not follow.", true);
            return;
          }
          if (btnFollow) btnFollow.hidden = true;
          if (btnUnfollow) btnUnfollow.hidden = false;
        };
      }
      if (btnUnfollow) {
        btnUnfollow.onclick = async function () {
          showMsg(msgEl, "", false);
          var ufr = await window.synodosAuth.apiFetch(
            "/api/users/" + encodeURIComponent(user.username) + "/follow",
            { method: "DELETE" }
          );
          if (!ufr) return;
          var r = ufr.res;
          if (!r.ok && r.status !== 204) {
            var d = ufr.data;
            showMsg(msgEl, d.error || "Could not unfollow.", true);
            return;
          }
          if (btnFollow) btnFollow.hidden = false;
          if (btnUnfollow) btnUnfollow.hidden = true;
        };
      }
      if (btnMsg) {
        btnMsg.onclick = async function () {
          var cid = await openOrGetConversation(user.username);
          if (cid) {
            window.location.href =
              "messages.html?c=" + encodeURIComponent(String(cid));
          } else {
            showMsg(msgEl, "Could not open conversation.", true);
          }
        };
      }
    } else {
      if (btnFollow) btnFollow.hidden = true;
      if (btnUnfollow) btnUnfollow.hidden = true;
      if (btnEdit) btnEdit.hidden = true;
      if (btnMsg) btnMsg.hidden = true;
      if (hint) hint.hidden = false;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
