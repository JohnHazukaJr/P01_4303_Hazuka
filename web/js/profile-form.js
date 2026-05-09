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

  var AVATAR_MAX_BYTES = 512 * 1024;
  /** Max width/height before scaling down (keeps uploads small for the 512 KB cap). */
  var AVATAR_MAX_EDGE = 1280;
  var WORK_TAGS_MAX = 12;

  function dataUrlDecodedLength(dataUrl) {
    var comma = dataUrl.indexOf(",");
    if (comma < 0) return Infinity;
    var b64 = dataUrl.slice(comma + 1);
    var len = b64.length;
    var pad = 0;
    if (b64.endsWith("==")) pad = 2;
    else if (b64.endsWith("=")) pad = 1;
    return Math.floor((len * 3) / 4) - pad;
  }

  /**
   * Resize and re-encode as JPEG so decoded size is <= maxBytes (for huge photos / PNGs).
   * @param {File} file
   * @param {number} maxEdge
   * @param {number} maxBytes
   * @param {function(string|null, string|null)} done — (err, dataUrl)
   */
  function compressImageFileToJpegDataUrl(file, maxEdge, maxBytes, done) {
    function finishCanvas(canvas) {
      var q = 0.9;
      for (var tries = 0; tries < 18; tries++) {
        var dataUrl = canvas.toDataURL("image/jpeg", q);
        if (dataUrlDecodedLength(dataUrl) <= maxBytes) {
          done(null, dataUrl);
          return;
        }
        q -= 0.05;
      }
      done(
        "This image is still too large after resizing (512 KB max). Try a smaller file.",
        null
      );
    }

    function runWithDims(w, h, draw) {
      if (!w || !h) {
        done("Could not read image dimensions.", null);
        return;
      }
      var scale = Math.min(1, maxEdge / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      var ctx = canvas.getContext("2d");
      if (!ctx) {
        done("Your browser cannot process this image.", null);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      draw(ctx, cw, ch);
      finishCanvas(canvas);
    }

    function loadWithImageElement() {
      var objUrl = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(objUrl);
        runWithDims(img.naturalWidth, img.naturalHeight, function (ctx, cw, ch) {
          ctx.drawImage(img, 0, 0, cw, ch);
        });
      };
      img.onerror = function () {
        URL.revokeObjectURL(objUrl);
        done(
          "Could not read this image. Try JPEG or PNG, or convert HEIC to JPEG.",
          null
        );
      };
      img.src = objUrl;
    }

    /* Prefer createImageBitmap — decodes more reliably than Image() on some Windows/Edge paths. */
    if (typeof createImageBitmap === "function") {
      createImageBitmap(file)
        .then(function (bitmap) {
          try {
            runWithDims(bitmap.width, bitmap.height, function (ctx, cw, ch) {
              ctx.drawImage(bitmap, 0, 0, cw, ch);
            });
          } finally {
            try {
              bitmap.close();
            } catch (_) {}
          }
        })
        .catch(function () {
          loadWithImageElement();
        });
      return;
    }
    loadWithImageElement();
  }

  function fileLooksLikeRasterImage(f) {
    var mime = (f.type || "").toLowerCase();
    if (mime.startsWith("image/")) return true;
    /* Windows often leaves type empty; use extension. */
    return /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(f.name || "");
  }

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
    var saveStatus = document.getElementById("profile-save-status");
    var previewName = document.getElementById("preview-display-name");
    var previewBio = document.getElementById("preview-bio");
    var previewTagsList = document.getElementById("preview-tags-list");
    var previewAvatarImg = document.getElementById("preview-avatar-img");

    var fieldsCatalog = null;
    var pendingAvatarDataUrl = null;
    /** True while FileReader / canvas is still building a data URL (Save must wait). */
    var avatarImportInProgress = false;
    var avatarResetRequested = false;
    var tagRowCounter = 0;
    var accountUsername = "";
    /** Last loaded `/api/me` user — used when resetting avatar before save. */
    var meSnapshot = null;

    function showDefaultAvatar() {
      if (!avatarImg) return;
      var snap =
        meSnapshot && typeof meSnapshot === "object"
          ? meSnapshot
          : { id: window.synodosAuth.getTokenUserId() };
      window.synodosAuth.applyUserAvatar(
        avatarImg,
        null,
        Object.assign({}, snap, { avatar_url: "" })
      );
    }

    function showLocalPickedAvatar(dataUrl) {
      if (!avatarImg) return;
      window.synodosAuth.applyUserAvatar(
        avatarImg,
        null,
        { avatar_url: String(dataUrl || "") },
        { skipCacheWrite: true }
      );
      syncPreviewAvatarFromMain();
    }

    function syncPreviewAvatarFromMain() {
      if (!previewAvatarImg) return;
      if (avatarImg && avatarImg.getAttribute("src")) {
        previewAvatarImg.onload = function () {};
        previewAvatarImg.src = avatarImg.src;
        previewAvatarImg.removeAttribute("hidden");
        if (previewAvatarImg.complete && previewAvatarImg.naturalWidth > 0) {
          /* ok */
        } else if (typeof previewAvatarImg.decode === "function") {
          previewAvatarImg.decode().catch(function () {});
        }
      } else {
        previewAvatarImg.src = window.synodosAuth.getDefaultAvatarUrl();
        previewAvatarImg.removeAttribute("hidden");
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
      return un || "\u2014";
    }

    function enterPreviewNameLoading() {
      if (!previewName) return;
      previewName.textContent = "";
      previewName.innerHTML =
        '<span class="profile-preview-name-skeleton skeleton" aria-hidden="true"></span>';
      previewName.setAttribute("aria-busy", "true");
      previewName.setAttribute("aria-label", "Loading preview name");
    }

    function exitPreviewNameLoading() {
      if (!previewName) return;
      previewName.removeAttribute("aria-busy");
      previewName.removeAttribute("aria-label");
      previewName.innerHTML = "";
    }

    function updateLivePreview() {
      if (previewName && previewName.getAttribute("aria-busy") !== "true") {
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
            "Work areas are still loading. Check your connection and refresh the page."
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
        var mime = (f.type || "").toLowerCase();
        if (!fileLooksLikeRasterImage(f)) {
          window.alert(
            "Choose an image file (JPEG, PNG, GIF, or WebP). If you already did, try renaming to .jpg or convert the file — Windows sometimes hides the real type."
          );
          avatarFile.value = "";
          return;
        }
        if (mime === "image/svg+xml" || /\.svg$/i.test(f.name || "")) {
          window.alert("SVG is not supported for profile photos. Use JPEG or PNG.");
          avatarFile.value = "";
          return;
        }

        function applyPick(dataUrl) {
          if (dataUrlDecodedLength(dataUrl) > AVATAR_MAX_BYTES) {
            window.alert(
              "Image is still over 512 KB after processing. Try another file."
            );
            avatarFile.value = "";
            avatarImportInProgress = false;
            return;
          }
          pendingAvatarDataUrl = dataUrl;
          avatarResetRequested = false;
          showLocalPickedAvatar(dataUrl);
          avatarImportInProgress = false;
        }

        avatarImportInProgress = true;

        if (f.size <= AVATAR_MAX_BYTES) {
          var reader = new FileReader();
          reader.onerror = function () {
            avatarImportInProgress = false;
            window.alert("Could not read this image file.");
            avatarFile.value = "";
          };
          reader.onload = function () {
            var dataUrl = reader.result;
            if (typeof dataUrl !== "string") {
              avatarImportInProgress = false;
              return;
            }
            if (dataUrlDecodedLength(dataUrl) <= AVATAR_MAX_BYTES) {
              applyPick(dataUrl);
            } else {
              compressImageFileToJpegDataUrl(
                f,
                AVATAR_MAX_EDGE,
                AVATAR_MAX_BYTES,
                function (err, out) {
                  if (err) {
                    window.alert(err);
                    avatarFile.value = "";
                    avatarImportInProgress = false;
                    return;
                  }
                  applyPick(out);
                }
              );
            }
          };
          reader.readAsDataURL(f);
          return;
        }

        compressImageFileToJpegDataUrl(
          f,
          AVATAR_MAX_EDGE,
          AVATAR_MAX_BYTES,
          function (err, dataUrl) {
            if (err) {
              window.alert(err);
              avatarFile.value = "";
              avatarImportInProgress = false;
              return;
            }
            applyPick(dataUrl);
          }
        );
      });
    }

    if (avatarDefault) {
      avatarDefault.addEventListener("click", function () {
        if (avatarFile) avatarFile.value = "";
        pendingAvatarDataUrl = null;
        avatarResetRequested = true;
        showDefaultAvatar();
        syncPreviewAvatarFromMain();
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
        var primed = window.synodosAuth.getCachedMe();
        if (primed) {
          accountUsername = primed.username
            ? String(primed.username).trim()
            : "";
          if (displayInput && primed.display_name) {
            displayInput.value = primed.display_name;
          }
          if (bioInput && primed.bio != null) {
            bioInput.value = primed.bio;
          }
          var pdaPrime = String(primed.public_display_as || "username").toLowerCase();
          var pdaRadiosPrime = form.querySelectorAll(
            'input[name="public_display_as"]'
          );
          for (var pq = 0; pq < pdaRadiosPrime.length; pq++) {
            pdaRadiosPrime[pq].checked =
              pdaRadiosPrime[pq].value === pdaPrime;
          }
        }

        if (!accountUsername) {
          enterPreviewNameLoading();
        } else {
          exitPreviewNameLoading();
          updateLivePreview();
        }

        var meR = await window.synodosAuth.apiFetch("/api/me", {});
        if (!meR) {
          exitPreviewNameLoading();
          return;
        }
        if (!meR.res.ok) {
          exitPreviewNameLoading();
          if (previewName) previewName.textContent = "\u2014";
          window.alert("Could not load your profile. Please try again.");
          return;
        }
        var fieldsR = await window.synodosAuth.apiFetch("/api/profile-fields", {});
        if (!fieldsR || !fieldsR.res.ok) {
          exitPreviewNameLoading();
          if (previewName) previewName.textContent = "\u2014";
          window.alert("Could not load your work area list. Please try again.");
          return;
        }
        var meData = meR.data;
        var fieldsPayload = fieldsR.data;
        if (
          !fieldsPayload ||
          typeof fieldsPayload.fields !== "object" ||
          fieldsPayload.fields === null
        ) {
          exitPreviewNameLoading();
          if (previewName) previewName.textContent = "\u2014";
          window.alert(
            "Something went wrong loading your profile options. Please refresh and try again."
          );
          return;
        }
        fieldsCatalog = fieldsPayload;

        if (flow === "setup" && meData.user && meData.user.profile_complete) {
          exitPreviewNameLoading();
          window.location.href = "home.html";
          return;
        }

        var u = meData.user || {};
        meSnapshot = u;
        if (u && u.id != null) {
          window.synodosAuth.setCachedMe(u);
        }
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

        /* Do not overwrite a photo the user already picked or a reset they requested
         * while this request was in flight (async race with /api/me). */
        if (!(pendingAvatarDataUrl || avatarResetRequested)) {
          if (u.avatar_url && String(u.avatar_url).length > 0) {
            window.synodosAuth.applyUserAvatar(avatarImg, null, u);
          } else {
            showDefaultAvatar();
          }
        }
        syncPreviewAvatarFromMain();

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

        exitPreviewNameLoading();
        updateLivePreview();
        hideSaveStatus();

        var badgeHost = document.getElementById("profile-preview-badges");
        if (badgeHost && window.synodosUserBadges) {
          window.synodosUserBadges.renderBadgesOnly(badgeHost, u);
        }
        if (workTagsAddBtn) workTagsAddBtn.disabled = false;
        updateAddButtonState();
      } catch (err) {
        exitPreviewNameLoading();
        if (previewName) previewName.textContent = "\u2014";
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

      if (avatarImportInProgress) {
        showSaveStatus(
          false,
          "Still processing your photo. Wait a moment, then click Save again."
        );
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

      var hadAvatarDataPayload =
        typeof payload.avatar_data === "string" &&
        payload.avatar_data.length > 0;

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        var patchR = await window.synodosAuth.apiFetch("/api/me", {
          method: "PATCH",
          headers: window.synodosAuth.authHeaders({ json: true }),
          body: JSON.stringify(payload),
        });
        if (!patchR) {
          return;
        }
        var res = patchR.res;
        var data = patchR.data;
        if (!res.ok) {
          var saveErr = data && data.error;
          if (!saveErr && res.status === 413) {
            saveErr =
              "Save request was too large. Try again with a smaller photo or compress the image first.";
          }
          if (!saveErr && res.status >= 500) {
            saveErr =
              "Something went wrong while saving. Please try again in a moment.";
          }
          showSaveStatus(
            false,
            saveErr || res.statusText || "Could not save profile"
          );
          return;
        }

        var avatarUrlBack =
          data.user && data.user.avatar_url != null
            ? String(data.user.avatar_url).trim()
            : "";
        if (hadAvatarDataPayload && !avatarUrlBack) {
          showSaveStatus(
            false,
            "Your profile saved, but the photo could not be uploaded. Try a smaller image or another file, then save again."
          );
          if (data.user) {
            window.synodosAuth.setCachedMe(data.user);
            meSnapshot = data.user;
          }
          return;
        }

        if (data.user) {
          window.synodosAuth.setCachedMe(data.user);
        }

        if (flow === "setup") {
          window.location.href = "home.html";
        } else {
          pendingAvatarDataUrl = null;
          avatarResetRequested = false;
          if (data.user) {
            meSnapshot = data.user;
            if (avatarUrlBack) {
              window.synodosAuth.applyUserAvatar(avatarImg, null, data.user);
            } else {
              showDefaultAvatar();
            }
            syncPreviewAvatarFromMain();
          }
          if (data.user && data.user.work_tags) {
            clearWorkTagRows();
            var tags = data.user.work_tags;
            for (var ti = 0; ti < tags.length; ti++) {
              addWorkTagRow(tags[ti].work_field, tags[ti].work_subfield);
            }
          }
          updateLivePreview();
          var badgeHostAfterSave = document.getElementById("profile-preview-badges");
          if (badgeHostAfterSave && window.synodosUserBadges && data.user) {
            window.synodosUserBadges.renderBadgesOnly(badgeHostAfterSave, data.user);
          }
          showSaveStatus(true, "Profile saved. Your space is up to date.");
        }
      } catch (err) {
        window.alert(
          "Could not reach the server. Please try again."
        );
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    if (avatarImg) {
      window.synodosAuth.primeUserAvatar(avatarImg, null, {});
    }
    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
