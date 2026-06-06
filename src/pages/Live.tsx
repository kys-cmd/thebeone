import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Send, MessageSquare, Heart, Share2, 
  Play, Zap, Wifi, Lock, LogIn, Settings
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/useAuthStore';
import { cmsService, SiteConfig } from '@/services/cmsService';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface ChatMessage {
  id: string;
  user: string;
  text: string;
  time: string;
}

export default function LivePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Admin Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [embedCode, setEmbedCode] = useState('');
  const [liveTitle, setLiveTitle] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [startTime, setStartTime] = useState('');

  // default vimeo embed provided by user
  const DEFAULT_VIMEO_EMBED = '<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://vimeo.com/event/5897209/embed" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe></div>';

  useEffect(() => {
    const fetchLiveStatus = async () => {
      try {
        const fetchedConfig = await cmsService.getSiteConfig();
        setConfig(fetchedConfig);
        setIsLive(fetchedConfig.live_is_active === true);
        
        // Initialize admin modal inputs
        setEmbedCode(fetchedConfig.live_embed_code || DEFAULT_VIMEO_EMBED);
        setLiveTitle(fetchedConfig.live_title || '비원아카데미 라이브');
        setChatEnabled(fetchedConfig.live_chat_enabled !== false);
        setStartTime(fetchedConfig.live_start_time || '');
      } catch (error) {
        console.error('Error fetching live status:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLiveStatus();

    // Setup Supabase Realtime for Status & Chat
    const channel = supabase.channel('b1_live_room');

    channel
      .on('broadcast', { event: 'live_status_change' }, (payload) => {
        setIsLive(payload.payload.isLive);
        if (payload.payload.config) {
          setConfig(payload.payload.config);
        }
      })
      .on('broadcast', { event: 'new_message' }, (payload) => {
        setMessages((prev) => [...prev, payload.payload.message]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleStartLiveConfirm = async () => {
    try {
      if (!config) return;
      const updatedConfig = { 
        ...config, 
        live_is_active: true,
        live_embed_code: embedCode || DEFAULT_VIMEO_EMBED,
        live_title: liveTitle || '비원아카데미 라이브',
        live_chat_enabled: chatEnabled,
        live_start_time: startTime || new Date().toISOString()
      };
      await cmsService.saveSiteConfig(updatedConfig);
      setConfig(updatedConfig);
      setIsLive(true);
      setShowSettingsModal(false);
      
      await supabase.channel('b1_live_room').send({
        type: 'broadcast',
        event: 'live_status_change',
        payload: { isLive: true, config: updatedConfig }
      });
      toast.success('라이브가 시작되었습니다.');
    } catch (error) {
      toast.error('라이브 시작 중 오류가 발생했습니다.');
    }
  };

  const handleStopLive = async () => {
    try {
      if (!config) return;
      const updatedConfig = { ...config, live_is_active: false };
      await cmsService.saveSiteConfig(updatedConfig);
      setConfig(updatedConfig);
      setIsLive(false);
      await supabase.channel('b1_live_room').send({
        type: 'broadcast',
        event: 'live_status_change',
        payload: { isLive: false, config: updatedConfig }
      });
      toast.success('라이브가 종료되었습니다.');
    } catch (error) {
      toast.error('라이브 종료 중 오류가 발생했습니다.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || config?.live_chat_enabled === false) return;
    
    const msg: ChatMessage = {
      id: Date.now().toString(),
      user: user.name || '비회원',
      text: newMessage,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };
    
    setNewMessage('');
    
    await supabase.channel('b1_live_room').send({
      type: 'broadcast',
      event: 'new_message',
      payload: { message: msg }
    });
    
    setMessages((prev) => [...prev, msg]);
  };

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  const isSuperAdmin = user?.role === 'super_admin';
  const displayEmbedCode = config?.live_embed_code || DEFAULT_VIMEO_EMBED;
  const displayTitle = config?.live_title || '비원아카데미 라이브';
  const chatIsDisabledByAdmin = config?.live_chat_enabled === false;

  return (
    <div className="min-h-screen bg-black pt-20 pb-32">
      <div className="container mx-auto px-4 py-8">
        
        {/* Admin Controls */}
        {isSuperAdmin && (
          <div className="mb-6 bg-white/10 p-6 rounded-2xl flex items-center justify-between border border-white/10">
            <div className="text-white">
              <h3 className="font-bold">비원아카데미 라이브</h3>
              <p className="text-sm text-gray-400">현재 상태: {isLive ? '진행 중' : '종료됨'}</p>
            </div>
            {isLive ? (
              <Button onClick={handleStopLive} variant="destructive" className="font-bold">라이브 종료하기</Button>
            ) : (
              <Button onClick={() => setShowSettingsModal(true)} className="bg-red-600 hover:bg-red-700 font-bold">라이브 진행하기</Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
          {/* Main Video Area */}
          <div className="lg:col-span-3 flex flex-col space-y-6 relative">
            <div className="relative aspect-video bg-gray-900 rounded-[32px] overflow-hidden shadow-2xl border border-white/5 flex flex-col items-center justify-center">
              
              {!isLive ? (
                <div className="text-center space-y-4">
                  <Wifi className="w-16 h-16 text-gray-600 mx-auto" />
                  <h2 className="text-3xl font-black text-white">라이브 준비중</h2>
                  <p className="text-gray-400">라이브가 진행되면 안내드리겠습니다.</p>
                </div>
              ) : (
                <>
                  <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: displayEmbedCode }} />
                  <div className="absolute top-6 left-6 z-10 flex items-center gap-4 pointer-events-none">
                     <Badge className="bg-red-600 text-white border-none font-black px-4 py-2 rounded-2xl flex items-center gap-2 animate-pulse text-sm">
                        <Wifi className="w-5 h-5" /> LIVE
                     </Badge>
                  </div>
                </>
              )}

              {/* Login Overlay for Non-members when Live */}
              {isLive && !user && (
                <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center space-y-6 p-8 bg-gray-900 rounded-3xl border border-white/10 max-w-md w-full mx-4">
                    <Lock className="w-12 h-12 text-red-500 mx-auto" />
                    <div>
                      <h3 className="text-2xl font-black text-white mb-2">비원아카데미 라이브</h3>
                      <p className="text-gray-400">로그인 시 시청하실 수 있습니다.</p>
                    </div>
                    <Button 
                      className="w-full h-14 text-lg font-bold bg-white text-black hover:bg-gray-200 rounded-xl"
                      onClick={() => navigate('/auth/login')}
                    >
                      <LogIn className="w-5 h-5 mr-2" /> 로그인하고 시청하기
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white/5 backdrop-blur-md p-8 rounded-[32px] border border-white/10 flex items-center justify-between">
              <div className="space-y-2">
                 <h1 className="text-2xl font-black text-white tracking-tighter">
                   {displayTitle}
                 </h1>
                 <div className="flex items-center gap-2">
                   <Zap className="w-4 h-4 text-red-600" />
                   <span className="text-gray-400 font-bold text-sm">비원아카데미 실시간 라이브 채널</span>
                 </div>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-1 flex flex-col bg-white rounded-[32px] overflow-hidden shadow-2xl border border-gray-100 relative">
            {!user && isLive && (
              <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-[2px] flex items-center justify-center p-6 text-center">
                <div className="font-bold text-gray-500 flex flex-col items-center gap-3">
                  <Lock className="w-8 h-8 text-gray-400" />
                  <span>로그인 후 채팅에 참여할 수 있습니다.</span>
                </div>
              </div>
            )}
            
            {chatIsDisabledByAdmin && isLive && user && (
              <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-[2px] flex items-center justify-center p-6 text-center">
                <div className="font-bold text-gray-500 flex flex-col items-center gap-3">
                  <Lock className="w-8 h-8 text-gray-400" />
                  <span>관리자에 의해 채팅이 비활성화되었습니다.</span>
                </div>
              </div>
            )}
            
            <div className="p-6 border-b flex items-center justify-between bg-gray-50/50">
               <div className="flex items-center gap-3">
                 <MessageSquare className="w-5 h-5 text-red-600" />
                 <h2 className="font-black text-gray-900 tracking-tight">실시간 채팅</h2>
               </div>
               {isLive ? (
                 <Badge className="bg-green-100 text-green-600 border-none font-black px-2">ON AIR</Badge>
               ) : (
                 <Badge className="bg-gray-100 text-gray-500 border-none font-black px-2">OFF</Badge>
               )}
            </div>

            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar"
            >
               {messages.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3">
                   <MessageSquare className="w-10 h-10 opacity-20" />
                   <p className="font-bold text-sm">첫 메시지를 남겨보세요!</p>
                 </div>
               ) : (
                 messages.map((msg) => (
                   <div key={msg.id} className="flex gap-4 group">
                      <Avatar className="w-8 h-8 border-2 border-white flex-shrink-0 font-black">
                        <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">{msg.user[0]}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1 w-full">
                         <div className="flex items-center justify-between">
                           <p className="text-xs font-black text-gray-900">{msg.user}</p>
                           <span className="text-[10px] font-bold text-gray-400">{msg.time}</span>
                         </div>
                         <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-2xl rounded-tl-sm w-full break-words">{msg.text}</p>
                      </div>
                   </div>
                 ))
               )}
            </div>

            <div className="p-4 border-t bg-white">
               <form onSubmit={handleSendMessage} className="relative group">
                 <Input 
                   value={newMessage}
                   onChange={(e) => setNewMessage(e.target.value)}
                   disabled={!isLive || !user}
                   placeholder={isLive ? (user ? "메시지를 입력하세요..." : "로그인 후 이용 가능합니다.") : "라이브가 시작되면 채팅이 활성화됩니다."} 
                   className="h-12 bg-gray-50 border-none rounded-xl pl-4 pr-12 font-bold focus-visible:ring-2 focus-visible:ring-red-600 transition-all disabled:opacity-50"
                 />
                 <Button 
                   type="submit"
                   size="icon" 
                   disabled={!isLive || !user || !newMessage.trim()}
                   className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 bg-red-600 rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
                 >
                   <Send className="w-4 h-4 text-white" />
                 </Button>
               </form>
            </div>
          </div>
        </div>
      </div>

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-8 shadow-2xl relative">
            <div className="absolute top-6 left-6 flex items-center gap-2 text-red-600">
              <Zap className="w-5 h-5" />
              <span className="font-black">LIVE SETUP</span>
            </div>
            
            <div className="pt-6 space-y-2">
              <h3 className="text-2xl font-black text-gray-900">라이브 방송 설정</h3>
              <p className="text-gray-500 text-sm font-bold">방송에 필요한 기본 정보를 입력해주세요.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-gray-700 font-bold ml-1">라이브 제목</Label>
                <Input 
                  value={liveTitle}
                  onChange={(e) => setLiveTitle(e.target.value)}
                  placeholder="예: 비원아카데미 라이브 특강"
                  className="h-12 bg-gray-50 border-none rounded-2xl font-bold"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-gray-700 font-bold ml-1">Vimeo 임베디드 코드</Label>
                <Input 
                  value={embedCode}
                  onChange={(e) => setEmbedCode(e.target.value)}
                  placeholder="<div style=..."
                  className="h-12 bg-gray-50 border-none rounded-2xl font-bold"
                />
              </div>
              
              <div className="space-y-3">
                <Label className="text-gray-700 font-bold ml-1">라이브 시작 시간 (선택)</Label>
                <Input 
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-12 bg-gray-50 border-none rounded-2xl font-bold"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div className="space-y-0.5">
                  <Label className="text-gray-900 font-bold">실시간 채팅 사용</Label>
                  <p className="text-gray-500 text-xs font-bold">참석자들의 실시간 채팅을 허용합니다.</p>
                </div>
                <Switch 
                  checked={chatEnabled} 
                  onCheckedChange={setChatEnabled}
                  className="data-[state=checked]:bg-red-600"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button 
                variant="outline" 
                className="flex-1 h-14 rounded-2xl border-gray-200 font-bold hover:bg-gray-50"
                onClick={() => setShowSettingsModal(false)}
              >
                취소
              </Button>
              <Button 
                className="flex-1 h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-lg shadow-xl shadow-red-200"
                onClick={handleStartLiveConfirm}
              >
                방송 시작하기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

