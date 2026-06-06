-- Supabase SQL Editor 에 복사하여 실행해 주세요.

-- 1. courses 테이블 칼럼 추가 (layout 컬럼 캐시 이슈 해결)
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS layout JSONB DEFAULT '{"blocks":[]}'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS curriculum JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS thumbnail TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS discount_price BIGINT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS instructor TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'regular';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'automatic';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS location TEXT;

-- 2. CMS 데이터 및 가짜 데이터 초기화 
-- (경고: 기존 등록된 사이트 정보, 강좌, 커뮤니티 등의 데이터가 모두 삭제됩니다!)
TRUNCATE TABLE public.courses CASCADE;
TRUNCATE TABLE public.banners CASCADE;
TRUNCATE TABLE public.communities CASCADE;
TRUNCATE TABLE public.reviews CASCADE;
TRUNCATE TABLE public.support_contents CASCADE;

-- 사이트 설정 기본값만 남기고 빈 값 복구
TRUNCATE TABLE public.site_config CASCADE;
INSERT INTO public.site_config (site_name, primary_color, footer_info)
VALUES ('비원아카데미', '#9333ea', '(주)비원아카데미 | 대표자: 김*수 | 사업자등록번호: 123-45-67890\n서울특별시 강남구 테헤란로 123, 4층\nCopyright © 2026 BE ONE. All Rights Reserved.');

-- 3. PostgREST 스키마 캐시 새로고침 (가장 마지막에 실행하여 캐시 오류 해결)
NOTIFY pgrst, 'reload schema';
