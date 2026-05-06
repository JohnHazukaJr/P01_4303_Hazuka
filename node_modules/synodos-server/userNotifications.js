/** In-app notifications (bell + /notifications). */

const NOTIFICATION_TYPES = {
  JOIN_REQUEST_RECEIVED: "join_request_received",
  JOIN_REQUEST_ACCEPTED: "join_request_accepted",
  JOIN_REQUEST_DECLINED: "join_request_declined",
  PROJECT_INVITE_RECEIVED: "project_invite_received",
  PROJECT_INVITE_ACCEPTED: "project_invite_accepted",
  PROJECT_YOU_WERE_ADDED: "project_you_were_added",
  DM_MESSAGE_RECEIVED: "dm_message_received",
};

async function insertNotification(db, userId, type, payload) {
  try {
    const body = payload && typeof payload === "object" ? payload : {};
    await db.run(
      "INSERT INTO user_notifications (user_id, notification_type, payload_json) VALUES ($1, $2, $3)",
      [Number(userId), String(type), JSON.stringify(body)]
    );
  } catch (e) {
    console.error("[synodos] insertNotification", e);
  }
}

module.exports = {
  insertNotification,
  NOTIFICATION_TYPES,
};
