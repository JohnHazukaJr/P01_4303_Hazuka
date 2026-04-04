/**
 * Synodos — client scripts (entry point).
 */

(function () {
  const API_BASE = "http://localhost:8080";

  const loginForm = document.getElementById("login-form");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const fd = new FormData(loginForm);
    const email = (fd.get("email") || "").toString().trim();
    const password = (fd.get("password") || "").toString();

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        const msg = data.error || res.statusText || "Sign-in failed";
        window.alert(msg);
        return;
      }
      if (typeof console !== "undefined" && console.info) {
        console.info("Signed in:", data);
      }
      window.alert(data.message || "Signed in.");
    } catch (err) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("Backend not reachable. Start the Node server (see server/README.md).", err);
      }
      window.alert(
        "Could not reach the server. In the server folder run: npm install && npm start"
      );
    }
  });
})();
