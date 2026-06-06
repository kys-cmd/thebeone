import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { BoardPost, BoardReply, Profile } from '@/types';
import { toast } from 'sonner';

export function useCommunityBoard(communityId: string, activePostId?: string) {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [replies, setReplies] = useState<BoardReply[]>([]);
  const [postsLoading, setPostsLoading] = useState<boolean>(true);
  const [repliesLoading, setRepliesLoading] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Profile cache to prevent duplicate lookups for real-time insert payloads
  const profileCache = useRef<Record<string, any>>({});

  const resolveProfile = async (uId: string) => {
    if (profileCache.current[uId]) {
      return profileCache.current[uId];
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('name, nickname, avatar_url')
      .eq('id', uId)
      .single();

    if (!error && data) {
      profileCache.current[uId] = data;
      return data;
    }
    return { name: '알 수 없음', nickname: '알 수 없음', avatar_url: null };
  };

  // 1. Fetch Posts
  const fetchPosts = useCallback(async () => {
    if (!communityId) return;
    setPostsLoading(true);
    try {
      const { data, error } = await supabase
        .from('board_posts')
        .select(`
          *,
          profiles (
            name,
            nickname,
            avatar_url
          )
        `)
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error: any) {
      console.error('Error fetching board posts:', error);
    } finally {
      setPostsLoading(false);
    }
  }, [communityId]);

  // 2. Fetch Replies for active post
  const fetchReplies = useCallback(async (pId: string) => {
    setRepliesLoading(true);
    try {
      const { data, error } = await supabase
        .from('board_replies')
        .select(`
          *,
          profiles (
            name,
            nickname,
            avatar_url
          )
        `)
        .eq('post_id', pId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setReplies(data || []);
    } catch (error: any) {
      console.error('Error fetching thread replies:', error);
    } finally {
      setRepliesLoading(false);
    }
  }, []);

  // Set current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // Fetch initial posts on community change
  useEffect(() => {
    fetchPosts();
  }, [communityId, fetchPosts]);

  // Fetch replies when activePostId changes
  useEffect(() => {
    if (activePostId) {
      fetchReplies(activePostId);
    } else {
      setReplies([]);
    }
  }, [activePostId, fetchReplies]);

  // 3. Supabase Realtime Sync for Posts
  useEffect(() => {
    if (!communityId) return;

    const channel = supabase
      .channel(`community_board_posts_${communityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_posts',
          filter: `community_id=eq.${communityId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPost = payload.new as BoardPost;
            const profile = await resolveProfile(newPost.user_id);
            const enrichedPost = {
              ...newPost,
              profiles: profile,
            };
            setPosts((prev) => [enrichedPost, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedPost = payload.new as BoardPost;
            const profile = await resolveProfile(updatedPost.user_id);
            setPosts((prev) =>
              prev.map((post) =>
                post.id === updatedPost.id
                  ? { ...updatedPost, profiles: profile }
                  : post
              )
            );
          } else if (payload.eventType === 'DELETE') {
            const oldPost = payload.old as { id: string };
            setPosts((prev) => prev.filter((post) => post.id !== oldPost.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [communityId]);

  // 4. Supabase Realtime Sync for Replies (only when post is selected)
  useEffect(() => {
    if (!activePostId) return;

    const channel = supabase
      .channel(`active_post_replies_${activePostId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_replies',
          filter: `post_id=eq.${activePostId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReply = payload.new as BoardReply;
            const profile = await resolveProfile(newReply.user_id);
            const enrichedReply = {
              ...newReply,
              profiles: profile,
            };
            setReplies((prev) => [...prev, enrichedReply]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedReply = payload.new as BoardReply;
            const profile = await resolveProfile(updatedReply.user_id);
            setReplies((prev) =>
              prev.map((rep) =>
                rep.id === updatedReply.id
                  ? { ...updatedReply, profiles: profile }
                  : rep
              )
            );
          } else if (payload.eventType === 'DELETE') {
            const oldReply = payload.old as { id: string };
            setReplies((prev) => prev.filter((rep) => rep.id !== oldReply.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activePostId]);

  // 5. Actions
  const createPost = async (title: string, content: string) => {
    if (!userId) {
      toast.error('로그인이 필요합니다.');
      return false;
    }
    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 입력해 주세요.');
      return false;
    }

    try {
      const { error } = await supabase.from('board_posts').insert([
        {
          community_id: communityId,
          user_id: userId,
          title,
          content,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
      toast.success('게시글이 성공적으로 등록되었습니다.');
      return true;
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast.error('게시글 등록 중 오류가 발생했습니다.');
      return false;
    }
  };

  const createReply = async (postId: string, content: string) => {
    if (!userId) {
      toast.error('로그인이 필요합니다.');
      return false;
    }
    if (!content.trim()) {
      return false;
    }

    try {
      const { error } = await supabase.from('board_replies').insert([
        {
          post_id: postId,
          user_id: userId,
          content,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error creating reply:', error);
      toast.error('댓글 등록 중 오류가 발생했습니다.');
      return false;
    }
  };

  const deletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('board_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
      toast.success('게시글이 삭제되었습니다.');
      return true;
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast.error('게시글 삭제에 실패했습니다.');
      return false;
    }
  };

  const deleteReply = async (replyId: string) => {
    try {
      const { error } = await supabase
        .from('board_replies')
        .delete()
        .eq('id', replyId);

      if (error) throw error;
      toast.success('댓글이 삭제되었습니다.');
      return true;
    } catch (error: any) {
      console.error('Error deleting reply:', error);
      toast.error('댓글 삭제에 실패했습니다.');
      return false;
    }
  };

  return {
    posts,
    replies,
    postsLoading,
    repliesLoading,
    createPost,
    createReply,
    deletePost,
    deleteReply,
    refetchPosts: fetchPosts,
    refetchReplies: () => activePostId && fetchReplies(activePostId),
  };
}
