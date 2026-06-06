-- 커뮤니티 고도화를 위한 스키마 업데이트

-- 1. 게시글 반응(표정짓기) 테이블
CREATE TABLE IF NOT EXISTS public.post_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id, emoji)
);

-- 2. 메시지 반응(표정짓기) 테이블
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- 3. 메시지 답장 기능을 위한 컬럼 추가
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='messages' AND COLUMN_NAME='reply_to_id') THEN
        ALTER TABLE public.messages ADD COLUMN reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. 게시글 공지 고정 및 삭제 기능을 위한 컬럼 추가
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='posts' AND COLUMN_NAME='is_pinned') THEN
        ALTER TABLE public.posts ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='posts' AND COLUMN_NAME='is_deleted') THEN
        ALTER TABLE public.posts ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 기존 게시글들의 is_deleted가 NULL인 경우 false로 업데이트
UPDATE public.posts SET is_deleted = false WHERE is_deleted IS NULL;

-- 5. 메시지 삭제 기능
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='messages' AND COLUMN_NAME='is_deleted') THEN
        ALTER TABLE public.messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 기존 메시지들의 is_deleted가 NULL인 경우 false로 업데이트
UPDATE public.messages SET is_deleted = false WHERE is_deleted IS NULL;

-- 6. 게시글 수정/삭제 RLS 정책
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있을 수 있으므로 체크 후 추가
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Users can update their own posts') THEN
        CREATE POLICY "Users can update their own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

-- RLS 정책 설정 (반응 관련)
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능 (혹은 가입자만)
CREATE POLICY "Allow authenticated to view post reactions" ON public.post_reactions FOR SELECT USING (true);
CREATE POLICY "Allow authenticated to manage their own post reactions" ON public.post_reactions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated to view message reactions" ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "Allow authenticated to manage their own message reactions" ON public.message_reactions FOR ALL USING (auth.uid() = user_id);
