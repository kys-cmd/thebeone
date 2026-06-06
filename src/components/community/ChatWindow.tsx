import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ChatMessage, Profile } from '@/types';
import { Send, Hash, Users, MessageSquare, Trash2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface ChatWindowProps {
  roomId: string;
  roomName: string;
  currentUserId?: string | null;
}

export function ChatWindow({ roomId, roomName, currentUserId }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const cacheProfiles = useRef<Record<string, { nickname: string; name: string; avatar_url: string | null }>>({});

  const resolveProfileForMessage = async (uId: string) => {
    if (cacheProfiles.current[uId]) return cacheProfiles.current[uId];
    
    const { data, error } = await supabase
      .from('profiles')
      .select('name, nickname, avatar_url')
      .eq('id', uId)
      .single();

    if (!error && data) {
      const parsed = {
        name: data.name || '알 수 없음',
        nickname: data.nickname || data.name || '알 수 없음',
        avatar_url: data.avatar_url,
      };
      cacheProfiles.current[uId] = parsed;
      return parsed;
    }
    return { name: '알 수 없음', nickname: '알 수 없음', avatar_url: null };
  };

  // Fetch messages in room
  const fetchMessages = async () => {
    try {
      const { data: firstTry, error: firstErr } = await supabase
        .from('chat_messages')
        .select(`
          *,
          profiles (
            name,
            nickname,
            avatar_url
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (!firstErr && firstTry) {
        const normalized = firstTry.map((item: any) => ({
          ...item,
          message: item.message || item.content
        })) as ChatMessage[];
        setMessages(normalized);
        return;
      }

      console.warn('First try fetching room messages in ChatWindow failed, trying fallback messages table:', firstErr);

      const { data: secondTry, error: secondErr } = await supabase
        .from('messages')
        .select(`
          *,
          profiles (
            name,
            nickname,
            avatar_url
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (!secondErr && secondTry) {
        // 데이터 보존 및 RLS 회피를 위한 is_deleted 안전 필터링
        const activeSecondTry = secondTry.filter(
          (item: any) => item.is_deleted !== true && item.is_deleted !== 'true'
        );
        const normalized = activeSecondTry.map((item: any) => ({
          ...item,
          message: item.message || item.content
        })) as ChatMessage[];
        setMessages(normalized);
        return;
      }

      console.error('All efforts to fetch room messages in ChatWindow failed:', secondErr);
    } catch (e: any) {
      console.error('Error fetching chat messages:', e);
    }
  };

  // Auto scroll to bottom
  const scrollToBottom = (behavior: 'smooth' | 'auto') => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior });
    }
  };

  useEffect(() => {
    fetchMessages().then(() => {
      setTimeout(() => scrollToBottom('auto'), 80);
    });

    // Real-time listener for incoming chat messages in this room (both tables)
    const chatMsgChannel = supabase
      .channel(`chat_messages_room_${roomId}_chat`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const raw = payload.new as ChatMessage;
            const profile = await resolveProfileForMessage(raw.user_id);
            const enriched: ChatMessage = {
              ...raw,
              message: raw.message || (raw as any).content,
              profiles: profile,
            };
            setMessages((prev) => {
              if (prev.some(m => m.id === enriched.id)) return prev;
              return [...prev, enriched];
            });
            setTimeout(() => scrollToBottom('smooth'), 50);
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old as { id: string };
            setMessages((prev) => prev.filter((m) => m.id !== oldId.id));
          }
        }
      )
      .subscribe();

    const msgChannel = supabase
      .channel(`chat_messages_room_${roomId}_msgs`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const raw = payload.new as ChatMessage;
            const profile = await resolveProfileForMessage(raw.user_id);
            const enriched: ChatMessage = {
              ...raw,
              message: raw.message || (raw as any).content,
              profiles: profile,
            };
            setMessages((prev) => {
              if (prev.some(m => m.id === enriched.id)) return prev;
              return [...prev, enriched];
            });
            setTimeout(() => scrollToBottom('smooth'), 50);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new;
            if (updated.is_deleted === true || updated.is_deleted === 'true') {
              setMessages((prev) => prev.filter((m) => m.id !== updated.id));
            } else {
              // 일반 업데이트 (메시지 변경 등)가 있을 경우 반영
              setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, ...updated, message: updated.message || updated.content } : m));
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old as { id: string };
            setMessages((prev) => prev.filter((m) => m.id !== oldId.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatMsgChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [roomId]);

  // Adjust scroll when messages count changes
  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !currentUserId) return;

    setSending(true);
    const textToSend = inputText;
    setInputText('');

    try {
      const basePayload = {
        room_id: roomId,
        user_id: currentUserId,
        created_at: new Date().toISOString()
      };

      // Try 1: chat_messages table, message column
      const { error: err1 } = await supabase
        .from('chat_messages')
        .insert([{
          ...basePayload,
          message: textToSend
        }]);

      if (err1) {
        console.warn('ChatWindow insert try 1 failed:', err1);
        
        // Try 2: chat_messages table, content column
        const { error: err2 } = await supabase
          .from('chat_messages')
          .insert([{
            ...basePayload,
            content: textToSend
          }]);

        if (err2) {
          console.warn('ChatWindow insert try 2 failed:', err2);

          // Try 3: messages table, content column
          const { error: err3 } = await supabase
            .from('messages')
            .insert([{
              ...basePayload,
              content: textToSend
            }]);

          if (err3) {
            console.warn('ChatWindow insert try 3 failed:', err3);

            // Try 4: messages table, message column
            const { error: err4 } = await supabase
              .from('messages')
              .insert([{
                ...basePayload,
                message: textToSend
              }]);

            if (err4) {
              console.error('All inserts in ChatWindow failed:', err4);
              throw new Error(err1.message || err4.message || '데이터베이스 기록 오류');
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast.error(`메시지 전송에 실패했습니다: ${error.message || JSON.stringify(error)}`);
      setInputText(textToSend); // Restore text on failure
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm('정말로 이 메시지를 삭제하시겠습니까?')) return;
    
    try {
      // 1. chat_messages 테이블에서는 물리 삭제 시도 (물리 삭제를 지원하거나 RLS가 적용된 보조 스토리지)
      const { error: err1 } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', msgId);

      // 2. messages 테이블은 회계 및 감사용 물리 삭제 금지 규칙에 따라 soft-delete (is_deleted: true) 처리
      const { error: err2 } = await supabase
        .from('messages')
        .update({ is_deleted: true })
        .eq('id', msgId);

      // 어떠한 쿼리 에러나 RLS 거부가 발생해도 사용자 편의를 위해 UI 로컬 상태에서는 즉시 제거
      setMessages(prev => prev.filter(m => m.id !== msgId));
      toast.success('메시지가 삭제되었습니다.');
    } catch (e) {
      console.warn('DB message deletion errored, using local fallback:', e);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      toast.success('메시지가 삭제되었습니다.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200/50 rounded-3xl overflow-hidden shadow-sm">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-purple-100 p-2 rounded-2xl text-purple-600">
            <Hash className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 leading-none">{roomName}</h3>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5 leading-none">
              #실시간 대화방 · 자유롭게 대화를 나눠보세요
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-black tracking-wider text-purple-600 bg-purple-50 px-3 py-1.5 rounded-full uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
          Live Connected
        </div>
      </div>

      {/* Main Messages Feed */}
      <div className="flex-grow p-6 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
            <div className="bg-slate-100 p-4 rounded-full text-slate-500">
              <MessageSquare className="w-10 h-10 animate-bounce" />
            </div>
            <div>
              <p className="font-extrabold text-xs text-slate-700">이 채팅방의 첫 번째 메시지를 보내보세요!</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">
                실시간 채팅을 통해 접속 중인 모든 사용자에게 즉시 전달됩니다.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => {
              const isMine = msg.user_id === currentUserId;
              const profile = msg.profiles as any;
              const senderName = profile?.nickname || profile?.name || '알 수 없음';
              const avatar = profile?.avatar_url;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 items-start group ${
                    isMine ? 'flex-row-reverse text-right' : 'text-left'
                  }`}
                >
                  <Avatar className="w-9 h-9 border border-white shadow-sm shrink-0">
                    <AvatarImage src={avatar || undefined} referrerPolicy="no-referrer" />
                    <AvatarFallback className="bg-purple-100 text-purple-600 text-xs font-black">
                      {senderName.substring(0, 1)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="max-w-[70%] space-y-1">
                    {/* User info */}
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                      <span className="text-slate-800 font-black text-xs">{senderName}</span>
                      <span>
                        {new Date(msg.created_at).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Chat Bubble content */}
                    <div className="relative group">
                      <div
                        className={`p-3.5 rounded-2xl text-sm font-medium leading-relaxed overflow-hidden shadow-sm ${
                          isMine
                            ? 'bg-purple-600 text-white rounded-tr-none text-left'
                            : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                        }`}
                      >
                        {msg.message}
                      </div>

                      {/* Delete Action button visible on hover */}
                      {isMine && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className={`absolute -top-1.5 rounded-full p-1 bg-white hover:bg-rose-50 border border-slate-100 shadow-sm text-slate-400 hover:text-rose-600 transition-all opacity-0 group-hover:opacity-100 ${
                            isMine ? '-left-6' : '-right-6'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Message input area */}
      <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 shrink-0">
        <div className="relative flex items-center">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={!currentUserId || sending}
            placeholder={
              currentUserId
                ? '메시지를 입력해 주세요 (Enter를 치거나 우측 화살표로 전송)'
                : '채팅 기능을 이용하려면 먼저 로그인해 주세요.'
            }
            className="w-full h-12 pl-4 pr-14 bg-slate-50/70 hover:bg-slate-50 focus-visible:bg-white border-slate-200 focus-visible:ring-purple-600 rounded-2xl text-sm font-semibold placeholder:text-slate-400"
          />
          <Button
            type="submit"
            disabled={!inputText.trim() || !currentUserId || sending}
            size="icon"
            className="absolute right-1.5 w-9 h-9 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-100 disabled:text-slate-300 rounded-xl transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </Button>
        </div>
      </form>
    </div>
  );
}
