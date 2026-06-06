-- Ensure unique constraints for correct upsert behavior
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS unique_enrollment;
ALTER TABLE enrollments ADD CONSTRAINT unique_enrollment UNIQUE (user_id, course_id);

ALTER TABLE community_members DROP CONSTRAINT IF EXISTS unique_community_membership;
ALTER TABLE community_members ADD CONSTRAINT unique_community_membership UNIQUE (community_id, user_id);

-- Also add 'role' column to community_members if not exists (for 'excluded' status)
ALTER TABLE community_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';
