-- ==============================================================================
-- 비원아카데미 Supabase 데이터베이스 스키마 (회계 시스템 3대 절대 규칙 적용)
-- 
-- [회계 시스템 3대 절대 규칙]
-- 1. 금액 계산 규칙: 부동소수점(Float) 금지, 모든 금액은 BIGINT(정수) 사용
-- 2. 데이터 보존 규칙: 물리적 삭제(DELETE) 금지, is_deleted 컬럼을 활용한 Soft Delete 적용
-- 3. 복식부기 원칙: 돈이 이동하는 모든 트랜잭션은 차변(Debit)/대변(Credit)으로 기록 (transactions, transaction_lines 참조)
-- ==============================================================================

-- 1. 사용자 프로필 (Supabase Auth 연동)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    name TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user', -- 'user', 'admin', 'super_admin'
    gender TEXT,
    birthdate DATE,
    mobile_phone TEXT,
    phone TEXT,
    address TEXT,
    
    -- Soft Delete
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 커뮤니티 (Communities)
CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID, -- REFERENCES courses(id) (Added at the end to prevent circular/forward reference issues)
    name TEXT NOT NULL,
    description TEXT,
    type TEXT, -- 'season', 'course', 'board'
    season_number INTEGER,
    icon TEXT,
    color TEXT,
    banner_url TEXT,
    is_active BOOLEAN DEFAULT true,
    feature_board BOOLEAN DEFAULT true,
    feature_chat BOOLEAN DEFAULT true,
    feature_gallery BOOLEAN DEFAULT false,
    
    -- Soft Delete
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 커뮤니티 게시글 (Posts)
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id),
    user_id UUID REFERENCES profiles(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    views INTEGER DEFAULT 0,
    
    -- Soft Delete
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 커뮤니티 실시간 채팅 (Messages)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id),
    user_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    media_url TEXT,
    
    -- Soft Delete
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. 강사 관리 (Instructors)
CREATE TABLE IF NOT EXISTS instructors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    title TEXT,
    bio TEXT,
    image_url TEXT,
    tags TEXT[] DEFAULT '{}',
    
    -- Soft Delete
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 강의 관리 (Courses)
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    thumbnail TEXT,
    price BIGINT NOT NULL DEFAULT 0, 
    discount_price BIGINT,
    instructor_id UUID REFERENCES instructors(id), -- 정규화된 강사 ID
    instructor TEXT, -- 역정규화된 강사명 (편의용)
    instructor_title TEXT,
    instructor_bio TEXT,
    instructor_image TEXT,
    instructor_tags TEXT[] DEFAULT '{}',
    hero_bg_color TEXT DEFAULT '#0f172a',
    hero_text_color TEXT DEFAULT '#ffffff',
    hero_image TEXT, -- HERO 배경 이미지
    outcomes TEXT[] DEFAULT '{}',
    recommended_for TEXT[] DEFAULT '{}',
    materials JSONB DEFAULT '[]'::jsonb,
    category TEXT DEFAULT 'regular',
    status TEXT DEFAULT 'published',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    reg_start_date TIMESTAMPTZ,
    reg_end_date TIMESTAMPTZ,
    study_start_date TIMESTAMPTZ,
    study_end_date TIMESTAMPTZ,
    is_free BOOLEAN DEFAULT false,
    access_type TEXT DEFAULT 'automatic',
    curriculum JSONB DEFAULT '[]'::jsonb,
    layout JSONB DEFAULT '{"blocks":[]}'::jsonb,
    location TEXT,
    
    -- Soft Delete
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 수강 신청/내역 (Enrollments)
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    course_id UUID REFERENCES courses(id),
    status TEXT DEFAULT 'active',
    
    -- Soft Delete
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- [복식부기 회계 시스템]
-- ==============================================================================

-- 7. 회계 계정과목 (Chart of Accounts)
CREATE TABLE IF NOT EXISTS accounting_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL, -- 예: '101' 보통예금, '401' 수강매출
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'ASSET'(자산), 'LIABILITY'(부채), 'EQUITY'(자본), 'REVENUE'(수익), 'EXPENSE'(비용)
    
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 거래 전표 (Transactions) - 하나의 논리적 거래를 묶는 단위
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    created_by UUID REFERENCES profiles(id),
    
    -- Soft Delete 
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 거래 분개 상세 (Transaction Lines) - 대차평균의 원리 적용
CREATE TABLE IF NOT EXISTS transaction_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounting_accounts(id),
    user_id UUID REFERENCES profiles(id),
    
    description TEXT,
    
    -- [회계 1원칙 & 3원칙] 금액 정수형 / 차변(Debit), 대변(Credit) 동시 기록
    debit_amount BIGINT DEFAULT 0,  -- 차변 금액 (들어온 돈/발생 비용)
    credit_amount BIGINT DEFAULT 0, -- 대변 금액 (나간 돈/발생 수익)
    
    -- Soft Delete
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 트리거 및 함수
-- ==============================================================================

-- 대차평균(차변 합계 = 대변 합계) 검증 확인 함수
CREATE OR REPLACE FUNCTION check_transaction_balance() 
RETURNS TRIGGER AS $$
DECLARE
    total_debit BIGINT;
    total_credit BIGINT;
BEGIN
    SELECT COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
    INTO total_debit, total_credit
    FROM transaction_lines
    WHERE transaction_id = NEW.transaction_id AND is_deleted = false;
    
    IF total_debit <> total_credit THEN
        RAISE EXCEPTION '복식부기 원칙 위배: 차변 합계(%)와 대변 합계(%)가 일치하지 않습니다.', total_debit, total_credit;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- [마이그레이션 용] 이미 테이블이 생성된 상태에서 컬럼 추가가 필요한 경우 아래 쿼리를 부분 실행하세요.
-- 프로필 확장
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthdate DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mobile_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- 커뮤니티 확장
ALTER TABLE communities ADD COLUMN IF NOT EXISTS course_id UUID;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS season_number INTEGER;
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'communities_course_id_fkey') THEN
        ALTER TABLE communities ADD CONSTRAINT communities_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id);
    END IF; 
END $$;

-- 게시판, 메세지 테이블명 변경 대응 
-- (주의: threads -> posts, chat_messages -> messages 로 테이블명이 바뀌었다면 수동 마이그레이션이 필요합니다)

-- 강의 설정 확장
ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS discount_price BIGINT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor_title TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor_bio TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor_image TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS hero_bg_color TEXT DEFAULT '#0f172a';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS hero_text_color TEXT DEFAULT '#ffffff';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS outcomes TEXT[] DEFAULT '{}';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS recommended_for TEXT[] DEFAULT '{}';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS materials JSONB DEFAULT '[]'::jsonb;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'regular';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'automatic';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS curriculum JSONB DEFAULT '[]'::jsonb;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS layout JSONB DEFAULT '{"blocks":[]}'::jsonb;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_duration_based BOOLEAN DEFAULT false;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 90;

-- 수강 신청 만료일 추가 (기존 테이블 마이그레이션 용도)
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- ==============================================================================
-- [CMS 콘텐츠 관리]
-- ==============================================================================

-- 10. 배너 (Banners)
CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    image TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    link TEXT,
    "order" INTEGER DEFAULT 1,
    type TEXT DEFAULT 'main', -- 'main', 'course', 'special'
    
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. 고객 센터 콘텐츠 (Support Contents)
CREATE TABLE IF NOT EXISTS support_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'notice', 'faq', 'suggestion'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. 사이트 설정 (Site Config)
CREATE TABLE IF NOT EXISTS site_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_name TEXT DEFAULT '비원아카데미',
    primary_color TEXT DEFAULT '#9333ea',
    footer_info TEXT,
    logo_url TEXT,
    favicon_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. 결제 설정 (Payment Settings)
CREATE TABLE IF NOT EXISTS payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pg_id TEXT,
    pg_company TEXT DEFAULT 'inicis', -- 'inicis', 'allat', 'mobilians', 'kcp'
    pg_mode TEXT DEFAULT 'test', -- 'live', 'test'
    inicis_key_url TEXT,
    inicis_sign_key TEXT,
    payment_methods_pg TEXT[] DEFAULT '{}', -- 'card', 'bank', 'vbank', 'phone'
    installment_months TEXT[] DEFAULT '{}', -- '0', '2', '3', ...
    payment_methods_direct TEXT[] DEFAULT '{}', -- 'bank_transfer', 'coupon'
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. 주문 (Orders)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    course_id UUID REFERENCES courses(id),
    amount BIGINT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
    
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. 커뮤니티 멤버십 (Community Members)
CREATE TABLE IF NOT EXISTS community_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id),
    user_id UUID REFERENCES profiles(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false
);

-- ==============================================================================
-- RLS (Row-Level Security) DB 정책 설정
-- ==============================================================================

-- 모든 테이블에 RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lines ENABLE ROW LEVEL SECURITY;

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

-- 1. 기존 정책 모두 삭제 (Conflict 방지)
DO $$
DECLARE
    row record;
BEGIN
    FOR row IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', row.policyname, row.tablename);
    END LOOP;
END
$$;

-- Create a trigger to automatically create a profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, is_deleted)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1), 'User'),
    NEW.email,
    'user',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-setup the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. 일단 모든 사용자(익명 포함)가 읽고 쓰기 가능하도록 완전 허용 정책 추가 (개발 목적. 실제 배포전 수정 필요!)
-- 프로필/수강 신청 정책: 개발 편의를 위해 완전 허용
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles are open for dev" ON profiles;
CREATE POLICY "Profiles are open for dev" ON profiles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Dev allow all enrollments" ON enrollments;
CREATE POLICY "Dev allow all enrollments" ON enrollments FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Dev allow all communities" ON communities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev allow all posts" ON posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev allow all messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev allow all courses" ON courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev allow all enrollments" ON enrollments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev allow all accounts" ON accounting_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev allow all transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev allow all transaction_lines" ON transaction_lines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev allow all banners" ON banners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev allow all support_contents" ON support_contents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev allow all site_config" ON site_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev allow all orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev allow all community_members" ON community_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev allow all instructors" ON instructors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev allow all payment_settings" ON payment_settings FOR ALL USING (true) WITH CHECK (true);

