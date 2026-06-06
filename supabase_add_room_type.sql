-- ==========================================
-- Update Chat Rooms Schema with type column
-- ==========================================
ALTER TABLE public.chat_rooms 
ADD COLUMN IF NOT EXISTS room_type TEXT DEFAULT 'public' CHECK (room_type IN ('public', 'private', 'dm'));

-- Update existing policies if necessary
DROP POLICY IF EXISTS "Allow members or public rooms read access" ON public.chat_rooms;

CREATE POLICY "Allow members or public rooms read access" 
ON public.chat_rooms FOR SELECT 
TO authenticated 
USING (
    room_type = 'public' OR 
    community_id IS NOT NULL OR 
    id IN (SELECT room_id FROM public.chat_room_members WHERE user_id = auth.uid())
);
