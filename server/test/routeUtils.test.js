const { test } = require("node:test");
const assert = require("node:assert/strict");

const { parseId, parseCursor } = require("../routeUtils");

test("parseId accepts positive integers", () => {
  assert.equal(parseId(1), 1);
  assert.equal(parseId("42"), 42);
  assert.equal(parseId(1000000), 1000000);
});

test("parseId rejects zero, negatives, floats, and garbage", () => {
  assert.equal(parseId(0), null);
  assert.equal(parseId(-1), null);
  assert.equal(parseId(1.5), null);
  assert.equal(parseId("abc"), null);
  assert.equal(parseId(""), null);
  assert.equal(parseId(null), null);
  assert.equal(parseId(undefined), null);
});

test("parseCursor mirrors parseId semantics", () => {
  assert.equal(parseCursor("100"), 100);
  assert.equal(parseCursor(0), null);
  assert.equal(parseCursor("not-a-number"), null);
  assert.equal(parseCursor(null), null);
});
