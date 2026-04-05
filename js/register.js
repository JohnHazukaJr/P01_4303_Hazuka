/**
 * Synodos — registration page.
 */
(function () {
  var API_BASE = window.synodosAuth.apiBase;

  var form = document.getElementById("register-form");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    var email = (fd.get("email") || "").toString().trim();
    var password = (fd.get("password") || "").toString();

    try {
      var res = await fetch(API_BASE + "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password }),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        window.alert(data.error || res.statusText || "Registration failed");
        return;
      }
      if (data.token) {
        window.synodosAuth.setToken(data.token);
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
