/** One-shot banner for JS/runtime failures (unexpected errors & rejections). */
(function () {
  if (typeof window === "undefined") return;

  var bannerShown = false;

  function showBannerOnce() {
    if (bannerShown) return;
    bannerShown = true;
    if (!document.body) return;

    var bar = document.createElement("div");
    bar.id = "synodos-global-error-banner";
    bar.className = "synodos-global-error-banner";
    bar.setAttribute("role", "alert");
    bar.innerHTML =
      '<p class="synodos-global-error-banner__text">Something went wrong. Please refresh the page.</p>' +
      '<button type="button" class="btn btn-ghost synodos-global-error-banner__dismiss" aria-label="Dismiss">Dismiss</button>';

    var btn = bar.querySelector(".synodos-global-error-banner__dismiss");
    if (btn) {
      btn.addEventListener("click", function () {
        bar.remove();
      });
    }

    document.body.insertBefore(bar, document.body.firstChild);
  }

  var origOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    showBannerOnce();
    if (typeof origOnError === "function") {
      try {
        return origOnError.call(this, message, source, lineno, colno, error);
      } catch (_) {}
    }
    if (typeof console !== "undefined" && console.error) {
      console.error("[synodos] window error", message, source, lineno, colno, error);
    }
    return false;
  };

  window.addEventListener("unhandledrejection", function (ev) {
    showBannerOnce();
    if (typeof console !== "undefined" && console.error) {
      console.error("[synodos] unhandledrejection", ev.reason);
    }
  });
})();
