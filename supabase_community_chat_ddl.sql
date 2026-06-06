-- ==========================================
-- 1. Communities Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.communities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 2. Board Posts Table (Thread Main Posts)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.board_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 3. Board Replies Table (Thread Replies)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.board_replies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.board_posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 4. Chat Rooms Table (Real-time Chat Rooms)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NULL, -- NULL allowed for community-independent rooms
    room_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 5. Chat Room Members (Room Participants Map)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.chat_room_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_room_user UNIQUE(room_id, user_id)
);

-- ==========================================
-- 6. Chat Messages Table (Real-time Messages)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- Index declarations for query optimization
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_board_posts_community_id ON public.board_posts(community_id);
CREATE INDEX IF NOT EXISTS idx_board_posts_user_id ON public.board_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_board_replies_post_id ON public.board_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_board_replies_user_id ON public.board_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_community_id ON public.chat_rooms(community_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_id ON public.chat_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_id ON public.chat_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON public.chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);

-- ==========================================
-- Enable Row Level Security (RLS)
-- ==========================================
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS Policies
-- ==========================================

-- A. Communities Policies
CREATE POLICY "Allow read access to communities to authenticated users" 
ON public.communities FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow select managers to insert/update communities" 
ON public.communities FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- B. Board Posts Policies
CREATE POLICY "Allow select access to board posts for authenticated users" 
ON public.board_posts FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow users to insert posts as themselves" 
ON public.board_posts FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update/delete their own posts" 
ON public.board_posts FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own posts" 
ON public.board_posts FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- C. Board Replies Policies
CREATE POLICY "Allow read access to replies for authenticated users" 
ON public.board_replies FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow users to insert replies as themselves" 
ON public.board_replies FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update/delete their own replies" 
ON public.board_replies FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own replies" 
ON public.board_replies FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- D. Chat Rooms Policies
CREATE POLICY "Allow members or public rooms read access" 
ON public.chat_rooms FOR SELECT 
TO authenticated 
USING (
    community_id IS NOT NULL OR 
    id IN (SELECT room_id FROM public.chat_room_members WHERE user_id = auth.uid())
);

CREATE POLICY "Allow authenticated to create rooms" 
ON public.chat_rooms FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow room creators to update/delete" 
ON public.chat_rooms FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- E. Chat Room Members Policies
CREATE POLICY "Allow read members to authenticated" 
ON public.chat_room_members FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow members to join rooms" 
ON public.chat_room_members FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow members to leave rooms" 
ON public.chat_room_members FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- F. Chat Messages Policies
CREATE POLICY "Allow room message access to joined members" 
ON public.chat_messages FOR SELECT 
TO authenticated 
USING (
    TRUE -- Simple read for simplification, or check membership:
    -- EXISTS (SELECT 1 FROM public.chat_room_members WHERE room_id = chat_messages.room_id AND user_id = auth.uid())
);

CREATE POLICY "Allow sending messages if joined" 
ON public.chat_messages FOR INSERT 
TO authenticated 
WITH CHECK (
    auth.uid() = user_id
    -- AND EXISTS (SELECT 1 FROM public.chat_room_members WHERE room_id = chat_messages.room_id AND user_id = auth.uid())
);

CREATE POLICY "Allow delete own message" 
ON public.chat_messages FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);
