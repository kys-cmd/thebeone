-- supabase_payment_api_logs.sql
-- 결제/환불/망취소 등 발생한 모든 KG 이니시스 통신 데이터(요청/응답 전문) 및 에러 로그 기록용 테크니컬 트래킹 테이블 추가

CREATE TABLE IF NOT EXISTS public.payment_api_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    merchant_uid TEXT,
    type TEXT NOT NULL, -- 'INIT_PAY_REQ', 'INIT_PAY_RES', 'S2S_APPROVAL_REQ', 'S2S_APPROVAL_RES', 'NET_CANCEL_REQ', 'NET_CANCEL_RES', 'REFUND_REQ', 'REFUND_RES', 'ERROR_LOG'
    api_url TEXT,
    request_data JSONB,
    response_data JSONB,
    status TEXT NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED'
    error_code TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가를 통해 트래킹 조회 최적화
CREATE INDEX IF NOT EXISTS idx_payment_api_logs_merchant_uid ON public.payment_api_logs(merchant_uid);
CREATE INDEX IF NOT EXISTS idx_payment_api_logs_created_at ON public.payment_api_logs(created_at DESC);

-- Row Level Security (RLS) 설정 활성화
ALTER TABLE public.payment_api_logs ENABLE ROW LEVEL SECURITY;

-- 관리자 및 완전 허용 정책 설정 (내부 통신 및 백엔드 관리용)
DROP POLICY IF EXISTS "Allow all operations for payment_api_logs" ON public.payment_api_logs;
CREATE POLICY "Allow all operations for payment_api_logs" ON public.payment_api_logs FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.payment_api_logs IS '결제 및 환불 시 발생하는 실시간 API 통신 전문 기록 및 백엔드 장애 추적용 로그 테이블';
