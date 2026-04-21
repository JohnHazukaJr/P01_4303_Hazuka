/** In-app notifications (bell + /notifications). */

const NOTIFICATION_TYPES = {
  JOIN_REQUEST_RECEIVED: "join_request_received",
  JOIN_REQUEST_ACCEPTED: "join_request_accepted",
  JOIN_REQUEST_DECLINED: "join_request_declined",
  PROJECT_INVITE_RECEIVED: "project_invite_received",
  PROJECT_INVITE_ACCEPTED: "project_invite_accepted",
  PROJECT_YOU_WERE_ADDED: "project_you_were_added",
};

/** @param {import("node:sqlite").DatabaseSync} db */
function insertNotification(db, userId, type, payload) {
  try {
    const body = payload && typeof payload === "object" ? payload : {};
    db.prepare(
      `INSERT INTO user_notifications (user_id, notification_type, payload_json) VALUES (?, ?, ?)`
    ).run(Number(userId), String(type), JSON.stringify(body));
  } catch (e) {
    console.error("[synodos] insertNotification", e);
  }
}

module.exports = {
  insertNotification,
  NOTIFICATION_TYPES,
};
