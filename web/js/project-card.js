/**
 * Shared project list card (dashboard + home). Requires user-badges.js for owner badges.
 * @typedef {{ addRole?: function(number, Object): void, deleteRole?: function(number, number): void, deleteProject?: function(number): void }} ProjectCardHandlers
 */
(function (global) {
  function isOwner(project, userId) {
    return userId != null && Number(project.owner_user_id) === Number(userId);
  }

  function renderRoleRow(project, role, canDelete, onDeleteRole) {
    var row = document.createElement("div");
    row.className = "role-row";
    var main = document.createElement("div");
    main.className = "role-row__main";
    var t = document.createElement("strong");
    t.className = "role-row__title";
    t.textContent = role.title || "";
    main.appendChild(t);
    if (role.skills) {
      var sk = document.createElement("span");
      sk.className = "role-row__skills";
      sk.textContent = role.skills;
      main.appendChild(sk);
    }
    var slots = document.createElement("span");
    slots.className = "role-row__slots";
    slots.textContent = "Openings: " + String(role.slots != null ? role.slots : 1);
    main.appendChild(slots);
    row.appendChild(main);
    if (canDelete && typeof onDeleteRole === "function") {
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn btn-ghost role-row__remove";
      rm.setAttribute("aria-label", "Remove role");
      rm.textContent = "Remove";
      rm.addEventListener("click", function () {
        onDeleteRole(project.id, role.id);
      });
      row.appendChild(rm);
    }
    return row;
  }

  /**
   * @param {object} project - API project shape from GET /api/projects
   * @param {{ userId?: number|null, hasToken?: boolean, handlers?: ProjectCardHandlers|null }} options
   *   handlers: omit or null for read-only cards (no owner actions)
   */
  function renderProjectCard(project, options) {
    options = options || {};
    var userId = options.userId;
    var hasToken = !!options.hasToken;
    var handlers = options.handlers || null;

    var own = isOwner(project, userId);
    var card = document.createElement("article");
    card.className = "project-card" + (own ? " project-card--own" : "");
    card.setAttribute("data-project-id", String(project.id));

    var title = document.createElement("h3");
    title.className = "project-card__title";
    var titleLink = document.createElement("a");
    titleLink.className = "project-card__title-link";
    titleLink.href = "project.html?id=" + encodeURIComponent(String(project.id));
    titleLink.textContent = project.title || "Untitled";
    title.appendChild(titleLink);

    var meta = document.createElement("p");
    meta.className = "project-card__meta";
    meta.appendChild(document.createTextNode("Owner: "));
    var oun = project.owner_username ? String(project.owner_username).trim() : "";
    if (oun) {
      var oa = document.createElement("a");
      oa.href = "user.html?u=" + encodeURIComponent(oun);
      oa.className = "project-owner-link";
      oa.textContent = project.owner_display || oun;
      meta.appendChild(oa);
      if (global.synodosUserBadges) {
        var ob = document.createElement("span");
        ob.className = "project-card__owner-badges";
        meta.appendChild(ob);
        global.synodosUserBadges.renderBadgesOnly(ob, {
          verified: project.owner_verified,
          official_account: project.owner_official_account,
        });
      }
    } else {
      meta.appendChild(document.createTextNode(project.owner_display || "?"));
    }
    var feedN = Number(project.feed_match_count);
    if (hasToken && Number.isFinite(feedN) && feedN > 0) {
      var feedBadge = document.createElement("span");
      feedBadge.className = "project-card__feed-match";
      feedBadge.setAttribute(
        "title",
        "Overlaps with your field/subfield tags — ranked higher in your feed"
      );
      feedBadge.textContent =
        feedN === 1 ? "1 match with your fields" : feedN + " matches with your fields";
      meta.appendChild(document.createTextNode(" · "));
      meta.appendChild(feedBadge);
    }

    var desc = document.createElement("p");
    desc.className = "project-card__desc";
    desc.textContent = project.description || "";

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(desc);

    var rolesWrap = document.createElement("div");
    rolesWrap.className = "project-roles";
    var rh = document.createElement("h4");
    rh.className = "project-roles__heading";
    rh.textContent = "Open roles";
    rolesWrap.appendChild(rh);

    var roles = project.roles || [];
    var canManageRoles = own && handlers && typeof handlers.deleteRole === "function";
    if (roles.length === 0) {
      var empty = document.createElement("p");
      empty.className = "project-roles__empty";
      empty.textContent = "No open roles yet.";
      rolesWrap.appendChild(empty);
    } else {
      for (var r = 0; r < roles.length; r++) {
        rolesWrap.appendChild(
          renderRoleRow(project, roles[r], canManageRoles, handlers && handlers.deleteRole)
        );
      }
    }
    card.appendChild(rolesWrap);

    if (own && handlers && typeof handlers.addRole === "function") {
      var addForm = document.createElement("form");
      addForm.className = "role-form";
      addForm.innerHTML =
        '<label class="role-form__label"><span>Role title</span>' +
        '<input name="title" type="text" required maxlength="200" placeholder="Role title">' +
        "</label>" +
        '<label class="role-form__label"><span>Skills / tools</span>' +
        '<input name="skills" type="text" maxlength="2000" placeholder="Tools or skills">' +
        "</label>" +
        '<label class="role-form__label role-form__label--narrow"><span>Openings</span>' +
        '<input name="slots" type="number" min="0" max="999" value="1">' +
        "</label>" +
        '<button type="submit" class="btn btn-primary btn-block">Add open role</button>';
      addForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var fd = new FormData(addForm);
        handlers.addRole(project.id, {
          title: fd.get("title"),
          skills: fd.get("skills") || "",
          slots: fd.get("slots"),
        });
      });
      card.appendChild(addForm);
    }

    if (own && handlers && typeof handlers.deleteProject === "function") {
      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-ghost btn-block project-card__delete";
      delBtn.textContent = "Delete project";
      delBtn.addEventListener("click", function () {
        if (
          global.confirm("Delete this project and all of its open roles? This cannot be undone.")
        ) {
          handlers.deleteProject(project.id);
        }
      });
      card.appendChild(delBtn);
    }

    return card;
  }

  global.synodosProjectCard = {
    renderProjectCard: renderProjectCard,
    renderRoleRow: renderRoleRow,
    isOwner: isOwner,
  };
})(typeof window !== "undefined" ? window : this);
