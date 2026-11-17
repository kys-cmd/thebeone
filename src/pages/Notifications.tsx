import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bell,
  Megaphone,
  MessageSquare,
  Ticket,
  Coins,
  ShieldCheck,
  Inbox,
  CheckCheck,
  Search,
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  Clock,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  notificationService,
  MemberNotificationItem,
  getNotificationCategoryLabel,
} from '@/services/notificationService';

type CategoryFilter =
  | 'ALL'
  | 'notice'
  | 'inquiry_reply'
  | 'benefits'
  | 'admin_message';

const FILTER_TABS: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'ALL', label: '전체 알림' },
  { id: 'notice', label: '공지사항' },
  { id: 'inquiry_reply', label: '1:1 문의 답변' },
  { id: 'benefits', label: '쿠폰 · 마일리지' },
  { id: 'admin_message', label: '관리자 안내' },
];

function sanitizeHtmlForDisplay(rawHtml: string): string {
  if (!rawHtml) return '';
  return rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '');
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getCategoryStyle(category: string) {
  switch (category) {
    case 'notice':
      return {
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
        iconBg: 'bg-purple-50 text-purple-600',
        Icon: Megaphone,
      };
    case 'inquiry_reply':
      return {
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        iconBg: 'bg-blue-50 text-blue-600',
        Icon: MessageSquare,
      };
    case 'coupon_issued':
      return {
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        iconBg: 'bg-emerald-50 text-emerald-600',
        Icon: Ticket,
      };
    case 'mileage_issued':
      return {
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        iconBg: 'bg-amber-50 text-amber-600',
        Icon: Coins,
      };
    case 'chat':
      return {
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        iconBg: 'bg-indigo-50 text-indigo-600',
        Icon: MessageSquare,
      };
    case 'admin_message':
    default:
      return {
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        iconBg: 'bg-slate-100 text-slate-700',
        Icon: ShieldCheck,
      };
  }
}

export default function Notifications() {
  const { user, isLoading: authLoading } = useAuthStore();
  const navigate = useNavigate();
  const { id: selectedId } = useParams<{ id?: string }>();

  const [notifications, setNotifications] = useState<MemberNotificationItem[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<MemberNotificationItem | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const loadNotifications = async (silent = false) => {
    if (!user) return;
    try {
      if (!silent) setLoadingList(true);
      const list = await notificationService.getNotificationsForUser(user.id, 200);
      setNotifications(list);
    } catch (err) {
      console.error('[Notifications] Failed to load list:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth/login');
      return;
    }

    loadNotifications();

    const sub = notificationService.subscribeToNotifications(() => {
      loadNotifications(true);
    });

    return () => {
      sub.unsubscribe();
    };
  }, [user, authLoading]);

  // Load full detail when `:id` route parameter changes
  useEffect(() => {
    if (!user) return;

    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }

    let cancelled = false;
    const fetchDetail = async () => {
      try {
        setLoadingDetail(true);
        const detail = await notificationService.getNotificationDetail(selectedId, true);
        if (cancelled) return;
        setSelectedDetail(detail);
        setNotifications((prev) =>
          prev.map((item) => (item.id === selectedId ? { ...item, isRead: true } : item))
        );
      } catch (err: any) {
        if (!cancelled) {
          // Fallback to in-memory item if available
          const localMatch = notifications.find((n) => n.id === selectedId);
          if (localMatch) {
            setSelectedDetail(localMatch);
          } else {
            toast.error(err?.message || '알림 상세 정보를 불러오지 못했습니다.');
          }
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };

    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId, user?.id]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notifications.filter((n) => {
      if (n.category === 'chat') return false;
      if (unreadOnly && n.isRead) return false;
      if (categoryFilter === 'benefits') {
        if (n.category !== 'coupon_issued' && n.category !== 'mileage_issued') return false;
      } else if (categoryFilter !== 'ALL' && n.category !== categoryFilter) {
        return false;
      }

      if (q) {
        const hay = `${n.title} ${n.summary} ${n.message} ${n.metadata?.courseTitle || ''} ${n.metadata?.couponName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notifications, categoryFilter, unreadOnly, searchQuery]);

  // Desktop: if no `:id` is selected, show the first filtered notification on the right pane without forcing mobile view
  const activeNotificationForDesktop = useMemo(() => {
    if (selectedDetail) return selectedDetail;
    if (selectedId) return notifications.find((n) => n.id === selectedId) || null;
    return filteredNotifications[0] || null;
  }, [selectedDetail, selectedId, notifications, filteredNotifications]);

  const handleSelectNotification = (notif: MemberNotificationItem) => {
    navigate(`/notifications/${notif.id}`);
  };

  const handleMarkAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    const ok = await notificationService.markAllAsRead(user.id);
    if (ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('모든 알림을 읽음 처리했습니다.');
    }
  };

  const handleCopyCouponCode = async (code: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      toast.success('쿠폰 코드가 복사되었습니다.');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('클립보드 복사에 실패했습니다.');
    }
  };

  const handleOpenLink = (url: string) => {
    if (!url) return;
    if (url.startsWith('/chat')) {
      toast.info('현재 실시간 채팅 기능이 비활성화되어 있습니다.');
      return;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.location.href = url;
    } else {
      navigate(url);
    }
  };

  const renderDetailContent = (notif: MemberNotificationItem | null) => {
    if (loadingDetail && !notif) {
      return (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
          <p className="text-xs font-bold">알림 상세 내용을 불러오는 중입니다...</p>
        </div>
      );
    }

    if (!notif) {
      return (
        <div className="py-24 px-6 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-800">확인할 알림을 선택해 주세요</p>
            <p className="text-xs font-medium text-slate-500 mt-1">
              왼쪽 알림 목록에서 항목을 클릭하면 전체 상세 내용을 확인하실 수 있습니다.
            </p>
          </div>
        </div>
      );
    }

    const style = getCategoryStyle(notif.category);
    const CategoryIcon = style.Icon;
    const meta = notif.metadata || {};

    return (
      <div className="flex flex-col h-full">
        {/* Detail Header */}
        <div className="p-5 sm:p-7 border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn('font-extrabold text-xs px-2.5 py-0.5 rounded-md border', style.badgeClass)}
              >
                <CategoryIcon className="w-3.5 h-3.5 mr-1 inline-block" />
                {getNotificationCategoryLabel(notif.category)}
              </Badge>
              {notif.userId === 'all' && (
                <Badge variant="outline" className="text-[11px] font-bold text-slate-600 border-slate-200 rounded-md">
                  전체 회원 공지
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 tabular-nums">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDateTime(notif.created_at)}</span>
            </div>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug break-keep">
              {notif.title}
            </h2>
            <p className="text-xs font-bold text-slate-500 mt-1.5">
              발송처: <span className="text-slate-700">{notif.senderName || '비원아카데미 운영팀'}</span>
            </p>
          </div>
        </div>

        {/* Detail Body */}
        <div className="p-5 sm:p-7 space-y-6 flex-1">
          {/* 1) 1:1 문의 답변 전용 상세 뷰 */}
          {notif.category === 'inquiry_reply' && (meta.inquiryQuestion || meta.replyContent) ? (
            <div className="space-y-5">
              {meta.inquiryQuestion && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-200/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[11px] font-extrabold">
                        내가 남긴 문의
                      </span>
                      {meta.inquiryCategory && (
                        <span className="text-xs font-bold text-purple-700">[{meta.inquiryCategory}]</span>
                      )}
                      {meta.inquiryTitle && (
                        <span className="text-xs font-extrabold text-slate-800">{meta.inquiryTitle}</span>
                      )}
                    </div>
                    {meta.inquiryCreatedAt && (
                      <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                        접수일시 {formatDateTime(meta.inquiryCreatedAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                    {meta.inquiryQuestion}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-4 sm:p-6 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-purple-100 pb-2.5">
                  <span className="px-2.5 py-0.5 rounded bg-purple-600 text-white text-xs font-extrabold">
                    관리자 답변 전문
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                    답변일시 {formatDateTime(meta.repliedAt || notif.created_at)}
                  </span>
                </div>
                <div className="text-sm sm:text-[15px] text-slate-900 font-medium leading-relaxed whitespace-pre-wrap break-words">
                  {meta.replyContent || notif.message}
                </div>
              </div>
            </div>
          ) : null}

          {/* 2) 쿠폰 발급 전용 상세 카드 */}
          {notif.category === 'coupon_issued' && meta.couponName && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                  <Ticket className="w-4 h-4 text-emerald-600" />
                  발급된 무료 수강 쿠폰 상세 내역
                </span>
                <Badge className="bg-emerald-600 text-white text-[11px] font-bold rounded-md">
                  무료 수강권
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white rounded-lg border border-emerald-100 p-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold block">쿠폰명</span>
                  <span className="text-slate-900 font-black text-sm">{meta.couponName}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold block">무료 수강 기간</span>
                  <span className="text-purple-700 font-black text-sm tabular-nums">
                    사용 시작일로부터 {meta.durationDays || 7}일간
                  </span>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <span className="text-slate-400 font-bold block">적용 대상 강의</span>
                  <span className="text-slate-800 font-extrabold text-sm flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    {meta.courseTitle || '지정 강의'}
                  </span>
                </div>
                {meta.couponCode && (
                  <div className="space-y-1 sm:col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-slate-400 font-bold block">전용 쿠폰 코드</span>
                      <span className="font-mono font-black text-sm text-slate-900 tracking-wider">
                        {meta.couponCode}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyCouponCode(meta.couponCode!)}
                      className="h-8 px-3 rounded-lg border-slate-200 font-bold text-xs gap-1.5 whitespace-nowrap"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCode ? '복사됨' : '코드 복사'}
                    </Button>
                  </div>
                )}
                {meta.issueMemo && (
                  <div className="sm:col-span-2 pt-2 border-t border-slate-100 space-y-1">
                    <span className="text-slate-400 font-bold block">관리자 발급 메모</span>
                    <p className="text-slate-700 font-semibold">{meta.issueMemo}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3) 마일리지 지급/차감 전용 상세 카드 */}
          {notif.category === 'mileage_issued' && meta.amount !== undefined && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-600" />
                  마일리지 변동 상세 내역
                </span>
                <Badge
                  className={cn(
                    'text-[11px] font-bold rounded-md text-white',
                    meta.adjustType === 'subtract' ? 'bg-rose-600' : 'bg-purple-600'
                  )}
                >
                  {meta.adjustType === 'subtract' ? '마일리지 차감' : '마일리지 적립'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white rounded-lg border border-amber-100 p-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold block">변동 포인트</span>
                  <span
                    className={cn(
                      'font-black text-base tabular-nums',
                      Number(meta.amount) >= 0 ? 'text-purple-700' : 'text-rose-600'
                    )}
                  >
                    {Number(meta.amount) >= 0 ? '+' : ''}
                    {Number(meta.amount).toLocaleString()}P
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold block">변경 전 잔액</span>
                  <span className="text-slate-700 font-bold text-sm tabular-nums">
                    {Number(meta.previousMileage || 0).toLocaleString()}P
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold block">변경 후 보유 잔액</span>
                  <span className="text-slate-900 font-black text-base tabular-nums">
                    {Number(meta.afterMileage || 0).toLocaleString()}P
                  </span>
                </div>
                {meta.reason && (
                  <div className="sm:col-span-3 pt-2 border-t border-slate-100 space-y-1">
                    <span className="text-slate-400 font-bold block">상세 사유</span>
                    <p className="text-slate-800 font-semibold">{meta.reason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4) 일반/공지 본문 메시지 렌더링 (inquiry_reply에서 이미 전용 뷰로 보여준 경우 중복 생략) */}
          {!(notif.category === 'inquiry_reply' && (meta.inquiryQuestion || meta.replyContent)) && (
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 sm:p-6">
              {notif.htmlContent ? (
                <div
                  className="prose prose-slate max-w-none text-sm sm:text-[15px] leading-relaxed break-words [&_img]:rounded-lg [&_img]:max-w-full [&_a]:text-purple-600 [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(notif.htmlContent) }}
                />
              ) : (
                <div className="text-sm sm:text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                  {notif.message}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {(notif.link || (notif.category === 'coupon_issued' && meta.courseId)) && (
            <div className="pt-2 flex flex-wrap items-center gap-2.5">
              {notif.link && (
                <Button
                  type="button"
                  onClick={() => handleOpenLink(notif.link!)}
                  className="h-11 px-5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-lg text-xs sm:text-sm gap-2 whitespace-nowrap"
                >
                  <span>
                    {notif.linkLabel ||
                      (notif.category === 'coupon_issued'
                        ? '내 쿠폰함에서 확인 · 사용하기'
                        : notif.category === 'mileage_issued'
                          ? '내 마일리지 내역 확인하기'
                          : notif.category === 'notice'
                            ? '공지사항 게시판 바로가기'
                            : '관련 페이지 바로가기')}
                  </span>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}

              {notif.category === 'coupon_issued' && meta.courseId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/course/${meta.courseId}`)}
                  className="h-11 px-4 rounded-lg border-slate-200 font-bold text-xs sm:text-sm text-slate-700 hover:bg-slate-50 gap-1.5 whitespace-nowrap"
                >
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  <span>대상 강의 상세 보기</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50/70 py-6 sm:py-10 px-4">
      <div className="container mx-auto max-w-6xl space-y-6">
        {/* Top Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                알림 센터
              </h1>
              {unreadCount > 0 && (
                <Badge className="bg-purple-600 text-white font-extrabold text-xs px-2.5 py-0.5 rounded-md tabular-nums">
                  미확인 {unreadCount}건
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
              공지사항, 1:1 문의 답변, 무료 수강 쿠폰 및 마일리지 발급 내역을 한곳에서 자세히 확인하세요.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadNotifications()}
              disabled={loadingList}
              className="h-9 px-3 rounded-lg border-slate-200 bg-white font-bold text-xs text-slate-700 gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loadingList && 'animate-spin')} />
              새로고침
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={unreadCount === 0}
              onClick={handleMarkAllAsRead}
              className="h-9 px-3.5 rounded-lg border-purple-200 bg-white text-purple-700 hover:bg-purple-50 font-extrabold text-xs gap-1.5 whitespace-nowrap"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              모두 읽음 처리
            </Button>
          </div>
        </div>

        {/* Category Filter Bar & Search */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 lg:pb-0">
            {FILTER_TABS.map((tab) => {
              const active = categoryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(tab.id);
                    if (selectedId) navigate('/notifications');
                  }}
                  className={cn(
                    'px-3.5 py-2 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none whitespace-nowrap shrink-0 px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                className="w-3.5 h-3.5 accent-purple-600 rounded"
              />
              <span>안 읽은 알림만</span>
            </label>

            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="제목, 내용, 강의명 검색"
                className="h-9 pl-8 text-xs font-semibold rounded-lg border-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Master-Detail Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Notification List (Hidden on mobile when viewing a specific `:id` detail) */}
          <div
            className={cn(
              'lg:col-span-5 bg-white rounded-xl border border-slate-200/90 overflow-hidden',
              selectedId ? 'hidden lg:block' : 'block'
            )}
          >
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-700">
                수신 알림 목록
              </span>
              <span className="text-xs font-bold text-slate-400 tabular-nums">
                총 {filteredNotifications.length.toLocaleString()}건
              </span>
            </div>

            {loadingList ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2.5 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
                <span className="text-xs font-bold">알림 내역을 불러오는 중입니다...</span>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-20 px-6 flex flex-col items-center justify-center text-center gap-2.5">
                <Inbox className="w-10 h-10 text-slate-300" />
                <p className="text-sm font-black text-slate-700">표시할 알림이 없습니다</p>
                <p className="text-xs font-medium text-slate-400">
                  새로운 공지사항이나 문의 답변, 쿠폰 혜택이 도착하면 이곳에 표시됩니다.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
                {filteredNotifications.map((item) => {
                  const style = getCategoryStyle(item.category);
                  const ItemIcon = style.Icon;
                  const isActive =
                    (selectedId && item.id === selectedId) ||
                    (!selectedId && activeNotificationForDesktop?.id === item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectNotification(item)}
                      className={cn(
                        'w-full text-left p-4 transition-colors flex items-start gap-3.5 cursor-pointer',
                        isActive
                          ? 'bg-purple-50/70'
                          : item.isRead
                            ? 'bg-white hover:bg-slate-50/80'
                            : 'bg-purple-50/25 hover:bg-purple-50/50'
                      )}
                    >
                      <div
                        className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                          style.iconBg
                        )}
                      >
                        <ItemIcon className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-extrabold text-purple-700">
                              {getNotificationCategoryLabel(item.category)}
                            </span>
                            {!item.isRead && (
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                            )}
                          </div>
                          <span className="text-[11px] font-medium text-slate-400 tabular-nums shrink-0">
                            {new Date(item.created_at).toLocaleDateString('ko-KR')}
                          </span>
                        </div>

                        <p
                          className={cn(
                            'text-sm truncate',
                            item.isRead ? 'font-bold text-slate-700' : 'font-black text-slate-900'
                          )}
                        >
                          {item.title}
                        </p>

                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {item.summary || item.message}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Detailed View */}
          <div
            className={cn(
              'lg:col-span-7 bg-white rounded-xl border border-slate-200/90 overflow-hidden min-h-[460px]',
              selectedId ? 'block' : 'hidden lg:block'
            )}
          >
            {selectedId && (
              <div className="lg:hidden px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                <button
                  type="button"
                  onClick={() => navigate('/notifications')}
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-700 hover:text-purple-700 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  알림 목록으로 돌아가기
                </button>
              </div>
            )}

            {renderDetailContent(selectedId ? selectedDetail : activeNotificationForDesktop)}
          </div>
        </div>
      </div>
    </div>
  );
}
