
-- 1. Orders table updates
-- Existing table in original schema might lack these columns
DO $$ 
BEGIN 
    -- Add order_name if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='order_name') THEN
        ALTER TABLE public.orders ADD COLUMN order_name TEXT;
    END IF;

    -- Add merchant_uid if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='merchant_uid') THEN
        ALTER TABLE public.orders ADD COLUMN merchant_uid TEXT UNIQUE;
    END IF;

    -- Add updated_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='updated_at') THEN
        ALTER TABLE public.orders ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 2. Clean up existing policies to avoid conflicts
DO $$
DECLARE
    pol record;
BEGIN
    -- Drop all existing policies on orders to start fresh
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'orders' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', pol.policyname);
    END LOOP;

    -- Drop all existing policies on payment_logs
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'payment_logs' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.payment_logs', pol.policyname);
    END LOOP;
END $$;

-- 3. Payment Logs table
CREATE TABLE IF NOT EXISTS public.payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_uid TEXT,
    order_id UUID REFERENCES public.orders(id),
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS settings
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Unified Permissive Policies
CREATE POLICY "Allow all operations for orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for payment_logs" ON public.payment_logs FOR ALL USING (true) WITH CHECK (true);
