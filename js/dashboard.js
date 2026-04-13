/** Projects and open roles UI. Requires auth.js before this script. */
(function () {
  if (!window.synodosAuth) {
    if (typeof console !== "undefined" && console.error) {
      console.error(
        "synodosAuth not found. Load js/auth.js before js/dashboard.js."
      );
    }
    return;
  }

  var API_BASE = window.synodosAuth.apiBase;
  var emailEl = document.getElementById("dashboard-email");
  var outBtn = document.getElementById("dashboard-sign-out");
  var projectsRoot = document.getElementById("projects-root");
  var projectsEmpty = document.getElementById("projects-empty");
  var formNew = document.getElementById("form-new-project");
  var msgEl = document.getElementById("dashboard-msg");

  var token = null;
  var userId = null;

  function showMsg(text, isError) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.hidden = !text;
    msgEl.className =
      "dashboard-msg" + (isError ? " dashboard-msg--error" : "");
  }

  function authHeaders() {
    var h = { "Content-Type": "application/json" };
    if (token) {
      h.Authorization = "Bearer " + token;
    }
    return h;
  }

  async function loadMe() {
    token = window.synodosAuth.getToken();
    if (!token) {
      window.location.href = "login.html";
      return false;
    }
    var res = await fetch(API_BASE + "/api/me", {
      headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) {
      window.synodosAuth.clearToken();
      window.location.href = "login.html";
      return false;
    }
    var data = await res.json();
    userId = data.user && data.user.id;
    if (emailEl && data.user && data.user.email) {
      emailEl.textContent = data.user.email;
    }
    return true;
  }

  async function fetchProjects() {
    var res = await fetch(API_BASE + "/api/projects");
    if (!res.ok) {
      throw new Error("Could not load projects");
    }
    return res.json();
  }

  function isOwner(project) {
    return userId != null && Number(project.owner_user_id) === Number(userId);
  }

  function renderProjects(data) {
    if (!projectsRoot) return;
    var list = (data && data.projects) || [];
    projectsRoot.innerHTML = "";
    if (projectsEmpty) {
      projectsEmpty.hidden = list.length > 0;
    }
    for (var i = 0; i < list.length; i++) {
      projectsRoot.appendChild(renderProjectCard(list[i]));
    }
  }

  function renderProjectCard(project) {
    var own = isOwner(project);
    var card = document.createElement("article");
    card.className =
      "project-card" + (own ? " project-card--own" : "");
    card.setAttribute("data-project-id", String(project.id));

    var title = document.createElement("h3");
    title.className = "project-card__title";
    title.textContent = project.title || "Untitled";

    var meta = document.createElement("p");
    meta.className = "project-card__meta";
    meta.textContent =
      "Owner: " + (project.owner_email || "?");

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
    if (roles.length === 0) {
      var empty = document.createElement("p");
      empty.className = "project-roles__empty";
      empty.textContent = "No open roles yet.";
      rolesWrap.appendChild(empty);
    } else {
      for (var r = 0; r < roles.length; r++) {
        rolesWrap.appendChild(renderRoleRow(project, roles[r], own));
      }
    }
    card.appendChild(rolesWrap);

    if (own) {
      var addForm = document.createElement("form");
      addForm.className = "role-form";
      addForm.innerHTML =
        '<label class="role-form__label"><span>Role title</span>' +
        '<input name="title" type="text" required maxlength="200" placeholder="e.g. UI design">' +
        "</label>" +
        '<label class="role-form__label"><span>Skills / tools</span>' +
        '<input name="skills" type="text" maxlength="2000" placeholder="Figma, accessibility">' +
        "</label>" +
        '<label class="role-form__label role-form__label--narrow"><span>Openings</span>' +
        '<input name="slots" type="number" min="0" max="999" value="1">' +
        "</label>" +
        '<button type="submit" class="btn btn-primary btn-block">Add open role</button>';
      addForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var fd = new FormData(addForm);
        addRole(project.id, {
          title: fd.get("title"),
          skills: fd.get("skills") || "",
          slots: fd.get("slots"),
        });
      });
      card.appendChild(addForm);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-ghost btn-block project-card__delete";
      delBtn.textContent = "Delete project";
      delBtn.addEventListener("click", function () {
        if (
          window.confirm(
            "Delete this project and all of its open roles? This cannot be undone."
          )
        ) {
          deleteProject(project.id);
        }
      });
      card.appendChild(delBtn);
    }

    return card;
  }

  function renderRoleRow(project, role, canDelete) {
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
    slots.textContent =
      "Openings: " + String(role.slots != null ? role.slots : 1);
    main.appendChild(slots);
    row.appendChild(main);
    if (canDelete) {
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn btn-ghost role-row__remove";
      rm.setAttribute("aria-label", "Remove role");
      rm.textContent = "Remove";
      rm.addEventListener("click", function () {
        deleteRole(project.id, role.id);
      });
      row.appendChild(rm);
    }
    return row;
  }

  async function refresh() {
    showMsg("", false);
    try {
      var data = await fetchProjects();
      renderProjects(data);
    } catch (err) {
      showMsg(
        (err && err.message) || "Something went wrong loading projects.",
        true
      );
    }
  }

  async function addRole(projectId, body) {
    showMsg("", false);
    try {
      var res = await fetch(
        API_BASE + "/api/projects/" + projectId + "/roles",
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(body),
        }
      );
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) {
        showMsg(data.error || "Could not add role", true);
        return;
      }
      await refresh();
    } catch (e) {
      showMsg("Could not add role.", true);
    }
  }

  async function deleteRole(projectId, roleId) {
    showMsg("", false);
    try {
      var res = await fetch(
        API_BASE +
          "/api/projects/" +
          projectId +
          "/roles/" +
          roleId,
        { method: "DELETE", headers: authHeaders() }
      );
      if (!res.ok) {
        var data = await res.json().catch(function () {
          return {};
        });
        showMsg(data.error || "Could not remove role", true);
        return;
      }
      await refresh();
    } catch (e) {
      showMsg("Could not remove role.", true);
    }
  }

  async function deleteProject(projectId) {
    showMsg("", false);
    try {
      var res = await fetch(API_BASE + "/api/projects/" + projectId, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        var data = await res.json().catch(function () {
          return {};
        });
        showMsg(data.error || "Could not delete project", true);
        return;
      }
      await refresh();
    } catch (e) {
      showMsg("Could not delete project.", true);
    }
  }

  async function init() {
    var ok = await loadMe();
    if (!ok) return;

    if (formNew) {
      formNew.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        showMsg("", false);
        var fd = new FormData(formNew);
        var payload = {
          title: fd.get("title"),
          description: fd.get("description") || "",
        };
        try {
          var res = await fetch(API_BASE + "/api/projects", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(payload),
          });
          var data = await res.json().catch(function () {
            return {};
          });
          if (!res.ok) {
            showMsg(data.error || "Could not create project", true);
            return;
          }
          formNew.reset();
          await refresh();
        } catch (e) {
          showMsg("Could not create project.", true);
        }
      });
    }

    await refresh();
  }

  if (outBtn) {
    outBtn.addEventListener("click", function () {
      window.synodosAuth.clearToken();
      window.location.href = "login.html";
    });
  }

  init();
})();
