/** Collapsible primary nav below 48rem; full row above. Requires theme-init.js (sets html.js). */
(function () {
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;

  var mq = window.matchMedia("(min-width: 48rem)");

  function isDesktop() {
    return mq.matches;
  }

  function setOpen(open) {
    if (isDesktop()) {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Menu");
      nav.removeAttribute("aria-hidden");
      return;
    }
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    nav.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function sync() {
    if (isDesktop()) {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Menu");
      nav.removeAttribute("aria-hidden");
    } else {
      var open = nav.classList.contains("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      nav.setAttribute("aria-hidden", open ? "false" : "true");
    }
  }

  toggle.addEventListener("click", function () {
    if (isDesktop()) return;
    setOpen(!nav.classList.contains("is-open"));
  });

  document.addEventListener("click", function (e) {
    if (isDesktop() || !nav.classList.contains("is-open")) return;
    var t = e.target;
    if (nav.contains(t) || toggle.contains(t)) return;
    setOpen(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setOpen(false);
  });

  nav.addEventListener("click", function (e) {
    if (isDesktop()) return;
    if (e.target.closest("a[href]")) setOpen(false);
    var b = e.target.closest("button");
    if (b && !b.hasAttribute("data-theme-toggle") && b.getAttribute("type") === "button") {
      setOpen(false);
    }
  });

  function onMqChange() {
    setOpen(false);
    sync();
  }
  if (mq.addEventListener) {
    mq.addEventListener("change", onMqChange);
  } else if (mq.addListener) {
    mq.addListener(onMqChange);
  }

  sync();
})();
