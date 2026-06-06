import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ChatRoom, ChatMessage, Profile } from '@/types';
import { toast } from 'sonner';

export interface ChatRoomWithLastMessage extends ChatRoom {
  room_name?: string;
  last_message?: string;
  last_message_at?: string;
  sender_nickname?: string;
  community_name?: string;
}

export function useMyChatRooms() {
  const [rooms, setRooms] = useState<ChatRoomWithLastMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchRooms = useCallback(async (currentUserId: string) => {
    try {
      // 1. Fetch chat_room_members to find rooms the user is in
      const { data: memberships, error: memberError } = await supabase
        .from('chat_room_members')
        .select(`
          room_id,
          chat_rooms (
            *,
            communities (
              name
            )
          )
        `)
        .eq('user_id', currentUserId);

      if (memberError) throw memberError;

      if (!memberships || memberships.length === 0) {
        setRooms([]);
        setLoading(false);
        return;
      }

      // Map memberships to rooms list
      const joinedRooms: ChatRoomWithLastMessage[] = memberships
        .map((m: any) => {
          if (!m.chat_rooms) return null;
          const baseName = m.chat_rooms.room_name || m.chat_rooms.name || '소통방';
          const commName = m.chat_rooms.communities?.name;
          
          let cleanName = baseName;
          // 앞에 잉여스럽게 노출되거나 겹쳐 생성된 '#' 문자 제거로 깨끗한 포맷 조성
          cleanName = cleanName.replace(/^#+/, '').trim();
          
          if (commName) {
            const escapedCommName = commName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const patterns = [
              new RegExp(`^\\[${escapedCommName}\\]\\s*`, 'i'),
              new RegExp(`^\\(${escapedCommName}\\)\\s*`, 'i'),
              new RegExp(`^#\\(${escapedCommName}\\)\\s*`, 'i'),
              new RegExp(`^#\\[${escapedCommName}\\]\\s*`, 'i'),
            ];
            patterns.forEach(pat => {
              cleanName = cleanName.replace(pat, '');
            });
            cleanName = cleanName.trim();
          }

          const finalName = commName ? `[${commName}] ${cleanName}` : cleanName;

          return {
            ...m.chat_rooms,
            room_name: finalName,
            community_name: commName || undefined,
          };
        })
        .filter(Boolean) as ChatRoomWithLastMessage[];

      // 2. Fetch the latest message for each joined room (with fallback support)
      const roomsWithLastMsg = await Promise.all(
        joinedRooms.map(async (room) => {
          let lastMsgData: any = null;

          // Try 1: chat_messages table
          try {
            const { data: lastMsgs, error: msgError } = await supabase
              .from('chat_messages')
              .select(`
                message,
                created_at,
                profiles (
                  nickname,
                  name
                )
              `)
              .eq('room_id', room.id)
              .order('created_at', { ascending: false })
              .limit(1);

            if (!msgError && lastMsgs && lastMsgs.length > 0) {
              const item = lastMsgs[0];
              lastMsgData = {
                message: item.message,
                created_at: item.created_at,
                profiles: item.profiles
              };
            }
          } catch (e) {
            console.warn('chat_messages fetch failed for latest message:', e);
          }

          // Try 2: messages fallback (if Try 1 yielded nothing)
          if (!lastMsgData) {
            try {
              const { data: altMsgs, error: altError } = await supabase
                .from('messages')
                .select(`
                  content,
                  created_at,
                  profiles (
                    nickname,
                    name
                  )
                `)
                .eq('room_id', room.id)
                .order('created_at', { ascending: false })
                .limit(1);

              if (!altError && altMsgs && altMsgs.length > 0) {
                const item = altMsgs[0];
                lastMsgData = {
                  message: item.content,
                  created_at: item.created_at,
                  profiles: item.profiles
                };
              }
            } catch (e) {
              console.warn('messages fallback fetch failed for latest message:', e);
            }
          }

          if (!lastMsgData) {
            return {
              ...room,
              last_message_at: room.created_at,
            };
          }

          const profile = lastMsgData.profiles as any;
          return {
            ...room,
            last_message: lastMsgData.message,
            last_message_at: lastMsgData.created_at,
            sender_nickname: profile?.nickname || profile?.name || '알 수 없음',
          };
        })
      );

      // Sort by last message / creation date descending
      roomsWithLastMsg.sort(
        (a, b) =>
          new Date(b.last_message_at || b.created_at).getTime() -
          new Date(a.last_message_at || a.created_at).getTime()
      );

      // 데이터 중복 투입 및 극단적인 실시간 마이크로레이스컨디션으로 인한 UI 중복 렌더링 무력화
      const uniqueRoomsMap = new Map<string, ChatRoomWithLastMessage>();
      roomsWithLastMsg.forEach(room => {
        if (!uniqueRoomsMap.has(room.id)) {
          uniqueRoomsMap.set(room.id, room);
        }
      });

      setRooms(Array.from(uniqueRoomsMap.values()));
    } catch (error: any) {
      console.error('Error in fetchRooms:', error);
      // Fail gracefully: try sorting by original room creation
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up the user session and real-time subscription
  useEffect(() => {
    let activeUserId: string | null = null;

    const setupSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        activeUserId = user.id;
        setUserId(user.id);
        await fetchRooms(user.id);
      } else {
        setLoading(false);
      }
    };

    setupSession();

    // Subscribe to chat messages to dynamically update sorting (push active to top, both tables)
    const channel = supabase
      .channel('my_chat_rooms_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        async (payload) => {
          const newMsgRaw = payload.new as any;
          const newMsg = {
            ...newMsgRaw,
            message: newMsgRaw.message || newMsgRaw.content
          };
          
          // Check if this message belongs to any room we are in
          setRooms((prevRooms) => {
            const hasRoom = prevRooms.some((r) => r.id === newMsg.room_id);
            if (!hasRoom) {
              // If we are not currently tracking this room, refetch to check if we just joined!
              if (activeUserId) {
                fetchRooms(activeUserId);
              }
              return prevRooms;
            }

            // Otherwise, update the target room with the new message and re-sort
            const updated = prevRooms.map((room) => {
              if (room.id === newMsg.room_id) {
                return {
                  ...room,
                  last_message: newMsg.message,
                  last_message_at: newMsg.created_at,
                };
              }
              return room;
            });

            return [...updated].sort(
              (a, b) =>
                new Date(b.last_message_at || b.created_at).getTime() -
                new Date(a.last_message_at || a.created_at).getTime()
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMsgRaw = payload.new as any;
          const newMsg = {
            ...newMsgRaw,
            message: newMsgRaw.message || newMsgRaw.content
          };
          
          // Check if this message belongs to any room we are in
          setRooms((prevRooms) => {
            const hasRoom = prevRooms.some((r) => r.id === newMsg.room_id);
            if (!hasRoom) {
              // If we are not currently tracking this room, refetch to check if we just joined!
              if (activeUserId) {
                fetchRooms(activeUserId);
              }
              return prevRooms;
            }

            // Otherwise, update the target room with the new message and re-sort
            const updated = prevRooms.map((room) => {
              if (room.id === newMsg.room_id) {
                return {
                  ...room,
                  last_message: newMsg.message,
                  last_message_at: newMsg.created_at,
                };
              }
              return room;
            });

            return [...updated].sort(
              (a, b) =>
                new Date(b.last_message_at || b.created_at).getTime() -
                new Date(a.last_message_at || a.created_at).getTime()
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_rooms',
        },
        () => {
          if (activeUserId) {
            fetchRooms(activeUserId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRooms]);

  const createChatRoom = async (communityId: string | null, roomName: string, members?: string[]) => {
    if (!userId) {
      toast.error('로그인이 필요합니다.');
      return null;
    }

    try {
      // 1. Create chat room
      const { data: newRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .insert([
          {
            community_id: communityId || null,
            room_name: roomName,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (roomError) throw roomError;

      // 2. Add creator member
      const memberList = [{ room_id: newRoom.id, user_id: userId }];
      
      // Add other invited members
      if (members && members.length > 0) {
        members.forEach((mId) => {
          if (mId !== userId) {
            memberList.push({ room_id: newRoom.id, user_id: mId });
          }
        });
      }

      const { error: memberError } = await supabase
        .from('chat_room_members')
        .insert(memberList);

      if (memberError) throw memberError;

      toast.success('채팅방이 생성되었습니다.');
      await fetchRooms(userId);
      return newRoom;
    } catch (error: any) {
      console.error('Error creating chat room:', error);
      toast.error('채팅방 생성 도중 오류가 발생했습니다.');
      return null;
    }
  };

  return {
    rooms,
    loading,
    refetch: () => userId && fetchRooms(userId),
    createChatRoom,
  };
}
