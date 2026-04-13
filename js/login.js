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

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
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
        window.alert(data.error || res.statusText || "Sign-in failed");
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
      window.alert(
        "Could not reach the server. In the server folder run: npm install && npm start"
      );
    }
  });
})();
