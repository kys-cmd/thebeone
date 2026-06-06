import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Smile, 
  ImageIcon, 
  FileUp, 
  MoreVertical, 
  Trash2, 
  Reply,
  Hash,
  Lock,
  MessageSquare,
  Users,
  ChevronLeft,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/useAuthStore';
import { communityService } from '@/services/communityService';
import { chatService } from '@/services/chatService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { type Message, type ChatRoom } from '@/types';
import { motion, AnimatePresence } from 'motion/react';

interface ChatRoomViewProps {
  communityId: string;
  room: ChatRoom | null;
  onBack?: () => void;
  isAdmin?: boolean;
}

const REACTION_EMOJIS = ['👍', '❤️', '👏', '😂', '😮', '😢', '🔥', '💯'];

export function ChatRoomView({ communityId, room, onBack, isAdmin }: ChatRoomViewProps) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!room) return;

    let messageSub: any;

    const loadData = async () => {
      try {
        const fetchedMessages = await communityService.getMessages(communityId, room.id);
        setMessages(fetchedMessages);
        
        messageSub = communityService.subscribeToMessages(communityId, (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new;
            if (newMsg.room_id === room.id || (!newMsg.room_id && room.id === 'all')) {
              setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new;
            if (updatedMsg.is_deleted) {
              setMessages(prev => prev.filter(m => m.id !== updatedMsg.id));
            } else {
              setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
            }
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }, room.id);
      } catch (error) {
        console.error('Failed to load messages', error);
      }
    };

    loadData();

    return () => {
      if (messageSub) messageSub.unsubscribe();
    };
  }, [communityId, room]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    
    if (user && room) {
      chatService.markAsRead(user.id, communityId);
    }
  }, [messages, user, communityId, room]);

  const handleSendMessage = async () => {
    if (!user || !input.trim() || !room) return;
    
    setIsSending(true);
    const content = input;
    setInput('');
    const replyId = replyingTo?.id;
    setReplyingTo(null);

    try {
      const result = await communityService.sendMessage({
        community_id: communityId,
        room_id: room.id === 'all' ? null : room.id,
        user_id: user.id,
        content: content,
        type: 'text',
        reply_to_id: replyId
      });
      setMessages(prev => [...prev, result as Message]);
      setShowEmojiPicker(false);
    } catch (error) {
      setInput(content);
      toast.error('전송 실패');
    } finally {
      setIsSending(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!user || !room) return;
    setIsLeaving(true);
    try {
      await chatService.leaveRoom(room.id);
      toast.success('채팅방에서 나갔습니다.');
      if (onBack) onBack();
    } catch (error: any) {
      toast.error(`나가기 실패: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('정말로 이 메시지를 삭제하시겠습니까?')) return;
    try {
      await communityService.deleteMessage(messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('메시지가 삭제되었습니다.');
    } catch (error) {
      toast.error('메시지 삭제 실패');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = event.target.files?.[0];
    if (!file || !user || !room) return;

    try {
      toast.loading('파일 업로드 중...');
      const url = await communityService.uploadFile(file, `community/${communityId}/chat`);
      
      const msgType = file.type.startsWith('image/') ? 'image' : 'file';
      const result = await communityService.sendMessage({
        community_id: communityId,
        room_id: room.id === 'all' ? null : room.id,
        user_id: user.id,
        content: file.name,
        media_url: url,
        type: msgType,
        metadata: { file_name: file.name, file_size: file.size }
      });
      setMessages(prev => [...prev, result as Message]);
      toast.dismiss();
      toast.success('업로드 완료!');
    } catch (error) {
      toast.dismiss();
      toast.error('업로드 실패');
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  if (!room) return null;

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-3 px-4 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="lg:hidden h-7 w-7 text-gray-400">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
            room.type === 'private' ? "bg-orange-100 text-orange-600" : "bg-purple-100 text-purple-600"
          )}>
            {room.type === 'private' ? <Lock className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}
          </div>
          <div>
            <h3 className="text-sm font-black text-gray-900 tracking-tight leading-none mb-0.5">{room.name}</h3>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                <Users className="w-2 h-2" />
                {room.member_count || 0}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-0.5">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-gray-300 hover:text-red-500 transition-colors"
            onClick={() => setShowLeaveConfirm(true)}
          >
            <LogOut className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-300"><MoreVertical className="w-3 h-3" /></Button>
        </div>
      </div>

      {/* Messages list */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth bg-gray-50/20"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <MessageSquare className="w-6 h-6 text-gray-200" />
            </div>
            <p className="text-xs font-black text-gray-400">메시지를 시작해 보세요</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.user_id === user?.id;
            const showAvatar = idx === 0 || messages[idx-1].user_id !== msg.user_id;

            return (
              <div key={msg.id} className={cn(
                "flex flex-col",
                isMe ? "items-end" : "items-start"
              )}>
                {!isMe && showAvatar && (
                  <div className="flex items-center gap-1.5 mb-1 ml-1">
                    <Avatar className="w-5 h-5 rounded-lg ring-1 ring-white shadow-xs">
                      <AvatarImage src={msg.profiles?.avatar_url || ''} />
                      <AvatarFallback className="bg-purple-100 text-purple-600 text-[8px] font-black">
                        {(msg.profiles?.nickname || msg.profiles?.name || '?').charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-black text-gray-500">{msg.profiles?.nickname || msg.profiles?.name}</span>
                  </div>
                )}
                
                <div className={cn(
                  "flex items-end gap-1.5 group max-w-[90%]",
                  isMe ? "flex-row-reverse" : "flex-row"
                )}>
                  <div className={cn(
                    "relative p-2.5 px-3 rounded-[18px] text-[15px] font-medium shadow-xs transition-all",
                    isMe 
                      ? "bg-purple-600 text-white rounded-tr-none" 
                      : "bg-white text-gray-900 rounded-tl-none border border-gray-100"
                  )}>
                    {msg.reply_to && (
                      <div className={cn(
                        "mb-1.5 p-1.5 rounded-lg text-xs border-l-2",
                        isMe ? "bg-purple-700/50 border-purple-400 text-purple-100" : "bg-gray-50 border-gray-300 text-gray-500"
                      )}>
                        <div className="font-black mb-0.5">{msg.reply_to.profiles?.nickname || msg.reply_to.profiles?.name}</div>
                        <div className="truncate text-[11px]">{msg.reply_to.content}</div>
                      </div>
                    )}
                    
                    {msg.type === 'image' ? (
                      <div className="space-y-1.5">
                        <img src={msg.media_url} className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition-opacity" alt="" onClick={() => window.open(msg.media_url)} />
                        {msg.content && <p>{msg.content}</p>}
                      </div>
                    ) : msg.type === 'file' ? (
                      <a href={msg.media_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-1 hover:opacity-80 transition-opacity">
                        <div className="w-7 h-7 bg-black/5 rounded-lg flex items-center justify-center">
                          <FileUp className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left min-w-0">
                          <div className="font-black text-sm truncate max-w-[140px]">{msg.metadata?.file_name || '파일'}</div>
                          <div className="text-[11px] opacity-60">{(msg.metadata?.file_size || 0 / 1024 / 1024).toFixed(2)}MB</div>
                        </div>
                      </a>
                    ) : (
                      <div className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-gray-300 font-bold whitespace-nowrap">{formatTime(msg.created_at)}</span>
                    <div className="flex gap-0.5">
                      <button onClick={() => setReplyingTo(msg)} className="p-0.5 hover:bg-gray-100 rounded text-gray-300"><Reply className="w-2.5 h-2.5" /></button>
                      {(isMe || isAdmin) && (
                        <button onClick={() => handleDeleteMessage(msg.id)} className="p-0.5 hover:bg-red-50 rounded text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-2.5 h-2.5" /></button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input area */}
      <div className="p-3 bg-white border-t border-gray-50 space-y-2">
        <AnimatePresence>
          {replyingTo && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-gray-50 rounded-lg p-2 flex items-start justify-between gap-2 border border-gray-100"
            >
              <div className="flex gap-2 min-w-0">
                <Reply className="w-3 h-3 text-purple-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[10px] font-black text-gray-900 mb-0.5">{replyingTo.profiles?.nickname || replyingTo.profiles?.name}님에게 답장</div>
                  <div className="text-[11px] text-gray-500 font-medium truncate">{replyingTo.content}</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setReplyingTo(null)} className="h-4 w-4 rounded-full hover:bg-white shrink-0">
                <MoreVertical className="w-2 h-2 rotate-45 text-gray-400" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-1.5">
          <div className="flex gap-0.5 shrink-0 pb-0.5">
            <label className="p-1.5 rounded-lg bg-gray-50 text-gray-300 hover:bg-purple-50 hover:text-purple-600 transition-all cursor-pointer">
              <ImageIcon className="w-3.5 h-3.5" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
            </label>
            <label className="p-1.5 rounded-lg bg-gray-50 text-gray-300 hover:bg-purple-50 hover:text-purple-600 transition-all cursor-pointer">
              <FileUp className="w-3.5 h-3.5" />
              <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'file')} />
            </label>
          </div>
          
          <div className="flex-1 relative">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="메시지..."
              className="min-h-[36px] pr-8 bg-gray-50 border-none rounded-xl font-bold text-[15px]"
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-0.5 bottom-0.5 h-7 w-7 text-gray-300 hover:text-purple-600 transition-colors"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="w-3.5 h-3.5" />
            </Button>
            
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-2xl border border-gray-100 p-2 grid grid-cols-4 gap-1 z-20"
                >
                  {REACTION_EMOJIS.map(emoji => (
                    <button 
                      key={emoji}
                      onClick={() => {
                        setInput(prev => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="w-8 h-8 rounded-lg hover:bg-purple-50 flex items-center justify-center text-base transition-all active:scale-90"
                    >
                      {emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button 
            onClick={handleSendMessage}
            disabled={!input.trim() || isSending}
            className="h-9 w-9 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-100 transition-all active:scale-95 shrink-0 px-0"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Leave Confirmation Dialog */}
      <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DialogContent className="rounded-[40px] sm:max-w-md p-10 border-none shadow-2xl">
          <DialogHeader className="space-y-4">
            <DialogTitle className="text-2xl font-black tracking-tight text-gray-900 flex items-center gap-4">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                <LogOut className="w-6 h-6 text-red-600" />
              </div>
              채팅방 나가기
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-bold leading-relaxed">
              정말로 <span className="text-red-600">"{room.name}"</span> 채팅방에서 나가시겠습니까?<br/>
              다시 초대받기 전까지는 이 대화방에 참여하실 수 없으며, 목록에서 사라집니다.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="pt-6 flex flex-col sm:flex-row gap-3">
             <Button 
               variant="outline"
               onClick={() => setShowLeaveConfirm(false)}
               className="w-full h-14 rounded-2xl border-gray-100 font-bold text-gray-500"
             >
               취소
             </Button>
             <Button 
               onClick={handleLeaveRoom}
               disabled={isLeaving}
               className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-700 font-black text-white shadow-xl shadow-red-100"
             >
               {isLeaving ? '나가는 중...' : '확인'}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
