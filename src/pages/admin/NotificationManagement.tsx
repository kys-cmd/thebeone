import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Megaphone,
  Send,
  Users,
  GraduationCap,
  FileSpreadsheet,
  Search,
  RefreshCw,
  Trash2,
  Eye,
  CheckCircle2,
  Inbox,
  MessageSquare,
  Ticket,
  Coins,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  notificationService,
  AdminSentNotificationRecord,
  AdminNoticeSummary,
  AdminNotificationMember,
  AdminNotificationCourse,
  AdminNotificationEnrollment,
  getNotificationCategoryLabel,
} from '@/services/notificationService';

type ActiveTab = 'compose' | 'history';
type ComposeMode = 'global_notice' | 'existing_notice' | 'custom_message';
type TargetSelectionMode = 'all_members' | 'selected' | 'course_students' | 'bulk_paste';
type CourseStudentStatusFilter = 'all' | 'active' | 'expired';

const LINK_PRESETS = [
  { label: '바로가기 버튼 없음', url: '', btnText: '' },
  { label: '공지사항 게시판 (/support/notice)', url: '/support/notice', btnText: '공지사항 게시판 바로가기' },
  { label: '내 쿠폰 · 마일리지함 (/mypage?tab=payments)', url: '/mypage?tab=payments', btnText: '내 쿠폰 · 마일리지함 확인하기' },
  { label: '내 강의실 (/mypage?tab=classroom)', url: '/mypage?tab=classroom', btnText: '내 강의실 바로가기' },
  { label: '정규강의 목록 (/courses)', url: '/courses', btnText: '정규강의 보러가기' },
  { label: '1:1 문의 (/support/inquiry)', url: '/support/inquiry', btnText: '1:1 문의 바로가기' },
  { label: '직접 경로 입력', url: 'CUSTOM', btnText: '' },
];

const ROLE_LABELS: Record<string, string> = {
  user: '일반회원',
  regular_member: '정회원',
  paid_member: '유료회원',
  beone_member: '비원회원',
  bione_member: '비원회원',
  admin: '관리자',
  super_admin: '최고관리자',
};

function normalizePhone(raw: string): string {
  return (raw || '').replace(/[^0-9]/g, '');
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

function sanitizeHtmlForPreview(rawHtml: string): string {
  if (!rawHtml) return '';
  return rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '');
}

export default function NotificationManagement() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('compose');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [sentNotifications, setSentNotifications] = useState<AdminSentNotificationRecord[]>([]);
  const [notices, setNotices] = useState<AdminNoticeSummary[]>([]);
  const [courses, setCourses] = useState<AdminNotificationCourse[]>([]);
  const [members, setMembers] = useState<AdminNotificationMember[]>([]);
  const [enrollments, setEnrollments] = useState<AdminNotificationEnrollment[]>([]);

  // 1. 발송 유형 및 본문 상태
  const [composeMode, setComposeMode] = useState<ComposeMode>('global_notice');
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('비원아카데미 운영팀');
  const [linkPreset, setLinkPreset] = useState<string>('/support/notice');
  const [customLink, setCustomLink] = useState<string>('');
  const [linkLabel, setLinkLabel] = useState<string>('공지사항 게시판 바로가기');

  // 2. 수신 대상 상태
  const [targetMode, setTargetMode] = useState<TargetSelectionMode>('all_members');
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const [studentCourseId, setStudentCourseId] = useState<string>('');
  const [studentCourseSearch, setStudentCourseSearch] = useState<string>('');
  const [studentStatusFilter, setStudentStatusFilter] = useState<CourseStudentStatusFilter>('all');
  const [studentMemberSearch, setStudentMemberSearch] = useState<string>('');
  const [selectedCourseStudentIds, setSelectedCourseStudentIds] = useState<Set<string>>(new Set());

  const [bulkPasteText, setBulkPasteText] = useState<string>('');
  const [confirmSendOpen, setConfirmSendOpen] = useState<boolean>(false);

  // 3. 발송 내역 상태
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>('ALL');
  const [previewRecord, setPreviewRecord] = useState<AdminSentNotificationRecord | null>(null);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);

  const loadDashboard = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await notificationService.getAdminDashboardData();
      setSentNotifications(data.sentNotifications);
      setNotices(data.notices);
      setCourses(data.courses);
      setMembers(data.members);
      setEnrollments(data.enrollments);

      if (!selectedNoticeId && data.notices.length > 0) {
        setSelectedNoticeId(data.notices[0].id);
      }

      if (!studentCourseId && data.courses.length > 0) {
        const courseWithStudents =
          data.courses.find((c) => data.enrollments.some((e) => e.course_id === c.id)) ||
          data.courses[0];
        if (courseWithStudents) {
          setStudentCourseId(courseWithStudents.id);
          const ids = data.enrollments
            .filter((e) => e.course_id === courseWithStudents.id)
            .map((e) => e.user_id);
          setSelectedCourseStudentIds(new Set(ids));
        }
      }
    } catch (err: any) {
      toast.error(err?.message || '알림 관리 대시보드 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // 발송 모드 변경 시 기본 링크/수신범위 자동 세팅
  const handleSelectComposeMode = (mode: ComposeMode) => {
    setComposeMode(mode);
    if (mode === 'global_notice') {
      setTargetMode('all_members');
      setLinkPreset('/support/notice');
      setLinkLabel('공지사항 게시판 바로가기');
    } else if (mode === 'existing_notice') {
      setTargetMode('all_members');
      setLinkPreset('/support/notice');
      setLinkLabel('공지사항 게시판 바로가기');
      const found = notices.find((n) => n.id === selectedNoticeId) || notices[0];
      if (found) {
        setSelectedNoticeId(found.id);
        setTitle(found.title.startsWith('[공지') ? found.title : `[공지사항] ${found.title}`);
        setMessage(found.plainPreview || found.title);
      }
    } else {
      setTargetMode('selected');
      setLinkPreset('');
      setLinkLabel('');
    }
  };

  const selectedNoticeObj = useMemo(
    () => notices.find((n) => n.id === selectedNoticeId) || null,
    [notices, selectedNoticeId]
  );

  // 통계 요약
  const stats = useMemo(() => {
    const totalSent = sentNotifications.length;
    const noticeCount = sentNotifications.filter((n) => n.category === 'notice').length;
    const inquiryCount = sentNotifications.filter((n) => n.category === 'inquiry_reply').length;
    const benefitCount = sentNotifications.filter(
      (n) => n.category === 'coupon_issued' || n.category === 'mileage_issued'
    ).length;
    const totalReads = sentNotifications.reduce((acc, n) => acc + (n.readCount || 0), 0);
    return { totalSent, noticeCount, inquiryCount, benefitCount, totalReads };
  }, [sentNotifications]);

  // 개별 선택용 회원 필터링
  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== 'ALL' && m.role !== roleFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.nickname.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q)
      );
    });
  }, [members, memberSearch, roleFilter]);

  // 강의별 수강자 명단 계산
  const memberByIdMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  );

  const studentCountsByCourse = useMemo(() => {
    const map = new Map<string, number>();
    const seen = new Set<string>();
    for (const e of enrollments) {
      const key = `${e.course_id}:${e.user_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      map.set(e.course_id, (map.get(e.course_id) || 0) + 1);
    }
    return map;
  }, [enrollments]);

  const filteredStudentCourses = useMemo(() => {
    const q = studentCourseSearch.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.instructor || '').toLowerCase().includes(q)
    );
  }, [courses, studentCourseSearch]);

  const courseStudentsList = useMemo(() => {
    if (!studentCourseId) return [];
    const seen = new Set<string>();
    const rows: Array<{
      member: AdminNotificationMember;
      isActive: boolean;
      expiresAt: string | null;
    }> = [];

    for (const e of enrollments) {
      if (e.course_id !== studentCourseId) continue;
      if (seen.has(e.user_id)) continue;
      const m = memberByIdMap.get(e.user_id);
      if (!m) continue;
      if (studentStatusFilter === 'active' && !e.is_active) continue;
      if (studentStatusFilter === 'expired' && e.is_active) continue;

      if (studentMemberSearch.trim()) {
        const q = studentMemberSearch.trim().toLowerCase();
        const hit =
          m.name.toLowerCase().includes(q) ||
          m.nickname.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.phone.toLowerCase().includes(q);
        if (!hit) continue;
      }

      seen.add(e.user_id);
      rows.push({
        member: m,
        isActive: e.is_active,
        expiresAt: e.expires_at,
      });
    }
    return rows;
  }, [studentCourseId, enrollments, memberByIdMap, studentStatusFilter, studentMemberSearch]);

  // 다량 텍스트 붙여넣기 매칭
  const bulkMatch = useMemo(() => {
    const tokens = bulkPasteText
      .split(/[\n,\t; ]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      return { matchedMembers: [] as AdminNotificationMember[], unmatchedTokens: [] as string[] };
    }

    const emailMap = new Map<string, AdminNotificationMember>();
    const phoneMap = new Map<string, AdminNotificationMember>();
    for (const m of members) {
      if (m.email) emailMap.set(m.email.trim().toLowerCase(), m);
      const normP = normalizePhone(m.phone);
      if (normP.length >= 9) phoneMap.set(normP, m);
    }

    const matchedById = new Map<string, AdminNotificationMember>();
    const unmatchedTokens: string[] = [];

    for (const token of tokens) {
      const lower = token.toLowerCase();
      const normP = normalizePhone(token);
      const found = emailMap.get(lower) || (normP.length >= 9 ? phoneMap.get(normP) : undefined);
      if (found) {
        matchedById.set(found.id, found);
      } else {
        unmatchedTokens.push(token);
      }
    }

    return {
      matchedMembers: Array.from(matchedById.values()),
      unmatchedTokens,
    };
  }, [bulkPasteText, members]);

  const resolvedRecipientCount = useMemo(() => {
    if (targetMode === 'all_members') return members.length;
    if (targetMode === 'bulk_paste') return bulkMatch.matchedMembers.length;
    if (targetMode === 'course_students') return selectedCourseStudentIds.size;
    return selectedUserIds.size;
  }, [
    targetMode,
    members.length,
    bulkMatch.matchedMembers.length,
    selectedCourseStudentIds.size,
    selectedUserIds.size,
  ]);

  const resolvedLink = linkPreset === 'CUSTOM' ? customLink.trim() : linkPreset;

  const handleOpenConfirm = () => {
    if (composeMode === 'existing_notice') {
      if (!selectedNoticeObj) {
        toast.error('불러올 공지사항을 선택해 주세요.');
        return;
      }
    } else {
      if (!title.trim()) {
        toast.error('알림 제목을 입력해 주세요.');
        return;
      }
      if (!message.trim()) {
        toast.error('알림 상세 본문 내용을 입력해 주세요.');
        return;
      }
    }

    if (targetMode !== 'all_members' && resolvedRecipientCount === 0) {
      toast.error('알림을 받을 대상 회원을 1명 이상 지정해 주세요.');
      return;
    }

    setConfirmSendOpen(true);
  };

  const handleExecuteSend = async () => {
    try {
      setSubmitting(true);

      const userIds =
        targetMode === 'bulk_paste'
          ? bulkMatch.matchedMembers.map((m) => m.id)
          : targetMode === 'course_students'
            ? Array.from(selectedCourseStudentIds)
            : Array.from(selectedUserIds);

      const selectedCourseTitle = courses.find((c) => c.id === studentCourseId)?.title || '선택 강의';
      const targetLabel =
        targetMode === 'all_members'
          ? `전체 회원 (${members.length.toLocaleString()}명)`
          : targetMode === 'course_students'
            ? `'${selectedCourseTitle}' 수강생 (${userIds.length.toLocaleString()}명)`
            : targetMode === 'bulk_paste'
              ? `다량 명단 매칭 (${userIds.length.toLocaleString()}명)`
              : userIds.length === 1
                ? '개별 회원 지정 발송'
                : `선택 회원 (${userIds.length.toLocaleString()}명)`;

      if (composeMode === 'existing_notice' && selectedNoticeObj) {
        const finalTitle =
          title.trim() ||
          (selectedNoticeObj.title.startsWith('[공지')
            ? selectedNoticeObj.title
            : `[공지사항] ${selectedNoticeObj.title}`);

        const res = await notificationService.sendAdminNotification({
          category: 'notice',
          targetMode: targetMode === 'all_members' ? 'all_members' : 'selected',
          userIds: targetMode === 'all_members' ? undefined : userIds,
          targetLabel,
          title: finalTitle,
          summary: summary.trim() || selectedNoticeObj.plainPreview,
          message: message.trim() || selectedNoticeObj.plainPreview || selectedNoticeObj.title,
          htmlContent: selectedNoticeObj.content,
          link: resolvedLink || '/support/notice',
          linkLabel: linkLabel.trim() || '공지사항 게시판 바로가기',
          senderName: senderName.trim() || '비원아카데미 운영팀',
          noticeId: selectedNoticeObj.id,
        });
        toast.success(res.message);
      } else {
        const res = await notificationService.sendAdminNotification({
          category: composeMode === 'global_notice' ? 'notice' : 'admin_message',
          targetMode: targetMode === 'all_members' ? 'all_members' : 'selected',
          userIds: targetMode === 'all_members' ? undefined : userIds,
          targetLabel,
          title: title.trim(),
          summary: summary.trim() || undefined,
          message: message.trim(),
          link: resolvedLink || undefined,
          linkLabel: linkLabel.trim() || undefined,
          senderName: senderName.trim() || '비원아카데미 운영팀',
        });
        toast.success(res.message);
      }

      setConfirmSendOpen(false);
      setTitle('');
      setSummary('');
      setMessage('');
      setSelectedUserIds(new Set());
      setBulkPasteText('');
      await loadDashboard(true);
      setActiveTab('history');
    } catch (err: any) {
      toast.error(err?.message || '알림 푸시 발송 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNotifications = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      setSubmitting(true);
      const res = await notificationService.deleteAdminNotifications(ids);
      toast.success(res.message);
      setDeleteTargetIds([]);
      if (previewRecord && ids.includes(previewRecord.id)) {
        setPreviewRecord(null);
      }
      await loadDashboard(true);
    } catch (err: any) {
      toast.error(err?.message || '알림 회수 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return sentNotifications.filter((n) => {
      if (historyCategoryFilter !== 'ALL' && n.category !== historyCategoryFilter) {
        return false;
      }
      if (!q) return true;
      const hay = `${n.title} ${n.summary} ${n.message} ${n.recipientLabel}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sentNotifications, historySearch, historyCategoryFilter]);

  const toggleIdInSet = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-8 text-left">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            알림 · 푸시 통합 관리
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            전체 회원 공지사항 푸시, 강의 수강생 맞춤 안내 발송 및 1:1 문의·쿠폰·마일리지 알림 발송 현황을 관리합니다.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => loadDashboard()}
          disabled={loading}
          className="h-10 px-4 rounded-lg border-slate-200 font-bold text-slate-700 gap-2 self-start md:self-auto whitespace-nowrap"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          데이터 새로고침
        </Button>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4">
          <p className="text-xs font-bold text-slate-500">누적 발송 알림</p>
          <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
            {stats.totalSent.toLocaleString()}건
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4">
          <p className="text-xs font-bold text-slate-500">공지사항 푸시</p>
          <p className="text-2xl font-black text-purple-600 mt-1 tabular-nums">
            {stats.noticeCount.toLocaleString()}건
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4">
          <p className="text-xs font-bold text-slate-500">1:1 문의 답변 알림</p>
          <p className="text-2xl font-black text-blue-600 mt-1 tabular-nums">
            {stats.inquiryCount.toLocaleString()}건
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4">
          <p className="text-xs font-bold text-slate-500">쿠폰 · 마일리지 알림</p>
          <p className="text-2xl font-black text-emerald-600 mt-1 tabular-nums">
            {stats.benefitCount.toLocaleString()}건
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 col-span-2 lg:col-span-1">
          <p className="text-xs font-bold text-slate-500">누적 회원 열람 수</p>
          <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
            {stats.totalReads.toLocaleString()}회
          </p>
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('compose')}
          className={`px-4 py-2.5 rounded-lg font-black text-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'compose'
              ? 'bg-purple-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Send className="w-4 h-4" />
          1. 맞춤 알림 · 공지사항 푸시 발송
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 rounded-lg font-black text-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-purple-600 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Bell className="w-4 h-4" />
          2. 발송 알림 내역 · 열람 현황 ({sentNotifications.length.toLocaleString()})
        </button>
      </div>

      {/* TAB 1: COMPOSE & PUSH */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left 6 Cols: Notification Type & Content Editor */}
          <div className="xl:col-span-6 bg-white rounded-xl border border-slate-200/80 p-6 space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900">알림 종류 및 상세 내용 작성</h2>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                작성한 전문 내용은 회원의 전용 [알림 센터] 상세 페이지에서 글자 수 제한 없이 그대로 노출됩니다.
              </p>
            </div>

            {/* Compose Mode Selector */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block">발송할 알림 유형 선택</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectComposeMode('global_notice')}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    composeMode === 'global_notice'
                      ? 'border-purple-600 bg-purple-50/60'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-black text-xs text-slate-900">
                    <Megaphone className="w-3.5 h-3.5 text-purple-600" />
                    <span>공지사항 알림 작성</span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">
                    새 공지 알림을 직접 작성해 푸시
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectComposeMode('existing_notice')}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    composeMode === 'existing_notice'
                      ? 'border-purple-600 bg-purple-50/60'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-black text-xs text-slate-900">
                    <Bell className="w-3.5 h-3.5 text-purple-600" />
                    <span>등록 공지 불러오기</span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">
                    게시판 공지 원문(HTML) 그대로 푸시
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectComposeMode('custom_message')}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    composeMode === 'custom_message'
                      ? 'border-purple-600 bg-purple-50/60'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-black text-xs text-slate-900">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    <span>관리자 맞춤 안내</span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">
                    수강 안내 · 이벤트 · 개별 메시지
                  </p>
                </button>
              </div>
            </div>

            {/* Existing Notice Picker */}
            {composeMode === 'existing_notice' && (
              <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <label className="text-xs font-black text-slate-800 block">
                  불러올 등록 공지사항 선택 ({notices.length}건)
                </label>
                {notices.length === 0 ? (
                  <p className="text-xs font-bold text-slate-500">
                    현재 등록된 공지사항이 없습니다. [게시판 및 내역 관리]에서 공지사항을 먼저 등록하거나 직접 작성 모드를 이용해 주세요.
                  </p>
                ) : (
                  <select
                    value={selectedNoticeId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedNoticeId(nextId);
                      const found = notices.find((n) => n.id === nextId);
                      if (found) {
                        setTitle(
                          found.title.startsWith('[공지')
                            ? found.title
                            : `[공지사항] ${found.title}`
                        );
                        setMessage(found.plainPreview || found.title);
                      }
                    }}
                    className="w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
                  >
                    {notices.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.title} ({new Date(n.created_at).toLocaleDateString('ko-KR')})
                      </option>
                    ))}
                  </select>
                )}
                {selectedNoticeObj && (
                  <p className="text-[11px] font-semibold text-purple-700">
                    선택한 공지의 본문(이미지·서식 포함 전문)이 회원 알림 상세 페이지에 그대로 표시됩니다.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-black text-slate-700 block">알림 제목 *</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    composeMode === 'custom_message'
                      ? '예: [수강 안내] 정규 강의 줌(Zoom) 접속 링크 및 사전 준비물 안내'
                      : '예: [공지사항] 시스템 정기 점검 및 신규 특강 오픈 안내'
                  }
                  className="h-11 rounded-lg border-slate-200 text-sm font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">발송자 표기명</label>
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="비원아카데미 운영팀"
                  className="h-10 rounded-lg border-slate-200 text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  한 줄 요약 (드롭다운 미리보기 · 선택)
                </label>
                <Input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="미입력 시 본문 앞부분으로 자동 생성"
                  className="h-10 rounded-lg border-slate-200 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 block">
                {composeMode === 'existing_notice'
                  ? '알림 요약 문구 (상세 화면에는 선택한 공지 원문 전체가 함께 표시됩니다)'
                  : '알림 상세 본문 내용 * (글자 수 제한 없음)'}
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="회원님이 알림 클릭 시 별도 상세 페이지에서 읽게 될 전체 안내 내용을 자세히 작성해 주세요."
                className="min-h-[190px] rounded-xl border-slate-200 text-sm font-medium p-4 leading-relaxed"
              />
            </div>

            {/* Optional CTA Link Configuration */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="text-xs font-black text-slate-800 block">
                상세 페이지 하단 바로가기 버튼 설정 (선택)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={linkPreset}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLinkPreset(val);
                    const preset = LINK_PRESETS.find((p) => p.url === val);
                    if (preset && val !== 'CUSTOM') {
                      setLinkLabel(preset.btnText);
                    }
                  }}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
                >
                  {LINK_PRESETS.map((p) => (
                    <option key={p.label} value={p.url}>
                      {p.label}
                    </option>
                  ))}
                </select>

                {linkPreset !== '' && (
                  <Input
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="버튼 문구 (예: 자세히 보러가기)"
                    className="h-10 rounded-lg border-slate-200 bg-white text-xs font-bold"
                  />
                )}
              </div>

              {linkPreset === 'CUSTOM' && (
                <Input
                  value={customLink}
                  onChange={(e) => setCustomLink(e.target.value)}
                  placeholder="이동할 경로 입력 (예: /course/강의ID 또는 https://...)"
                  className="h-10 rounded-lg border-slate-200 bg-white text-xs font-semibold"
                />
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-600">현재 선택된 푸시 수신 대상</span>
                <span className="font-black text-purple-600 text-lg tabular-nums">
                  {targetMode === 'all_members'
                    ? `전체 회원 (${members.length.toLocaleString()}명)`
                    : `총 ${resolvedRecipientCount.toLocaleString()}명`}
                </span>
              </div>
              <Button
                type="button"
                disabled={submitting || resolvedRecipientCount === 0}
                onClick={handleOpenConfirm}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl text-sm gap-2 whitespace-nowrap"
              >
                <Send className="w-4 h-4" />
                실시간 알림 푸시 발송하기
              </Button>
            </div>
          </div>

          {/* Right 6 Cols: Recipient Selector */}
          <div className="xl:col-span-6 bg-white rounded-xl border border-slate-200/80 p-6 space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900">푸시 수신 대상 회원 지정</h2>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                전체 회원 일괄 공지부터 특정 강의 수강생, 개별 회원, 다량 명단까지 자유롭게 지정할 수 있습니다.
              </p>

              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {[
                  { id: 'all_members', label: '전체 회원 일괄', icon: Megaphone },
                  { id: 'selected', label: '개별 · 선택 회원', icon: Users },
                  { id: 'course_students', label: '강의 수강자', icon: GraduationCap },
                  { id: 'bulk_paste', label: '다량 명단 붙여넣기', icon: FileSpreadsheet },
                ].map((tab) => {
                  const TabIcon = tab.icon;
                  const active = targetMode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTargetMode(tab.id as TargetSelectionMode)}
                      className={`px-3 py-2 rounded-lg text-xs font-black flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      <TabIcon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode A: All Members */}
            {targetMode === 'all_members' && (
              <div className="p-6 rounded-xl bg-purple-50/50 border border-purple-200/80 space-y-3">
                <div className="flex items-center gap-2 text-purple-700 font-black text-sm">
                  <Megaphone className="w-5 h-5" />
                  <span>전체 가입 회원 일괄 브로드캐스트</span>
                </div>
                <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                  현재 활동 중인 전체 회원(<strong className="font-black tabular-nums">{members.length.toLocaleString()}명</strong>)의 상단 종 모양 알림창과 전용 알림 센터 페이지에 즉시 노출됩니다.
                </p>
              </div>
            )}

            {/* Mode B: Selected Individual Members */}
            {targetMode === 'selected' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="이름, 닉네임, 이메일, 연락처 검색"
                      className="h-10 pl-9 text-xs font-semibold rounded-lg border-slate-200"
                    />
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 bg-white"
                  >
                    <option value="ALL">전체 등급</option>
                    <option value="user">일반회원</option>
                    <option value="beone_member">비원회원</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500">
                    검색 결과 {filteredMembers.length.toLocaleString()}명 · 선택됨{' '}
                    <strong className="text-purple-600 tabular-nums">{selectedUserIds.size}명</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedUserIds((prev) => {
                          const next = new Set(prev);
                          filteredMembers.forEach((m) => next.add(m.id));
                          return next;
                        })
                      }
                      className="font-extrabold text-purple-600 hover:underline cursor-pointer"
                    >
                      검색결과 전체선택
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedUserIds(new Set())}
                      className="font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      선택해제
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                  {filteredMembers.slice(0, 250).map((m) => {
                    const checked = selectedUserIds.has(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer text-xs ${
                          checked ? 'bg-purple-50/50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleIdInSet(m.id, setSelectedUserIds)}
                            className="w-4 h-4 accent-purple-600 rounded"
                          />
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 truncate">
                              {m.name || m.nickname || '회원'}{' '}
                              {m.nickname && m.name && (
                                <span className="text-slate-400 font-semibold">({m.nickname})</span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">{m.email}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold rounded-md shrink-0">
                          {ROLE_LABELS[m.role] || m.role}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mode C: Course Students */}
            {targetMode === 'course_students' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 block">대상 강의 선택</label>
                  <Input
                    value={studentCourseSearch}
                    onChange={(e) => setStudentCourseSearch(e.target.value)}
                    placeholder="강의명 또는 강사명 검색..."
                    className="h-9 text-xs font-semibold rounded-lg border-slate-200"
                  />
                  <select
                    value={studentCourseId}
                    onChange={(e) => {
                      const cId = e.target.value;
                      setStudentCourseId(cId);
                      const ids = enrollments
                        .filter((enr) => {
                          if (enr.course_id !== cId) return false;
                          if (studentStatusFilter === 'active') return enr.is_active;
                          if (studentStatusFilter === 'expired') return !enr.is_active;
                          return true;
                        })
                        .map((enr) => enr.user_id);
                      setSelectedCourseStudentIds(new Set(ids));
                    }}
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-800 bg-white"
                  >
                    {filteredStudentCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} (수강생 {studentCountsByCourse.get(c.id) || 0}명)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {(
                      [
                        { id: 'all', label: '전체 이력' },
                        { id: 'active', label: '현재 수강 중' },
                        { id: 'expired', label: '수강 만료' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setStudentStatusFilter(st.id);
                          const ids = enrollments
                            .filter((enr) => {
                              if (enr.course_id !== studentCourseId) return false;
                              if (st.id === 'active') return enr.is_active;
                              if (st.id === 'expired') return !enr.is_active;
                              return true;
                            })
                            .map((enr) => enr.user_id);
                          setSelectedCourseStudentIds(new Set(ids));
                        }}
                        className={`px-2.5 py-1.5 rounded-md text-[11px] font-extrabold cursor-pointer ${
                          studentStatusFilter === st.id
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCourseStudentIds(new Set(courseStudentsList.map((r) => r.member.id)))
                      }
                      className="font-extrabold text-purple-600 hover:underline cursor-pointer"
                    >
                      전체선택
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCourseStudentIds(new Set())}
                      className="font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      선택해제
                    </button>
                  </div>
                </div>

                <Input
                  value={studentMemberSearch}
                  onChange={(e) => setStudentMemberSearch(e.target.value)}
                  placeholder="수강생 이름·이메일 내 검색..."
                  className="h-9 text-xs font-semibold rounded-lg border-slate-200"
                />

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
                  {courseStudentsList.length === 0 ? (
                    <div className="py-12 text-center text-xs font-bold text-slate-400">
                      조건에 해당하는 수강생이 없습니다.
                    </div>
                  ) : (
                    courseStudentsList.map(({ member: m, isActive }) => {
                      const checked = selectedCourseStudentIds.has(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer text-xs ${
                            checked ? 'bg-purple-50/50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleIdInSet(m.id, setSelectedCourseStudentIds)}
                              className="w-4 h-4 accent-purple-600 rounded"
                            />
                            <div className="min-w-0">
                              <p className="font-extrabold text-slate-900 truncate">
                                {m.name || m.nickname || '회원'}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">{m.email}</p>
                            </div>
                          </div>
                          <Badge
                            className={
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 text-[10px]'
                                : 'bg-slate-100 text-slate-500 text-[10px]'
                            }
                          >
                            {isActive ? '수강중' : '만료'}
                          </Badge>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Mode D: Bulk Paste */}
            {targetMode === 'bulk_paste' && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-600">
                  엑셀이나 명단에서 <strong>이메일</strong> 또는 <strong>휴대폰 번호</strong>를 복사해 붙여넣으면 회원 DB와 자동 매칭됩니다.
                </p>
                <Textarea
                  value={bulkPasteText}
                  onChange={(e) => setBulkPasteText(e.target.value)}
                  placeholder={'user1@example.com\n010-1234-5678\nuser2@example.com'}
                  className="min-h-[180px] rounded-xl border-slate-200 text-xs font-mono p-3"
                />
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600">매칭된 유효 회원 수</span>
                  <span className="text-purple-700 font-black tabular-nums">
                    {bulkMatch.matchedMembers.length.toLocaleString()}명
                    {bulkMatch.unmatchedTokens.length > 0 && (
                      <span className="text-rose-500 ml-2">
                        (미일치 {bulkMatch.unmatchedTokens.length}건 제외)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SENT HISTORY & READ ANALYTICS */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'ALL', label: '전체 내역' },
                { id: 'notice', label: '공지사항' },
                { id: 'inquiry_reply', label: '1:1 문의 답변' },
                { id: 'coupon_issued', label: '쿠폰 발급' },
                { id: 'mileage_issued', label: '마일리지' },
                { id: 'admin_message', label: '관리자 안내' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setHistoryCategoryFilter(cat.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer ${
                    historyCategoryFilter === cat.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="알림 제목, 내용, 수신대상 검색"
                className="h-10 pl-9 text-xs font-semibold rounded-lg border-slate-200"
              />
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center gap-2.5 text-slate-400">
              <Inbox className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-black text-slate-700">발송된 알림 내역이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-extrabold bg-slate-50/70">
                    <th className="py-3 px-4 whitespace-nowrap">분류</th>
                    <th className="py-3 px-4">알림 제목 · 요약</th>
                    <th className="py-3 px-4 whitespace-nowrap">수신 대상</th>
                    <th className="py-3 px-4 whitespace-nowrap">열람 현황</th>
                    <th className="py-3 px-4 whitespace-nowrap">발송 일시</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge variant="outline" className="font-extrabold text-[11px] rounded-md">
                          {getNotificationCategoryLabel(item.category)}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 max-w-md">
                        <p className="font-black text-slate-900 text-sm truncate">{item.title}</p>
                        <p className="text-slate-500 font-medium truncate mt-0.5">{item.summary}</p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-slate-700">
                        {item.recipientLabel}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap tabular-nums">
                        <span className="font-black text-purple-700">
                          {item.readCount.toLocaleString()}명 열람
                        </span>
                        <span className="text-slate-400 font-semibold ml-1">
                          / {item.targetCount.toLocaleString()}명
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-medium tabular-nums">
                        {formatDateTime(item.created_at)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewRecord(item)}
                            className="h-8 px-2.5 rounded-lg border-slate-200 font-bold text-xs gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> 상세보기
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTargetIds([item.id])}
                            className="h-8 px-2.5 rounded-lg text-rose-600 hover:bg-rose-50 font-bold text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 발송 최종 확인 모달 */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent className="rounded-xl max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              알림 푸시 발송 확인
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500">
              발송 즉시 대상 회원의 알림 아이콘 및 알림 센터에 실시간 반영됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <span className="font-bold text-slate-500">발송 구분</span>
              <span className="font-black text-slate-900">
                {composeMode === 'custom_message' ? '관리자 맞춤 안내' : '공지사항 알림'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="font-bold text-slate-500">수신 인원</span>
              <span className="font-black text-purple-600 tabular-nums">
                {targetMode === 'all_members'
                  ? `전체 회원 (${members.length.toLocaleString()}명)`
                  : `총 ${resolvedRecipientCount.toLocaleString()}명`}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 space-y-1">
              <span className="font-bold text-slate-500 block">알림 제목</span>
              <p className="font-black text-slate-900 text-sm">{title || selectedNoticeObj?.title}</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmSendOpen(false)}
              className="rounded-lg font-bold"
            >
              취소
            </Button>
            <Button
              disabled={submitting}
              onClick={handleExecuteSend}
              className="bg-purple-600 hover:bg-purple-700 text-white font-black rounded-lg gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? '푸시 발송 중...' : '지금 푸시 발송'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 발송 내역 상세 미리보기 모달 */}
      <Dialog open={!!previewRecord} onOpenChange={(open) => !open && setPreviewRecord(null)}>
        <DialogContent className="rounded-xl max-w-2xl bg-white max-h-[85vh] overflow-y-auto">
          {previewRecord && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs font-extrabold rounded-md">
                    {getNotificationCategoryLabel(previewRecord.category)}
                  </Badge>
                  <span className="text-xs font-semibold text-slate-400 tabular-nums">
                    {formatDateTime(previewRecord.created_at)}
                  </span>
                </div>
                <DialogTitle className="text-lg font-black text-slate-900 text-left">
                  {previewRecord.title}
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-500 text-left">
                  수신 대상: {previewRecord.recipientLabel} · 열람 {previewRecord.readCount.toLocaleString()}명
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 text-left space-y-4">
                {previewRecord.htmlContent ? (
                  <div
                    className="prose prose-slate max-w-none text-sm leading-relaxed break-words [&_img]:rounded-lg [&_img]:max-w-full"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtmlForPreview(previewRecord.htmlContent),
                    }}
                  />
                ) : (
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed break-words">
                    {previewRecord.message}
                  </p>
                )}

                {previewRecord.link && (
                  <div className="pt-3 border-t border-slate-200 flex items-center gap-2 text-xs font-bold text-purple-700">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>
                      연결 버튼: {previewRecord.linkLabel || '바로가기'} ({previewRecord.link})
                    </span>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPreviewRecord(null)}
                  className="rounded-lg font-bold"
                >
                  닫기
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 알림 회수(삭제) 확인 모달 */}
      <Dialog
        open={deleteTargetIds.length > 0}
        onOpenChange={(open) => !open && setDeleteTargetIds([])}
      >
        <DialogContent className="rounded-xl max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900">
              발송된 알림을 회수(삭제)하시겠습니까?
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-slate-500">
              회수 시 회원의 알림 목록과 상세 페이지에서 즉시 숨김 처리됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTargetIds([])}
              className="rounded-lg font-bold"
            >
              취소
            </Button>
            <Button
              disabled={submitting}
              onClick={() => handleDeleteNotifications(deleteTargetIds)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-black rounded-lg"
            >
              {submitting ? '회수 중...' : '알림 회수하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
