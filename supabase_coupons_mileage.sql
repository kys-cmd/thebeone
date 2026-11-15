-- ============================================================================
-- 비원아카데미 LMS: 쿠폰(무료 강의 수강권) 및 마일리지 관리 인덱스 최적화 스크립트
-- 참고: 쿠폰 템플릿(coupon_template), 회원 쿠폰(user_coupon), 마일리지 로그(mileage_log)는
-- 기존 public.support_contents 및 public.profiles.mileage 컬럼과 완벽 호환되어 별도 마이그레이션 없이 즉시 작동하며,
-- 대용량 조회 성능 향상을 원할 경우 아래 인덱스를 선택적으로 실행할 수 있습니다.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_support_contents_type_title_active
  ON public.support_contents (type, title, is_deleted);

CREATE INDEX IF NOT EXISTS idx_support_contents_type_created_at
  ON public.support_contents (type, is_deleted, created_at DESC);
