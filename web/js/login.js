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
  function clearWrongPasswordMsg() {
    if (msgEl && msgEl.textContent === "Incorrect password") {
      showMsg("", false);
    }
  }
  if (passwordInput) {
    passwordInput.addEventListener("focus", clearWrongPasswordMsg);
    passwordInput.addEventListener("click", clearWrongPasswordMsg);
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    showMsg("", false);
    var fd = new FormData(loginForm);
    var identifier = (fd.get("identifier") || "").toString().trim();
    var password = (fd.get("password") || "").toString();

    try {
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
      if (!res.ok) {
        var err = data.error || res.statusText || "Sign-in failed";
        if (res.status === 401) {
          err = "Incorrect password";
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
      if (typeof console !== "undefined" && console.warn) {
        console.warn("Backend not reachable.", err);
      }
      showMsg(
        "Could not reach the server. In the server folder run: npm install && npm start",
        true
      );
    }
  });
})();
