/**
 * Light / dark theme: prefers stored choice, else system. Cobalt + gold palette unchanged for primary UI.
 */
(function () {
  var KEY = "synodos_theme";

  function getStored() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function effectiveIsDark() {
    var s = getStored();
    if (s === "light") return false;
    if (s === "dark") return true;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function updateToggles() {
    var dark = effectiveIsDark();
    document.querySelectorAll("[data-theme-toggle]").forEach(function (el) {
      el.setAttribute("aria-pressed", dark ? "true" : "false");
      el.setAttribute(
        "aria-label",
        dark ? "Switch to light mode" : "Switch to dark mode"
      );
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
    if (getStored() === null) apply();
  }
  if (mq.addEventListener) {
    mq.addEventListener("change", onSchemeChange);
  } else if (mq.addListener) {
    mq.addListener(onSchemeChange);
  }

  document.querySelectorAll("[data-theme-toggle]").forEach(function (el) {
    el.addEventListener("click", function () {
      setStored(effectiveIsDark() ? "light" : "dark");
    });
  });
})();
