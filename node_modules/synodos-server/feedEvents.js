async function insertFeedEvent(db, actorUserId, eventType, payload) {
  const body = payload && typeof payload === "object" ? payload : {};
  await db.run(
    "INSERT INTO feed_events (actor_user_id, event_type, payload_json) VALUES ($1, $2, $3)",
    [Number(actorUserId), String(eventType), JSON.stringify(body)]
  );
}

const EVENT_TYPES = {
  PROJECT_CREATED: "project_created",
  ROLE_ADDED: "role_added",
  JOIN_ACCEPTED: "join_accepted",
  USER_FOLLOWED: "user_followed",
};

module.exports = { insertFeedEvent, EVENT_TYPES };
