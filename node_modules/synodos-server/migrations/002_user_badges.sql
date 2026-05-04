-- Split identity verification from platform "official" accounts.
-- verified = identity verified (manual or future automated flow).
-- official_account = notable org / staff / brand (admin-granted only).

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS official_account BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
