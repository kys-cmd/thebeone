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
  Play, Zap, Wifi, Lock, LogIn, Settings,
  ChevronLeft, Home, ArrowDown, ChevronDown, ChevronUp
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
  const [isLive, setIsLive] = useState(true);
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMobileInfo, setShowMobileInfo] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
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
    // 1. Initial cached values for instant zero-flicker display
    try {
      const cached = localStorage.getItem('beone_live_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.live_embed_code) setEmbedCode(parsed.live_embed_code);
        if (parsed.live_title) setLiveTitle(parsed.live_title);
        if (typeof parsed.live_is_active === 'boolean') setIsLive(parsed.live_is_active);
        if (typeof parsed.live_chat_enabled === 'boolean') setChatEnabled(parsed.live_chat_enabled);
        if (parsed.live_start_time) setStartTime(parsed.live_start_time);
      }
    } catch (e) {
      console.warn('Failed to parse cached live config:', e);
    }

    const fetchLiveStatus = async () => {
      try {
        // First try to fetch from support_contents (publicly readable persistent table)
        const { data: liveData } = await supabase
          .from('support_contents')
          .select('*')
          .eq('type', 'live_config')
          .maybeSingle();

        if (liveData && liveData.content) {
          try {
            const parsed = JSON.parse(liveData.content);
            const active = parsed.live_is_active !== false;
            setIsLive(active);
            setEmbedCode(parsed.live_embed_code || DEFAULT_VIMEO_EMBED);
            setLiveTitle(parsed.live_title || liveData.title || '비원아카데미 라이브');
            setChatEnabled(parsed.live_chat_enabled !== false);
            setStartTime(parsed.live_start_time || '');
            setConfig((prev) => ({
              ...(prev || {}),
              live_is_active: active,
              live_embed_code: parsed.live_embed_code || DEFAULT_VIMEO_EMBED,
              live_title: parsed.live_title || liveData.title || '비원아카데미 라이브',
              live_chat_enabled: parsed.live_chat_enabled !== false,
              live_start_time: parsed.live_start_time || ''
            }));
            localStorage.setItem('beone_live_config', JSON.stringify({
              live_is_active: active,
              live_embed_code: parsed.live_embed_code || DEFAULT_VIMEO_EMBED,
              live_title: parsed.live_title || liveData.title || '비원아카데미 라이브',
              live_chat_enabled: parsed.live_chat_enabled !== false,
              live_start_time: parsed.live_start_time || ''
            }));
          } catch (err) {
            console.error('Error parsing live config json:', err);
          }
        } else {
          // Fallback to siteConfig
          const fetchedConfig = await cmsService.getSiteConfig();
          setConfig(fetchedConfig);
          // Default to true so live content is immediately visible
          setIsLive(fetchedConfig.live_is_active !== false);
          setEmbedCode(fetchedConfig.live_embed_code || DEFAULT_VIMEO_EMBED);
          setLiveTitle(fetchedConfig.live_title || '비원아카데미 라이브');
          setChatEnabled(fetchedConfig.live_chat_enabled !== false);
          setStartTime(fetchedConfig.live_start_time || '');
        }
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
        if (payload?.payload?.isLive !== undefined) {
          setIsLive(payload.payload.isLive);
        }
        if (payload?.payload?.config) {
          setConfig(payload.payload.config);
          if (payload.payload.config.live_embed_code) {
            setEmbedCode(payload.payload.config.live_embed_code);
          }
          if (payload.payload.config.live_title) {
            setLiveTitle(payload.payload.config.live_title);
          }
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

  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 60;
    setShowScrollBottom(!isNearBottom);
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setShowScrollBottom(false);
    }
  };

  useEffect(() => {
    if (!showScrollBottom && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, showScrollBottom]);

  const handleStartLiveConfirm = async () => {
    try {
      const updatedConfig = { 
        ...(config || {}), 
        live_is_active: true,
        live_embed_code: embedCode || DEFAULT_VIMEO_EMBED,
        live_title: liveTitle || '비원아카데미 라이브',
        live_chat_enabled: chatEnabled,
        live_start_time: startTime || new Date().toISOString()
      };

      // Persist in support_contents as 'live_config'
      try {
        const { data: existing } = await supabase
          .from('support_contents')
          .select('id')
          .eq('type', 'live_config')
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from('support_contents')
            .update({
              title: updatedConfig.live_title,
              content: JSON.stringify(updatedConfig),
              active: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('support_contents')
            .insert([{
              type: 'live_config',
              title: updatedConfig.live_title,
              content: JSON.stringify(updatedConfig),
              active: true,
              is_deleted: false
            }]);
        }
      } catch (dbErr) {
        console.warn('DB persistence warning:', dbErr);
      }

      localStorage.setItem('beone_live_config', JSON.stringify(updatedConfig));
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
      console.error('Error starting live:', error);
      toast.error('라이브 시작 중 오류가 발생했습니다.');
    }
  };

  const handleStopLive = async () => {
    try {
      const updatedConfig = { 
        ...(config || {}), 
        live_is_active: false,
        live_embed_code: embedCode || DEFAULT_VIMEO_EMBED,
        live_title: liveTitle || '비원아카데미 라이브'
      };

      try {
        const { data: existing } = await supabase
          .from('support_contents')
          .select('id')
          .eq('type', 'live_config')
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from('support_contents')
            .update({
              content: JSON.stringify(updatedConfig),
              active: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        }
      } catch (dbErr) {
        console.warn('DB persistence warning on stop:', dbErr);
      }

      localStorage.setItem('beone_live_config', JSON.stringify(updatedConfig));
      setConfig(updatedConfig);
      setIsLive(false);

      await supabase.channel('b1_live_room').send({
        type: 'broadcast',
        event: 'live_status_change',
        payload: { isLive: false, config: updatedConfig }
      });
      toast.success('라이브가 종료되었습니다.');
    } catch (error) {
      console.error('Error stopping live:', error);
      toast.error('라이브 종료 중 오류가 발생했습니다.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || config?.live_chat_enabled === false) return;
    
    const msg: ChatMessage = {
      id: Date.now().toString(),
      user: user.name || '비회원',
      text: newMessage.trim(),
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
    <div className="h-[100dvh] md:h-[calc(100dvh-5rem)] lg:h-auto lg:min-h-screen bg-black flex flex-col lg:block lg:pt-20 lg:pb-32 overflow-hidden lg:overflow-visible">
      {/* Mobile Dedicated Top Navigation Bar (lg:hidden) */}
      <div className="lg:hidden shrink-0 h-11 bg-black/95 backdrop-blur border-b border-white/10 px-3 flex items-center justify-between z-30 text-white">
        <div className="flex items-center gap-1.5">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)} 
            className="text-white hover:bg-white/10 h-8 w-8 rounded-lg"
            title="뒤로가기"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-1.5 font-black text-sm tracking-tight">
            <span className="bg-gradient-to-r from-red-500 to-purple-400 bg-clip-text text-transparent">비원Live</span>
            {isLive && (
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isLive ? (
            <Badge className="bg-red-600 text-white border-none font-bold text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <Wifi className="w-3 h-3" /> LIVE
            </Badge>
          ) : (
            <Badge className="bg-gray-800 text-gray-400 border-none font-bold text-[11px] px-2 py-0.5 rounded-full">
              준비중
            </Badge>
          )}

          {isSuperAdmin && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowSettingsModal(true)} 
              className="text-white hover:bg-white/10 h-8 w-8 rounded-lg"
              title="라이브 방송 설정"
            >
              <Settings className="w-4 h-4 text-red-400" />
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')} 
            className="text-white hover:bg-white/10 h-8 w-8 rounded-lg"
            title="홈으로"
          >
            <Home className="w-4 h-4 text-gray-300" />
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-0 lg:px-4 py-0 lg:py-8 flex-1 flex flex-col lg:block min-h-0">
        {/* Admin Controls (Desktop) */}
        {isSuperAdmin && (
          <div className="hidden lg:flex mb-6 bg-white/10 p-6 rounded-2xl items-center justify-between border border-white/10">
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

        {/* Main Content Layout: Mobile flex-col with sticky video + full-height chat; Desktop 4-col grid */}
        <div className="flex flex-col lg:grid lg:grid-cols-4 gap-0 lg:gap-6 flex-1 min-h-0 lg:h-[calc(100vh-200px)] lg:min-h-[600px]">
          
          {/* Main Video Area: Pinned at top on mobile, 3-col on desktop */}
          <div className="lg:col-span-3 flex flex-col shrink-0 lg:shrink space-y-0 lg:space-y-6 relative bg-black z-20">
            <div className="relative aspect-video w-full bg-gray-900 lg:rounded-[32px] overflow-hidden shadow-2xl border-b lg:border border-white/10 flex flex-col items-center justify-center">
              {/* The Live Video Player: Always visible to everyone without requiring login */}
              <div 
                className="w-full h-full [&>div]:w-full [&>div]:h-full [&>div]:!p-0 [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:absolute [&_iframe]:inset-0" 
                dangerouslySetInnerHTML={{ __html: displayEmbedCode }} 
              />
              <div className="absolute top-3 left-3 sm:top-6 sm:left-6 z-10 flex items-center gap-3 pointer-events-none">
                {isLive ? (
                  <Badge className="bg-red-600 text-white border-none font-black px-2.5 py-1 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl flex items-center gap-1.5 animate-pulse text-xs sm:text-sm shadow-lg">
                    <Wifi className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> LIVE
                  </Badge>
                ) : (
                  <Badge className="bg-gray-900/90 text-gray-300 border border-white/20 font-bold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-xs sm:text-sm shadow-lg backdrop-blur-md flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-gray-400" /> 방송 준비중
                  </Badge>
                )}
              </div>
            </div>

            {/* Mobile Compact Title & Info Bar (lg:hidden) */}
            <div className="lg:hidden bg-gray-950 border-b border-white/10 shrink-0">
              <div className="px-3 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <h1 className="text-xs sm:text-sm font-bold text-white truncate">
                    {displayTitle}
                  </h1>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => setShowMobileInfo(!showMobileInfo)}
                    className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-white bg-white/5 px-2 py-1 rounded-md transition-colors"
                  >
                    <span>정보</span>
                    {showMobileInfo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {isSuperAdmin && (
                    isLive ? (
                      <Button 
                        size="sm" 
                        onClick={handleStopLive} 
                        variant="destructive" 
                        className="h-6 text-[11px] font-bold px-2 rounded-md"
                      >
                        종료
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        onClick={() => setShowSettingsModal(true)} 
                        className="h-6 text-[11px] font-bold px-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
                      >
                        시작
                      </Button>
                    )
                  )}
                </div>
              </div>

              {/* Collapsible Info Details on Mobile */}
              {showMobileInfo && (
                <div className="px-3 pb-2.5 pt-0.5 text-xs text-gray-300 space-y-1 border-t border-white/5 bg-gray-900/90">
                  <p className="font-medium text-white">{displayTitle}</p>
                  <p className="text-[11px] text-gray-400">비원아카데미 실시간 라이브 채널에 오신 것을 환영합니다.</p>
                  {config?.live_start_time && (
                    <p className="text-[10px] text-purple-400">
                      시작 시간: {new Date(config.live_start_time).toLocaleString('ko-KR')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Title Banner (hidden lg:flex) */}
            <div className="hidden lg:flex bg-white/5 backdrop-blur-md p-8 rounded-[32px] border border-white/10 items-center justify-between">
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

          {/* Chat Area: Fills 100% of remaining height on mobile; 1-col sidebar on desktop */}
          <div className="lg:col-span-1 flex-1 min-h-0 flex flex-col bg-white lg:rounded-[32px] overflow-hidden shadow-2xl border-t lg:border border-gray-100 relative">
            
            {/* Chat Header */}
            <div className="px-4 py-2.5 sm:py-3.5 border-b flex items-center justify-between bg-gray-50/90 shrink-0">
               <div className="flex items-center gap-2 sm:gap-2.5">
                 <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                 <h2 className="font-black text-xs sm:text-sm lg:text-base text-gray-900 tracking-tight">실시간 채팅</h2>
                 {messages.length > 0 && (
                   <span className="text-[11px] font-bold text-gray-400">({messages.length})</span>
                 )}
               </div>
               {isLive ? (
                 <Badge className="bg-green-100 text-green-700 border-none font-black text-[11px] px-2 py-0.5">ON AIR</Badge>
               ) : (
                 <Badge className="bg-gray-100 text-gray-500 border-none font-black text-[11px] px-2 py-0.5">OFF</Badge>
               )}
            </div>

            {/* Scrollable Chat Messages Container */}
            <div 
              ref={chatContainerRef}
              onScroll={handleChatScroll}
              className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 no-scrollbar"
            >
               {messages.length === 0 ? (
                 <div className="h-full min-h-[120px] flex flex-col items-center justify-center text-gray-400 space-y-2">
                   <MessageSquare className="w-8 h-8 opacity-20" />
                   <p className="font-bold text-xs sm:text-sm">첫 메시지를 남겨보세요!</p>
                 </div>
               ) : (
                 messages.map((msg) => (
                   <div key={msg.id} className="flex gap-2.5 sm:gap-3 group items-start">
                      <Avatar className="w-7 h-7 sm:w-8 sm:h-8 border border-gray-100 flex-shrink-0 font-black">
                        <AvatarFallback className="bg-purple-100 text-purple-700 text-[11px] sm:text-xs">{msg.user[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
                         <div className="flex items-center gap-2">
                           <p className="text-xs font-black text-gray-900 truncate">{msg.user}</p>
                           <span className="text-[10px] font-medium text-gray-400 shrink-0">{msg.time}</span>
                         </div>
                         <p className="text-xs sm:text-sm text-gray-800 leading-relaxed bg-gray-50 border border-gray-100/80 p-2.5 sm:p-3 rounded-2xl rounded-tl-sm w-fit max-w-full break-words">
                           {msg.text}
                         </p>
                      </div>
                   </div>
                 ))
               )}
            </div>

            {/* Floating Scroll to Bottom Button */}
            {showScrollBottom && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-20 bg-gray-900/90 hover:bg-black text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 transition-all"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>최신 메시지</span>
              </button>
            )}

            {/* Chat Input Bar */}
            <div className="p-2.5 sm:p-3 lg:p-4 border-t bg-white shrink-0">
               {!user ? (
                 <div className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                   <div className="flex items-center gap-1.5 text-xs text-gray-500 font-bold min-w-0 truncate">
                     <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                     <span className="truncate">로그인 후 채팅에 참여할 수 있습니다.</span>
                   </div>
                   <Button 
                     size="sm" 
                     onClick={() => navigate('/auth/login')}
                     className="h-7 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shrink-0 px-2.5"
                   >
                     <LogIn className="w-3 h-3 mr-1" /> 로그인
                   </Button>
                 </div>
               ) : chatIsDisabledByAdmin ? (
                 <div className="text-center py-2 text-xs font-bold text-gray-400 bg-gray-50 rounded-xl">
                   관리자에 의해 실시간 채팅이 비활성화되었습니다.
                 </div>
               ) : !isLive ? (
                 <div className="text-center py-2 text-xs font-bold text-gray-400 bg-gray-50 rounded-xl">
                   라이브가 시작되면 실시간 채팅이 활성화됩니다.
                 </div>
               ) : (
                 <form onSubmit={handleSendMessage} className="relative group flex items-center">
                   <div className="relative flex-1 min-w-0">
                     <Input 
                       value={newMessage}
                       onChange={(e) => setNewMessage(e.target.value)}
                       placeholder="메시지를 입력하세요..." 
                       className="h-10 sm:h-12 bg-gray-50 border-gray-200 rounded-xl pl-3 sm:pl-4 pr-11 text-xs sm:text-sm font-bold focus-visible:ring-2 focus-visible:ring-red-500 transition-all"
                     />
                     <Button 
                       type="submit"
                       size="icon" 
                       disabled={!newMessage.trim()}
                       className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 bg-red-600 rounded-lg hover:bg-red-700 transition-all disabled:opacity-40"
                     >
                       <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                     </Button>
                   </div>
                 </form>
               )}
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

