
-- KG 이니시스 및 결제 시스템을 위한 스키마 확장 및 보완

-- 1. 결제 설정 테이블 확장
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS portone_store_id TEXT;
COMMENT ON COLUMN public.payment_settings.portone_store_id IS '포트원 가맹점 식별코드 (IMP_ID)';
COMMENT ON COLUMN public.payment_settings.pg_id IS 'PG 상점아이디 (MID)';

-- 2. 결제 내역 테이블 생성 (usePayment.ts에서 사용 중이나 스키마에 누락됨)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_uid TEXT UNIQUE NOT NULL,
    imp_uid TEXT,
    amount BIGINT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'cancelled'
    user_id UUID REFERENCES auth.users(id),
    lecture_id UUID REFERENCES public.courses(id),
    
    -- 응답 데이터 전문 저장용 (디버깅 및 정산용)
    raw_response JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 설정
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert payments during checkout" ON public.payments;
CREATE POLICY "Anyone can insert payments during checkout" ON public.payments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
CREATE POLICY "Users can view their own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
DROP POLICY IF EXISTS "Users can update their own pending payments" ON public.payments;
CREATE POLICY "Users can update their own pending payments" ON public.payments FOR UPDATE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 기본 데이터 삽입 (없을 경우)
INSERT INTO public.payment_settings (pg_company, pg_mode, payment_methods_pg, installment_months)
SELECT 'html5_inicis', 'test', ARRAY['card'], ARRAY['0']
WHERE NOT EXISTS (SELECT 1 FROM public.payment_settings LIMIT 1);
