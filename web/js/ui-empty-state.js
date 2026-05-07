/**
 * Tiny shared helpers for empty states + skeleton placeholders.
 * Exposes window.synodosUi with these methods:
 *   - showEmpty(el, text)  — set text, unhide
 *   - hideEmpty(el)        — hide
 *   - showError(el, text)  — set text, mark as error, unhide
 *   - skeletonCards(root, count) — render N skeleton card placeholders
 *   - skeletonLines(root, count) — render N skeleton line placeholders
 *   - clearSkeleton(root)   — remove placeholder children (but only ones we made)
 *
 * No external deps; safe to load on any page after auth.js.
 */
(function (global) {
  function setText(el, text) {
    if (!el) return;
    el.textContent = text == null ? "" : String(text);
  }

  function showEmpty(el, text) {
    if (!el) return;
    setText(el, text);
    el.hidden = !text;
    el.className = (el.className || "")
      .split(/\s+/)
      .filter(function (c) {
        return c && c !== "dashboard-msg--error";
      })
      .join(" ");
    if (!el.classList.contains("dashboard-empty")) {
      el.classList.add("dashboard-empty");
    }
  }

  function hideEmpty(el) {
    if (!el) return;
    el.hidden = true;
  }

  function showError(el, text) {
    if (!el) return;
    setText(el, text);
    el.hidden = !text;
    if (!el.classList.contains("dashboard-msg")) {
      el.classList.add("dashboard-msg");
    }
    el.classList.add("dashboard-msg--error");
  }

  function makeSkeleton(className) {
    var d = document.createElement("div");
    d.className = "skeleton " + className;
    d.setAttribute("data-synodos-skeleton", "1");
    d.setAttribute("aria-hidden", "true");
    return d;
  }

  function skeletonCards(root, count) {
    if (!root) return;
    clearSkeleton(root);
    var n = Math.max(1, Math.floor(Number(count) || 3));
    for (var i = 0; i < n; i++) {
      root.appendChild(makeSkeleton("skeleton--card"));
    }
  }

  function skeletonLines(root, count) {
    if (!root) return;
    clearSkeleton(root);
    var n = Math.max(1, Math.floor(Number(count) || 3));
    for (var i = 0; i < n; i++) {
      var c = "skeleton--line";
      if (i === n - 1) c += " skeleton--medium";
      root.appendChild(makeSkeleton(c));
    }
  }

  function clearSkeleton(root) {
    if (!root) return;
    var nodes = root.querySelectorAll('[data-synodos-skeleton="1"]');
    for (var i = nodes.length - 1; i >= 0; i--) {
      nodes[i].parentNode && nodes[i].parentNode.removeChild(nodes[i]);
    }
  }

  global.synodosUi = {
    showEmpty: showEmpty,
    hideEmpty: hideEmpty,
    showError: showError,
    skeletonCards: skeletonCards,
    skeletonLines: skeletonLines,
    clearSkeleton: clearSkeleton,
  };
})(typeof window !== "undefined" ? window : this);
