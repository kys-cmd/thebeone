import { supabase } from '@/lib/supabase';
import { Message, ChatRoom, ChatRoomMember } from '@/types';

export const chatService = {
  /**
   * 사용자가 참여 중인 커뮤니티의 전체 읽지 않은 메시지 수를 가져옵니다.
   */
  async getTotalUnreadCount(userId: string): Promise<number> {
    try {
      // 1. 사용자가 참여 중인 커뮤니티 목록을 가져옵니다.
      const { data: memberships } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', userId);

      if (!memberships || memberships.length === 0) return 0;

      const communityIds = memberships.map(m => m.community_id);

      // 2. 각 커뮤니티별 마지막 읽은 시간 정보를 가져옵니다.
      const { data: lastReads } = await supabase
        .from('chat_last_read')
        .select('community_id, last_read_at')
        .eq('user_id', userId)
        .in('community_id', communityIds);

      const lastReadMap = new Map<string, string>();
      lastReads?.forEach(lr => lastReadMap.set(lr.community_id, lr.last_read_at));

      // 3. 각 커뮤니티에서 마지막 읽은 시간 이후에 생성된 메시지 수를 합산합니다.
      let totalUnread = 0;

      for (const communityId of communityIds) {
        const lastReadAt = lastReadMap.get(communityId) || '1970-01-01T00:00:00Z';
        
        const { count, error } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', communityId)
          .gt('created_at', lastReadAt);

        if (!error && count !== null) {
          totalUnread += count;
        }
      }

      return totalUnread;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  },

  /**
   * 특정 커뮤니티를 읽음 처리합니다.
   */
  async markAsRead(userId: string, communityId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('chat_last_read')
        .upsert({
          user_id: userId,
          community_id: communityId,
          last_read_at: now
        }, {
          onConflict: 'user_id, community_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  },

  /**
   * 실시간 메시지 변경을 구독합니다.
   */
  subscribeToAllMessages(onNewMessage: () => void) {
    const channelName = `public-messages-${Math.random().toString(36).substring(2, 7)}`;
    return supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
      }, () => {
        onNewMessage();
      })
      .subscribe();
  },

  async getRooms(communityId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Select rooms along with their members to filter correctly
    const { data: rooms, error } = await supabase
      .from('chat_rooms')
      .select('*, chat_room_members(user_id, count)')
      .eq('community_id', communityId)
      .not('is_deleted', 'eq', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Ensure deleted or invalid active rooms are completely filtered out on structural level,
    // and private/one_to_one rooms are only returned if the current user is a member of them.
    const activeRooms = (rooms || []).filter(r => {
      if (!r || !(r as any).id) return false;
      if ((r as any).is_deleted === true || (r as any).is_deleted === 'true') return false;
      
      const type = (r as any).type;
      if (type === 'private' || type === 'one_to_one') {
        if (!user) return false;
        const membersList = (r as any).chat_room_members || [];
        // Check if current user's id exists in the members of this room
        const isMember = membersList.some((m: any) => m.user_id === user.id);
        return isMember;
      }
      
      return true;
    });

    return activeRooms.map(r => {
      // Calculate member count based on raw relations or matching list length
      const countObj = r.chat_room_members?.find((m: any) => m.count !== undefined);
      const memberCount = countObj ? countObj.count : (r.chat_room_members?.length || 0);

      return {
        ...r,
        member_count: memberCount
      };
    }) as ChatRoom[];
  },

  async createRoom(data: Partial<ChatRoom> & { members?: string[] }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    // Clean up community_id (if empty or 'default', set to null)
    const sanitizedData = { ...data };
    delete sanitizedData.members; // Remove members from root data

    if (!sanitizedData.community_id || sanitizedData.community_id === 'default') {
      delete sanitizedData.community_id;
    }

    const { data: room, error } = await supabase
      .from('chat_rooms')
      .insert([{
        ...sanitizedData,
        created_by: user.id,
        created_at: new Date().toISOString(),
        is_deleted: false
      }])
      .select()
      .single();

    if (error) throw error;

    // Join the room as creator and add other members
    const roomMembers = [{ room_id: room.id, user_id: user.id }];
    
    if (data.members && data.members.length > 0) {
      data.members.forEach(memberId => {
        if (memberId !== user.id) {
          roomMembers.push({ room_id: room.id, user_id: memberId });
        }
      });
    }

    const { error: membersError } = await supabase.from('chat_room_members').insert(roomMembers);
    if (membersError) console.error('Error adding members:', membersError);

    return room as ChatRoom;
  },

  async joinRoom(roomId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { error } = await supabase
      .from('chat_room_members')
      .insert([{
        room_id: roomId,
        user_id: user.id
      }]);

    if (error && error.code !== '23505') throw error; // 23505 is unique violation (already joined)
    return true;
  },

  async getJoinedRooms() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    // Use a two-step approach if the joined filter is problematic
    const { data: memberships, error: memError } = await supabase
      .from('chat_room_members')
      .select(`
        room_id, 
        chat_rooms(
          *, 
          community:communities(name)
        )
      `)
      .eq('user_id', user.id);

    if (memError) throw memError;

    // Filter out deleted rooms manually to avoid complex Supabase filter issues with joins
    const rooms = memberships
      .filter(m => {
        if (!m.chat_rooms) return false;
        const room = m.chat_rooms as any;
        return room.id && room.is_deleted !== true && room.is_deleted !== 'true';
      })
      .map(m => ({
        ...m.chat_rooms,
        community_name: (m.chat_rooms as any)?.community?.name
      }));

    // Fetch nicknames for the room creators if needed or messages will bring them
    return rooms;
  },

  async deleteRoom(roomId: string) {
    try {
      console.log('Force room deletion sequence started:', roomId);

      // Step 1: Broad cleanup of all possible related data
      // We wrap them in async functions to handle errors properly within allSettled
      await Promise.allSettled([
        // Messages and their reactions
        (async () => {
          const { data: messages } = await supabase.from('messages').select('id').eq('room_id', roomId);
          if (messages && messages.length > 0) {
            const messageIds = messages.map(m => m.id);
            await supabase.from('message_reactions').delete().in('message_id', messageIds);
            await supabase.from('messages').delete().eq('room_id', roomId);
          }
        })(),
        // Memberships
        supabase.from('chat_room_members').delete().eq('room_id', roomId),
        // Try to clear last read markers if applicable (column name might differ per table schema)
        (async () => {
          // Attempt cleanup but ignore if table/columns don't match room-level tracking
          try {
            await supabase.from('chat_last_read').delete().eq('room_id', roomId);
          } catch (e) {
            // Ignore individual step failure
          }
        })()
      ]);

      // Step 2: Final Deletion of the room itself
      // Try Hard Delete first
      const { error: hardDeleteError } = await supabase
        .from('chat_rooms')
        .delete()
        .eq('id', roomId);

      if (hardDeleteError) {
        console.warn('Hard delete failed, likely RLS or foreign key constraints. Trying Soft Delete fallback...', hardDeleteError.message);
        
        // Final fallback: Soft delete (this usually bypasses cascade issues and is allowed by simpler RLS)
        const { error: softDeleteError } = await supabase
          .from('chat_rooms')
          .update({ is_deleted: true, updated_at: new Date().toISOString() })
          .eq('id', roomId);

        if (softDeleteError) {
          console.error('All DB deletion methods failed for chat_room:', roomId);
          throw new Error('데이터베이스 권한이 부족하거나 제약 조건으로 인해 삭제할 수 없습니다. 관리자 권한을 확인해주세요.');
        }
        
        console.log('Room marked as is_deleted success.');
      } else {
        console.log('Room hard-deleted success.');
      }
      
      return true;
    } catch (error: any) {
      console.error('DeleteRoom sequence failed:', error);
      throw error;
    }
  },

  async leaveRoom(roomId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { error } = await supabase
      .from('chat_room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  },

  async searchUsers(query: string) {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, name, nickname, avatar_url, email')
      .or(`name.ilike.%${query}%,nickname.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);

    if (error) throw error;
    return profiles;
  },

  async checkRoomAccess(roomId: string, userId: string): Promise<{ hasAccess: boolean; room: ChatRoom | null }> {
    try {
      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', roomId)
        .not('is_deleted', 'eq', true)
        .single();

      if (roomError || !room) return { hasAccess: false, room: null };

      if (room.type === 'public') {
        return { hasAccess: true, room };
      }

      const { data: membership, error: memberError } = await supabase
        .from('chat_room_members')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .maybeSingle();

      if (memberError) return { hasAccess: false, room };

      return { hasAccess: !!membership, room };
    } catch (error) {
      console.error('Error checking room access:', error);
      return { hasAccess: false, room: null };
    }
  },

  /**
   * 1:1 채팅방을 조회하거나 없으면 새로 생성합니다.
   */
  async getOrCreateOneToOneRoom(communityId: string, currentUserId: string, targetUserId: string, targetName: string): Promise<string> {
    try {
      // 1. 내가 소속된 모든 방 찾기
      const { data: myRooms, error: myRoomsError } = await supabase
        .from('chat_room_members')
        .select('room_id')
        .eq('user_id', currentUserId);

      if (myRoomsError) throw myRoomsError;

      if (myRooms && myRooms.length > 0) {
        const roomIds = myRooms.map(r => r.room_id);
        
        // 2. 그 중 상대방도 소속되어 있고, 현재 커뮤니티의 1:1 채팅방 매칭 확인
        const { data: match, error: matchError } = await supabase
          .from('chat_room_members')
          .select('room_id, chat_rooms!inner(community_id, type, is_deleted)')
          .in('room_id', roomIds)
          .eq('user_id', targetUserId)
          .eq('chat_rooms.community_id', communityId)
          .eq('chat_rooms.type', 'one_to_one')
          .not('chat_rooms.is_deleted', 'eq', true)
          .limit(1);

        if (!matchError && match && match.length > 0) {
          return match[0].room_id;
        }
      }

      // 3. 없으면 새로운 1:1 방 개설
      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .insert([{
          community_id: communityId,
          name: `${targetName}님과의 1:1 대화`,
          type: 'one_to_one',
          created_by: currentUserId,
          created_at: new Date().toISOString(),
          is_deleted: false
        }])
        .select()
        .single();

      if (roomError) throw roomError;

      // 4. 멤버 관계 생성
      const { error: membersError } = await supabase
        .from('chat_room_members')
        .insert([
          { room_id: room.id, user_id: currentUserId },
          { room_id: room.id, user_id: targetUserId }
        ]);

      if (membersError) throw membersError;

      return room.id;
    } catch (error) {
      console.error('getOrCreateOneToOneRoom failed:', error);
      throw error;
    }
  },

  /**
   * 모든 채팅방, 메시지, 멤버 관계를 초기화(삭제)합니다.
   */
  async resetAllChatData() {
    try {
      console.log('Starting full reset of all chat-related data...');
      
      // 1. 메시지 피드백/리액션 전체 삭제
      await supabase
        .from('message_reactions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      // 2. 메시지 전체 삭제
      await supabase
        .from('messages')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      // 3. 채팅방 멤버 관계 전체 삭제 (room_id 기준으로 비움)
      await supabase
        .from('chat_room_members')
        .delete()
        .neq('room_id', '00000000-0000-0000-0000-000000000000');

      // 4. 마지막 읽은 기록 전체 삭제 (있을 경우 수수)
      try {
        await supabase
          .from('chat_last_read')
          .delete()
          .neq('user_id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.warn('chat_last_read cleanup bypassed:', e);
      }

      // 5. 채팅방 본문 전체 삭제
      const { error: roomDeleteError } = await supabase
        .from('chat_rooms')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (roomDeleteError) {
        console.warn('Hard delete chat_rooms failed. Fallback to Soft Delete is_deleted true update...', roomDeleteError.message);
        const { error: softResetError } = await supabase
          .from('chat_rooms')
          .update({ is_deleted: true, name: '[초기화된 대화방]' })
          .neq('id', '00000000-0000-0000-0000-000000000000');
          
        if (softResetError) throw softResetError;
      }

      console.log('Chat data reset successfully executed.');
      return true;
    } catch (error) {
      console.error('Error during resetAllChatData:', error);
      throw error;
    }
  }
};
