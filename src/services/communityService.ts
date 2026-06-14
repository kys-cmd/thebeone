import { supabase } from '@/lib/supabase';
import { Community, Post, Message } from '@/types';

export const communityService = {
  async getCommunities() {
    const { data: communities, error } = await supabase
      .from('communities')
      .select('*')
      .eq('is_deleted', false)
      .order('type', { ascending: true });

    if (error) throw error;
    return (communities || []).sort((a, b) => (a.type || '').localeCompare(b.type || '')) as Community[];
  },

  async getPosts(communityId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Attempt to fetch with is_deleted filter
    let { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles(name, nickname, avatar_url),
        post_likes(user_id),
        post_comments(id),
        post_reactions(user_id, emoji),
        post_attendance(user_id),
        post_poll_votes(user_id, option_index),
        post_todo_checks(user_id, todo_index)
      `)
      .eq('community_id', communityId)
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    // Handle missing relationship or is_deleted column
    if (error && (error.message.includes('relationship') || error.message.includes('is_deleted'))) {
      console.warn('Advanced fetch failed, using fallback query:', error.message);
      const query = supabase.from('posts').select('*').eq('community_id', communityId);
      
      if (!error.message.includes('is_deleted')) {
        query.or('is_deleted.eq.false,is_deleted.is.null');
      }
      
      const { data: posts, error: basicError } = await query
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (basicError) throw basicError;
      if (!posts) return [];

      // Manually join profiles and other data
      const userIds = [...new Set(posts.map(p => p.user_id))];
      const postIds = posts.map(p => p.id);

      const [profiles, likes, comments, reactions, attendance, pollVotes, todoChecks] = await Promise.all([
        supabase.from('profiles').select('id, name, nickname, avatar_url').in('id', userIds),
        supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
        supabase.from('post_comments').select('id, post_id').in('post_id', postIds),
        supabase.from('post_reactions').select('post_id, user_id, emoji').in('post_id', postIds),
        supabase.from('post_attendance').select('post_id, user_id').in('post_id', postIds),
        supabase.from('post_poll_votes').select('post_id, user_id, option_index').in('post_id', postIds),
        supabase.from('post_todo_checks').select('post_id, user_id, todo_index').in('post_id', postIds)
      ]);

      return posts.map(p => {
        const pLikes = likes.data?.filter(l => l.post_id === p.id) || [];
        const pComments = comments.data?.filter(c => c.post_id === p.id) || [];
        const pReactions: any = {};
        reactions.data?.filter(r => r.post_id === p.id).forEach(r => {
          if (!pReactions[r.emoji]) pReactions[r.emoji] = { count: 0, user_ids: [] };
          pReactions[r.emoji].count++;
          pReactions[r.emoji].user_ids.push(r.user_id);
        });

        return {
          ...p,
          profiles: profiles.data?.find(pr => pr.id === p.user_id) || null,
          likes_count: pLikes.length,
          comments_count: pComments.length,
          is_liked: user ? pLikes.some(l => l.user_id === user.id) : false,
          reactions: pReactions,
          attendance_count: attendance.data?.filter(a => a.post_id === p.id).length || 0,
          has_attended: user ? attendance.data?.some(a => a.post_id === p.id && a.user_id === user.id) : false,
          poll_votes: pollVotes.data?.filter(v => v.post_id === p.id) || [],
          user_poll_vote: user ? pollVotes.data?.find(v => v.post_id === p.id && v.user_id === user.id)?.option_index : null,
          todo_checks: todoChecks.data?.filter(c => c.post_id === p.id) || [],
          user_todo_checks: user ? todoChecks.data?.filter(c => c.post_id === p.id && c.user_id === user.id).map(c => c.todo_index) : []
        };
      }) as Post[];
    }

    if (error) throw error;

    return (data || []).map((p: any) => {
      const reactions: Record<string, { count: number; user_ids: string[] }> = {};
      p.post_reactions?.forEach((r: any) => {
        if (!reactions[r.emoji]) reactions[r.emoji] = { count: 0, user_ids: [] };
        reactions[r.emoji].count++;
        reactions[r.emoji].user_ids.push(r.user_id);
      });

      return {
        ...p,
        likes_count: p.post_likes?.length || 0,
        comments_count: p.post_comments?.length || 0,
        is_liked: user ? p.post_likes?.some((l: any) => l.user_id === user.id) : false,
        reactions,
        attendance_count: p.post_attendance?.length || 0,
        has_attended: user ? p.post_attendance?.some((a: any) => a.user_id === user.id) : false,
        poll_votes: p.post_poll_votes || [],
        user_poll_vote: user ? p.post_poll_votes?.find((v: any) => v.user_id === user.id)?.option_index : null,
        todo_checks: p.post_todo_checks || [],
        user_todo_checks: user ? p.post_todo_checks?.filter((c: any) => c.user_id === user.id).map((c: any) => c.todo_index) : []
      };
    }) as Post[];
  },

  async getAllPosts() {
    const { data: { user } } = await supabase.auth.getUser();
    
    let { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles(name, nickname, avatar_url),
        post_likes(user_id),
        post_comments(id),
        post_reactions(user_id, emoji),
        post_attendance(user_id),
        post_poll_votes(user_id, option_index),
        post_todo_checks(user_id, todo_index)
      `)
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error && (error.message.includes('relationship') || error.message.includes('is_deleted'))) {
      console.warn('Advanced fetch failed, using fallback query:', error.message);
      const query = supabase.from('posts').select('*');
      
      if (!error.message.includes('is_deleted')) {
        query.or('is_deleted.eq.false,is_deleted.is.null');
      }
      
      const { data: posts, error: basicError } = await query
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (basicError) throw basicError;
      if (!posts) return [];

      const userIds = [...new Set(posts.map(p => p.user_id))];
      const postIds = posts.map(p => p.id);

      const [profiles, likes, comments, reactions, attendance, pollVotes, todoChecks] = await Promise.all([
        supabase.from('profiles').select('id, name, nickname, avatar_url').in('id', userIds),
        supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
        supabase.from('post_comments').select('id, post_id').in('post_id', postIds),
        supabase.from('post_reactions').select('post_id, user_id, emoji').in('post_id', postIds),
        supabase.from('post_attendance').select('post_id, user_id').in('post_id', postIds),
        supabase.from('post_poll_votes').select('post_id, user_id, option_index').in('post_id', postIds),
        supabase.from('post_todo_checks').select('post_id, user_id, todo_index').in('post_id', postIds)
      ]);

      return posts.map(p => {
        const pLikes = likes.data?.filter(l => l.post_id === p.id) || [];
        const pComments = comments.data?.filter(c => c.post_id === p.id) || [];
        const pReactions: any = {};
        reactions.data?.filter(r => r.post_id === p.id).forEach(r => {
          if (!pReactions[r.emoji]) pReactions[r.emoji] = { count: 0, user_ids: [] };
          pReactions[r.emoji].count++;
          pReactions[r.emoji].user_ids.push(r.user_id);
        });

        return {
          ...p,
          profiles: profiles.data?.find(pr => pr.id === p.user_id) || null,
          likes_count: pLikes.length,
          comments_count: pComments.length,
          is_liked: user ? pLikes.some(l => l.user_id === user.id) : false,
          reactions: pReactions,
          attendance_count: attendance.data?.filter(a => a.post_id === p.id).length || 0,
          has_attended: user ? attendance.data?.some(a => a.post_id === p.id && a.user_id === user.id) : false,
          poll_votes: pollVotes.data?.filter(v => v.post_id === p.id) || [],
          user_poll_vote: user ? pollVotes.data?.find(v => v.post_id === p.id && v.user_id === user.id)?.option_index : null,
          todo_checks: todoChecks.data?.filter(c => c.post_id === p.id) || [],
          user_todo_checks: user ? todoChecks.data?.filter(c => c.post_id === p.id && c.user_id === user.id).map(c => c.todo_index) : []
        };
      }) as Post[];
    }

    if (error) throw error;

    return (data || []).map((p: any) => {
      const pReactions: Record<string, { count: number; user_ids: string[] }> = {};
      p.post_reactions?.forEach((r: any) => {
        if (!pReactions[r.emoji]) pReactions[r.emoji] = { count: 0, user_ids: [] };
        pReactions[r.emoji].count++;
        pReactions[r.emoji].user_ids.push(r.user_id);
      });

      return {
        ...p,
        likes_count: p.post_likes?.length || 0,
        comments_count: p.post_comments?.length || 0,
        is_liked: user ? p.post_likes?.some((l: any) => l.user_id === user.id) : false,
        reactions: pReactions,
        attendance_count: p.post_attendance?.length || 0,
        has_attended: user ? p.post_attendance?.some((a: any) => a.user_id === user.id) : false,
        poll_votes: p.post_poll_votes || [],
        user_poll_vote: user ? p.post_poll_votes?.find((v: any) => v.user_id === user.id)?.option_index : null,
        todo_checks: p.post_todo_checks || [],
        user_todo_checks: user ? p.post_todo_checks?.filter((c: any) => c.user_id === user.id).map((c: any) => c.todo_index) : []
      };
    }) as Post[];
  },

  async createPost(post: Partial<Post>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('posts')
      .insert([{ 
        ...post, 
        user_id: user.id,
        views: 0, 
        is_deleted: false, 
        created_at: new Date().toISOString() 
      }])
      .select('*, profiles(name, nickname, avatar_url)')
      .single();

    if (error) {
      // Handle missing relationship or columns
      if (error.message.includes('relationship') || error.code === 'PGRST200' || (error.message && (error.message.includes('content_json') || error.message.includes('metadata') || error.message.includes('hashtags') || error.message.includes('file_urls')))) {
        const strippedPost = { ...post };
        delete (strippedPost as any).content_json;
        delete (strippedPost as any).hashtags;
        delete (strippedPost as any).metadata;
        delete (strippedPost as any).file_urls;

        const { data: rawPost, error: insertError } = await supabase
          .from('posts')
          .insert([{ 
            ...strippedPost, 
            user_id: user.id,
            views: 0, 
            is_deleted: false, 
            created_at: new Date().toISOString() 
          }])
          .select()
          .single();
        
        if (insertError) throw insertError;
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, nickname, avatar_url')
          .eq('id', user.id)
          .single();
          
        return { 
          ...rawPost, 
          profiles: profile,
          likes_count: 0,
          comments_count: 0,
          is_liked: false
        };
      }
      throw error;
    }
    return {
      ...data,
      likes_count: 0,
      comments_count: 0,
      is_liked: false
    };
  },

  async updatePost(postId: string, updates: Partial<Post>) {
    const { data, error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', postId)
      .select('*, profiles(name, nickname, avatar_url)')
      .single();

    if (error) {
      if (error.message.includes('relationship') || error.message.includes('content_json') || error.message.includes('metadata') || error.message.includes('hashtags') || error.message.includes('file_urls')) {
        const strippedUpdates = { ...updates };
        delete (strippedUpdates as any).content_json;
        delete (strippedUpdates as any).hashtags;
        delete (strippedUpdates as any).metadata;
        delete (strippedUpdates as any).file_urls;
        
        const { data: retryData, error: retryError } = await supabase
          .from('posts')
          .update(strippedUpdates)
          .eq('id', postId)
          .select()
          .single();
          
        if (retryError) throw retryError;

        // Manually join profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, nickname, avatar_url')
          .eq('id', (retryData as any).user_id)
          .single();

        return { ...retryData, profiles: profile } as Post;
      }
      throw error;
    }
    return data as Post;
  },

  async deletePost(postId: string) {
    // 1. Clean up all potential child records first to avoid any foreign key constraint violations
    const tables = [
      'post_likes', 'post_comments', 'post_reactions', 'post_attendance', 
      'post_poll_votes', 'post_todo_checks', 'post_hashtags', 'post_mentions'
    ];
    
    try {
      await Promise.all(tables.map(table => 
        supabase.from(table).delete().eq('post_id', postId).then(({ error }) => {
          if (error && !error.message.includes('relation') && !error.message.includes('not found')) {
            console.warn(`Cleanup failed for ${table}:`, error.message);
          }
          return null;
        })
      ));
    } catch (e) {
      console.warn('Manual relative cleanup warning:', e);
    }

    // 2. Perform the actual hard delete from the posts table
    const { error: deleteError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (deleteError) {
      console.error('Failed to hard delete post from DB:', deleteError);
      throw new Error(`게시글 삭제에 실패했습니다 (DB 하드 삭제 오류): ${deleteError.message}`);
    }

    return true;
  },

  async getMessages(communityId: string, roomId?: string) {
    const { data: { user } } = await supabase.auth.getUser();

    // Try with is_deleted filter
    let query = supabase
      .from('messages')
      .select(`
        *,
        profiles(name, nickname, avatar_url),
        message_reactions(user_id, emoji),
        reply_to:messages!reply_to_id(id, content, type, media_url, profiles(name, nickname))
      `)
      .eq('community_id', communityId);

    if (roomId === 'all' || !roomId) {
      query = query.is('room_id', null);
    } else {
      query = query.eq('room_id', roomId);
    }

    let { data, error } = await query
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('created_at', { ascending: true });

    // Fallback if is_deleted column doesn't exist
    if (error && error.message.includes('is_deleted')) {
      let fallbackQuery = supabase
        .from('messages')
        .select(`
          *,
          profiles(name, nickname, avatar_url),
          message_reactions(user_id, emoji),
          reply_to:messages!reply_to_id(id, content, type, media_url, profiles(name, nickname))
        `)
        .eq('community_id', communityId);

      if (roomId === 'all' || !roomId) {
        fallbackQuery = fallbackQuery.is('room_id', null);
      } else {
        fallbackQuery = fallbackQuery.eq('room_id', roomId);
      }

      const result = await fallbackQuery.order('created_at', { ascending: true });
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.warn('Combined messages fetch failed, basic fallback active:', error.message);
      let fallbackQuery = supabase
        .from('messages')
        .select('*')
        .eq('community_id', communityId);

      if (roomId === 'all' || !roomId) {
        fallbackQuery = fallbackQuery.is('room_id', null);
      } else {
        fallbackQuery = fallbackQuery.eq('room_id', roomId);
      }

      const { data: messages } = await fallbackQuery.order('created_at', { ascending: true });
        
      if (!messages) return [];
      const userIds = [...new Set((messages || []).map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, nickname, avatar_url')
        .in('id', userIds);
        
      return (messages || []).map(m => ({
        ...m,
        profiles: profiles?.find(pr => pr.id === m.user_id) || null,
        reactions: {}
      })) as Message[];
    }

    return (data || []).map((m: any) => {
      const reactions: Record<string, { count: number; user_ids: string[] }> = {};
      m.message_reactions?.forEach((r: any) => {
        if (!reactions[r.emoji]) reactions[r.emoji] = { count: 0, user_ids: [] };
        reactions[r.emoji].count++;
        reactions[r.emoji].user_ids.push(r.user_id);
      });

      return {
        ...m,
        reactions
      };
    }) as Message[];
  },

  async toggleLike(postId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { data: existingLike } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingLike) {
      await supabase
        .from('post_likes')
        .delete()
        .eq('id', existingLike.id);
      return false;
    } else {
      await supabase
        .from('post_likes')
        .insert([{ post_id: postId, user_id: user.id }]);
      return true;
    }
  },

  async getComments(postId: string) {
    const { data, error } = await supabase
      .from('post_comments')
      .select('*, profiles(name, nickname, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      const { data: comments } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      
      if (!comments) return [];
      const userIds = [...new Set(comments.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, nickname, avatar_url')
        .in('id', userIds);
      
      return comments.map(c => ({
        ...c,
        profiles: profiles?.find(pr => pr.id === c.user_id) || null
      }));
    }
    return data;
  },

  async addComment(postId: string, content: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('post_comments')
      .insert([{ post_id: postId, user_id: user.id, content }])
      .select('*, profiles(name, nickname, avatar_url)')
      .single();

    if (error) {
      const { data: rawComment, error: insertError } = await supabase
        .from('post_comments')
        .insert([{ post_id: postId, user_id: user.id, content }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, nickname, avatar_url')
        .eq('id', user.id)
        .single();
      return { ...rawComment, profiles: profile };
    }
    return data;
  },

  async updateComment(commentId: string, content: string) {
    const { data, error } = await supabase
      .from('post_comments')
      .update({ content })
      .eq('id', commentId)
      .select('*, profiles(name, nickname, avatar_url)')
      .single();

    if (error) throw error;
    return data;
  },

  async deleteComment(commentId: string) {
    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;
    return true;
  },

  async sendMessage(message: Partial<Message>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('messages')
      .insert([{ ...message, user_id: user.id }])
      .select('*, profiles(name, nickname, avatar_url)')
      .single();

    if (error) {
      if (error.code === 'PGRST200') {
        const { data: rawMsg, error: insertError } = await supabase
          .from('messages')
          .insert([{ ...message, user_id: user.id }])
          .select()
          .single();
          
        if (insertError) throw insertError;
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, nickname, avatar_url')
          .eq('id', user.id)
          .single();
        return { ...rawMsg, profiles: profile };
      }
      console.error('Message send error details:', error);
      throw error;
    }
    return data;
  },

  async uploadFile(file: File, path: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('community')
      .upload(filePath, file);

    if (uploadError) {
      if (uploadError.message.includes('Bucket not found')) {
        throw new Error('데이터베이스 설정이 완료되지 않았습니다. 관리자에게 "community" 스토리지 버킷 생성을 요청하세요.');
      }
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    return `/api/assets/community/${filePath}`;
  },

  subscribeToMessages(communityId: string, onEvent: (payload: any) => void, roomId?: string) {
    const channelName = `community-messages-${communityId}-${roomId || 'all'}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Supabase real-time filters are limited. Prefer filtering by roomId if available,
    // otherwise fallback to communityId and handle filtering in the callback.
    const filter = (roomId && roomId !== 'all') 
      ? `room_id=eq.${roomId}` 
      : `community_id=eq.${communityId}`;

    return supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages',
        filter: filter
      }, async (payload: any) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const { data } = await supabase
            .from('profiles')
            .select('name, nickname, avatar_url')
            .eq('id', payload.new.user_id)
            .single();
          
          onEvent({ ...payload, new: { ...payload.new, profiles: data } });
        } else {
          onEvent(payload);
        }
      })
      .subscribe();
  },

  subscribeToPosts(communityId: string, onEvent: (payload: any) => void) {
    const channelName = `community-posts-${communityId}-${Math.random().toString(36).substring(2, 7)}`;
    return supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'posts',
        filter: `community_id=eq.${communityId}`
      }, async (payload: any) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const { data } = await supabase
            .from('profiles')
            .select('name, nickname, avatar_url')
            .eq('id', payload.new.user_id)
            .single();
          
          onEvent({ ...payload, new: { ...payload.new, profiles: data } });
        } else {
          onEvent(payload);
        }
      })
      .subscribe();
  },

  subscribeToLikes(communityId: string, onLike: (payload: any) => void) {
    const channelName = `community-likes-${communityId}-${Math.random().toString(36).substring(2, 7)}`;
    return supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'post_likes'
      }, (payload) => onLike(payload))
      .subscribe();
  },

  subscribeToComments(communityId: string, onEvent: (payload: any) => void) {
    const channelName = `community-comments-${communityId}-${Math.random().toString(36).substring(2, 7)}`;
    return supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'post_comments'
      }, async (payload: any) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const { data } = await supabase
            .from('profiles')
            .select('name, nickname, avatar_url')
            .eq('id', payload.new.user_id)
            .single();
          onEvent({ ...payload, new: { ...payload.new, profiles: data } });
        } else {
          onEvent(payload);
        }
      })
      .subscribe();
  },

  async findUserByEmail(email: string) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, name, nickname, avatar_url, email')
      .eq('email', email)
      .maybeSingle();
    
    if (error) throw error;
    return profile;
  },

  async sendInvitation(communityId: string, inviteeEmail: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('community_invitations')
      .insert([{
        community_id: communityId,
        inviter_id: user.id,
        invitee_email: inviteeEmail
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async leaveCommunity(communityId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', communityId)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  },

  async getAdminCommunities() {
    try {
      console.log('Fetching admin communities...');
      const { data: communities, error } = await supabase
        .from('communities')
        .select('*, posts(count)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Core community fetch error:', error);
        throw error;
      }

      // Fetch all active memberships and enrollments at once to optimize
      const result = [];
      for (const c of communities) {
        const uniqueUsers = new Set<string>();
        
        // 1. Explicit members
        const { data: explicitIds } = await supabase
          .from('community_members')
          .select('user_id')
          .eq('community_id', c.id)
          .neq('role', 'excluded');
        
        explicitIds?.forEach(m => uniqueUsers.add(m.user_id));

        // 2. Course enrollments
        if (c.course_id) {
          const { data: enrollmentIds } = await supabase
            .from('enrollments')
            .select('user_id')
            .eq('course_id', c.course_id)
            .eq('status', 'active');
          
          // Exclude those who were explicitly 'excluded'
          const { data: excludedMembers } = await supabase
            .from('community_members')
            .select('user_id')
            .eq('community_id', c.id)
            .eq('role', 'excluded');
          
          const excludedIds = new Set(excludedMembers?.map(m => m.user_id) || []);
          
          enrollmentIds?.forEach(e => {
            if (!excludedIds.has(e.user_id)) {
              uniqueUsers.add(e.user_id);
            }
          });
        }

        result.push({
          ...c,
          memberCount: uniqueUsers.size,
          postCount: c.posts?.[0]?.count || 0
        });
      }
      return result;
    } catch (err) {
      console.error('getAdminCommunities fail:', err);
      return [];
    }
  },

  async createCommunity(data: { name: string; type?: string; course_id?: string; description?: string }) {
    const { data: community, error } = await supabase
      .from('communities')
      .insert([{
        name: data.name,
        type: data.type || 'board',
        course_id: data.course_id || null,
        description: data.description || '',
        is_deleted: false,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return community;
  },

  async updateCommunity(id: string, data: { name?: string; type?: string; course_id?: string; description?: string }) {
    const { data: community, error } = await supabase
      .from('communities')
      .update({
        ...data,
        course_id: data.course_id || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return community;
  },

  async deleteCommunity(id: string) {
    try {
      // 0. Delete chat read records (Crucial for foreign key constraints)
      const { error: chatReadError } = await supabase
        .from('chat_last_read')
        .delete()
        .eq('community_id', id);
      if (chatReadError) console.warn('Chat read deletion warning:', chatReadError);

      // 1. Delete messages
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('community_id', id);
      if (msgError) console.warn('Message deletion warning:', msgError);

      // 2. Delete posts and related data (likes, comments)
      // First find all posts in this community to delete their relative data
      const { data: posts } = await supabase
        .from('posts')
        .select('id')
        .eq('community_id', id);

      if (posts && posts.length > 0) {
        const postIds = posts.map(p => p.id);
        
        // Delete likes for these posts
        await supabase.from('post_likes').delete().in('post_id', postIds);
        // Delete comments for these posts
        await supabase.from('post_comments').delete().in('post_id', postIds);
        // Delete the posts themselves
        await supabase.from('posts').delete().in('id', postIds);
      }

      // 3. Delete community members
      const { error: memberError } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', id);
      
      if (memberError) console.warn('Member deletion warning:', memberError);

      // 4. Final delete of community
      const { error } = await supabase
        .from('communities')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Delete community failed:', error);
      throw error;
    }
  },

  async removeMember(communityId: string, userId: string) {
    try {
      console.log(`[CommunityService] Attempting to remove member. Comm: ${communityId}, User: ${userId}`);
      
      // 먼저 커뮤니티 유형 확인 (강의 연동 여부)
      const { data: community, error: fetchErr } = await supabase
        .from('communities')
        .select('course_id')
        .eq('id', communityId)
        .single();

      if (fetchErr) throw new Error('커뮤니티 정보를 확인할 수 없습니다.');

      if (community?.course_id) {
        // 강의 연동 커뮤니티: 수강생은 삭제해도 다시 나타날 수 있으므로 'excluded' 역할 부여
        console.log('[CommunityService] Course-linked community. Setting status to excluded.');
        const { error: upsertErr } = await supabase
          .from('community_members')
          .upsert({
            community_id: communityId,
            user_id: userId,
            role: 'excluded',
            joined_at: new Date().toISOString()
          }, { 
            onConflict: 'community_id,user_id' 
          });
        
        if (upsertErr) {
          console.error('[CommunityService] Upsert failed, fallback to update:', upsertErr);
          const { error: updateErr } = await supabase
            .from('community_members')
            .update({ role: 'excluded' })
            .match({ community_id: communityId, user_id: userId });
          if (updateErr) throw updateErr;
        }
      } else {
        // 일반 커뮤니티: 멤버 레퍼런스 완전 삭제
        console.log('[CommunityService] Regular community. Executing hard delete.');
        const { error: deleteErr } = await supabase
          .from('community_members')
          .delete()
          .match({ community_id: communityId, user_id: userId });
        
        if (deleteErr) {
          console.error('[CommunityService] Delete failed:', deleteErr);
          throw deleteErr;
        }
      }

      console.log('[CommunityService] Member removal successful.');
      return true;
    } catch (error: any) {
      console.error('[CommunityService] removeMember critical failure:', error);
      throw new Error(error.message || '멤버 제외 처리 중 오류가 발생했습니다.');
    }
  },

  async getAdminCommunityMembers(communityId: string, courseId?: string) {
    try {
      // 1. Get explicit members
      let explicitMembers: any[] = [];
      const { data: expl, error: explErr } = await supabase
        .from('community_members')
        .select('role, joined_at, user_id')
        .eq('community_id', communityId);
      
      if (explErr) {
        // Fallback for minimal schema
        const { data: fallbackExpl } = await supabase
          .from('community_members')
          .select('user_id')
          .eq('community_id', communityId);
        explicitMembers = fallbackExpl || [];
      } else {
        explicitMembers = expl || [];
      }
      
      const userIds = new Set(explicitMembers.map(m => m.user_id));
      
      // 2. Get enrolled members if course linked
      let enrollmentData: any[] = [];
      if (courseId) {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('user_id, created_at')
          .eq('course_id', courseId)
          .eq('status', 'active');
          
        if (enrollments) {
          enrollmentData = enrollments;
          enrollments.forEach(e => userIds.add(e.user_id));
        }
      }

      const uniqueUserIds = Array.from(userIds);
      if (uniqueUserIds.length === 0) return [];

      // 3. Fetch profiles
      const { data: profiles, error: authError } = await supabase
        .from('profiles')
        .select('id, name, nickname, email, avatar_url')
        .in('id', uniqueUserIds);

      if (authError) throw authError;

      // 4. Combine and map
      const memberMap = new Map();

      // Start with course enrollments
      enrollmentData.forEach(e => {
        const profile = profiles?.find(p => p.id === e.user_id);
        if (profile) {
          memberMap.set(profile.id, {
            id: profile.id,
            name: profile.name || '알 수 없음',
            email: profile.email,
            avatarUrl: profile.avatar_url,
            joinedAt: e.created_at,
            source: 'course',
            role: 'member'
          });
        }
      });

      // Override/Add with explicit members
      explicitMembers.forEach(m => {
        const profile = profiles?.find(p => p.id === m.user_id);
        if (profile) {
          memberMap.set(profile.id, {
            id: profile.id,
            name: profile.name || '알 수 없음',
            email: profile.email,
            avatarUrl: profile.avatar_url,
            joinedAt: m.joined_at || new Date().toISOString(),
            source: m.role && m.role !== 'member' ? 'manual' : (memberMap.has(profile.id) ? 'course' : 'manual'),
            role: m.role || 'member'
          });
        }
      });

      const finalMembers = Array.from(memberMap.values())
        .filter(m => m.role !== 'excluded');

      return finalMembers.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
    } catch (error) {
      console.error('Failed to get community members:', error);
      return [];
    }
  },
  
  async searchUsers(query: string) {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, name, nickname, email, avatar_url')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);

    if (error) throw error;
    return users;
  },

  async getAllUsers() {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, name, nickname, email, avatar_url')
      .order('name', { ascending: true })
      .limit(100);

    if (error) throw error;
    return users;
  },

  async syncCourseMembers(communityId: string, courseId: string) {
    // Get all enrolled users for this course
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('user_id')
      .eq('course_id', courseId)
      .eq('status', 'active');

    if (enrollError) throw enrollError;
    if (!enrollments || enrollments.length === 0) return true;

    const userIds = enrollments.map(e => e.user_id);

    // Get existing memberships to avoid duplicates
    const { data: existingMembers } = await supabase
      .from('community_members')
      .select('user_id')
      .eq('community_id', communityId)
      .in('user_id', userIds);

    const existingUserIds = new Set(existingMembers?.map(m => m.user_id) || []);
    const newUserIds = userIds.filter(id => !existingUserIds.has(id));

    if (newUserIds.length === 0) return true;

    // Batch insert new members
    const { error: insertError } = await supabase
      .from('community_members')
      .insert(newUserIds.map(userId => ({
        community_id: communityId,
        user_id: userId,
        role: 'member',
        joined_at: new Date().toISOString()
      })));

    if (insertError) throw insertError;
    return true;
  },

  async inviteMemberToCommunityByUserId(communityId: string, userId: string) {
    // Check if already exists (including excluded)
    const { data: existing } = await supabase
      .from('community_members')
      .select('id, role')
      .eq('community_id', communityId)
      .eq('user_id', userId)
      .maybeSingle();
      
    if (existing) {
      if (existing.role === 'excluded') {
        // Re-activate
        const { error } = await supabase
          .from('community_members')
          .update({ 
            role: 'member', 
            joined_at: new Date().toISOString() 
          })
          .eq('id', existing.id);
        if (error) throw error;
        return true;
      }
      throw new Error('이미 이 커뮤니티의 멤버이거나 초대된 상태입니다.');
    }
    
    const { error: insertError } = await supabase
      .from('community_members')
      .insert([{
        community_id: communityId,
        user_id: userId,
        role: 'member',
        joined_at: new Date().toISOString()
      }]);
      
    if (insertError) throw insertError;
    return true;
  },

  async togglePostReaction(postId: string, emoji: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { data: existing } = await supabase
      .from('post_reactions')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from('post_reactions').delete().eq('id', existing.id);
      if (error) throw error;
      return false;
    } else {
      const { error } = await supabase.from('post_reactions').insert([{ post_id: postId, user_id: user.id, emoji }]);
      if (error) throw error;
      return true;
    }
  },

  async joinAttendance(postId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('post_attendance')
      .insert([{ post_id: postId, user_id: user.id }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('이미 출석하셨습니다.');
      throw error;
    }
    return data;
  },

  async votePoll(postId: string, optionIndex: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('post_poll_votes')
      .insert([{ post_id: postId, user_id: user.id, option_index: optionIndex }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('이미 투표하셨습니다.');
      throw error;
    }
    return data;
  },

  async toggleTodo(postId: string, todoIndex: number, completed: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    if (completed) {
      const { data, error } = await supabase
        .from('post_todo_checks')
        .insert([{ post_id: postId, user_id: user.id, todo_index: todoIndex }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { error } = await supabase
        .from('post_todo_checks')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('todo_index', todoIndex);
      if (error) throw error;
      return null;
    }
  },

  async toggleMessageReaction(messageId: string, emoji: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id);
      if (error) throw error;
      return false;
    } else {
      const { error } = await supabase.from('message_reactions').insert([{ message_id: messageId, user_id: user.id, emoji }]);
      if (error) throw error;
      return true;
    }
  },

  async togglePin(postId: string, isPinned: boolean) {
    const { error } = await supabase
      .from('posts')
      .update({ is_pinned: isPinned })
      .eq('id', postId);
    if (error) throw error;
    return true;
  },

  async deleteMessage(messageId: string) {
    const { error } = await supabase
      .from('messages')
      .update({ is_deleted: true })
      .eq('id', messageId);
    if (error) throw error;
    return true;
  },

  subscribeToPostReactions(communityId: string, onEvent: (payload: any) => void) {
    const channelName = `post-reactions-${communityId}-${Math.random().toString(36).substring(2, 7)}`;
    return supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'post_reactions'
      }, (payload) => onEvent(payload))
      .subscribe();
  },

  subscribeToMessageReactions(communityId: string, onEvent: (payload: any) => void) {
    const channelName = `message-reactions-${communityId}-${Math.random().toString(36).substring(2, 7)}`;
    return supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions'
      }, (payload) => onEvent(payload))
      .subscribe();
  },

  async inviteMemberToCommunityByEmail(communityId: string, email: string) {
    // Find user by email
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email);
      
    if (userError || !users || users.length === 0) {
      throw new Error('해당 이메일을 가진 회원을 찾을 수 없습니다.');
    }
    
    const userId = users[0].id;
    
    // Check if already invited
    const { data: existing } = await supabase
      .from('community_members')
      .select('id')
      .eq('community_id', communityId)
      .eq('user_id', userId)
      .maybeSingle();
      
    if (existing) {
      throw new Error('이미 초대된 회원입니다.');
    }
    
    const { error: insertError } = await supabase
      .from('community_members')
      .insert([{
        community_id: communityId,
        user_id: userId,
        joined_at: new Date().toISOString()
      }]);
      
    if (insertError) throw insertError;
    return true;
  },

  async checkMembership(communityId: string, userId: string) {
    const { data: community, error: commError } = await supabase
      .from('communities')
      .select('*')
      .eq('id', communityId)
      .single();

    if (commError) throw commError;

    // If it's not a course-specific community, maybe it's public?
    // For now, let's assume if it has a course_id, we check enrollments.
    if (!community.course_id) return true;

    const { data: enrollment, error: enrollError } = await supabase
      .from('enrollments')
      .select('*')
      .eq('course_id', community.course_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (enrollError) throw enrollError;
    return !!enrollment;
  },

  async getJoinedCommunities(userId: string) {
    // 1. Get explicit memberships (including exclusions)
    const { data: explicitMem } = await supabase
      .from('community_members')
      .select('community_id, role')
      .eq('user_id', userId);
    
    const explicitIds = explicitMem?.filter(m => m.role !== 'excluded' && m.role !== 'pending').map(m => m.community_id) || [];
    const excludedIds = new Set(explicitMem?.filter(m => m.role === 'excluded' || m.role === 'pending').map(m => m.community_id) || []);

    // 2. Get course enrollments
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('user_id', userId);
    
    const courseIds = enrollments?.map(e => e.course_id).filter(Boolean) || [];

    // 3. Get all relevant communities
    let query = supabase.from('communities').select('*').eq('is_deleted', false);
    
    let filters = [];
    if (explicitIds.length > 0) filters.push(`id.in.(${explicitIds.join(',')})`);
    if (courseIds.length > 0) filters.push(`course_id.in.(${courseIds.join(',')})`);

    if (filters.length === 0) return [];

    const { data: communities, error } = await query.or(filters.join(','));
    if (error) throw error;
    
    // 4. Final filter to remove those where user is explicitly 'excluded'
    return communities.filter(c => !excludedIds.has(c.id)) as any[];
  },

  async applyToJoinCommunity(communityId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    // Check if registration already exists
    const { data: existing } = await supabase
      .from('community_members')
      .select('id, role')
      .eq('community_id', communityId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      if (existing.role === 'member') {
        throw new Error('이미 이 커뮤니티의 가입된 멤버입니다.');
      }
      // If excluded or pending, set role specifically to 'pending'
      const { error } = await supabase
        .from('community_members')
        .update({ role: 'pending', joined_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
      return true;
    }

    const { error } = await supabase
      .from('community_members')
      .insert([{
        community_id: communityId,
        user_id: user.id,
        role: 'pending',
        joined_at: new Date().toISOString()
      }]);

    if (error) throw error;
    return true;
  },

  async getJoinRequests() {
    const { data, error } = await supabase
      .from('community_members')
      .select(`
        id,
        community_id,
        user_id,
        role,
        joined_at,
        communities(name, type),
        profiles(name, nickname, email, avatar_url)
      `)
      .eq('role', 'pending')
      .order('joined_at', { ascending: false });

    if (error) {
      // In case relation fallback is needed
      const { data: rawData, error: rawError } = await supabase
        .from('community_members')
        .select('*')
        .eq('role', 'pending')
        .order('joined_at', { ascending: false });
        
      if (rawError) throw rawError;
      if (!rawData) return [];

      const communityIds = [...new Set(rawData.map((r: any) => r.community_id))];
      const userIds = [...new Set(rawData.map((r: any) => r.user_id))];

      const [comms, profiles] = await Promise.all([
        supabase.from('communities').select('id, name, type').in('id', communityIds),
        supabase.from('profiles').select('id, name, nickname, email, avatar_url').in('id', userIds)
      ]);

      return rawData.map((r: any) => {
        return {
          ...r,
          communities: comms.data?.find((c: any) => c.id === r.community_id) || null,
          profiles: profiles.data?.find((p: any) => p.id === r.user_id) || null
        };
      });
    }

    return data || [];
  },

  async approveJoinRequest(membershipId: string) {
    const { error } = await supabase
      .from('community_members')
      .update({ role: 'member', joined_at: new Date().toISOString() })
      .eq('id', membershipId);

    if (error) throw error;
    return true;
  },

  async rejectJoinRequest(membershipId: string) {
    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('id', membershipId);

    if (error) throw error;
    return true;
  }
};
