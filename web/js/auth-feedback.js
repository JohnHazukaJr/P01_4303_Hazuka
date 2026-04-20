/** Full-screen success toast before redirect (register / login). Load after auth.js. */
(function (global) {
  var DEFAULT_HOLD_MS = 1500;
  var DEFAULT_FADE_MS = 320;

  /**
   * @param {string} message
   * @param {{ holdMs?: number, fadeMs?: number }} [opts]
   * @returns {Promise<void>}
   */
  function showAuthSuccess(message, opts) {
    opts = opts || {};
    var holdMs =
      typeof opts.holdMs === "number" ? opts.holdMs : DEFAULT_HOLD_MS;
    var fadeMs =
      typeof opts.fadeMs === "number" ? opts.fadeMs : DEFAULT_FADE_MS;

    return new Promise(function (resolve) {
      var root = document.createElement("div");
      root.className = "auth-feedback";
      root.setAttribute("role", "status");
      root.setAttribute("aria-live", "polite");

      var panel = document.createElement("div");
      panel.className = "auth-feedback__panel";

      var iconWrap = document.createElement("div");
      iconWrap.className = "auth-feedback__icon";
      iconWrap.setAttribute("aria-hidden", "true");
      iconWrap.innerHTML =
        '<svg class="auth-feedback__check-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" fill="none" aria-hidden="true"><circle class="auth-feedback__check-ring" cx="26" cy="26" r="24" stroke="currentColor" stroke-width="2"/><path class="auth-feedback__check-mark" d="M15 27l8 8 14-16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      var text = document.createElement("p");
      text.className = "auth-feedback__message";
      text.textContent = message;

      panel.appendChild(iconWrap);
      panel.appendChild(text);
      root.appendChild(panel);
      document.body.appendChild(root);

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          root.classList.add("auth-feedback--visible");
        });
      });

      setTimeout(function () {
        root.classList.remove("auth-feedback--visible");
        setTimeout(function () {
          root.remove();
          resolve();
        }, fadeMs);
      }, holdMs);
    });
  }

  global.synodosShowAuthSuccess = showAuthSuccess;
})(typeof window !== "undefined" ? window : this);
