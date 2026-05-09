function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function normalizeUsername(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

/** 3–32 chars: letters, numbers, . _ - ; must start and end with alphanumeric. */
function validateUsername(s) {
  var u = normalizeUsername(s);
  if (u.length < 3 || u.length > 32) {
    return {
      ok: false,
      error: "Username must be 3–32 characters",
    };
  }
  if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(u)) {
    return {
      ok: false,
      error:
        "Username may only use letters, numbers, periods, underscores, and hyphens (start and end with a letter or number)",
    };
  }
  return { ok: true, value: u };
}

function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

module.exports = {
  normalizeEmail,
  normalizeUsername,
  validateUsername,
  looksLikeEmail,
};
