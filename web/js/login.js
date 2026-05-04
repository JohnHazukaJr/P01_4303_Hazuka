/** Sign-in form. Requires auth.js before this script. */
(function () {
  if (!window.synodosAuth) {
    if (typeof console !== "undefined" && console.error) {
      console.error(
        "synodosAuth not found. Load js/auth.js before js/login.js."
      );
    }
    return;
  }

  var API_BASE = window.synodosAuth.apiBase;

  var loginForm = document.getElementById("login-form");
  if (!loginForm) return;
  var msgEl = document.getElementById("login-msg");

  function showMsg(text, isError) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.hidden = !text;
    msgEl.className =
      "dashboard-msg" + (isError ? " dashboard-msg--error" : "");
  }

  (function showIdleLogoutReasonOnce() {
    var reason =
      window.synodosAuth && window.synodosAuth.getSignOutReason
        ? window.synodosAuth.getSignOutReason()
        : null;
    if (reason === "inactive") {
      showMsg("Signed out after 10 minutes of inactivity.", true);
    }
    if (window.synodosAuth && window.synodosAuth.clearSignOutReason) {
      window.synodosAuth.clearSignOutReason();
    }
  })();

  var passwordInput = document.getElementById("password");
  function clearErrorMsg() {
    if (msgEl && msgEl.classList.contains("dashboard-msg--error")) {
      showMsg("", false);
    }
  }
  if (passwordInput) {
    passwordInput.addEventListener("focus", clearErrorMsg);
    passwordInput.addEventListener("click", clearErrorMsg);
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    showMsg("", false);
    var fd = new FormData(loginForm);
    var identifier = (fd.get("identifier") || "").toString().trim();
    var password = (fd.get("password") || "").toString();

    try {
      // #region agent log
      fetch(
        "http://127.0.0.1:7727/ingest/2e0e05ed-2293-4597-b6c6-1abe56458da5",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "374fbb",
          },
          body: JSON.stringify({
            sessionId: "374fbb",
            hypothesisId: "H1",
            location: "web/js/login.js:submit",
            message: "login_fetch_start",
            data: {
              apiBaseLen: String(API_BASE || "").length,
              apiBaseHost: (function () {
                try {
                  return new URL(String(API_BASE)).hostname;
                } catch (e) {
                  return "parse_fail";
                }
              })(),
              idLen: identifier.length,
            },
            timestamp: Date.now(),
          }),
        }
      ).catch(function () {});
      // #endregion
      var res = await fetch(API_BASE + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier,
          password: password,
        }),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      // #region agent log
      fetch(
        "http://127.0.0.1:7727/ingest/2e0e05ed-2293-4597-b6c6-1abe56458da5",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "374fbb",
          },
          body: JSON.stringify({
            sessionId: "374fbb",
            hypothesisId: "H2",
            location: "web/js/login.js:submit",
            message: "login_fetch_response",
            data: {
              httpStatus: res.status,
              ok: res.ok,
              errKey: data && data.error ? String(data.error).slice(0, 80) : "",
            },
            timestamp: Date.now(),
          }),
        }
      ).catch(function () {});
      // #endregion
      if (!res.ok) {
        var err = data.error || res.statusText || "Sign-in failed";
        if (res.status === 401) {
          var pw = document.getElementById("password");
          if (pw) {
            pw.value = "";
          }
        }
        showMsg(err, true);
        return;
      }
      if (data.token) {
        window.synodosAuth.setToken(data.token);
      }
      if (typeof window.synodosShowAuthSuccess === "function") {
        await window.synodosShowAuthSuccess("Signed in — welcome back.", {
          holdMs: 1450,
          fadeMs: 320,
        });
      }
      window.location.href = "dashboard.html";
    } catch (err) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7727/ingest/2e0e05ed-2293-4597-b6c6-1abe56458da5",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "374fbb",
          },
          body: JSON.stringify({
            sessionId: "374fbb",
            hypothesisId: "H2",
            location: "web/js/login.js:submit",
            message: "login_fetch_network_error",
            data: {
              errName: err && err.name,
              errMsg: err && err.message ? String(err.message).slice(0, 120) : "",
            },
            timestamp: Date.now(),
          }),
        }
      ).catch(function () {});
      // #endregion
      if (typeof console !== "undefined" && console.warn) {
        console.warn("Backend not reachable.", err);
      }
      showMsg("Could not reach the server. Please try again.", true);
    }
  });
})();
