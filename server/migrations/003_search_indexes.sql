-- Trigram indexes to accelerate ILIKE-based search on projects + users.
-- pg_trgm is available on Supabase by default.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_projects_title_trgm
  ON projects USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_projects_description_trgm
  ON projects USING GIN (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_display_name_trgm
  ON users USING GIN (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_bio_trgm
  ON users USING GIN (bio gin_trgm_ops);

-- username is CITEXT; use the text operator class for trigram support.
CREATE INDEX IF NOT EXISTS idx_users_username_trgm
  ON users USING GIN ((username::text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_user_work_tags_field_trgm
  ON user_work_tags USING GIN (work_field gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_user_work_tags_subfield_trgm
  ON user_work_tags USING GIN (work_subfield gin_trgm_ops);

COMMIT;
