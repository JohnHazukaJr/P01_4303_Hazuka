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
const fs = require("fs");

const AVATAR_MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const AVATAR_MAX_BYTES = 512 * 1024;

let cachedClient = null;

// #region agent log
function dbgSupabaseRoleFromJwt(key) {
  try {
    const parts = String(key || "").split(".");
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = Buffer.from(b64, "base64").toString("utf8");
    const obj = JSON.parse(json);
    return obj && obj.role != null ? String(obj.role) : null;
  } catch (_) {
    return null;
  }
}

function dbgPost(hypothesisId, location, message, data) {
  try {
    const payload = {
      sessionId: "7dfff8",
      runId: "pre-fix",
      hypothesisId,
      location,
      message,
      data: data || {},
      timestamp: Date.now(),
    };

    // Primary: write directly to the provisioned NDJSON log file (most reliable).
    try {
      fs.appendFileSync("debug-7dfff8.log", JSON.stringify(payload) + "\n");
    } catch (_) {}

    // Secondary: also try the HTTP ingest if available.
    if (typeof fetch === "function") {
      fetch(
        "http://127.0.0.1:7462/ingest/2e0e05ed-2293-4597-b6c6-1abe56458da5",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "7dfff8",
          },
          body: JSON.stringify(payload),
        }
      ).catch(function () {});
    }
  } catch (_) {}
}
// #endregion

function getBucket() {
  return String(process.env.SUPABASE_AVATAR_BUCKET || "avatars").trim();
}

/**
 * Ensure the avatar bucket exists (create public bucket if missing).
 * Service-role clients can usually create buckets; some org policies block this — then the user must create it in the dashboard.
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
async function ensureAvatarBucket(client, bucketName) {
  const { data: buckets, error: listErr } = await client.storage.listBuckets();
  if (listErr) {
    // #region agent log
    dbgPost("D", "server/storage.js:ensureAvatarBucket", "listBuckets error", {
      bucketName,
      errName: listErr && listErr.name ? String(listErr.name) : null,
      errMessage: listErr && listErr.message ? String(listErr.message) : null,
      statusCode:
        listErr && listErr.statusCode != null ? listErr.statusCode : null,
      cause:
        listErr && listErr.cause && listErr.cause.message
          ? String(listErr.cause.message)
          : null,
    });
    // #endregion
    var lm = listErr.message || "Could not access Storage";
    var extra = "";
    if (/row-level security|rls policy|violates row-level/i.test(String(lm))) {
      extra = rlsServiceRoleHint(bucketName);
    } else {
      extra =
        " — Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Settings → API → **service_role** secret, not anon).";
    }
    return {
      ok: false,
      error: lm + extra,
    };
  }
  const exists = (buckets || []).some(function (b) {
    return b && b.name === bucketName;
  });
  if (exists) {
    return { ok: true };
  }

  const { error: createErr } = await client.storage.createBucket(bucketName, {
    public: true,
  });
  if (!createErr) {
    return { ok: true };
  }
  // #region agent log
  dbgPost("E", "server/storage.js:ensureAvatarBucket", "createBucket error", {
    bucketName,
    errName: createErr && createErr.name ? String(createErr.name) : null,
    errMessage: createErr && createErr.message ? String(createErr.message) : null,
    statusCode:
      createErr && createErr.statusCode != null ? createErr.statusCode : null,
    cause:
      createErr && createErr.cause && createErr.cause.message
        ? String(createErr.cause.message)
        : null,
  });
  // #endregion
  const msg = String(createErr.message || "");
  if (/already exists|duplicate/i.test(msg)) {
    return { ok: true };
  }
  return {
    ok: false,
    error:
      msg +
      ' — In Supabase: open **Storage** → **New bucket** → name it **' +
      bucketName +
      "** → enable **Public bucket** → Create. Or set `SUPABASE_AVATAR_BUCKET` in `.env` to a bucket you already created.",
  };
}

function rlsServiceRoleHint(bucketName) {
  const b =
    bucketName && String(bucketName).trim()
      ? String(bucketName).trim()
      : getBucket();
  return (
    " Fix: In Supabase go to **Settings → API** and copy the **service_role** key (secret), " +
    "not the anon / publishable key — put it in `SUPABASE_SERVICE_ROLE_KEY` on the API host and restart. " +
    "With the anon key, Storage RLS blocks uploads. Also ensure bucket **" +
    b +
    "** exists and is **public** (Storage → bucket → Public)."
  );
}

function formatStorageError(bucket, upErr) {
  const raw = (upErr && upErr.message) || "Avatar upload failed";
  if (/row-level security|rls policy|violates row-level/i.test(raw)) {
    return raw + "." + rlsServiceRoleHint(bucket);
  }
  if (/bucket not found|not found|does not exist/i.test(raw)) {
    return (
      raw +
      ' — Create a **public** Storage bucket named **' +
      bucket +
      "** (Supabase dashboard → Storage → New bucket), or set `SUPABASE_AVATAR_BUCKET` to match your bucket name, then restart the API."
    );
  }
  return raw;
}

function getClient() {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // #region agent log
    dbgPost(
      "A",
      "server/storage.js:getClient",
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      {
        hasUrl: !!url,
        hasKey: !!key,
      }
    );
    // #endregion
    throw new Error(
      "[synodos] Avatar uploads require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  // #region agent log
  dbgPost(
    "A",
    "server/storage.js:getClient",
    "Creating Supabase client for Storage",
    {
      supabaseUrlHost: String(url).replace(/^https?:\/\//i, "").split("/")[0],
      keyRole: dbgSupabaseRoleFromJwt(key),
      keyLen: String(key).length,
      keyDotParts: String(key).split(".").length,
    }
  );
  // #endregion
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
  // #region agent log
  dbgPost("B", "server/storage.js:uploadAvatar", "Starting avatar upload", {
    userId: String(userId),
    mime,
    bytes: buffer && buffer.length ? buffer.length : 0,
    bucket,
  });
  // #endregion
  if (!bucket) {
    return {
      ok: false,
      error:
        "SUPABASE_AVATAR_BUCKET is empty. Set it in server/.env (e.g. SUPABASE_AVATAR_BUCKET=avatars).",
    };
  }

  const ensured = await ensureAvatarBucket(client, bucket);
  if (!ensured.ok) {
    return { ok: false, error: ensured.error };
  }

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
    // #region agent log
    dbgPost("C", "server/storage.js:uploadAvatar", "Supabase upload error", {
      bucket,
      objectKey: newKey,
      errName: upErr && upErr.name ? String(upErr.name) : null,
      errMessage: upErr && upErr.message ? String(upErr.message) : null,
      statusCode: upErr && upErr.statusCode != null ? upErr.statusCode : null,
      cause:
        upErr && upErr.cause && upErr.cause.message
          ? String(upErr.cause.message)
          : null,
    });
    // #endregion
    return {
      ok: false,
      error: formatStorageError(bucket, upErr),
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
