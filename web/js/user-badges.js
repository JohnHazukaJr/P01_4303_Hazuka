/**
 * Verified + Official account pills (shared UI).
 * Requires css/style.css (.verified-badge, .official-badge).
 */
(function (global) {
  function truthy(v) {
    return v === true || v === 1 || v === "1";
  }

  function isVerified(u) {
    return truthy(u && u.verified);
  }

  function isOfficial(u) {
    return truthy(u && u.official_account);
  }

  function makeVerifiedBadge() {
    var bv = document.createElement("span");
    bv.className = "verified-badge";
    bv.textContent = "Verified";
    bv.setAttribute("aria-label", "Identity verified");
    bv.title = "Identity verified";
    return bv;
  }

  function makeOfficialBadge() {
    var bo = document.createElement("span");
    bo.className = "official-badge";
    bo.textContent = "Official";
    bo.setAttribute("aria-label", "Official account");
    bo.title =
      "Official account — platform or notable organization on synodos";
    return bo;
  }

  /**
   * Fill a dedicated host element (replaces its contents) with 0–1 badges.
   * Official accounts show only Official (not Verified — verified is for consumer accounts).
   * @param {HTMLElement|null} host
   * @param {{ verified?: boolean, official_account?: boolean }|null} user
   */
  function renderBadgesOnly(host, user) {
    if (!host) return;
    host.innerHTML = "";
    if (!user) return;
    var inner = document.createElement("span");
    inner.className = "user-badges-inline";
    inner.setAttribute("data-synodos-user-badges", "1");
    if (isOfficial(user)) {
      inner.appendChild(makeOfficialBadge());
    } else if (isVerified(user)) {
      inner.appendChild(makeVerifiedBadge());
    }
    if (inner.childNodes.length) {
      host.appendChild(inner);
    }
  }

  /**
   * Remove prior badge groups from parent and append a new group after existing title content.
   * Use when the parent also holds a text label (e.g. h1).
   */
  function appendToTitle(parent, user) {
    if (!parent) return;
    var old = parent.querySelectorAll('[data-synodos-user-badges="1"]');
    for (var i = 0; i < old.length; i++) {
      old[i].remove();
    }
    if (!user || (!isVerified(user) && !isOfficial(user))) return;
    var inner = document.createElement("span");
    inner.className = "user-badges-inline";
    inner.setAttribute("data-synodos-user-badges", "1");
    if (isOfficial(user)) {
      inner.appendChild(makeOfficialBadge());
    } else if (isVerified(user)) {
      inner.appendChild(makeVerifiedBadge());
    }
    parent.appendChild(document.createTextNode(" "));
    parent.appendChild(inner);
  }

  global.synodosUserBadges = {
    renderBadgesOnly: renderBadgesOnly,
    appendToTitle: appendToTitle,
    isVerified: isVerified,
    isOfficial: isOfficial,
  };
})(typeof window !== "undefined" ? window : this);
