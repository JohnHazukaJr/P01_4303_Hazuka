/**
 * Runtime config for the static frontend.
 * Sets window.SYNODOS_API_BASE before auth.js initializes.
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.SYNODOS_API_BASE && String(window.SYNODOS_API_BASE).trim()) return;

  // Optional per-browser override (handy for testing).
  try {
    var override = localStorage.getItem("synodos_api_base");
    if (override && String(override).trim()) {
      window.SYNODOS_API_BASE = String(override).trim();
      return;
    }
  } catch (_) {}

  // Convention: Render static site named synodos-web, API named synodos-api.
  // Example:
  //   https://synodos-web.onrender.com  -> https://synodos-api.onrender.com
  try {
    var host = window.location && window.location.hostname ? String(window.location.hostname) : "";
    if (host.toLowerCase().startsWith("synodos-web")) {
      window.SYNODOS_API_BASE = window.location.origin.replace("synodos-web", "synodos-api");
    }
  } catch (_) {}
})();

