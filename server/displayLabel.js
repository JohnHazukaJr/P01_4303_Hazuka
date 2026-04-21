function publicDisplayLabel(row) {
  const pref = String(row.public_display_as || "username").toLowerCase();
  const un = row.username != null ? String(row.username).trim() : "";
  const dn = row.display_name != null ? String(row.display_name).trim() : "";
  if (pref === "full_name" && dn.length >= 2) return dn;
  if (un) return un;
  if (dn.length >= 2) return dn;
  return un || "Member";
}

module.exports = { publicDisplayLabel };
