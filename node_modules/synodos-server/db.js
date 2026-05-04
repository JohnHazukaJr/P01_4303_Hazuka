function normalizeEmail(email) {
  return require("./userValidation").normalizeEmail(email);
}

function normalizeUsername(s) {
  return require("./userValidation").normalizeUsername(s);
}

/** 3–32 chars: letters, numbers, . _ - ; must start and end with alphanumeric. */
function validateUsername(s) {
  return require("./userValidation").validateUsername(s);
}

function looksLikeEmail(s) {
  return require("./userValidation").looksLikeEmail(s);
}

module.exports = {
  normalizeEmail,
  normalizeUsername,
  validateUsername,
  looksLikeEmail,
};
