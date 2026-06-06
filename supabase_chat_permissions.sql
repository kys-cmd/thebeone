
-- Missing DELETE and UPDATE policies for Chat feature
-- Run this in your Supabase SQL Editor to enable deletion and soft-deletion

-- Chat Rooms
DROP POLICY IF EXISTS "Public Chat Rooms Update" ON chat_rooms;
CREATE POLICY "Public Chat Rooms Update" ON chat_rooms FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Chat Rooms Delete" ON chat_rooms;
CREATE POLICY "Public Chat Rooms Delete" ON chat_rooms FOR DELETE USING (true);

-- Chat Room Members
DROP POLICY IF EXISTS "Public Chat Room Members Update" ON chat_room_members;
CREATE POLICY "Public Chat Room Members Update" ON chat_room_members FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Chat Room Members Delete" ON chat_room_members;
CREATE POLICY "Public Chat Room Members Delete" ON chat_room_members FOR DELETE USING (true);

-- Messages
DROP POLICY IF EXISTS "Public Messages Update" ON messages;
CREATE POLICY "Public Messages Update" ON messages FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Messages Delete" ON messages;
CREATE POLICY "Public Messages Delete" ON messages FOR DELETE USING (true);

-- Message Reactions
DROP POLICY IF EXISTS "Public Message Reactions Delete" ON message_reactions;
CREATE POLICY "Public Message Reactions Delete" ON message_reactions FOR DELETE USING (true);
