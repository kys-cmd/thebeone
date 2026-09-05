-- ==============================================================================
-- 비원아카데미 커뮤니티 개편 마이그레이션
--
-- 적용 내용
--   1. posts.allow_comments 컬럼 추가 (게시글별 댓글 허용 여부, 기본값 허용)
--   2. 커뮤니티 게시글 작성 권한을 관리자로 제한 (미션 인증글은 회원도 작성 가능)
--   3. 댓글이 잠긴 게시글에는 댓글이 달리지 않도록 RLS로 차단
--   4. 목록 조회 성능을 위한 인덱스 추가
--
-- 적용 방법
--   Supabase 대시보드 -> SQL Editor 에 붙여넣고 Run
--   (public.is_admin() 헬퍼가 필요하므로 supabase_rls_fix.sql 을 먼저 적용하세요)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. 게시글별 댓글 허용 여부
-- ------------------------------------------------------------------------------
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT TRUE;

-- 기존 게시글은 모두 댓글 허용으로 채운다.
UPDATE public.posts SET allow_comments = TRUE WHERE allow_comments IS NULL;

-- 블록형 본문(content_json.blocks)을 저장하기 위한 컬럼 (이미 있으면 통과)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS content_json JSONB;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hashtags TEXT[];


-- ------------------------------------------------------------------------------
-- 2. 게시글 작성 권한: 관리자 전용
--    미션 인증글(type = 'mission_verification')만 본인 명의로 회원 작성 허용
-- ------------------------------------------------------------------------------
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 기존의 "누구나 작성" 계열 정책 제거
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_policy" ON public.posts;

CREATE POLICY "posts_insert_admin_only" ON public.posts
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND (public.is_admin() OR type = 'mission_verification')
    );

-- 수정/삭제는 기존과 동일하게 작성자 본인 또는 관리자
DROP POLICY IF EXISTS "posts_update_policy" ON public.posts;
CREATE POLICY "posts_update_policy" ON public.posts
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "posts_delete_policy" ON public.posts;
CREATE POLICY "posts_delete_policy" ON public.posts
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());


-- ------------------------------------------------------------------------------
-- 3. 댓글: 게시글이 댓글을 허용할 때만 등록 가능
-- ------------------------------------------------------------------------------
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can comment" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_insert_policy" ON public.post_comments;

CREATE POLICY "post_comments_insert_policy" ON public.post_comments
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.posts p
            WHERE p.id = post_id
              AND COALESCE(p.allow_comments, TRUE) = TRUE
        )
    );

DROP POLICY IF EXISTS "post_comments_delete_policy" ON public.post_comments;
CREATE POLICY "post_comments_delete_policy" ON public.post_comments
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "post_comments_update_policy" ON public.post_comments;
CREATE POLICY "post_comments_update_policy" ON public.post_comments
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());


-- ------------------------------------------------------------------------------
-- 4. 목록 조회용 인덱스
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_posts_community_created
    ON public.posts (community_id, is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id
    ON public.post_comments (post_id, created_at);


-- ==============================================================================
-- 참고: 게시글 목록의 이미지 최적화
--
-- 프론트엔드는 목록 썸네일을 `/api/assets/<bucket>/<path>?width=...&quality=...`
-- 형태로 요청하고, 서버(server.ts / netlify/functions/assets.ts)가 이를
-- Supabase Storage 의 이미지 변환 엔드포인트(render/image/public)로 넘긴다.
-- 이미지 변환은 Supabase 유료 플랜 기능이므로, 사용할 수 없는 환경에서는
-- 클라이언트가 자동으로 원본 이미지로 폴백한다(업로드 시 클라이언트에서
-- 1920px / JPEG 85% 로 이미 압축하므로 그 경우에도 원본이 과도하게 크지는 않다).
-- ==============================================================================
