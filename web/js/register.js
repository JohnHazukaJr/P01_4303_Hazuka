/** Registration form. Requires auth.js before this script. */
(function () {
  if (!window.synodosAuth) {
    if (typeof console !== "undefined" && console.error) {
      console.error(
        "synodosAuth not found. Load js/auth.js before js/register.js."
      );
    }
    return;
  }

  var API_BASE = window.synodosAuth.apiBase;

  var form = document.getElementById("register-form");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    var username = (fd.get("username") || "").toString().trim();
    var email = (fd.get("email") || "").toString().trim();
    var password = (fd.get("password") || "").toString();

    try {
      var res = await fetch(API_BASE + "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username,
          email: email,
          password: password,
        }),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        window.alert(
          "Could not create account. " +
            (data.error || res.statusText || "Try again.")
        );
        return;
      }
      if (data.token) {
        window.synodosAuth.setToken(data.token);
      }
      var prefetchMe =
        data.token && typeof window.synodosAuth.apiFetch === "function"
          ? window.synodosAuth.apiFetch("/api/me", {}).then(function (r) {
              if (r && r.res.ok && r.data && r.data.user) {
                window.synodosAuth.setCachedMe(r.data.user);
              }
            })
          : Promise.resolve();
      if (typeof window.synodosShowAuthSuccess === "function") {
        await window.synodosShowAuthSuccess(
          "Account created — welcome to synodos.",
          { holdMs: 1650, fadeMs: 320 }
        );
      }
      await prefetchMe;
      window.location.replace("profile-setup.html");
    } catch (err) {
      window.alert("Could not reach the server. Please try again.");
    }
  });
})();
