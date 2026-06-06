-- instructors 테이블 생성
CREATE TABLE IF NOT EXISTS instructors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    title TEXT,
    bio TEXT,
    image_url TEXT,
    
    -- Soft Delete
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- courses 테이블 확장
ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES instructors(id);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS hero_image TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS reg_start_date TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS reg_end_date TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS study_start_date TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS study_end_date TIMESTAMPTZ;

-- RLS 활성화
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dev allow all instructors" ON instructors FOR ALL USING (true) WITH CHECK (true);
