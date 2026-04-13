/** JWT in localStorage and API base URL (`synodosAuth`). */
(function (global) {
  var TOKEN_KEY = "synodos_token";
  var win = typeof window !== "undefined" ? window : null;
  var apiFromWindow =
    win &&
    win.SYNODOS_API_BASE &&
    String(win.SYNODOS_API_BASE).trim();

  global.synodosAuth = {
    apiBase: apiFromWindow || "http://localhost:8080", // set window.SYNODOS_API_BASE if API is not localhost:8080
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
