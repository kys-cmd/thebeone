import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';

export const profileService = {
  async getAllProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Profile[];
  },

  async updateProfile(id: string, updates: Partial<Profile>) {
    // Clean up updates: Convert empty strings to null for fields that should be nullable
    const cleanedUpdates = { ...updates };
    
    // Explicitly handle fields that should be NULL instead of empty strings
    const fieldsToNullify = ['birthdate', 'gender', 'mobile_phone', 'phone', 'address', 'nickname', 'avatar_url'];
    fieldsToNullify.forEach(field => {
      if (cleanedUpdates[field as keyof typeof cleanedUpdates] === '') {
        (cleanedUpdates as any)[field] = null;
      }
    });
    
    // 1. Update the profiles table
    const { data, error } = await supabase
      .from('profiles')
      .update(cleanedUpdates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Database Profile Update Error:', error);
      throw error;
    }

    // 2. Sync with auth user metadata ONLY if the target user is the currently logged in user
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (currentUser && currentUser.id === id) {
      const authUpdates: any = {};
      if (updates.name) authUpdates.full_name = updates.name;
      if (updates.nickname) authUpdates.nickname = updates.nickname;
      if (updates.avatar_url) authUpdates.avatar_url = updates.avatar_url;
      if (updates.gender) authUpdates.gender = updates.gender;
      if (updates.mobile_phone) authUpdates.phone = updates.mobile_phone;

      if (Object.keys(authUpdates).length > 0) {
        await supabase.auth.updateUser({
          data: authUpdates
        }).catch(err => console.warn('Auth metadata sync failed:', err));
      }
    }

    return data as Profile;
  },

  async getProfileById(id: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Profile;
  },

  async softDeleteProfile(id: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_deleted: true })
      .eq('id', id);
    
    if (error) throw error;
  },

  async deleteProfileHard(id: string) {
    try {
      console.log('Starting extremely robust Cascade hard deletion for profile:', id);

      // 1. Fetch user's written posts so we can clear their dependents first
      let postIds: string[] = [];
      try {
        const { data: userPosts, error } = await supabase
          .from('posts')
          .select('id')
          .eq('user_id', id);
        if (!error && userPosts && userPosts.length > 0) {
          postIds = userPosts.map(p => p.id);
        }
      } catch (err) {
        console.warn('Failed to fetch user posts:', err);
      }

      // 2. Fetch user's board posts so we can clear their replies
      let boardPostIds: string[] = [];
      try {
        const { data: userBoardPosts, error } = await supabase
          .from('board_posts')
          .select('id')
          .eq('user_id', id);
        if (!error && userBoardPosts && userBoardPosts.length > 0) {
          boardPostIds = userBoardPosts.map(bp => bp.id);
        }
      } catch (err) {
        console.warn('Failed to fetch user board posts:', err);
      }

      // 3. Fetch user's message IDs to clear reactions on them
      let messageIds: string[] = [];
      let chatMessageIds: string[] = [];
      try {
        const { data: userMessages, error } = await supabase
          .from('messages')
          .select('id')
          .eq('user_id', id);
        if (!error && userMessages && userMessages.length > 0) {
          messageIds = userMessages.map(m => m.id);
        }
      } catch (err) {
        console.warn('Failed to fetch user messages:', err);
      }

      try {
        const { data: userChatMessages, error } = await supabase
          .from('chat_messages')
          .select('id')
          .eq('user_id', id);
        if (!error && userChatMessages && userChatMessages.length > 0) {
          chatMessageIds = userChatMessages.map(cm => cm.id);
        }
      } catch (err) {
        console.warn('Failed to fetch chat_messages:', err);
      }

      // Helper helper to run block deletions and log issues
      const runDeletes = async (tasks: { desc: string; query: any }[]) => {
        const results = await Promise.allSettled(tasks.map(t => t.query));
        results.forEach((res, index) => {
          if (res.status === 'rejected') {
            console.error(`[Cascade-Hard-Delete] '${tasks[index].desc}' was rejected. Reason:`, res.reason);
          } else {
            const val = res.value;
            if (val && typeof val === 'object' && 'error' in val && val.error) {
              console.error(`[Cascade-Hard-Delete] '${tasks[index].desc}' returned error:`, val.error);
            } else {
              console.log(`[Cascade-Hard-Delete] '${tasks[index].desc}' deleted successfully or is empty.`);
            }
          }
        });
      };

      console.log('Executing Level 1 Cleanup: Child row interactions (Reactions/Comments/Replies)...');
      // Level 1: Clear reactions/comments on other users' screens or entries associated with user's written items
      await runDeletes([
        // Clear message reactions on user's own sent messages
        { desc: 'message_reactions (by sender messages)', query: messageIds.length > 0 ? supabase.from('message_reactions').delete().in('message_id', messageIds) : Promise.resolve() },
        { desc: 'message_reactions (by sender chat_messages)', query: chatMessageIds.length > 0 ? supabase.from('message_reactions').delete().in('message_id', chatMessageIds) : Promise.resolve() },

        // Clear comments and votes on user's written posts
        { desc: 'post_likes (on user posts)', query: postIds.length > 0 ? supabase.from('post_likes').delete().in('post_id', postIds) : Promise.resolve() },
        { desc: 'post_comments (on user posts)', query: postIds.length > 0 ? supabase.from('post_comments').delete().in('post_id', postIds) : Promise.resolve() },
        { desc: 'post_reactions (on user posts)', query: postIds.length > 0 ? supabase.from('post_reactions').delete().in('post_id', postIds) : Promise.resolve() },
        { desc: 'post_attendance (on user posts)', query: postIds.length > 0 ? supabase.from('post_attendance').delete().in('post_id', postIds) : Promise.resolve() },
        { desc: 'post_poll_votes (on user posts)', query: postIds.length > 0 ? supabase.from('post_poll_votes').delete().in('post_id', postIds) : Promise.resolve() },
        { desc: 'post_todo_checks (on user posts)', query: postIds.length > 0 ? supabase.from('post_todo_checks').delete().in('post_id', postIds) : Promise.resolve() },

        // Clear replies on user's written board posts
        { desc: 'board_replies (on user board posts)', query: boardPostIds.length > 0 ? supabase.from('board_replies').delete().in('post_id', boardPostIds) : Promise.resolve() },

        // Clear user's own reactions, comments, likes as a reader/interactor
        { desc: 'message_reactions (as user)', query: supabase.from('message_reactions').delete().eq('user_id', id) },
        { desc: 'post_likes (as user)', query: supabase.from('post_likes').delete().eq('user_id', id) },
        { desc: 'post_comments (as user)', query: supabase.from('post_comments').delete().eq('user_id', id) },
        { desc: 'post_reactions (as user)', query: supabase.from('post_reactions').delete().eq('user_id', id) },
        { desc: 'post_attendance (as user)', query: supabase.from('post_attendance').delete().eq('user_id', id) },
        { desc: 'post_poll_votes (as user)', query: supabase.from('post_poll_votes').delete().eq('user_id', id) },
        { desc: 'post_todo_checks (as user)', query: supabase.from('post_todo_checks').delete().eq('user_id', id) },
        { desc: 'board_replies (as user)', query: supabase.from('board_replies').delete().eq('user_id', id) },
      ]);

      console.log('Executing Level 2 Cleanup: Main user authored rows & table records...');
      // Level 2: Delete direct authorship rows and subscription associations
      await runDeletes([
        { desc: 'posts (authored by user)', query: supabase.from('posts').delete().eq('user_id', id) },
        { desc: 'board_posts (authored by user)', query: supabase.from('board_posts').delete().eq('user_id', id) },
        { desc: 'messages (authored by user)', query: supabase.from('messages').delete().eq('user_id', id) },
        { desc: 'chat_messages (authored by user)', query: supabase.from('chat_messages').delete().eq('user_id', id) },
        { desc: 'enrollments', query: supabase.from('enrollments').delete().eq('user_id', id) },
        { desc: 'community_members', query: supabase.from('community_members').delete().eq('user_id', id) },
        { desc: 'chat_room_members (user_id)', query: supabase.from('chat_room_members').delete().eq('user_id', id) },
        { desc: 'chat_last_read (user_id)', query: supabase.from('chat_last_read').delete().eq('user_id', id) },
        { desc: 'community_invitations (as inviter)', query: supabase.from('community_invitations').delete().eq('inviter_id', id) },
        { desc: 'reviews (authored by user)', query: supabase.from('reviews').delete().eq('user_id', id) },
        { desc: 'orders (associated with user)', query: supabase.from('orders').delete().eq('user_id', id) },
        { desc: 'payments (associated with user)', query: supabase.from('payments').delete().eq('user_id', id) },
        { desc: 'transactions (created_by)', query: supabase.from('transactions').delete().eq('created_by', id) },
        { desc: 'transactions (user_id)', query: supabase.from('transactions').delete().eq('user_id', id) },
      ]);

      console.log('Executing Level 3 Cleanup: Secondary fallback columns/old styles...');
      // Level 3: Fallback check older schema styles just in case
      await runDeletes([
        { desc: 'chat_room_members (profile_id fallback)', query: supabase.from('chat_room_members').delete().eq('profile_id', id) },
        { desc: 'chat_last_read (profile_id fallback)', query: supabase.from('chat_last_read').delete().eq('profile_id', id) },
        { desc: 'messages (sender_id fallback)', query: supabase.from('messages').delete().eq('sender_id', id) },
      ]);

      console.log('Executing Level 4 Cleanup: Core user profile deletion itself...');
      // 4. Finally, remove user profile itself
      const { error: profileDeleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);
      
      if (profileDeleteError) {
        console.error('Core profiles row delete failed:', profileDeleteError);
        throw profileDeleteError;
      }

      console.log('Executing Level 5 Cleanup: Removing authentication credentials permanently...');
      try {
        let authSuccess = false;
        try {
          const response = await fetch('/api/admin/delete-auth-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: id })
          });
          if (response.ok) {
            const result = await response.json();
            if (result.status === 'success') {
              console.log('Successfully deleted user from Supabase Auth credentials table via primary API.');
              authSuccess = true;
            } else {
              console.warn('Primary Auth delete returned failure:', result.message);
            }
          }
        } catch (e) {
          console.warn('Primary Auth delete API hit an exception, attempting unified fallback API:', e);
        }

        if (!authSuccess) {
          const session = (await supabase.auth.getSession()).data.session;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (session) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
          const resUnified = await fetch('/api/core-api', {
            method: 'POST',
            headers,
            body: JSON.stringify({ action: 'admin-delete-auth-user', userId: id })
          });
          if (resUnified.ok) {
            const resultUnified = await resUnified.json();
            if (resultUnified.status === 'success') {
              console.log('Successfully deleted user from Supabase Auth credentials table via unified API fallback.');
            } else {
              console.warn('Unified API fallback returned failure:', resultUnified.message);
            }
          } else {
            console.error('Unified API fallback returned status code:', resUnified.status);
          }
        }
      } catch (errAuth) {
        console.error('Failed to command server to purge Auth credentials row:', errAuth);
      }

      console.log('Successfully completed profile hard deletion:', id);
    } catch (err: any) {
      console.error('Error in deleteProfileHard:', err);
      // Construct a very descriptive custom error to let the frontend know what database error occurred
      throw new Error(err.message || '데이터베이스 Cascade 삭제 중 예외가 발생했습니다.');
    }
  }
};
