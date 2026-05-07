const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  isValidWorkField,
  isValidWorkSubfield,
  enrichTag,
  profileFieldsPayload,
} = require("../profileFields");

test("isValidWorkField recognises canonical fields", () => {
  assert.equal(isValidWorkField("tech"), true);
  assert.equal(isValidWorkField("art"), true);
  assert.equal(isValidWorkField("blue_collar"), true);
});

test("isValidWorkField rejects unknown fields", () => {
  assert.equal(isValidWorkField("science"), false);
  assert.equal(isValidWorkField(""), false);
  assert.equal(isValidWorkField(null), false);
  assert.equal(isValidWorkField("Tech"), false); // case-sensitive
});

test("isValidWorkSubfield validates field/subfield pairs", () => {
  assert.equal(isValidWorkSubfield("tech", "software"), true);
  assert.equal(isValidWorkSubfield("art", "music"), true);
  assert.equal(isValidWorkSubfield("blue_collar", "construction"), true);
});

test("isValidWorkSubfield rejects unknown pairs", () => {
  assert.equal(isValidWorkSubfield("tech", "music"), false);
  assert.equal(isValidWorkSubfield("art", "software"), false);
  assert.equal(isValidWorkSubfield("nope", "software"), false);
  assert.equal(isValidWorkSubfield("tech", ""), false);
});

test("enrichTag returns labels for known pairs", () => {
  const t = enrichTag("tech", "software");
  assert.equal(t.work_field, "tech");
  assert.equal(t.work_subfield, "software");
  assert.equal(t.field_label, "Tech");
  assert.equal(t.subfield_label, "Software engineering");
});

test("enrichTag falls back to raw values for unknowns", () => {
  const t = enrichTag("mystery", "x");
  assert.equal(t.work_field, "mystery");
  assert.equal(t.work_subfield, "x");
  assert.equal(t.field_label, "mystery");
  assert.equal(t.subfield_label, "x");
});

test("profileFieldsPayload exposes all top-level fields", () => {
  const payload = profileFieldsPayload();
  assert.ok(payload.fields, "fields key exists");
  assert.ok(payload.fields.tech, "tech field present");
  assert.ok(payload.fields.art, "art field present");
  assert.ok(payload.fields.blue_collar, "blue_collar field present");
  assert.equal(typeof payload.fields.tech.label, "string");
  assert.ok(Array.isArray(payload.fields.tech.subfields));
  assert.ok(payload.fields.tech.subfields.length > 0);
});
