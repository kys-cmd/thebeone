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
  ChevronLeft, Home, ArrowDown, ChevronDown, ChevronUp,
  AlertTriangle, Radio, Square, ExternalLink, CheckCircle2,
  Clock, User, RefreshCw
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/useAuthStore';
import { cmsService, SiteConfig } from '@/services/cmsService';
import { liveService, LiveSession } from '@/services/liveService';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface ChatMessage {
  id: string;
  user: string; // 작성자 표시명 (닉네임 우선, 없을 시 실명)
  nickname?: string;
  realName?: string;
  role?: string;
  avatar?: string;
  text: string;
  time: string;
}

export default function LivePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMobileInfo, setShowMobileInfo] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Admin Modal & Conflict States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictingSessions, setConflictingSessions] = useState<LiveSession[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const [embedCode, setEmbedCode] = useState('');
  const [liveTitle, setLiveTitle] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [startTime, setStartTime] = useState('');

  // default vimeo embed provided by user
  const DEFAULT_VIMEO_EMBED = '<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://vimeo.com/event/5897209/embed" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe></div>';

  const isAdmin = Boolean(user && (user.role === 'admin' || user.role === 'super_admin'));

  const fetchLiveStatus = async () => {
    try {
      const status = await liveService.getLiveStatus();
      if (status.isLive && status.activeSession) {
        setIsLive(true);
        setActiveSession(status.activeSession);
        const code = status.activeSession.embed_code || status.config?.live_embed_code || DEFAULT_VIMEO_EMBED;
        const title = status.activeSession.title || status.config?.live_title || '비원아카데미 라이브';
        setEmbedCode(code);
        setLiveTitle(title);
        setChatEnabled(status.activeSession.chat_enabled !== false);
        setStartTime(status.activeSession.start_time_custom || status.activeSession.started_at || '');
        setConfig((prev) => ({
          ...(prev || {}),
          live_is_active: true,
          live_embed_code: code,
          live_title: title,
          live_chat_enabled: status.activeSession?.chat_enabled !== false,
          live_start_time: status.activeSession?.started_at || ''
        }));
      } else {
        setIsLive(false);
        setActiveSession(null);
        liveService.clearLiveCache();
        setConfig((prev) => ({
          ...(prev || {}),
          live_is_active: false
        }));
      }
    } catch (error) {
      console.error('Error fetching live status:', error);
      setIsLive(false);
      setActiveSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStatus();

    // Setup Supabase Realtime for Status & Chat
    const channel = supabase.channel('b1_live_room');

    channel
      .on('broadcast', { event: 'live_status_change' }, (payload) => {
        if (payload?.payload?.isLive === false) {
          setIsLive(false);
          setActiveSession(null);
          liveService.clearLiveCache();
          setConfig((prev) => ({
            ...(prev || {}),
            live_is_active: false
          }));
        } else if (payload?.payload?.isLive === true) {
          setIsLive(true);
          if (payload?.payload?.config) {
            const cfg = payload.payload.config;
            setConfig(cfg);
            if (cfg.live_embed_code) setEmbedCode(cfg.live_embed_code);
            if (cfg.live_title) setLiveTitle(cfg.live_title);
          }
          fetchLiveStatus();
        }
      })
      .on('broadcast', { event: 'new_message' }, (payload) => {
        setMessages((prev) => [...prev, payload.payload.message]);
      })
      .subscribe();

    // Regular polling every 20s to ensure multi-admin sync
    const interval = setInterval(() => {
      fetchLiveStatus();
    }, 20000);

    return () => {
      clearInterval(interval);
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

  // When admin clicks "라이브 진행하기"
  const handleOpenStartLive = async () => {
    try {
      setActionLoading(true);
      const currentStatus = await liveService.getLiveStatus();
      if (currentStatus.isLive && currentStatus.activeSession) {
        // Another broadcast is active! Prompt conflict resolution
        setConflictingSessions([currentStatus.activeSession]);
        setShowConflictModal(true);
      } else {
        setLiveTitle('비원아카데미 라이브 특강');
        setEmbedCode(DEFAULT_VIMEO_EMBED);
        setChatEnabled(true);
        setShowSettingsModal(true);
      }
    } catch (e) {
      console.error('Check status error:', e);
      setShowSettingsModal(true);
    } finally {
      setActionLoading(false);
    }
  };

  // Start Live execution (with conflict resolution)
  const handleStartLiveConfirm = async (forceOverwrite = false) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      setActionLoading(true);
      const adminRealName = user.name?.trim() || (user as any).full_name?.trim() || user.nickname?.trim() || '관리자';

      const result = await liveService.startLive({
        title: liveTitle.trim() || '비원아카데미 라이브',
        embedCode: embedCode.trim() || DEFAULT_VIMEO_EMBED,
        chatEnabled,
        startTime,
        adminId: user.id,
        adminName: adminRealName,
        adminEmail: user.email || '',
        adminNickname: user.nickname || undefined,
        forceTerminateExisting: forceOverwrite
      });

      if (result.conflict) {
        setShowSettingsModal(false);
        setConflictingSessions(result.activeSessions || []);
        setShowConflictModal(true);
        return;
      }

      if (result.success) {
        toast.success('라이브가 시작되었습니다.');
        setShowSettingsModal(false);
        setShowConflictModal(false);
        await fetchLiveStatus();
      } else {
        toast.error(result.message || '라이브 시작 중 오류가 발생했습니다.');
      }
    } catch (error: any) {
      console.error('Error starting live:', error);
      toast.error(error.message || '라이브 시작 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  // Stop Live execution (Clears DB session & all client caches)
  const handleStopLive = async () => {
    try {
      setActionLoading(true);
      const adminRealName = user?.name?.trim() || (user as any)?.full_name?.trim() || user?.nickname?.trim() || '관리자';

      const res = await liveService.stopLive({
        sessionId: activeSession?.id,
        adminId: user?.id,
        adminName: adminRealName,
        adminEmail: user?.email
      });

      if (res.success) {
        liveService.clearLiveCache();
        setIsLive(false);
        setActiveSession(null);
        setShowConflictModal(false);
        toast.success('라이브가 종료되었습니다. 캐시가 초기화되었습니다.');
      } else {
        toast.error(res.message || '라이브 종료 실패');
      }
    } catch (error) {
      console.error('Error stopping live:', error);
      toast.error('라이브 종료 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  // Stop all active broadcasts (used from conflict modal or stop-all)
  const handleStopAllLive = async () => {
    try {
      setActionLoading(true);
      const adminRealName = user?.name?.trim() || (user as any)?.full_name?.trim() || user?.nickname?.trim() || '관리자';

      const res = await liveService.stopAllLive({
        adminId: user?.id,
        adminName: adminRealName,
        adminEmail: user?.email
      });

      if (res.success) {
        liveService.clearLiveCache();
        setIsLive(false);
        setActiveSession(null);
        setShowConflictModal(false);
        toast.success('기존에 있던 모든 라이브 방송이 종료되었습니다.');
      } else {
        toast.error(res.message || '전체 라이브 종료 실패');
      }
    } catch (err) {
      console.error('Stop all error:', err);
      toast.error('라이브 방송 종료 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || config?.live_chat_enabled === false) return;
    
    // 비원Live 채팅방: 닉네임 우선 적용, 닉네임이 없을 경우 실명(Real Name)으로 대체
    const realName = user.name?.trim() || (user as any).full_name?.trim() || '';
    const userNickname = user.nickname?.trim() || '';
    const displayName = userNickname || realName || '회원';

    const msg: ChatMessage = {
      id: Date.now().toString(),
      user: displayName,
      nickname: userNickname || undefined,
      realName: realName || undefined,
      role: user.role,
      avatar: user.avatar_url || undefined,
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

          {isAdmin && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleOpenStartLive} 
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
        {isAdmin && (
          <div className="hidden lg:flex mb-6 bg-gradient-to-r from-gray-900 via-gray-900 to-black p-5 rounded-3xl items-center justify-between border border-white/15 shadow-xl">
            <div className="text-white space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-red-500 animate-pulse" /> 비원아카데미 라이브 관리 모드
                </span>
                {isLive ? (
                  <Badge className="bg-red-600 text-white font-black text-xs px-2.5 py-0.5 rounded-full animate-pulse">
                    LIVE 송출 중
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-400 border-white/20 font-bold text-xs">
                    방송 준비중
                  </Badge>
                )}
              </div>

              {isLive && activeSession ? (
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 pt-0.5">
                  <span className="flex items-center gap-1 font-bold text-gray-300">
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    시작 관리자: <strong className="text-white font-black">{activeSession.admin_name || '관리자'}</strong>
                    <span className="text-[11px] text-gray-400 font-mono">({activeSession.admin_email || '계정'})</span>
                  </span>
                  <span className="flex items-center gap-1 text-gray-300">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    시작 시간: <span className="font-bold text-white">{new Date(activeSession.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </span>
                </div>
              ) : (
                <p className="text-xs text-gray-400">현재 송출 중인 라이브 방송이 없습니다.</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Link to Admin Live Management Page */}
              <Button
                variant="outline"
                onClick={() => navigate('/admin/live')}
                className="rounded-xl border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-bold h-11 px-4 flex items-center gap-1.5"
              >
                <ExternalLink className="w-4 h-4" />
                <span>라이브 관리 페이지 (어드민)</span>
              </Button>

              {isLive ? (
                <Button 
                  onClick={handleStopLive} 
                  variant="destructive" 
                  disabled={actionLoading}
                  className="rounded-xl font-black bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 h-11 px-5 flex items-center gap-2"
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>{actionLoading ? '종료 중...' : '라이브 방송 종료하기'}</span>
                </Button>
              ) : (
                <Button 
                  onClick={handleOpenStartLive} 
                  disabled={actionLoading}
                  className="rounded-xl bg-red-600 hover:bg-red-700 font-black text-white shadow-lg shadow-red-600/30 h-11 px-5 flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>라이브 진행하기</span>
                </Button>
              )}
            </div>
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

                  {isAdmin && (
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
                        onClick={handleOpenStartLive} 
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
                        {msg.avatar && <AvatarImage src={msg.avatar} alt={msg.nickname?.trim() || msg.user || '회원'} />}
                        <AvatarFallback className="bg-purple-100 text-purple-700 text-[11px] sm:text-xs">
                          {(msg.nickname?.trim() || msg.user || msg.realName || '회')[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
                         <div className="flex items-center gap-1.5 flex-wrap">
                           {/* 닉네임 우선 표시, 닉네임이 없을 경우 실명 대체 */}
                           <p className="text-xs font-black text-gray-900 truncate">
                             {msg.nickname?.trim() || msg.user || msg.realName || '회원'}
                           </p>
                           {/* 닉네임으로 표시 중이고 실명이 다른 경우 참고용 표기 */}
                           {msg.nickname?.trim() && msg.realName && msg.realName !== msg.nickname.trim() && (
                             <span className="text-[10px] text-gray-400 font-medium truncate">({msg.realName})</span>
                           )}
                           {msg.role === 'super_admin' && (
                             <span className="text-[9px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full shrink-0">관리자</span>
                           )}
                           {msg.role === 'admin' && (
                             <span className="text-[9px] font-black bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full shrink-0">운영진</span>
                           )}
                           <span className="text-[10px] font-medium text-gray-400 shrink-0 ml-auto">{msg.time}</span>
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
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1 text-[11px] text-gray-500">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                        <span className="truncate">
                          <strong className="text-gray-900 font-bold">
                            {user.nickname?.trim() || user.name?.trim() || (user as any).full_name?.trim() || '회원'}
                          </strong>
                          {user.nickname?.trim() && (user.name?.trim() || (user as any).full_name?.trim()) && (
                            <span className="text-gray-400 font-normal"> ({user.name?.trim() || (user as any).full_name?.trim()})</span>
                          )}
                          <span className="text-purple-600 font-bold ml-1">
                            {user.nickname?.trim() ? '(닉네임 참여)' : '(실명 참여)'}
                          </span>
                        </span>
                      </div>
                    </div>
                    <form onSubmit={handleSendMessage} className="relative group flex items-center">
                      <div className="relative flex-1 min-w-0">
                        <Input 
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder={`${user.nickname?.trim() || user.name?.trim() || '회원'} 님, 메시지를 입력하세요...`}
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
                 </div>
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
                disabled={actionLoading}
              >
                취소
              </Button>
              <Button 
                className="flex-1 h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-lg shadow-xl shadow-red-200"
                onClick={() => handleStartLiveConfirm(false)}
                disabled={actionLoading}
              >
                {actionLoading ? '시작 처리 중...' : '방송 시작하기'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Resolution Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-6 shadow-2xl relative border-2 border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
              <span className="font-black text-xs tracking-wider uppercase">라이브 방송 중복 감지</span>
            </div>

            <div>
              <h3 className="text-2xl font-black text-gray-900">이미 진행 중인 라이브 방송이 있습니다</h3>
              <p className="text-xs font-bold text-gray-500 mt-1">
                다른 관리자 계정에서 시작했거나 이전 세션의 라이브 방송이 송출 중입니다.
              </p>
            </div>

            {/* Current Active Broadcast details */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-black text-amber-900">현재 송출 중인 방송 정보</p>
              {(conflictingSessions.length > 0 ? conflictingSessions : (activeSession ? [activeSession] : [])).map((act) => (
                <div key={act.id} className="bg-white p-3.5 rounded-xl border border-amber-100 space-y-1.5 shadow-sm text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-gray-900">{act.title}</span>
                    <Badge className="bg-red-600 text-white text-[10px] font-bold">송출중</Badge>
                  </div>
                  <div className="text-gray-600 flex items-center gap-2">
                    <span className="font-bold text-gray-400">진행 관리자:</span>
                    <span className="font-black text-gray-900">{act.admin_name || '관리자'}</span>
                    <span className="text-gray-500 font-mono text-[11px]">({act.admin_email || '이메일 없음'})</span>
                  </div>
                  <div className="text-gray-600 flex items-center gap-2">
                    <span className="font-bold text-gray-400">시작 시간:</span>
                    <span className="font-bold text-gray-800">
                      {act.started_at ? new Date(act.started_at).toLocaleString('ko-KR') : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs font-bold text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100">
              기존 방송이 켜져 있는 상태에서 새로 방송을 시작하면 방송이 엉킬 수 있습니다. 기존에 진행 중인 라이브 방송을 종료하시겠습니까?
            </p>

            <div className="space-y-3 pt-2">
              <Button
                className="w-full h-12 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-lg shadow-purple-200 flex items-center justify-center gap-2"
                onClick={() => {
                  setShowConflictModal(false);
                  handleStartLiveConfirm(true);
                }}
                disabled={actionLoading}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>기존 방송 종료 후 새 방송 시작하기</span>
              </Button>

              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  className="flex-1 h-12 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={handleStopAllLive}
                  disabled={actionLoading}
                >
                  <span>기존 방송만 종료하기</span>
                </Button>

                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-2xl border-gray-200 font-bold hover:bg-gray-50"
                  onClick={() => setShowConflictModal(false)}
                  disabled={actionLoading}
                >
                  <span>취소</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

