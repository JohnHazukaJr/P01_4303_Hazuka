/**
 * Shared client auth: JWT in localStorage + API base URL.
 */
(function (global) {
  var TOKEN_KEY = "synodos_token";
  var win = typeof window !== "undefined" ? window : null;
  var apiFromWindow =
    win &&
    win.SYNODOS_API_BASE &&
    String(win.SYNODOS_API_BASE).trim();

  global.synodosAuth = {
    /** Set window.SYNODOS_API_BASE before loading this script when the API is not on localhost:8080. */
    apiBase: apiFromWindow || "http://localhost:8080",
    getToken: function () {
      try {
        return localStorage.getItem(TOKEN_KEY);
      } catch (e) {
        return null;
      }
    },
    setToken: function (token) {
      try {
        localStorage.setItem(TOKEN_KEY, token);
      } catch (e) {
        /* ignore */
      }
    },
    clearToken: function () {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch (e) {
        /* ignore */
      }
    },
  };
})(typeof window !== "undefined" ? window : this);
