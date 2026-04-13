/**
 * Apply theme before first paint (load in <head>, no defer). theme.js handles toggles and persistence.
 */
(function () {
  try {
    var key = "synodos_theme";
    var stored = localStorage.getItem(key);
    var dark =
      stored === "dark" ||
      (stored !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  } catch (e) {
    /* ignore */
  }
})();
