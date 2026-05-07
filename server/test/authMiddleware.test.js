const { test } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const {
  createRequireAuth,
  createOptionalAuth,
} = require("../authMiddleware");

const SECRET = "test-secret";

function makeFakeDb(userRow) {
  return {
    /* The real db.get is parameterised; only the row matters for these tests. */
    get: async () => userRow,
  };
}

function makeRes() {
  const calls = [];
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      calls.push({ status: this.statusCode, body: obj });
      return this;
    },
    _calls: calls,
  };
}

test("requireAuth rejects requests with no Authorization header", async () => {
  const middleware = createRequireAuth(makeFakeDb(null), SECRET);
  const req = { headers: {} };
  const res = makeRes();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Unauthorized" });
});

test("requireAuth rejects malformed Authorization header", async () => {
  const middleware = createRequireAuth(makeFakeDb(null), SECRET);
  const req = { headers: { authorization: "Token abc" } };
  const res = makeRes();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("requireAuth rejects invalid JWT", async () => {
  const middleware = createRequireAuth(makeFakeDb(null), SECRET);
  const req = { headers: { authorization: "Bearer not-a-real-token" } };
  const res = makeRes();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("requireAuth rejects valid JWT for non-existent user", async () => {
  const token = jwt.sign({ sub: 999, email: "x@y.com" }, SECRET);
  const middleware = createRequireAuth(makeFakeDb(null), SECRET);
  const req = { headers: { authorization: "Bearer " + token } };
  const res = makeRes();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("requireAuth attaches req.user and calls next on success", async () => {
  const userRow = { id: 7, email: "user@example.com" };
  const token = jwt.sign({ sub: 7, email: "user@example.com" }, SECRET);
  const middleware = createRequireAuth(makeFakeDb(userRow), SECRET);
  const req = { headers: { authorization: "Bearer " + token } };
  const res = makeRes();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, userRow);
  assert.equal(res.statusCode, 200);
});

test("optionalAuth without header sets req.user = null and proceeds", async () => {
  const middleware = createOptionalAuth(makeFakeDb(null), SECRET);
  const req = { headers: {} };
  const res = makeRes();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.user, null);
});

test("optionalAuth with bad token still proceeds anonymously", async () => {
  const middleware = createOptionalAuth(makeFakeDb(null), SECRET);
  const req = { headers: { authorization: "Bearer garbage" } };
  const res = makeRes();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.user, null);
});

test("optionalAuth with valid token attaches user and proceeds", async () => {
  const userRow = { id: 3, email: "p@q.com" };
  const token = jwt.sign({ sub: 3, email: "p@q.com" }, SECRET);
  const middleware = createOptionalAuth(makeFakeDb(userRow), SECRET);
  const req = { headers: { authorization: "Bearer " + token } };
  const res = makeRes();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, userRow);
});
