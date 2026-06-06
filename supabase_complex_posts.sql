-- Upgrade posts table to support complex content
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_json JSONB;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags TEXT[];

-- Update RLS policies (just in case)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Note: we already have post_attendance, post_poll_votes, post_todo_checks from previous migrations.
-- We will continue using them for tracking participation, while storing definitions in content_json if needed.
