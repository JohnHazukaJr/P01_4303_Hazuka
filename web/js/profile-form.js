/**
 * Shared profile editor — first-time setup (data-flow="setup") or edit (data-flow="edit").
 * Multi field/subfield tags + live preview. Requires auth.js.
 */
(function () {
  if (!window.synodosAuth) {
    if (typeof console !== "undefined" && console.error) {
      console.error("synodosAuth not found. Load js/auth.js before js/profile-form.js.");
    }
    return;
  }

  var API_BASE = window.synodosAuth.apiBase;
  var AVATAR_MAX_BYTES = 512 * 1024;
  var WORK_TAGS_MAX = 12;

  function getForm() {
    return document.getElementById("synodos-profile-form");
  }

  function getFlow(form) {
    return (form.getAttribute("data-flow") || "setup").trim();
  }

  function init() {
    var form = getForm();
    if (!form) return;

    var flow = getFlow(form);
    var displayInput = document.getElementById("display_name");
    var bioInput = document.getElementById("bio");
    var workTagsRoot = document.getElementById("work_tags_root");
    var workTagsAddBtn = document.getElementById("work_tags_add");
    var avatarFile = document.getElementById("avatar_file");
    var avatarChoose = document.getElementById("avatar_choose");
    var avatarDefault = document.getElementById("avatar_default");
    var avatarImg = document.getElementById("profile-avatar-img");
    var avatarPh = document.getElementById("profile-avatar-placeholder");
    var saveStatus = document.getElementById("profile-save-status");
    var previewName = document.getElementById("preview-display-name");
    var previewBio = document.getElementById("preview-bio");
    var previewTagsList = document.getElementById("preview-tags-list");
    var previewAvatarImg = document.getElementById("preview-avatar-img");
    var previewAvatarPh = document.getElementById("preview-avatar-placeholder");

    var fieldsCatalog = null;
    var pendingAvatarDataUrl = null;
    var avatarResetRequested = false;
    var tagRowCounter = 0;
    var accountUsername = "";

    function showSvgPlaceholder() {
      if (avatarImg) {
        avatarImg.hidden = true;
        avatarImg.removeAttribute("src");
      }
      if (avatarPh) avatarPh.hidden = false;
      syncPreviewAvatarFromMain();
    }

    function showDefaultAvatar() {
      if (!avatarImg || !avatarPh) return;
      var def = window.synodosAuth.getDefaultAvatarUrl();
      function revealMainAvatar() {
        avatarImg.hidden = false;
        avatarPh.hidden = true;
        syncPreviewAvatarFromMain();
      }
      avatarImg.onload = function () {
        revealMainAvatar();
      };
      avatarImg.onerror = function () {
        showSvgPlaceholder();
      };
      avatarImg.src = def;
      if (avatarImg.complete && avatarImg.naturalWidth > 0) {
        revealMainAvatar();
      } else if (typeof avatarImg.decode === "function") {
        avatarImg.decode().then(revealMainAvatar).catch(function () {});
      }
    }

    function showImageSrc(src) {
      if (!avatarImg || !avatarPh) return;
      function revealMainAvatar() {
        avatarImg.hidden = false;
        avatarPh.hidden = true;
        syncPreviewAvatarFromMain();
      }
      avatarImg.onload = function () {
        revealMainAvatar();
      };
      avatarImg.onerror = function () {
        showDefaultAvatar();
      };
      avatarImg.src = src;
      if (avatarImg.complete && avatarImg.naturalWidth > 0) {
        revealMainAvatar();
      } else if (typeof avatarImg.decode === "function") {
        avatarImg.decode().then(revealMainAvatar).catch(function () {});
      }
    }

    function syncPreviewAvatarFromMain() {
      if (!previewAvatarImg || !previewAvatarPh) return;
      /* Mirror main whenever it has a src. Do not require main to be visible: while the
       * image is still loading it may stay `hidden`; the old `!hidden` check combined with
       * updateLivePreview() reset the preview to the default icon on every keystroke. */
      if (avatarImg && avatarImg.getAttribute("src")) {
        function revealPreviewAvatar() {
          previewAvatarImg.hidden = false;
          previewAvatarPh.hidden = true;
        }
        previewAvatarImg.onload = function () {
          revealPreviewAvatar();
        };
        previewAvatarImg.src = avatarImg.src;
        if (previewAvatarImg.complete && previewAvatarImg.naturalWidth > 0) {
          revealPreviewAvatar();
        } else if (typeof previewAvatarImg.decode === "function") {
          previewAvatarImg.decode().then(revealPreviewAvatar).catch(function () {});
        }
      } else {
        previewAvatarImg.hidden = true;
        previewAvatarImg.removeAttribute("src");
        previewAvatarPh.hidden = false;
      }
    }

    function fillSubfieldSelect(ss, fieldKey, selectedSub) {
      ss.innerHTML = "";
      var ph = document.createElement("option");
      ph.value = "";
      ph.disabled = true;
      ph.textContent = "Select subfield";
      ss.appendChild(ph);
      if (!fieldKey || !fieldsCatalog || !fieldsCatalog.fields[fieldKey]) {
        ss.disabled = true;
        ph.selected = true;
        return;
      }
      ss.disabled = false;
      var subs = fieldsCatalog.fields[fieldKey].subfields;
      var found = false;
      for (var i = 0; i < subs.length; i++) {
        var opt = document.createElement("option");
        opt.value = subs[i].id;
        opt.textContent = subs[i].label;
        if (selectedSub && subs[i].id === selectedSub) {
          opt.selected = true;
          found = true;
        }
        ss.appendChild(opt);
      }
      if (!found) ph.selected = true;
    }

    function updateAddButtonState() {
      if (!workTagsRoot || !workTagsAddBtn) return;
      var n = workTagsRoot.querySelectorAll(".work-tag-row").length;
      workTagsAddBtn.disabled = n >= WORK_TAGS_MAX;
    }

    function collectWorkTags() {
      if (!workTagsRoot) return [];
      var rows = workTagsRoot.querySelectorAll(".work-tag-row");
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        var fs = rows[i].querySelector(".work-tag-field");
        var ss = rows[i].querySelector(".work-tag-sub");
        if (!fs || !ss || !fs.value || !ss.value) continue;
        out.push({
          work_field: fs.value,
          work_subfield: ss.value,
        });
      }
      return out;
    }

    function updatePreviewTags() {
      if (!previewTagsList || !workTagsRoot) return;
      previewTagsList.innerHTML = "";
      var rows = workTagsRoot.querySelectorAll(".work-tag-row");
      var any = false;
      for (var i = 0; i < rows.length; i++) {
        var fs = rows[i].querySelector(".work-tag-field");
        var ss = rows[i].querySelector(".work-tag-sub");
        if (!fs || !ss || !fs.value || !ss.value) continue;
        any = true;
        var fl =
          fs.options[fs.selectedIndex] && fs.options[fs.selectedIndex].textContent
            ? fs.options[fs.selectedIndex].textContent
            : fs.value;
        var sl =
          ss.options[ss.selectedIndex] && ss.options[ss.selectedIndex].textContent
            ? ss.options[ss.selectedIndex].textContent
            : ss.value;
        var li = document.createElement("li");
        var span = document.createElement("span");
        span.className = "synodos-tag";
        span.textContent = fl + " · " + sl;
        li.appendChild(span);
        previewTagsList.appendChild(li);
      }
      if (!any) {
        var li0 = document.createElement("li");
        li0.className = "synodos-preview-tag-placeholder";
        li0.textContent = "Add your fields above";
        previewTagsList.appendChild(li0);
      }
    }

    function peerVisibleName() {
      var pref = "username";
      var radios = form.querySelectorAll('input[name="public_display_as"]');
      for (var ri = 0; ri < radios.length; ri++) {
        if (radios[ri].checked) {
          pref = radios[ri].value;
          break;
        }
      }
      var dn = displayInput ? String(displayInput.value).trim() : "";
      var un = accountUsername || "";
      if (pref === "full_name" && dn.length >= 2) return dn;
      if (un) return un;
      if (dn.length >= 2) return dn;
      return un || "Your name";
    }

    function updateLivePreview() {
      if (previewName) {
        previewName.textContent = peerVisibleName();
      }
      if (previewBio) {
        var b = bioInput ? String(bioInput.value).trim() : "";
        previewBio.textContent =
          b || "Tell collaborators what you care about, skills, and how you like to work…";
        previewBio.classList.toggle("profile-preview__bio--empty", !b);
      }
      updatePreviewTags();
    }

    function addWorkTagRow(fieldVal, subVal) {
      if (!workTagsRoot || !fieldsCatalog || !fieldsCatalog.fields) return;
      tagRowCounter++;
      var row = document.createElement("div");
      row.className = "work-tag-row";
      row.setAttribute("data-tag-row", String(tagRowCounter));

      var fs = document.createElement("select");
      fs.className = "work-tag-field";
      fs.required = true;
      fs.setAttribute("aria-label", "Professional field");
      var phf = document.createElement("option");
      phf.value = "";
      phf.disabled = true;
      phf.textContent = "Select field";
      fs.appendChild(phf);
      var keys = Object.keys(fieldsCatalog.fields || {});
      for (var ki = 0; ki < keys.length; ki++) {
        var k = keys[ki];
        var opt = document.createElement("option");
        opt.value = k;
        opt.textContent = fieldsCatalog.fields[k].label;
        if (fieldVal === k) opt.selected = true;
        fs.appendChild(opt);
      }
      if (!fieldVal) phf.selected = true;

      var ss = document.createElement("select");
      ss.className = "work-tag-sub";
      ss.required = true;
      ss.setAttribute("aria-label", "Subfield");
      fillSubfieldSelect(ss, fieldVal || "", subVal || "");

      fs.addEventListener("change", function () {
        fillSubfieldSelect(ss, fs.value, "");
        updateLivePreview();
      });
      ss.addEventListener("change", updateLivePreview);

      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn btn-ghost work-tag-remove";
      rm.setAttribute("aria-label", "Remove this field and subfield");
      rm.textContent = "Remove";
      rm.addEventListener("click", function () {
        var all = workTagsRoot.querySelectorAll(".work-tag-row");
        if (all.length <= 1) return;
        row.remove();
        updateAddButtonState();
        updateLivePreview();
      });

      var inner = document.createElement("div");
      inner.className = "work-tag-row__inner";
      inner.appendChild(fs);
      inner.appendChild(ss);
      inner.appendChild(rm);
      row.appendChild(inner);
      workTagsRoot.appendChild(row);
      updateAddButtonState();
    }

    function clearWorkTagRows() {
      if (workTagsRoot) workTagsRoot.innerHTML = "";
    }

    if (workTagsAddBtn && workTagsRoot) {
      workTagsAddBtn.disabled = true;
      workTagsAddBtn.addEventListener("click", function () {
        if (!fieldsCatalog || !fieldsCatalog.fields) {
          window.alert(
            "Work areas are still loading. Check your connection and that the API is running (server: npm start)."
          );
          return;
        }
        if (workTagsRoot.querySelectorAll(".work-tag-row").length >= WORK_TAGS_MAX) {
          return;
        }
        addWorkTagRow("", "");
        updateLivePreview();
      });
    }

    if (avatarChoose && avatarFile) {
      avatarChoose.addEventListener("click", function () {
        avatarFile.click();
      });
    }

    if (avatarFile) {
      avatarFile.addEventListener("change", function () {
        var f = avatarFile.files && avatarFile.files[0];
        if (!f) return;
        if (f.size > AVATAR_MAX_BYTES) {
          window.alert("Image must be at most 512 KB.");
          avatarFile.value = "";
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var dataUrl = reader.result;
          if (typeof dataUrl !== "string") return;
          pendingAvatarDataUrl = dataUrl;
          avatarResetRequested = false;
          showImageSrc(dataUrl);
        };
        reader.readAsDataURL(f);
      });
    }

    if (avatarDefault) {
      avatarDefault.addEventListener("click", function () {
        if (avatarFile) avatarFile.value = "";
        pendingAvatarDataUrl = null;
        avatarResetRequested = true;
        showDefaultAvatar();
      });
    }

    if (displayInput) {
      displayInput.addEventListener("input", function () {
        updateLivePreview();
      });
    }

    if (bioInput) {
      bioInput.addEventListener("input", updateLivePreview);
    }

    form.addEventListener("change", function (ev) {
      if (ev.target && ev.target.name === "public_display_as") {
        updateLivePreview();
      }
    });

    function showSaveStatus(ok, msg) {
      if (!saveStatus) return;
      saveStatus.hidden = false;
      saveStatus.textContent = msg || "";
      saveStatus.className =
        "profile-save-status" + (ok ? " profile-save-status--ok" : " profile-save-status--err");
    }

    function hideSaveStatus() {
      if (saveStatus) {
        saveStatus.hidden = true;
        saveStatus.textContent = "";
      }
    }

    async function load() {
      var token = window.synodosAuth.getToken();
      if (!token) {
        window.location.href = "login.html";
        return;
      }
      try {
        var resMe = await fetch(API_BASE + "/api/me", {
          headers: { Authorization: "Bearer " + token },
        });
        if (!resMe.ok) {
          if (resMe.status === 401) {
            window.synodosAuth.handleUnauthorized();
            return;
          }
          window.alert("Could not load your profile. Please try again.");
          return;
        }
        var resFields = await fetch(API_BASE + "/api/profile-fields");
        if (!resFields.ok) {
          window.alert("Could not load profile options from the server.");
          return;
        }
        var meData;
        var fieldsPayload;
        try {
          var parsed = await Promise.all([resMe.json(), resFields.json()]);
          meData = parsed[0];
          fieldsPayload = parsed[1];
        } catch (parseErr) {
          window.alert("Invalid response from the server. Is the API URL correct (see SYNODOS_API_BASE)?");
          return;
        }
        if (
          !fieldsPayload ||
          typeof fieldsPayload.fields !== "object" ||
          fieldsPayload.fields === null
        ) {
          window.alert(
            "Profile options from the server were incomplete. Try again or update the app."
          );
          return;
        }
        fieldsCatalog = fieldsPayload;

        if (flow === "setup" && meData.user && meData.user.profile_complete) {
          window.location.href = "dashboard.html";
          return;
        }

        var u = meData.user || {};
        accountUsername = u.username ? String(u.username).trim() : "";
        if (displayInput && u.display_name) {
          displayInput.value = u.display_name;
        }
        if (bioInput && u.bio) {
          bioInput.value = u.bio;
        }
        var pda = String(u.public_display_as || "username").toLowerCase();
        var pdaRadios = form.querySelectorAll('input[name="public_display_as"]');
        for (var pi = 0; pi < pdaRadios.length; pi++) {
          pdaRadios[pi].checked = pdaRadios[pi].value === pda;
        }

        if (u.avatar_url && String(u.avatar_url).length > 0) {
          showImageSrc(window.synodosAuth.assetUrl(String(u.avatar_url)));
          avatarResetRequested = false;
          pendingAvatarDataUrl = null;
        } else {
          showDefaultAvatar();
        }

        clearWorkTagRows();
        var wtags = u.work_tags;
        if (wtags && wtags.length > 0) {
          for (var wi = 0; wi < wtags.length; wi++) {
            var tg = wtags[wi];
            addWorkTagRow(tg.work_field, tg.work_subfield);
          }
        } else if (
          u.work_field &&
          fieldsCatalog.fields[u.work_field]
        ) {
          addWorkTagRow(u.work_field, u.work_subfield || "");
        } else {
          addWorkTagRow("", "");
        }

        updateLivePreview();
        hideSaveStatus();
        if (workTagsAddBtn) workTagsAddBtn.disabled = false;
        updateAddButtonState();
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("Could not load profile.", err);
        }
        window.alert(
          "Could not reach the server. Please try again."
        );
        if (workTagsAddBtn) workTagsAddBtn.disabled = true;
      }
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      hideSaveStatus();
      var token = window.synodosAuth.getToken();
      if (!token) {
        window.location.href = "login.html";
        return;
      }
      var fdSubmit = new FormData(form);
      var displayName = (fdSubmit.get("display_name") || "")
        .toString()
        .trim();
      var bio = (fdSubmit.get("bio") || "").toString();
      var workTags = collectWorkTags();
      var pdaRaw = fdSubmit.get("public_display_as");
      var publicDisplayAs =
        pdaRaw === "full_name" || pdaRaw === "username"
          ? pdaRaw
          : "username";

      if (workTags.length < 1) {
        showSaveStatus(false, "Add at least one field and subfield pair.");
        return;
      }

      var payload = {
        display_name: displayName,
        public_display_as: publicDisplayAs,
        bio: bio,
        work_tags: workTags,
      };

      if (pendingAvatarDataUrl) {
        payload.avatar_data = pendingAvatarDataUrl;
      } else if (avatarResetRequested) {
        payload.avatar_reset = true;
      }

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        var res = await fetch(API_BASE + "/api/me", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify(payload),
        });
        var data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          showSaveStatus(false, data.error || res.statusText || "Could not save profile");
          return;
        }

        if (flow === "setup") {
          window.location.href = "dashboard.html";
        } else {
          pendingAvatarDataUrl = null;
          avatarResetRequested = false;
          if (data.user && data.user.avatar_url) {
            showImageSrc(window.synodosAuth.assetUrl(String(data.user.avatar_url)));
          } else {
            showDefaultAvatar();
          }
          if (data.user && data.user.work_tags) {
            clearWorkTagRows();
            var tags = data.user.work_tags;
            for (var ti = 0; ti < tags.length; ti++) {
              addWorkTagRow(tags[ti].work_field, tags[ti].work_subfield);
            }
          }
          updateLivePreview();
          showSaveStatus(true, "Profile saved. Your space is up to date.");
        }
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("Backend not reachable.", err);
        }
        window.alert(
          "Could not reach the server. Please try again."
        );
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
