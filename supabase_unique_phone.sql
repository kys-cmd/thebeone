-- ============================================================================
-- 휴대폰 번호 기반 중복 회원가입 방지
-- ----------------------------------------------------------------------------
-- 휴대폰 번호를 회원 식별 Key로 사용한다.
-- 애플리케이션에서 가입/기본정보 저장 전에 중복을 확인하지만,
-- 동시 요청(경합)이나 API를 우회한 직접 입력까지 막으려면 DB 제약이 필요하다.
--
-- Supabase SQL Editor에서 아래 순서대로 실행한다.
-- ============================================================================

-- 1) 저장 형식(하이픈 유무)에 관계없이 비교할 수 있도록 숫자만 남기는 함수
CREATE OR REPLACE FUNCTION public.normalize_phone(p TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(p, ''), '[^0-9]', '', 'g'), '')
$$;

-- ----------------------------------------------------------------------------
-- 2) [필수 확인] 이미 중복된 번호가 있으면 3)의 인덱스 생성이 실패한다.
--    아래 쿼리로 먼저 확인하고, 중복 계정을 정리(또는 is_deleted = true 처리)한 뒤 진행할 것.
-- ----------------------------------------------------------------------------
-- SELECT public.normalize_phone(mobile_phone) AS phone,
--        COUNT(*) AS cnt,
--        array_agg(id) AS profile_ids,
--        array_agg(email) AS emails
--   FROM public.profiles
--  WHERE is_deleted = false
--    AND public.normalize_phone(mobile_phone) IS NOT NULL
--  GROUP BY 1
-- HAVING COUNT(*) > 1
--  ORDER BY cnt DESC;

-- ----------------------------------------------------------------------------
-- 3) 탈퇴하지 않은(is_deleted = false) 회원에 한해 휴대폰 번호를 고유하게 강제
--    탈퇴 회원의 번호는 재가입에 사용할 수 있도록 인덱스 대상에서 제외한다.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS profiles_mobile_phone_unique_idx
    ON public.profiles (public.normalize_phone(mobile_phone))
    WHERE is_deleted = false
      AND public.normalize_phone(mobile_phone) IS NOT NULL;

-- 4) 조회 성능 보조 인덱스 (아이디 찾기 / 중복 확인용)
CREATE INDEX IF NOT EXISTS profiles_phone_lookup_idx
    ON public.profiles (public.normalize_phone(phone))
    WHERE is_deleted = false;
