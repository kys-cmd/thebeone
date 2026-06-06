
-- Chat Rooms Table
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'public', -- 'public', 'private', 'one_to_one'
  password TEXT, -- For private rooms
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false
);

-- Chat Room Members Table
CREATE TABLE IF NOT EXISTS chat_room_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Community Invitations Table
CREATE TABLE IF NOT EXISTS community_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES profiles(id),
  invitee_email TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add room_id to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE;

-- Post Attendance Table
CREATE TABLE IF NOT EXISTS post_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Post Poll Votes Table
CREATE TABLE IF NOT EXISTS post_poll_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  option_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Post Todo Checks Table
CREATE TABLE IF NOT EXISTS post_todo_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  todo_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id, todo_index)
);

-- Chat Last Read Table
CREATE TABLE IF NOT EXISTS chat_last_read (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, community_id)
);

-- RLS Policies
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_todo_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_last_read ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Open for now as requested for rapid development, but keeping schema correct)
DROP POLICY IF EXISTS "Public Chat Rooms Access" ON chat_rooms;
CREATE POLICY "Public Chat Rooms Access" ON chat_rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Chat Rooms Insert" ON chat_rooms;
CREATE POLICY "Public Chat Rooms Insert" ON chat_rooms FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Chat Room Members Access" ON chat_room_members;
CREATE POLICY "Public Chat Room Members Access" ON chat_room_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Chat Room Members Insert" ON chat_room_members;
CREATE POLICY "Public Chat Room Members Insert" ON chat_room_members FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Invitations Access" ON community_invitations;
CREATE POLICY "Public Invitations Access" ON community_invitations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Invitations Insert" ON community_invitations;
CREATE POLICY "Public Invitations Insert" ON community_invitations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow All On post_attendance" ON post_attendance;
CREATE POLICY "Allow All On post_attendance" ON post_attendance FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow All On post_poll_votes" ON post_poll_votes;
CREATE POLICY "Allow All On post_poll_votes" ON post_poll_votes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow All On post_todo_checks" ON post_todo_checks;
CREATE POLICY "Allow All On post_todo_checks" ON post_todo_checks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow All On chat_last_read" ON chat_last_read;
CREATE POLICY "Allow All On chat_last_read" ON chat_last_read FOR ALL USING (true) WITH CHECK (true);
