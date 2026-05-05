const {
  enrichTag,
  isValidWorkField,
  isValidWorkSubfield,
} = require("./profileFields");

const USER_PROFILE_COLUMNS =
  "id, username, display_name, public_display_as, bio, avatar_url, work_field, work_subfield, verified, official_account";

function sqlSelectUserProfileById() {
  return `SELECT ${USER_PROFILE_COLUMNS} FROM users WHERE id = $1`;
}

function sqlSelectUserProfileByUsername() {
  return `SELECT ${USER_PROFILE_COLUMNS} FROM users WHERE username = $1`;
}

async function loadUserProfileRow(db, userId) {
  return db.get(sqlSelectUserProfileById(), [userId]);
}

async function loadUserWorkTags(db, userId) {
  const rows = await db.all(
    "SELECT work_field, work_subfield FROM user_work_tags WHERE user_id = $1 ORDER BY id ASC",
    [userId]
  );
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    out.push(enrichTag(rows[i].work_field, rows[i].work_subfield));
  }
  return out;
}

function profileCompleteFromRow(row, tags) {
  const dnOk = String(row.display_name || "").trim().length >= 2;
  if (!dnOk) return false;
  if (tags && tags.length > 0) {
    for (let i = 0; i < tags.length; i++) {
      const t = tags[i];
      if (
        isValidWorkField(t.work_field) &&
        isValidWorkSubfield(t.work_field, t.work_subfield)
      ) {
        return true;
      }
    }
  }
  const wf = String(row.work_field || "").trim();
  const ws = String(row.work_subfield || "").trim();
  return (
    wf.length > 0 &&
    ws.length > 0 &&
    isValidWorkField(wf) &&
    isValidWorkSubfield(wf, ws)
  );
}

module.exports = {
  USER_PROFILE_COLUMNS,
  sqlSelectUserProfileById,
  sqlSelectUserProfileByUsername,
  loadUserProfileRow,
  loadUserWorkTags,
  profileCompleteFromRow,
};
