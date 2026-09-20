import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Radio, 
  Play, 
  Square, 
  AlertTriangle, 
  Clock, 
  User, 
  ExternalLink, 
  RefreshCw, 
  MessageSquare, 
  Video, 
  CheckCircle2, 
  Info,
  Layers,
  ChevronRight,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/store/useAuthStore';
import { liveService, LiveSession } from '@/services/liveService';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function AdminLiveManagement() {
  const { user } = useAuthStore();
  const [activeSessions, setActiveSessions] = useState<LiveSession[]>([]);
  const [historySessions, setHistorySessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal States
  const [showStartModal, setShowStartModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showStopAllConfirm, setShowStopAllConfirm] = useState(false);
  const [selectedSessionToStop, setSelectedSessionToStop] = useState<LiveSession | null>(null);

  // Start Form States
  const [liveTitle, setLiveTitle] = useState('');
  const [embedCode, setEmbedCode] = useState('');
  const [startTime, setStartTime] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const DEFAULT_VIMEO_EMBED = '<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://vimeo.com/event/5897209/embed" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe></div>';

  // Load Sessions
  const loadSessions = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await liveService.getSessions();
      setActiveSessions(data.activeSessions || []);
      setHistorySessions(data.historySessions || []);
    } catch (err) {
      console.error('Error loading live sessions:', err);
      toast.error('라이브 방송 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSessions();

    // Listen to realtime broadcast events
    const channel = supabase.channel('b1_live_admin_room');
    channel
      .on('broadcast', { event: 'live_status_change' }, () => {
        // Silently reload sessions when any admin starts or stops
        loadSessions();
      })
      .subscribe();

    // Polling every 15s to keep elapsed time fresh and sync status
    const interval = setInterval(() => {
      loadSessions();
    }, 15000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  // Format Date to KST String
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return isoString;
    }
  };

  // Calculate elapsed time
  const getElapsedString = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      if (diffMs < 0) return '방금 전';
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return '방금 시작';
      if (diffMin < 60) return `${diffMin}분 경과`;
      const diffHours = Math.floor(diffMin / 60);
      const remainingMin = diffMin % 60;
      return `${diffHours}시간 ${remainingMin}분 경과`;
    } catch {
      return '';
    }
  };

  // Calculate duration between started_at and ended_at
  const getDurationString = (startIso?: string | null, endIso?: string | null) => {
    if (!startIso || !endIso) return '-';
    try {
      const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
      if (diffMs <= 0) return '1분 미만';
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 60) return `${diffMin}분간 진행`;
      const hours = Math.floor(diffMin / 60);
      const mins = diffMin % 60;
      return `${hours}시간 ${mins}분간 진행`;
    } catch {
      return '-';
    }
  };

  // Start Live Click Handler
  const handleOpenStartModal = () => {
    if (activeSessions.length > 0) {
      // Conflict exists! Show conflict warning
      setShowConflictModal(true);
    } else {
      setLiveTitle('비원아카데미 라이브 특강');
      setEmbedCode(DEFAULT_VIMEO_EMBED);
      setChatEnabled(true);
      setShowStartModal(true);
    }
  };

  // Confirm Start (or Force Overwrite)
  const handleConfirmStart = async (forceOverwrite: boolean = false) => {
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
        setShowStartModal(false);
        setShowConflictModal(true);
        return;
      }

      if (result.success) {
        toast.success('라이브 방송이 성공적으로 시작되었습니다!');
        setShowStartModal(false);
        setShowConflictModal(false);
        await loadSessions(true);
      } else {
        toast.error(result.message || '라이브 시작 중 오류가 발생했습니다.');
      }
    } catch (err: any) {
      console.error('Start live error:', err);
      toast.error(err.message || '라이브 방송 시작 실패');
    } finally {
      setActionLoading(false);
    }
  };

  // Stop Single Live
  const handleStopSingleSession = async (session: LiveSession) => {
    try {
      setActionLoading(true);
      const adminRealName = user?.name?.trim() || (user as any)?.full_name?.trim() || user?.nickname?.trim() || '관리자';

      const res = await liveService.stopLive({
        sessionId: session.id,
        adminId: user?.id,
        adminName: adminRealName,
        adminEmail: user?.email
      });

      if (res.success) {
        toast.success(`"${session.title}" 라이브 방송이 종료되었습니다.`);
        setSelectedSessionToStop(null);
        await loadSessions(true);
      } else {
        toast.error(res.message || '방송 종료 실패');
      }
    } catch (err: any) {
      console.error('Stop live error:', err);
      toast.error('라이브 종료 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  // Stop All Active Sessions
  const handleStopAllSessions = async () => {
    try {
      setActionLoading(true);
      const adminRealName = user?.name?.trim() || (user as any)?.full_name?.trim() || user?.nickname?.trim() || '관리자';

      const res = await liveService.stopAllLive({
        adminId: user?.id,
        adminName: adminRealName,
        adminEmail: user?.email
      });

      if (res.success) {
        toast.success('현재 진행 중인 모든 라이브 방송이 종료되었습니다. 캐시가 초기화되었습니다.');
        setShowStopAllConfirm(false);
        setShowConflictModal(false);
        await loadSessions(true);
      } else {
        toast.error(res.message || '전체 방송 종료 처리 중 오류가 발생했습니다.');
      }
    } catch (err: any) {
      console.error('Stop all live error:', err);
      toast.error('전체 라이브 종료 실패');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans antialiased text-gray-900">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white shadow-lg shadow-red-200">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-gray-900">비원Live 방송 관리</h1>
              <p className="text-xs text-gray-500 font-bold">실시간 라이브 방송 송출 상태 제어, 다중 방송 충돌 방지 및 전체 종료 관리</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSessions(true)}
            disabled={refreshing}
            className="rounded-xl border-gray-200 font-bold hover:bg-gray-50 flex items-center gap-2 h-11 px-4"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-600' : 'text-gray-500'}`} />
            <span>새로고침</span>
          </Button>

          {/* Quick link to live watch page */}
          <Link to="/live" target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-gray-200 font-bold text-gray-700 hover:text-purple-600 hover:bg-purple-50 flex items-center gap-2 h-11 px-4"
            >
              <ExternalLink className="w-4 h-4" />
              <span>비원Live 시청화면</span>
            </Button>
          </Link>

          {/* Stop All Button (Prominent) */}
          <Button
            variant="destructive"
            onClick={() => setShowStopAllConfirm(true)}
            disabled={activeSessions.length === 0 && !liveService}
            className="rounded-xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 flex items-center gap-2 h-11 px-5"
          >
            <Square className="w-4 h-4 fill-white" />
            <span>모든 라이브 방송 전체 종료</span>
          </Button>

          {/* Start New Live Button */}
          <Button
            onClick={handleOpenStartModal}
            className="rounded-xl font-black bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200 flex items-center gap-2 h-11 px-5"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>새 라이브 시작하기</span>
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="rounded-3xl border-gray-100 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">현재 진행 중인 방송</p>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-gray-900">{activeSessions.length}</span>
                <span className="text-sm font-bold text-gray-500">개</span>
              </div>
              <p className="text-xs font-bold text-gray-500">
                {activeSessions.length > 0 ? (
                  <span className="text-red-600 font-black flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                    현재 실시간 스트리밍 중
                  </span>
                ) : (
                  '송출 중인 방송 없음'
                )}
              </p>
            </div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${activeSessions.length > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
              <Radio className="w-7 h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-gray-100 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">누적 라이브 세션</p>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-gray-900">{activeSessions.length + historySessions.length}</span>
                <span className="text-sm font-bold text-gray-500">회</span>
              </div>
              <p className="text-xs font-bold text-gray-500">완료된 방송 {historySessions.length}건 기록</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers className="w-7 h-7" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-gray-100 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">현재 접속 관리자</p>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-gray-900 truncate max-w-[180px]">
                  {user?.name || user?.nickname || '관리자'}
                </span>
                <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none text-[10px] font-bold">
                  {user?.role === 'super_admin' ? '최고관리자' : '운영관리자'}
                </Badge>
              </div>
              <p className="text-xs font-bold text-gray-400 truncate max-w-[200px]">{user?.email}</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 1: Active Live Broadcasts List (High Priority) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
            <h2 className="text-lg font-black text-gray-900 tracking-tight">현재 진행 중인 라이브 방송 리스트</h2>
            <Badge className="bg-red-600 text-white font-black text-xs px-2.5 py-0.5 rounded-full">
              {activeSessions.length}건 진행중
            </Badge>
          </div>

          {activeSessions.length > 1 && (
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-xl flex items-center gap-1.5 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              주의: 다중 방송이 동시에 켜져 있습니다. 필요한 방송 외에는 종료해주세요.
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400 font-bold">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
            라이브 방송 상태를 확인 중입니다...
          </div>
        ) : activeSessions.length === 0 ? (
          <Card className="rounded-3xl border border-gray-100 bg-white shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">현재 송출 중인 라이브 방송이 없습니다</h3>
            <p className="text-xs font-bold text-gray-400 mb-6 max-w-md mx-auto">
              비원Live 수강생 화면에는 현재 &apos;방송 준비중&apos;으로 안내되고 있습니다. 새로운 라이브 특강을 시작하려면 아래 버튼을 눌러주세요.
            </p>
            <Button
              onClick={handleOpenStartModal}
              className="rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white h-11 px-6 shadow-md shadow-purple-200 inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>새 라이브 방송 시작하기</span>
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeSessions.map((session) => (
              <Card 
                key={session.id} 
                className="rounded-3xl border-2 border-red-500/20 bg-gradient-to-r from-white via-white to-red-50/20 shadow-md hover:shadow-lg transition-all overflow-hidden"
              >
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left: Info Details */}
                    <div className="space-y-4 flex-1">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-red-600 text-white border-none font-black text-xs px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse shadow-sm">
                          <Radio className="w-3.5 h-3.5" /> LIVE 진행 중
                        </Badge>
                        <span className="text-xs font-black text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100">
                          {getElapsedString(session.started_at)}
                        </span>
                        {session.chat_enabled ? (
                          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-xs font-bold flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> 실시간 채팅 활성화
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500 bg-gray-50 border-gray-200 text-xs font-bold">
                            채팅 비활성
                          </Badge>
                        )}
                      </div>

                      {/* Title */}
                      <div>
                        <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                          {session.title}
                        </h3>
                      </div>

                      {/* Detailed Meta: Start Time & Admin Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {/* Start Time info */}
                        <div className="bg-gray-50 rounded-2xl p-3.5 flex items-center gap-3 border border-gray-100">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-gray-400">방송 시작 시간</p>
                            <p className="text-sm font-black text-gray-900 tracking-tight">
                              {formatDate(session.started_at)}
                            </p>
                          </div>
                        </div>

                        {/* Admin Identity Info */}
                        <div className="bg-gray-50 rounded-2xl p-3.5 flex items-center gap-3 border border-gray-100">
                          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-gray-400">시작한 관리자 계정</p>
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-sm font-black text-gray-900">
                                {session.admin_name || '관리자'}
                              </span>
                              {session.admin_nickname && (
                                <span className="text-xs font-bold text-gray-500">
                                  ({session.admin_nickname})
                                </span>
                              )}
                              <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 truncate">
                                {session.admin_email || '아이디 없음'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-gray-100">
                      <Link to="/live" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                        <Button
                          variant="outline"
                          className="w-full rounded-2xl border-gray-200 font-bold hover:bg-gray-50 text-gray-700 h-12 px-5 flex items-center justify-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>시청 화면 확인</span>
                        </Button>
                      </Link>

                      <Button
                        variant="destructive"
                        onClick={() => setSelectedSessionToStop(session)}
                        disabled={actionLoading}
                        className="w-full sm:w-auto rounded-2xl font-black bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-200 h-12 px-6 flex items-center justify-center gap-2"
                      >
                        <Square className="w-4 h-4 fill-white" />
                        <span>라이브 방송 종료하기</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Broadcast History */}
      <div className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-black text-gray-900 tracking-tight">최근 종료된 라이브 방송 히스토리</h2>
            <Badge variant="outline" className="text-gray-500 text-xs font-bold">
              최근 {historySessions.length}건
            </Badge>
          </div>
        </div>

        {historySessions.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400 text-xs font-bold">
            종료된 이전 방송 기록이 없습니다.
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-bold text-xs uppercase border-b border-gray-100">
                  <tr>
                    <th className="py-4 px-6">상태</th>
                    <th className="py-4 px-6">방송 제목</th>
                    <th className="py-4 px-6">시작 시간</th>
                    <th className="py-4 px-6">종료 시간</th>
                    <th className="py-4 px-6">진행 시간</th>
                    <th className="py-4 px-6">시작 관리자</th>
                    <th className="py-4 px-6">종료 관리자</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium">
                  {historySessions.map((hist) => (
                    <tr key={hist.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-4 px-6">
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 font-bold text-[11px]">
                          종료됨
                        </Badge>
                      </td>
                      <td className="py-4 px-6 font-bold text-gray-900 max-w-[220px] truncate">
                        {hist.title}
                      </td>
                      <td className="py-4 px-6 text-xs text-gray-600 whitespace-nowrap">
                        {formatDate(hist.started_at)}
                      </td>
                      <td className="py-4 px-6 text-xs text-gray-600 whitespace-nowrap">
                        {formatDate(hist.ended_at)}
                      </td>
                      <td className="py-4 px-6 text-xs font-bold text-purple-600 whitespace-nowrap">
                        {getDurationString(hist.started_at, hist.ended_at)}
                      </td>
                      <td className="py-4 px-6 text-xs whitespace-nowrap">
                        <div className="font-bold text-gray-900">{hist.admin_name || '관리자'}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{hist.admin_email || '-'}</div>
                      </td>
                      <td className="py-4 px-6 text-xs whitespace-nowrap">
                        <div className="font-bold text-gray-700">{hist.ended_by_name || '-'}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{hist.ended_by_email || ''}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: START LIVE SETTINGS MODAL */}
      {/* ========================================================================= */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-6 shadow-2xl relative border border-gray-100">
            <div className="flex items-center gap-2 text-purple-600">
              <Radio className="w-5 h-5 animate-pulse" />
              <span className="font-black text-xs tracking-wider uppercase">Live Stream Setup</span>
            </div>

            <div>
              <h3 className="text-2xl font-black text-gray-900">새 라이브 방송 시작</h3>
              <p className="text-xs font-bold text-gray-400 mt-1">
                라이브 방송 제목과 Vimeo 임베드 코드를 입력하여 송출을 시작합니다.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-black text-gray-700">라이브 방송 제목</Label>
                <Input
                  value={liveTitle}
                  onChange={(e) => setLiveTitle(e.target.value)}
                  placeholder="예: 비원아카데미 정규 라이브 특강"
                  className="h-12 bg-gray-50 border-gray-200 rounded-2xl font-bold focus:bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black text-gray-700">Vimeo / 영상 임베드 코드 (HTML)</Label>
                <textarea
                  value={embedCode}
                  onChange={(e) => setEmbedCode(e.target.value)}
                  placeholder="<iframe src=...>"
                  rows={3}
                  className="w-full p-3 text-xs bg-gray-50 border border-gray-200 rounded-2xl font-mono focus:bg-white outline-none focus:ring-2 focus:ring-purple-600/20"
                />
                <p className="text-[11px] font-bold text-gray-400">
                  기본값으로 비원 라이브 Vimeo 이벤트 코드가 자동 세팅됩니다.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black text-gray-700">예정 시작 시간 (선택)</Label>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-12 bg-gray-50 border-gray-200 rounded-2xl font-bold"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="space-y-0.5">
                  <Label className="text-sm font-black text-gray-900">실시간 채팅 사용</Label>
                  <p className="text-xs font-bold text-gray-400">수강생의 실시간 참여 및 질문 채팅 허용</p>
                </div>
                <Switch
                  checked={chatEnabled}
                  onCheckedChange={setChatEnabled}
                  className="data-[state=checked]:bg-purple-600"
                />
              </div>

              <div className="bg-purple-50 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-purple-700">
                <Info className="w-4 h-4 shrink-0" />
                <span>시작 즉시 관리자 정보({user?.name || '관리자'}, {user?.email})가 기록됩니다.</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-2xl border-gray-200 font-bold hover:bg-gray-50"
                onClick={() => setShowStartModal(false)}
                disabled={actionLoading}
              >
                취소
              </Button>
              <Button
                className="flex-1 h-12 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-lg shadow-purple-200"
                onClick={() => handleConfirmStart(false)}
                disabled={actionLoading}
              >
                {actionLoading ? '시작 중...' : '방송 시작하기'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFLICT CONFIRMATION MODAL (CORE USER REQUIREMENT) */}
      {/* ========================================================================= */}
      {showConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-8 max-w-lg w-full space-y-6 shadow-2xl relative border-2 border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
              <span className="font-black text-xs tracking-wider uppercase">Live Stream Conflict</span>
            </div>

            <div>
              <h3 className="text-2xl font-black text-gray-900">이미 진행 중인 라이브 방송이 있습니다</h3>
              <p className="text-xs font-bold text-gray-500 mt-1">
                다른 관리자 계정 또는 이전 세션에서 시작된 라이브 방송이 현재 송출 중입니다.
              </p>
            </div>

            {/* Existing Active Sessions Card */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-black text-amber-900">현재 진행 중인 방송 정보</p>
              {activeSessions.map((act) => (
                <div key={act.id} className="bg-white p-3.5 rounded-xl border border-amber-100 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-gray-900">{act.title}</span>
                    <Badge className="bg-red-600 text-white text-[10px] font-bold">송출중</Badge>
                  </div>
                  <div className="text-xs text-gray-600 flex items-center gap-2">
                    <span className="font-bold text-gray-400">진행 관리자:</span>
                    <span className="font-black text-gray-900">{act.admin_name || '관리자'}</span>
                    <span className="text-gray-500 font-mono text-[11px]">({act.admin_email || '이메일 없음'})</span>
                  </div>
                  <div className="text-xs text-gray-600 flex items-center gap-2">
                    <span className="font-bold text-gray-400">시작 일시:</span>
                    <span className="font-bold text-gray-700">{formatDate(act.started_at)}</span>
                    <span className="text-red-600 font-black text-[11px]">({getElapsedString(act.started_at)})</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs font-bold text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100">
              새로운 라이브 방송을 시작하려면 기존 방송을 종료해야 합니다. 기존에 진행 중인 라이브 방송을 종료하고 새로 시작하시겠습니까?
            </p>

            <div className="space-y-3 pt-2">
              <Button
                className="w-full h-12 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-lg shadow-purple-200 flex items-center justify-center gap-2"
                onClick={() => {
                  setShowConflictModal(false);
                  setLiveTitle('비원아카데미 라이브 특강');
                  setEmbedCode(DEFAULT_VIMEO_EMBED);
                  setChatEnabled(true);
                  handleConfirmStart(true);
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
                  onClick={handleStopAllSessions}
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

      {/* ========================================================================= */}
      {/* MODAL 3: STOP SINGLE SESSION CONFIRM */}
      {/* ========================================================================= */}
      {selectedSessionToStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full space-y-6 shadow-2xl relative border border-gray-100">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Square className="w-6 h-6 fill-red-600" />
            </div>

            <div className="text-center">
              <h3 className="text-xl font-black text-gray-900">라이브 방송을 종료하시겠습니까?</h3>
              <p className="text-xs font-bold text-gray-400 mt-1">
                종료 즉시 모든 시청자 화면에서 라이브가 중단되며 캐시가 갱신됩니다.
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl space-y-2 border border-gray-100 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400 font-bold">방송 제목:</span>
                <span className="text-gray-900 font-black truncate max-w-[200px]">{selectedSessionToStop.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-bold">시작한 관리자:</span>
                <span className="text-gray-900 font-bold">{selectedSessionToStop.admin_name} ({selectedSessionToStop.admin_email})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-bold">시작 시간:</span>
                <span className="text-gray-700 font-bold">{formatDate(selectedSessionToStop.started_at)}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-2xl border-gray-200 font-bold hover:bg-gray-50"
                onClick={() => setSelectedSessionToStop(null)}
                disabled={actionLoading}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-12 rounded-2xl font-black bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200"
                onClick={() => handleStopSingleSession(selectedSessionToStop)}
                disabled={actionLoading}
              >
                {actionLoading ? '종료 중...' : '방송 종료하기'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: STOP ALL LIVE STREAMS CONFIRM */}
      {/* ========================================================================= */}
      {showStopAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full space-y-6 shadow-2xl relative border-2 border-red-500/20">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="text-center">
              <h3 className="text-xl font-black text-gray-900">모든 라이브 방송 전체 종료</h3>
              <p className="text-xs font-bold text-gray-500 mt-2 leading-relaxed">
                현재 진행 중인 모든 라이브 방송 세션({activeSessions.length}건)을 즉시 종료하고 관련 캐시와 싱글톤 상태를 완전히 초기화합니다.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-2xl border-gray-200 font-bold hover:bg-gray-50"
                onClick={() => setShowStopAllConfirm(false)}
                disabled={actionLoading}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-12 rounded-2xl font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-200"
                onClick={handleStopAllSessions}
                disabled={actionLoading}
              >
                {actionLoading ? '전체 종료 중...' : '네, 모두 종료합니다'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
