/**
 * Apply theme before first paint (load in <head>, no defer). theme.js handles toggles and persistence.
 */
(function () {
  try {
    var key = "synodos_theme";
    var stored = localStorage.getItem(key);
    var dark;
    if (stored === "dark") dark = true;
    else if (stored === "light") dark = false;
    else {
      /* "auto", unset, or legacy: follow system */
      dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  } catch (e) {
    /* ignore */
  }
  document.documentElement.classList.add("js");
})();
