(function () {
  function syncButton(btn, input) {
    var passwordVisible = input.type === "text";
    btn.classList.toggle("password-toggle--revealed", passwordVisible);
    btn.setAttribute("aria-pressed", passwordVisible ? "true" : "false");
    btn.setAttribute("aria-label", passwordVisible ? "Hide password" : "Show password");
  }

  document.querySelectorAll("[data-password-toggle]").forEach(function (btn) {
    var wrap = btn.closest(".field-password-wrap");
    if (!wrap) return;
    var input = wrap.querySelector("input");
    if (!input) return;
    btn.addEventListener("click", function () {
      input.type = input.type === "password" ? "text" : "password";
      syncButton(btn, input);
    });
    syncButton(btn, input);
  });
})();
