/** Shared copy + links for in-app notifications. Load before public-nav.js. */
(function (global) {
  function labelForType(type, payload) {
    var p = payload || {};
    switch (type) {
      case "join_request_received":
        return (
          (p.requester_public_display_label || p.requester_username || "Someone") +
          " applied to join “" +
          (p.project_title || "a project") +
          ".”"
        );
      case "join_request_accepted":
        return "You were accepted into “" + (p.project_title || "a project") + ".”";
      case "join_request_declined":
        return "Your request to join “" + (p.project_title || "a project") + "” was declined.";
      case "project_invite_received":
        return (
          (p.inviter_public_display_label || p.inviter_username || "Someone") +
          " invited you to “" +
          (p.project_title || "a project") +
          ".”"
        );
      case "project_invite_accepted":
        return (
          (p.invitee_public_display_label || p.invitee_username || "They") +
          " accepted your invite to “" +
          (p.project_title || "a project") +
          ".”"
        );
      case "project_you_were_added":
        return "You joined “" + (p.project_title || "a project") + "” from an invitation.";
      case "dm_message_received":
        return (
          (p.sender_public_display_label || "Someone") +
          " messaged you" +
          (p.message_preview ? ": " + p.message_preview : ".")
        );
      default:
        return type || "Notification";
    }
  }

  function primaryLink(type, payload) {
    var p = payload || {};
    if (p.project_id) {
      return "project.html?id=" + encodeURIComponent(String(p.project_id));
    }
    if (type === "dm_message_received" && p.conversation_id != null) {
      return "messages.html?c=" + encodeURIComponent(String(p.conversation_id));
    }
    return null;
  }

  global.synodosNotificationHelpers = {
    labelForType: labelForType,
    primaryLink: primaryLink,
  };
})(typeof window !== "undefined" ? window : this);
