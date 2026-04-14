/** Theme: cycle light → dark → system (auto). Persistence + skip-link focus. Requires theme-init.js in <head>. */
(function () {
  var KEY = "synodos_theme";

  function getStored() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  /** Resolved mode: "light" | "dark" | "auto" (includes unset legacy). */
  function getMode() {
    var s = getStored();
    if (s === "light" || s === "dark" || s === "auto") return s;
    return "auto";
  }

  function effectiveIsDark() {
    var s = getMode();
    if (s === "light") return false;
    if (s === "dark") return true;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function nextMode() {
    var m = getMode();
    if (m === "light") return "dark";
    if (m === "dark") return "auto";
    return "light";
  }

  function toggleAriaLabel(mode, darkNow) {
    if (mode === "light") {
      return "Theme: light. Activate for dark mode.";
    }
    if (mode === "dark") {
      return "Theme: dark. Activate to match system appearance.";
    }
    return (
      "Theme: system (" +
      (darkNow ? "dark" : "light") +
      "). Activate for light mode."
    );
  }

  function updateToggles() {
    var dark = effectiveIsDark();
    var mode = getMode();
    document.querySelectorAll("[data-theme-toggle]").forEach(function (el) {
      el.setAttribute("aria-pressed", dark ? "true" : "false");
      el.setAttribute("aria-label", toggleAriaLabel(mode, dark));
      el.setAttribute("title", "Cycles: light → dark → system");
    });
  }

  function apply() {
    document.documentElement.setAttribute(
      "data-theme",
      effectiveIsDark() ? "dark" : "light"
    );
    updateToggles();
  }

  function setStored(mode) {
    try {
      localStorage.setItem(KEY, mode);
    } catch (e) {
      /* ignore */
    }
    apply();
  }

  apply();

  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  function onSchemeChange() {
    if (getMode() === "auto") apply();
  }
  if (mq.addEventListener) {
    mq.addEventListener("change", onSchemeChange);
  } else if (mq.addListener) {
    mq.addListener(onSchemeChange);
  }

  document.querySelectorAll("[data-theme-toggle]").forEach(function (el) {
    el.addEventListener("click", function () {
      setStored(nextMode());
    });
  });
})();

(function () {
  var skip = document.querySelector(".skip-link");
  var mainEl = document.getElementById("main-content");
  if (!skip || !mainEl) return;
  skip.addEventListener("click", function () {
    window.setTimeout(function () {
      mainEl.focus();
    }, 0);
  });
})();
