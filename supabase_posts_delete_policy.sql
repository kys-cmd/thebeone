-- ==============================================================================
-- 비원아카데미 수퍼베이스(Supabase) 게시글 및 대화방 완벽 삭제 권한 활성화 SQL 마이그레이션
--
-- 적용 방법:
-- 1. 이 전체 내용을 복사합니다.
-- 2. Supabase 대시보드 -> SQL Editor로 이동하여 새로운 쿼리를 생성합니다.
-- 3. 이 본문을 붙여넣기 한 뒤 'Run' 버튼을 눌러 적용합니다.
-- ==============================================================================

-- 1. 게시글(posts) 테이블 하드 삭제(DELETE) 정책 생성
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
CREATE POLICY "Users can delete own posts" ON public.posts 
    FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all posts" ON public.posts;
CREATE POLICY "Admins can manage all posts" ON public.posts
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 2. 대화방(chat_rooms) 테이블 하드 삭제(DELETE) 정책 생성
DROP POLICY IF EXISTS "Admins and owners can delete chat_rooms" ON public.chat_rooms;
CREATE POLICY "Admins and owners can delete chat_rooms" ON public.chat_rooms
    FOR DELETE USING (auth.uid() = created_by OR public.is_admin());
