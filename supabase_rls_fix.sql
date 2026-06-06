-- ==============================================================================
-- 비원아카데미 수퍼베이스 RLS(Row Level Security) 및 테이블 제어 마이그레이션 SQL
-- 
-- 적용 사항:
-- 1. 중복 확인용 `public.is_admin()` 세이프티 가드 헬퍼 함수 정의 (Profiles recursion 방지)
-- 2. `lesson_progress` 테이블 추가
-- 3. 모든 테이블 RLS 활성화 및 구체적인 접근 제어(Security ACL level) 정책 설계
-- 4. 개발용 완전허용("Dev allow all") 레거시 정책 정리
-- ==============================================================================

-- 1. 관리자 및 슈퍼어드민 검증용 DEFINER 헬퍼 함수 정의 (Profiles 레커전 방지 핵심 모델)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin' OR email = 'kys@k-learn.co.kr')
    AND is_deleted = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. 학습 진도율 기록용 `lesson_progress` 테이블 생성
CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    watched_time INTEGER DEFAULT 0, -- 초 단위 시청 기록
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, course_id, lesson_id)
);


-- 3. RLS 점검을 위한 테이블 목록 보호 레벨 확보
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_lines ENABLE ROW LEVEL SECURITY;


-- 4. 기존 열려있던 Dev allow all 및 기타 충돌 방지를 위한 구 정책 일괄 드롭
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND policyname IN (
            'Profiles are open for dev', 'Dev allow all enrollments', 'Dev allow all communities',
            'Dev allow all posts', 'Dev allow all messages', 'Dev allow all courses',
            'Dev allow all accounts', 'Dev allow all transactions', 'Dev allow all transaction_lines',
            'Dev allow all banners', 'Dev allow all support_contents', 'Dev allow all site_config',
            'Dev allow all orders', 'Dev allow all community_members', 'Dev allow all instructors',
            'Dev allow all payment_settings', 'Profiles are viewable by everyone', 'Admins can manage communities',
            'Members are viewable by everyone', 'Users can join communities', 'Admins can manage community members',
            'Admins can manage all posts', 'Admins can manage all messages'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END
$$;


-- ==============================================================================
-- [테이블별 정밀 RLS 정책 설계 목록]
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- A. profiles (사용자 프로필)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles 
    FOR SELECT TO authenticated USING (true); -- 로그인한 유저 상호 조회 허용 (게시판/리뷰 표시용)

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles 
    FOR UPDATE TO authenticated USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_all_admin" ON public.profiles;
CREATE POLICY "profiles_all_admin" ON public.profiles 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- B. orders (결제 주문 건)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
CREATE POLICY "orders_select_policy" ON public.orders 
    FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "orders_insert_policy" ON public.orders;
CREATE POLICY "orders_insert_policy" ON public.orders 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "orders_all_admin" ON public.orders;
CREATE POLICY "orders_all_admin" ON public.orders 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- C. enrollments (수강 권한 내역)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "enrollments_select_policy" ON public.enrollments;
CREATE POLICY "enrollments_select_policy" ON public.enrollments 
    FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "enrollments_insert_policy" ON public.enrollments;
CREATE POLICY "enrollments_insert_policy" ON public.enrollments 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "enrollments_all_admin" ON public.enrollments;
CREATE POLICY "enrollments_all_admin" ON public.enrollments 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- D. lesson_progress (학습 개별 강좌 진도 기록)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "lesson_progress_select_policy" ON public.lesson_progress;
CREATE POLICY "lesson_progress_select_policy" ON public.lesson_progress 
    FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "lesson_progress_write_policy" ON public.lesson_progress;
CREATE POLICY "lesson_progress_write_policy" ON public.lesson_progress 
    FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());


-- ------------------------------------------------------------------------------
-- E. community_members (커뮤니티 소속 여부)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "community_members_select_policy" ON public.community_members;
CREATE POLICY "community_members_select_policy" ON public.community_members 
    FOR SELECT TO authenticated USING (true); -- 커뮤니티 채팅 등 상호 소통을 위해 가입자 목록 조회 허용

DROP POLICY IF EXISTS "community_members_insert_policy" ON public.community_members;
CREATE POLICY "community_members_insert_policy" ON public.community_members 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "community_members_all_admin" ON public.community_members;
CREATE POLICY "community_members_all_admin" ON public.community_members 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- F. admin tables (어드민 전용 및 보안 정보 관리 영역)
-- ------------------------------------------------------------------------------

-- payment_settings (결제 대행 및 서명 시크릿 키 - 외부 노출 원천 차단)
DROP POLICY IF EXISTS "payment_settings_admin_only" ON public.payment_settings;
CREATE POLICY "payment_settings_admin_only" ON public.payment_settings 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- accounting_accounts (회계 계정과목 대장)
DROP POLICY IF EXISTS "accounting_accounts_admin_only" ON public.accounting_accounts;
CREATE POLICY "accounting_accounts_admin_only" ON public.accounting_accounts 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- transactions (회계 거래 전표)
DROP POLICY IF EXISTS "transactions_admin_only" ON public.transactions;
CREATE POLICY "transactions_admin_only" ON public.transactions 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- transaction_lines (회계 분개 상세 내역)
DROP POLICY IF EXISTS "transaction_lines_admin_only" ON public.transaction_lines;
CREATE POLICY "transaction_lines_admin_only" ON public.transaction_lines 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Courses (강의 정보 조회는 일반 오픈, 변경/쓰기는 admin만)
DROP POLICY IF EXISTS "courses_select_policy" ON public.courses;
CREATE POLICY "courses_select_policy" ON public.courses 
    FOR SELECT USING (is_deleted = false); -- 비회원도 강의 목록 구경 가능

DROP POLICY IF EXISTS "courses_write_admin_only" ON public.courses;
CREATE POLICY "courses_write_admin_only" ON public.courses 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Communities (커뮤니티 메인 조회 오픈, 변경은 admin만)
DROP POLICY IF EXISTS "communities_select_policy" ON public.communities;
CREATE POLICY "communities_select_policy" ON public.communities 
    FOR SELECT USING (is_deleted = false);

DROP POLICY IF EXISTS "communities_write_admin_only" ON public.communities;
CREATE POLICY "communities_write_admin_only" ON public.communities 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Support Contents (공지/FAQ 등: 일반 조회 오픈, 변경은 admin 전용)
DROP POLICY IF EXISTS "support_contents_select_policy" ON public.support_contents;
CREATE POLICY "support_contents_select_policy" ON public.support_contents 
    FOR SELECT USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "support_contents_all_admin" ON public.support_contents;
CREATE POLICY "support_contents_all_admin" ON public.support_contents 
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Instructors / Banners / Site Config (일반 조회 오픈, 변경은 admin 전용)
DROP POLICY IF EXISTS "instructors_select_policy" ON public.instructors;
CREATE POLICY "instructors_select_policy" ON public.instructors FOR SELECT USING (is_deleted = false);
DROP POLICY IF EXISTS "instructors_write_admin_only" ON public.instructors;
CREATE POLICY "instructors_write_admin_only" ON public.instructors FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "banners_select_policy" ON public.banners;
CREATE POLICY "banners_select_policy" ON public.banners FOR SELECT USING (active = true AND is_deleted = false);
DROP POLICY IF EXISTS "banners_write_admin_only" ON public.banners;
CREATE POLICY "banners_write_admin_only" ON public.banners FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "site_config_select_policy" ON public.site_config;
CREATE POLICY "site_config_select_policy" ON public.site_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "site_config_write_admin_only" ON public.site_config;
CREATE POLICY "site_config_write_admin_only" ON public.site_config FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Reviews (수강후기: 모든 사람 조회 허용, 작성은 본인/관리자, 전체 관리는 본인/관리자)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on reviews" ON public.reviews;
CREATE POLICY "Allow public read on reviews" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;
CREATE POLICY "Authenticated users can insert reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can manage their own reviews" ON public.reviews;
CREATE POLICY "Users can manage their own reviews" ON public.reviews FOR ALL USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());
