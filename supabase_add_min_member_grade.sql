-- Supabase SQL Editor 에서 복사하여 실행해 주세요.

-- 1. courses 테이블에 수강 가능 회원 등급 컬럼(min_member_grade)을 추가합니다.
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS min_member_grade TEXT DEFAULT NULL;

-- 2. PostgREST 스키마 캐시를 새로고침하여 수정한 스키마를 즉시 인식시킵니다.
NOTIFY pgrst, 'reload schema';
