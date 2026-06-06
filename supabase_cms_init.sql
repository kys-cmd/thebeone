-- CMS 및 관련 테이블 생성 SQL 
-- Supabase SQL Editor 에 복사하여 실행해 주세요.

-- 1. Banners 테이블
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    image TEXT, -- nullable로 변경 (이미지 없을 수 있음)
    bg_color TEXT DEFAULT '#000000',
    video_url TEXT,
    active BOOLEAN DEFAULT true,
    link TEXT,
    "order" INTEGER DEFAULT 0,
    type TEXT DEFAULT 'main', -- main, course, special 등
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Communities Category 테이블 (이미 존재할 수 있지만, 관련된 CMS 컬럼 추가)
-- 이미 communities 테이블이 있다면 필요한 컬럼만 추가하세요.
CREATE TABLE IF NOT EXISTS public.communities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    icon TEXT,
    color TEXT,
    banner_url TEXT,
    feature_board BOOLEAN DEFAULT true,
    feature_chat BOOLEAN DEFAULT false,
    feature_gallery BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 기존 커뮤니티 테이블이 있는 경우를 대비한 ALTER 구문 (오류 무시 가능)
DO $$ 
BEGIN 
    BEGIN ALTER TABLE public.communities ADD COLUMN is_active BOOLEAN DEFAULT true; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.communities ADD COLUMN icon TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.communities ADD COLUMN color TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.communities ADD COLUMN banner_url TEXT; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.communities ADD COLUMN feature_board BOOLEAN DEFAULT true; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.communities ADD COLUMN feature_chat BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN END;
    BEGIN ALTER TABLE public.communities ADD COLUMN feature_gallery BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN END;
END $$;

-- 3. Support Contents 테이블 (공지사항, FAQ 등)
CREATE TABLE IF NOT EXISTS public.support_contents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL, -- 'notice', 'faq', 'suggestion'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Site Config 테이블
CREATE TABLE IF NOT EXISTS public.site_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_name TEXT DEFAULT '비원아카데미',
    logo_url TEXT,
    favicon_url TEXT,
    primary_color TEXT DEFAULT '#9333ea',
    footer_info TEXT,
    -- 이벤트 배너 설정 추가
    event_banner_show BOOLEAN DEFAULT true,
    event_banner_text TEXT DEFAULT '비원아카데미 오픈 기념! 모든 정규강의 최대 50% 페이백 챌린지 참여하기 ➔',
    event_banner_link TEXT,
    event_banner_bg_color TEXT DEFAULT '#9333ea',
    event_banner_text_color TEXT DEFAULT '#ffffff',
    banner_interval INTEGER DEFAULT 5000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 기존 테이블이 있는 경우를 대비한 컬럼 추가 SQL
DO $$ 
BEGIN 
    -- event_banner_show 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_config' AND column_name='event_banner_show') THEN
        ALTER TABLE public.site_config ADD COLUMN event_banner_show BOOLEAN DEFAULT true;
    END IF;

    -- event_banner_text 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_config' AND column_name='event_banner_text') THEN
        ALTER TABLE public.site_config ADD COLUMN event_banner_text TEXT DEFAULT '비원아카데미 오픈 기념! 모든 정규강의 최대 50% 페이백 챌린지 참여하기 ➔';
    END IF;

    -- event_banner_link 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_config' AND column_name='event_banner_link') THEN
        ALTER TABLE public.site_config ADD COLUMN event_banner_link TEXT;
    END IF;

    -- event_banner_bg_color 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_config' AND column_name='event_banner_bg_color') THEN
        ALTER TABLE public.site_config ADD COLUMN event_banner_bg_color TEXT DEFAULT '#9333ea';
    END IF;

    -- event_banner_text_color 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_config' AND column_name='event_banner_text_color') THEN
        ALTER TABLE public.site_config ADD COLUMN event_banner_text_color TEXT DEFAULT '#ffffff';
    END IF;

    -- banners subtitle 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='banners' AND column_name='subtitle') THEN
        ALTER TABLE public.banners ADD COLUMN subtitle TEXT;
    END IF;

    -- banners html_content 컬럼 추가 (직접 디자인 가능하도록)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='banners' AND column_name='html_content') THEN
        ALTER TABLE public.banners ADD COLUMN html_content TEXT;
    END IF;

    -- banners video_url 컬럼 추가 (비메오 등 동영상 지원)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='banners' AND column_name='video_url') THEN
        ALTER TABLE public.banners ADD COLUMN video_url TEXT;
    END IF;

    -- banners bg_color 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='banners' AND column_name='bg_color') THEN
        ALTER TABLE public.banners ADD COLUMN bg_color TEXT DEFAULT '#000000';
    END IF;

    -- banners image 컬럼 NULL 허용으로 변경
    ALTER TABLE public.banners ALTER COLUMN image DROP NOT NULL;

    -- site_config banner_interval 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_config' AND column_name='banner_interval') THEN
        ALTER TABLE public.site_config ADD COLUMN banner_interval INTEGER DEFAULT 5000;
    END IF;
END $$;

-- PostgREST 스키마 캐시 갱신 (선택 사항, 보통 자동이나 명시적으로 갱신 시도)
NOTIFY pgrst, 'reload schema';

-- 4.1 RLS 보안 설정
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
DROP POLICY IF EXISTS "Allow public read on site_config" ON public.site_config;
CREATE POLICY "Allow public read on site_config" 
ON public.site_config FOR SELECT 
USING (true);

-- 모든 사용자(또는 익명 사용자)가 업데이트 가능 (실 운영시에는 관리자만 가능하도록 auth.uid() 체크 필요)
DROP POLICY IF EXISTS "Allow public update on site_config" ON public.site_config;
CREATE POLICY "Allow public update on site_config" 
ON public.site_config FOR UPDATE 
USING (true)
WITH CHECK (true);

-- 4.2 Banners RLS 보안 설정
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
DROP POLICY IF EXISTS "Allow public read on banners" ON public.banners;
CREATE POLICY "Allow public read on banners" 
ON public.banners FOR SELECT 
USING (true);

-- 모든 사용자(또는 익명 사용자)가 추가/수정/삭제 가능
-- 실 운영 환경에서는 특정 관리자만 가능하게 설정해야 합니다.
DROP POLICY IF EXISTS "Allow public insert on banners" ON public.banners;
CREATE POLICY "Allow public insert on banners" 
ON public.banners FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update on banners" ON public.banners;
CREATE POLICY "Allow public update on banners" 
ON public.banners FOR UPDATE 
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on banners" ON public.banners;
CREATE POLICY "Allow public delete on banners" 
ON public.banners FOR DELETE 
USING (true);

-- 5. 기본 설정 데이터 1건 추가 (site_config)
INSERT INTO public.site_config (
    site_name, 
    primary_color, 
    footer_info, 
    event_banner_show, 
    event_banner_text, 
    event_banner_bg_color, 
    event_banner_text_color
)
SELECT 
    '비원아카데미', 
    '#9333ea', 
    '(주)비원아카데미 | 대표자: 김*수 | 사업자등록번호: 123-45-67890\n서울특별시 강남구 테헤란로 123, 4층\nCopyright © 2026 BE ONE. All Rights Reserved.',
    true,
    '비원아카데미 오픈 기념! 모든 정규강의 최대 50% 페이백 챌린지 참여하기 ➔',
    '#9333ea',
    '#ffffff'
WHERE NOT EXISTS (SELECT 1 FROM public.site_config LIMIT 1);


-- ==========================================
-- STORAGE 룰 설정 (파일 업로드 용)
-- ==========================================
-- Supabase 대시보드 -> Storage 에서 'public-assets' 라는 이름의 Bucket을 Public 으로 생성한 후 아래를 실행하세요.

-- 퍼블릭 접근 허용 (누구나 이미지 읽기 가능)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'public-assets' );

-- 로그인된 사용자만 이미지 업로드 가능 (필요시 관리자 권한으로 변경)
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'public-assets' AND auth.role() = 'authenticated' );

-- 6. Reviews 테이블 (수강후기)
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID, -- REFERENCES courses(id)
    course_title TEXT,
    user_id UUID,
    user_name TEXT,
    user_avatar TEXT,
    content TEXT NOT NULL,
    rating INTEGER DEFAULT 5,
    is_best BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 6.1 Reviews 정책
DROP POLICY IF EXISTS "Allow public read on reviews" ON public.reviews;
CREATE POLICY "Allow public read on reviews" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;
CREATE POLICY "Authenticated users can insert reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can manage their own reviews" ON public.reviews;
CREATE POLICY "Users can manage their own reviews" ON public.reviews FOR ALL USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 7. Chat Last Read 테이블 (채팅 읽음 확인용)
CREATE TABLE IF NOT EXISTS public.chat_last_read (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    community_id UUID REFERENCES public.communities(id),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, community_id)
);

ALTER TABLE public.chat_last_read ENABLE ROW LEVEL SECURITY;

-- 겹침 방지를 위해 기존 정책 삭제 후 생성
DROP POLICY IF EXISTS "Users can manage their own last_read" ON public.chat_last_read;
CREATE POLICY "Users can manage their own last_read" ON public.chat_last_read FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own objects" ON storage.objects;
CREATE POLICY "Users can update their own objects"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'public-assets' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Users can delete their own objects" ON storage.objects;
CREATE POLICY "Users can delete their own objects"
ON storage.objects FOR DELETE
USING ( bucket_id = 'public-assets' AND auth.uid() = owner);
