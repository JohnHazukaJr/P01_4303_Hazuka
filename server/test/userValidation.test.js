const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeEmail,
  normalizeUsername,
  validateUsername,
  looksLikeEmail,
} = require("../userValidation");

test("normalizeEmail trims and lower-cases", () => {
  assert.equal(normalizeEmail("  Foo@Bar.COM  "), "foo@bar.com");
  assert.equal(normalizeEmail(null), "");
  assert.equal(normalizeEmail(undefined), "");
});

test("normalizeUsername trims and lower-cases", () => {
  assert.equal(normalizeUsername(" Alice  "), "alice");
  assert.equal(normalizeUsername("BOB"), "bob");
  assert.equal(normalizeUsername(""), "");
  assert.equal(normalizeUsername(null), "");
});

test("validateUsername accepts simple names", () => {
  const r = validateUsername("alex");
  assert.equal(r.ok, true);
  assert.equal(r.value, "alex");
});

test("validateUsername normalizes case", () => {
  const r = validateUsername("Alex");
  assert.equal(r.ok, true);
  assert.equal(r.value, "alex");
});

test("validateUsername accepts dots, underscores, hyphens", () => {
  assert.equal(validateUsername("a.b").ok, true);
  assert.equal(validateUsername("a_b").ok, true);
  assert.equal(validateUsername("a-b").ok, true);
  assert.equal(validateUsername("ab.cd_ef-gh").ok, true);
});

test("validateUsername rejects too-short or too-long", () => {
  assert.equal(validateUsername("ab").ok, false);
  assert.equal(validateUsername("a".repeat(33)).ok, false);
});

test("validateUsername rejects boundary punctuation", () => {
  assert.equal(validateUsername(".alice").ok, false);
  assert.equal(validateUsername("alice.").ok, false);
  assert.equal(validateUsername("_alice").ok, false);
  assert.equal(validateUsername("-alice").ok, false);
});

test("validateUsername rejects spaces and forbidden chars", () => {
  assert.equal(validateUsername("alice bob").ok, false);
  assert.equal(validateUsername("alice@x").ok, false);
  assert.equal(validateUsername("alice!").ok, false);
});

test("looksLikeEmail picks out things with @ and dot", () => {
  assert.equal(looksLikeEmail("foo@bar.com"), true);
  assert.equal(looksLikeEmail("Foo@Bar.co.uk"), true);
  assert.equal(looksLikeEmail("foo@bar"), false);
  assert.equal(looksLikeEmail("foobar.com"), false);
  assert.equal(looksLikeEmail(""), false);
  assert.equal(looksLikeEmail(null), false);
});
