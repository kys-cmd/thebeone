-- profiles 테이블에 누락된 컬럼을 추가합니다.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthdate DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile_phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- RLS 정책 확인 (이미 존재하는 경우를 대비해 IF NOT EXISTS는 정책 수준에서 지원되지 않으므로 수동 확인 필요)
-- 기본적으로 supabase_schema.sql 등에 정의된 정책이 활성화되어 있어야 합니다.
