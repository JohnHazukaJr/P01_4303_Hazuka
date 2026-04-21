/** @param {import("node:sqlite").DatabaseSync} db */
function insertFeedEvent(db, actorUserId, eventType, payload) {
  const body = payload && typeof payload === "object" ? payload : {};
  db.prepare(
    `INSERT INTO feed_events (actor_user_id, event_type, payload_json) VALUES (?, ?, ?)`
  ).run(actorUserId, String(eventType), JSON.stringify(body));
}

const EVENT_TYPES = {
  PROJECT_CREATED: "project_created",
  ROLE_ADDED: "role_added",
  JOIN_ACCEPTED: "join_accepted",
  USER_FOLLOWED: "user_followed",
};

module.exports = { insertFeedEvent, EVENT_TYPES };
