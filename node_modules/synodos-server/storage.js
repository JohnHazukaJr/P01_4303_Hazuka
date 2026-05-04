/**
 * Supabase Storage adapter for user avatars.
 *
 * Relational app data (projects, messages, notifications, …) lives in
 * Postgres via DATABASE_URL — not here. This module is only for binary
 * profile images.
 *
 * The bucket is expected to be public so that <img src> can load avatars
 * directly from Supabase's CDN. The service-role key is used server-side
 * for writes; it must never be shipped to the browser.
 */

const { createClient } = require("@supabase/supabase-js");

const AVATAR_MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const AVATAR_MAX_BYTES = 512 * 1024;

let cachedClient = null;

function getBucket() {
  return String(process.env.SUPABASE_AVATAR_BUCKET || "avatars");
}

function getClient() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "[synodos] Avatar uploads require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

function avatarKey(userId, ext) {
  return String(userId) + ext;
}

function allAvatarKeys(userId) {
  return Object.keys(AVATAR_MIME_EXT).map(function (mime) {
    return avatarKey(userId, AVATAR_MIME_EXT[mime]);
  });
}

/**
 * Upload (or overwrite) the avatar for `userId`.
 * @param {number|string} userId
 * @param {Buffer} buffer
 * @param {string} mime - one of the AVATAR_MIME_EXT keys
 * @returns {Promise<{ok: true, url: string} | {ok: false, error: string}>}
 */
async function uploadAvatar(userId, buffer, mime) {
  const ext = AVATAR_MIME_EXT[mime];
  if (!ext) {
    return { ok: false, error: "Use JPEG, PNG, GIF, or WebP" };
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, error: "Empty image data" };
  }
  if (buffer.length > AVATAR_MAX_BYTES) {
    return { ok: false, error: "Image too large (max 512 KB)" };
  }

  let client;
  try {
    client = getClient();
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : "Storage misconfigured" };
  }

  const bucket = getBucket();
  const newKey = avatarKey(userId, ext);

  const stalePeers = allAvatarKeys(userId).filter(function (k) {
    return k !== newKey;
  });
  if (stalePeers.length > 0) {
    try {
      await client.storage.from(bucket).remove(stalePeers);
    } catch (_) {
      // Ignore: missing-object errors are expected and harmless.
    }
  }

  const { error: upErr } = await client.storage
    .from(bucket)
    .upload(newKey, buffer, {
      contentType: mime,
      upsert: true,
      cacheControl: "3600",
    });
  if (upErr) {
    return {
      ok: false,
      error: upErr.message || "Avatar upload failed",
    };
  }

  const { data: pub } = client.storage.from(bucket).getPublicUrl(newKey);
  if (!pub || !pub.publicUrl) {
    return { ok: false, error: "Storage returned no public URL" };
  }
  return { ok: true, url: pub.publicUrl };
}

/**
 * Remove every avatar variant for `userId` from the bucket. Idempotent.
 * @param {number|string} userId
 */
async function deleteAvatar(userId) {
  let client;
  try {
    client = getClient();
  } catch (_) {
    return;
  }
  const bucket = getBucket();
  try {
    await client.storage.from(bucket).remove(allAvatarKeys(userId));
  } catch (_) {}
}

module.exports = {
  AVATAR_MIME_EXT,
  AVATAR_MAX_BYTES,
  uploadAvatar,
  deleteAvatar,
  getBucket,
};
