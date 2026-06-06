-- Supabase SQL Editor 에 복사하여 실행해 주세요.

-- 1. 아직 없는 컬럼들이 있다면 추가해줍니다.
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS layout JSONB DEFAULT '{"blocks":[]}'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS curriculum JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS thumbnail TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS discount_price BIGINT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS instructor TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS instructor_title TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS instructor_bio TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS instructor_image TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS hero_bg_color TEXT DEFAULT '#0f172a';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS hero_text_color TEXT DEFAULT '#ffffff';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS outcomes TEXT[] DEFAULT '{}';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS recommended_for TEXT[] DEFAULT '{}';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'regular';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'automatic';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS location TEXT;

-- 2. PostgREST 스키마 캐시를 새로고침하여 에러(schema cache)를 해결합니다.
NOTIFY pgrst, 'reload schema';
