import React, { useEffect, useMemo, useState } from 'react';
import {
  Ticket,
  Coins,
  Plus,
  Search,
  Users,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  Edit2,
  Send,
  FileSpreadsheet,
  Upload,
  Clock,
  BookOpen,
  AlertCircle,
  RotateCcw,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  couponMileageService,
  CouponTemplate,
  AdminUserCouponRecord,
  AdminMileageLogRecord,
  AdminMemberSummary,
  AdminCourseOption,
  AdminEnrollmentRecord,
} from '@/services/couponMileageService';

type ActiveTab = 'templates' | 'issue-coupon' | 'coupon-ledger' | 'mileage';
type TargetSelectionMode = 'selected' | 'course_students' | 'bulk_paste' | 'all_members';
type CourseStudentStatusFilter = 'all' | 'active' | 'expired';

const DURATION_PRESETS = [3, 7, 14, 30, 60, 90];
const MILEAGE_PRESETS = [1000, 3000, 5000, 10000, 30000, 50000];

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

function formatDateTime(iso: string | null | undefined): string {
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

export default function CouponMileageManagement() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('templates');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [templates, setTemplates] = useState<CouponTemplate[]>([]);
  const [userCoupons, setUserCoupons] = useState<AdminUserCouponRecord[]>([]);
  const [mileageLogs, setMileageLogs] = useState<AdminMileageLogRecord[]>([]);
  const [courses, setCourses] = useState<AdminCourseOption[]>([]);
  const [members, setMembers] = useState<AdminMemberSummary[]>([]);
  const [enrollments, setEnrollments] = useState<AdminEnrollmentRecord[]>([]);

  // 1. 쿠폰 종류 생성/수정 상태
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tplCourseId, setTplCourseId] = useState<string>('');
  const [tplCourseSearch, setTplCourseSearch] = useState<string>('');
  const [tplName, setTplName] = useState<string>('');
  const [tplDurationDays, setTplDurationDays] = useState<string>('7');
  const [tplDescription, setTplDescription] = useState<string>('');

  // 2. 쿠폰 개별/대량 발행 상태
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [couponTargetMode, setCouponTargetMode] = useState<TargetSelectionMode>('selected');
  const [couponMemberSearch, setCouponMemberSearch] = useState<string>('');
  const [couponRoleFilter, setCouponRoleFilter] = useState<string>('ALL');
  const [selectedCouponUserIds, setSelectedCouponUserIds] = useState<Set<string>>(new Set());
  // 2-B. 쿠폰 - 강의 수강자 탭 상태
  const [couponStudentCourseId, setCouponStudentCourseId] = useState<string>('');
  const [couponStudentCourseSearch, setCouponStudentCourseSearch] = useState<string>('');
  const [couponStudentStatusFilter, setCouponStudentStatusFilter] = useState<CourseStudentStatusFilter>('all');
  const [couponStudentMemberSearch, setCouponStudentMemberSearch] = useState<string>('');
  const [selectedCouponCourseStudentIds, setSelectedCouponCourseStudentIds] = useState<Set<string>>(new Set());

  const [couponBulkPasteText, setCouponBulkPasteText] = useState<string>('');
  const [couponIssueMemo, setCouponIssueMemo] = useState<string>('');
  const [preventDuplicateUnused, setPreventDuplicateUnused] = useState<boolean>(true);
  const [confirmCouponModalOpen, setConfirmCouponModalOpen] = useState<boolean>(false);

  // 3. 쿠폰 발행/사용 내역 상태
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<'ALL' | 'available' | 'used' | 'revoked'>('ALL');
  const [selectedRevokeIds, setSelectedRevokeIds] = useState<Set<string>>(new Set());

  // 4. 마일리지 개별/대량 지급·차감 상태
  const [mileageAdjustType, setMileageAdjustType] = useState<'add' | 'subtract'>('add');
  const [mileageTargetMode, setMileageTargetMode] = useState<TargetSelectionMode>('selected');
  const [mileageMemberSearch, setMileageMemberSearch] = useState<string>('');
  const [mileageRoleFilter, setMileageRoleFilter] = useState<string>('ALL');
  const [selectedMileageUserIds, setSelectedMileageUserIds] = useState<Set<string>>(new Set());
  // 4-B. 마일리지 - 강의 수강자 탭 상태
  const [mileageStudentCourseId, setMileageStudentCourseId] = useState<string>('');
  const [mileageStudentCourseSearch, setMileageStudentCourseSearch] = useState<string>('');
  const [mileageStudentStatusFilter, setMileageStudentStatusFilter] = useState<CourseStudentStatusFilter>('all');
  const [mileageStudentMemberSearch, setMileageStudentMemberSearch] = useState<string>('');
  const [selectedMileageCourseStudentIds, setSelectedMileageCourseStudentIds] = useState<Set<string>>(new Set());

  const [mileageBulkPasteText, setMileageBulkPasteText] = useState<string>('');
  const [mileageAmount, setMileageAmount] = useState<string>('5000');
  const [mileageReason, setMileageReason] = useState<string>('');
  const [mileageLogSearch, setMileageLogSearch] = useState<string>('');
  const [confirmMileageModalOpen, setConfirmMileageModalOpen] = useState<boolean>(false);
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState<CouponTemplate | null>(null);
  const [pendingRevokeIds, setPendingRevokeIds] = useState<string[]>([]);

  const loadDashboard = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await couponMileageService.getAdminDashboardData();
      setTemplates(data.templates);
      setUserCoupons(data.userCoupons);
      setMileageLogs(data.mileageLogs);
      setCourses(data.courses);
      setMembers(data.members);
      setEnrollments(data.enrollments);

      if (!tplCourseId && data.courses.length > 0) {
        setTplCourseId(data.courses[0].id);
      }
      if (!couponStudentCourseId && data.courses.length > 0) {
        const courseWithStudents =
          data.courses.find((c) => data.enrollments.some((e) => e.course_id === c.id)) ||
          data.courses[0];
        if (courseWithStudents) {
          setCouponStudentCourseId(courseWithStudents.id);
          const initialIds = data.enrollments
            .filter((e) => e.course_id === courseWithStudents.id)
            .map((e) => e.user_id);
          setSelectedCouponCourseStudentIds(new Set(initialIds));
        }
      }
      if (!mileageStudentCourseId && data.courses.length > 0) {
        const courseWithStudents =
          data.courses.find((c) => data.enrollments.some((e) => e.course_id === c.id)) ||
          data.courses[0];
        if (courseWithStudents) {
          setMileageStudentCourseId(courseWithStudents.id);
          const initialIds = data.enrollments
            .filter((e) => e.course_id === courseWithStudents.id)
            .map((e) => e.user_id);
          setSelectedMileageCourseStudentIds(new Set(initialIds));
        }
      }
      if (!selectedTemplateId && data.templates.length > 0) {
        const firstActive = data.templates.find((t) => t.active) || data.templates[0];
        if (firstActive) setSelectedTemplateId(firstActive.id);
      }
    } catch (err: any) {
      toast.error(err.message || '쿠폰/마일리지 관리 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // 통계 지표 계산
  const stats = useMemo(() => {
    const activeTemplates = templates.filter((t) => t.active).length;
    const validIssued = userCoupons.filter((c) => c.status !== 'revoked').length;
    const availableCount = userCoupons.filter((c) => c.status === 'available').length;
    const usedCount = userCoupons.filter((c) => c.status === 'used').length;
    const totalMileage = members.reduce((acc, m) => acc + (Number(m.mileage) || 0), 0);
    return {
      activeTemplates,
      totalTemplates: templates.length,
      validIssued,
      availableCount,
      usedCount,
      totalMileage,
    };
  }, [templates, userCoupons, members]);

  // 강의 필터링 (쿠폰 종류 생성 폼용)
  const filteredCoursesForForm = useMemo(() => {
    const q = tplCourseSearch.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.instructor || '').toLowerCase().includes(q)
    );
  }, [courses, tplCourseSearch]);

  // 다량 텍스트 붙여넣기 매칭 엔진 (이메일 또는 전화번호 기준)
  const parseBulkTargets = (rawText: string) => {
    const tokens = rawText
      .split(/[\n,\t; ]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      return { matchedMembers: [] as AdminMemberSummary[], unmatchedTokens: [] as string[] };
    }

    const emailMap = new Map<string, AdminMemberSummary>();
    const phoneMap = new Map<string, AdminMemberSummary>();

    for (const m of members) {
      if (m.email) emailMap.set(m.email.trim().toLowerCase(), m);
      const normPhone = normalizePhone(m.phone);
      if (normPhone.length >= 9) phoneMap.set(normPhone, m);
    }

    const matchedById = new Map<string, AdminMemberSummary>();
    const unmatchedTokens: string[] = [];

    for (const token of tokens) {
      const lower = token.toLowerCase();
      const normP = normalizePhone(token);
      const byEmail = emailMap.get(lower);
      const byPhone = normP.length >= 9 ? phoneMap.get(normP) : undefined;
      const found = byEmail || byPhone;
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
  };

  const couponBulkMatch = useMemo(
    () => parseBulkTargets(couponBulkPasteText),
    [couponBulkPasteText, members]
  );

  const mileageBulkMatch = useMemo(
    () => parseBulkTargets(mileageBulkPasteText),
    [mileageBulkPasteText, members]
  );

  // 회원 빠른 조회 맵 및 강의별 수강생 집계
  const memberById = useMemo(() => {
    const map = new Map<string, AdminMemberSummary>();
    for (const m of members) map.set(m.id, m);
    return map;
  }, [members]);

  const courseEnrollmentSummaryMap = useMemo(() => {
    const summary = new Map<
      string,
      { total: number; active: number; expired: number; rowsByUser: Map<string, AdminEnrollmentRecord> }
    >();

    for (const enr of enrollments) {
      if (!memberById.has(enr.user_id)) continue;
      let bucket = summary.get(enr.course_id);
      if (!bucket) {
        bucket = { total: 0, active: 0, expired: 0, rowsByUser: new Map() };
        summary.set(enr.course_id, bucket);
      }
      const existing = bucket.rowsByUser.get(enr.user_id);
      if (!existing || (!existing.is_active && enr.is_active)) {
        bucket.rowsByUser.set(enr.user_id, enr);
      }
    }

    for (const bucket of summary.values()) {
      bucket.total = bucket.rowsByUser.size;
      let activeCnt = 0;
      for (const r of bucket.rowsByUser.values()) {
        if (r.is_active) activeCnt++;
      }
      bucket.active = activeCnt;
      bucket.expired = bucket.total - activeCnt;
    }

    return summary;
  }, [enrollments, memberById]);

  const getStudentsForCourse = (
    courseId: string,
    statusFilter: CourseStudentStatusFilter,
    searchText: string
  ) => {
    const bucket = courseEnrollmentSummaryMap.get(courseId);
    if (!bucket) return [] as Array<{ member: AdminMemberSummary; enrollment: AdminEnrollmentRecord }>;

    const q = searchText.trim().toLowerCase();
    const list: Array<{ member: AdminMemberSummary; enrollment: AdminEnrollmentRecord }> = [];

    for (const [userId, enr] of bucket.rowsByUser.entries()) {
      if (statusFilter === 'active' && !enr.is_active) continue;
      if (statusFilter === 'expired' && enr.is_active) continue;
      const member = memberById.get(userId);
      if (!member) continue;
      if (q) {
        const hit =
          member.name.toLowerCase().includes(q) ||
          member.nickname.toLowerCase().includes(q) ||
          member.email.toLowerCase().includes(q) ||
          member.phone.toLowerCase().includes(q);
        if (!hit) continue;
      }
      list.push({ member, enrollment: enr });
    }

    return list;
  };

  const couponCourseDropdownOptions = useMemo(() => {
    const q = couponStudentCourseSearch.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.instructor || '').toLowerCase().includes(q)
    );
  }, [courses, couponStudentCourseSearch]);

  const mileageCourseDropdownOptions = useMemo(() => {
    const q = mileageStudentCourseSearch.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.instructor || '').toLowerCase().includes(q)
    );
  }, [courses, mileageStudentCourseSearch]);

  const filteredCouponCourseStudents = useMemo(
    () =>
      getStudentsForCourse(
        couponStudentCourseId,
        couponStudentStatusFilter,
        couponStudentMemberSearch
      ),
    [
      couponStudentCourseId,
      couponStudentStatusFilter,
      couponStudentMemberSearch,
      courseEnrollmentSummaryMap,
      memberById,
    ]
  );

  const filteredMileageCourseStudents = useMemo(
    () =>
      getStudentsForCourse(
        mileageStudentCourseId,
        mileageStudentStatusFilter,
        mileageStudentMemberSearch
      ),
    [
      mileageStudentCourseId,
      mileageStudentStatusFilter,
      mileageStudentMemberSearch,
      courseEnrollmentSummaryMap,
      memberById,
    ]
  );

  const handleChangeCouponStudentCourse = (
    nextCourseId: string,
    nextStatus: CourseStudentStatusFilter = couponStudentStatusFilter
  ) => {
    setCouponStudentCourseId(nextCourseId);
    setCouponStudentStatusFilter(nextStatus);
    const matching = getStudentsForCourse(nextCourseId, nextStatus, '');
    setSelectedCouponCourseStudentIds(new Set(matching.map((x) => x.member.id)));
  };

  const handleChangeMileageStudentCourse = (
    nextCourseId: string,
    nextStatus: CourseStudentStatusFilter = mileageStudentStatusFilter
  ) => {
    setMileageStudentCourseId(nextCourseId);
    setMileageStudentStatusFilter(nextStatus);
    const matching = getStudentsForCourse(nextCourseId, nextStatus, '');
    setSelectedMileageCourseStudentIds(new Set(matching.map((x) => x.member.id)));
  };

  // 회원 필터링 (쿠폰 발급 탭)
  const filteredMembersForCoupon = useMemo(() => {
    const q = couponMemberSearch.trim().toLowerCase();
    return members.filter((m) => {
      if (couponRoleFilter !== 'ALL' && m.role !== couponRoleFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.nickname.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q)
      );
    });
  }, [members, couponMemberSearch, couponRoleFilter]);

  // 회원 필터링 (마일리지 지급 탭)
  const filteredMembersForMileage = useMemo(() => {
    const q = mileageMemberSearch.trim().toLowerCase();
    return members.filter((m) => {
      if (mileageRoleFilter !== 'ALL' && m.role !== mileageRoleFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.nickname.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q)
      );
    });
  }, [members, mileageMemberSearch, mileageRoleFilter]);

  // 쿠폰 내역 필터링
  const filteredUserCoupons = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase();
    return userCoupons.filter((c) => {
      if (ledgerStatusFilter !== 'ALL' && c.status !== ledgerStatusFilter) return false;
      if (!q) return true;
      return (
        c.user_name.toLowerCase().includes(q) ||
        c.user_email.toLowerCase().includes(q) ||
        c.coupon_name.toLowerCase().includes(q) ||
        c.course_title.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    });
  }, [userCoupons, ledgerSearch, ledgerStatusFilter]);

  // 마일리지 로그 필터링
  const filteredMileageLogs = useMemo(() => {
    const q = mileageLogSearch.trim().toLowerCase();
    if (!q) return mileageLogs;
    return mileageLogs.filter(
      (l) =>
        l.user_name.toLowerCase().includes(q) ||
        l.user_email.toLowerCase().includes(q) ||
        l.reason.toLowerCase().includes(q)
    );
  }, [mileageLogs, mileageLogSearch]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  // CSV / TXT 파일에서 이메일·연락처 텍스트 읽어오기
  const handleTextFileImport = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      setter((prev) => (prev ? `${prev}\n${content}` : content));
      toast.success(`'${file.name}' 명단 데이터를 불러왔습니다.`);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  // 쿠폰 종류 생성 또는 수정 저장
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = Math.floor(Number(tplDurationDays));
    const targetCourse = courses.find((c) => c.id === tplCourseId);

    if (!tplCourseId || !targetCourse) {
      toast.error('무료 수강을 적용할 대상 강의를 선택해 주세요.');
      return;
    }
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      toast.error('수강 기간은 1일 이상 3,650일 이하로 입력해 주세요.');
      return;
    }

    const finalName =
      tplName.trim() || `${targetCourse.title} ${days}일 무료 수강 쿠폰`;

    try {
      setSubmitting(true);
      if (editingTemplateId) {
        const res = await couponMileageService.updateCouponTemplate({
          templateId: editingTemplateId,
          name: finalName,
          courseId: tplCourseId,
          durationDays: days,
          description: tplDescription,
        });
        toast.success(res.message || '쿠폰 종류가 수정되었습니다.');
      } else {
        const res = await couponMileageService.createCouponTemplate({
          name: finalName,
          courseId: tplCourseId,
          durationDays: days,
          description: tplDescription,
        });
        toast.success(res.message || '새 무료 수강 쿠폰 종류가 생성되었습니다.');
        if (res.templateId) setSelectedTemplateId(res.templateId);
      }

      setEditingTemplateId(null);
      setTplName('');
      setTplDurationDays('7');
      setTplDescription('');
      await loadDashboard(true);
    } catch (err: any) {
      toast.error(err.message || '쿠폰 종류 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEditTemplate = (tpl: CouponTemplate) => {
    setEditingTemplateId(tpl.id);
    setTplCourseId(tpl.course_id);
    setTplName(tpl.name);
    setTplDurationDays(String(tpl.duration_days));
    setTplDescription(tpl.description || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleTemplateActive = async (tpl: CouponTemplate) => {
    try {
      await couponMileageService.updateCouponTemplate({
        templateId: tpl.id,
        active: !tpl.active,
      });
      toast.success(tpl.active ? '쿠폰 종류가 비활성화되었습니다.' : '쿠폰 종류가 활성화되었습니다.');
      await loadDashboard(true);
    } catch (err: any) {
      toast.error(err.message || '상태 변경에 실패했습니다.');
    }
  };

  const handleDeleteTemplate = async (tpl: CouponTemplate) => {
    try {
      setSubmitting(true);
      await couponMileageService.deleteCouponTemplate(tpl.id);
      toast.success('쿠폰 종류가 삭제되었습니다.');
      if (editingTemplateId === tpl.id) setEditingTemplateId(null);
      setPendingDeleteTemplate(null);
      await loadDashboard(true);
    } catch (err: any) {
      toast.error(err.message || '삭제 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 쿠폰 발행 대상 회원 수 계산
  const resolvedCouponRecipientCount = useMemo(() => {
    if (couponTargetMode === 'all_members') return members.length;
    if (couponTargetMode === 'bulk_paste') return couponBulkMatch.matchedMembers.length;
    if (couponTargetMode === 'course_students') return selectedCouponCourseStudentIds.size;
    return selectedCouponUserIds.size;
  }, [
    couponTargetMode,
    members.length,
    couponBulkMatch.matchedMembers.length,
    selectedCouponCourseStudentIds.size,
    selectedCouponUserIds.size,
  ]);

  // 실제 쿠폰 발행 실행
  const handleExecuteIssueCoupons = async () => {
    if (!selectedTemplate) {
      toast.error('발행할 쿠폰 종류를 먼저 선택해 주세요.');
      return;
    }

    const userIds =
      couponTargetMode === 'bulk_paste'
        ? couponBulkMatch.matchedMembers.map((m) => m.id)
        : couponTargetMode === 'course_students'
          ? Array.from(selectedCouponCourseStudentIds)
          : Array.from(selectedCouponUserIds);

    if (couponTargetMode !== 'all_members' && userIds.length === 0) {
      toast.error('쿠폰을 지급할 대상 회원이 없습니다.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await couponMileageService.issueCoupons({
        templateId: selectedTemplate.id,
        targetMode: couponTargetMode === 'all_members' ? 'all_members' : 'selected',
        userIds: couponTargetMode === 'all_members' ? undefined : userIds,
        issueMemo: couponIssueMemo,
        preventDuplicateUnused,
      });
      toast.success(res.message);
      setConfirmCouponModalOpen(false);
      setSelectedCouponUserIds(new Set());
      setCouponBulkPasteText('');
      setCouponIssueMemo('');
      await loadDashboard(true);
      setActiveTab('coupon-ledger');
    } catch (err: any) {
      toast.error(err.message || '쿠폰 발행 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 쿠폰 회수 처리
  const handleRevokeCoupons = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      setSubmitting(true);
      const res = await couponMileageService.revokeUserCoupons(ids);
      toast.success(res.message || '쿠폰 회수가 완료되었습니다.');
      setSelectedRevokeIds(new Set());
      setPendingRevokeIds([]);
      await loadDashboard(true);
    } catch (err: any) {
      toast.error(err.message || '쿠폰 회수에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 마일리지 지급 대상 회원 수 계산
  const resolvedMileageRecipientCount = useMemo(() => {
    if (mileageTargetMode === 'all_members') return members.length;
    if (mileageTargetMode === 'bulk_paste') return mileageBulkMatch.matchedMembers.length;
    if (mileageTargetMode === 'course_students') return selectedMileageCourseStudentIds.size;
    return selectedMileageUserIds.size;
  }, [
    mileageTargetMode,
    members.length,
    mileageBulkMatch.matchedMembers.length,
    selectedMileageCourseStudentIds.size,
    selectedMileageUserIds.size,
  ]);

  // 실제 마일리지 지급/차감 실행
  const handleExecuteIssueMileage = async () => {
    const parsedAmount = Math.floor(Number(mileageAmount));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('마일리지 수량을 1P 이상 입력해 주세요.');
      return;
    }

    const userIds =
      mileageTargetMode === 'bulk_paste'
        ? mileageBulkMatch.matchedMembers.map((m) => m.id)
        : mileageTargetMode === 'course_students'
          ? Array.from(selectedMileageCourseStudentIds)
          : Array.from(selectedMileageUserIds);

    if (mileageTargetMode !== 'all_members' && userIds.length === 0) {
      toast.error('마일리지를 지급/차감할 대상 회원을 선택해 주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await couponMileageService.issueMileage({
        targetMode: mileageTargetMode === 'all_members' ? 'all_members' : 'selected',
        userIds: mileageTargetMode === 'all_members' ? undefined : userIds,
        adjustType: mileageAdjustType,
        amount: parsedAmount,
        reason:
          mileageReason.trim() ||
          (mileageAdjustType === 'add' ? '관리자 마일리지 지급' : '관리자 마일리지 차감'),
      });
      toast.success(res.message);
      setConfirmMileageModalOpen(false);
      setSelectedMileageUserIds(new Set());
      setMileageBulkPasteText('');
      setMileageReason('');
      await loadDashboard(true);
    } catch (err: any) {
      toast.error(err.message || '마일리지 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserInSet = (
    userId: string,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  return (
    <div className="space-y-8">
      {/* 상단 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            쿠폰 / 마일리지 관리
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            강의 무료 수강 쿠폰 종류 생성(사용일 기준 기간제) 및 회원별 개별·다량 쿠폰/마일리지 발행 시스템
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadDashboard()}
          disabled={loading}
          className="rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-50 h-10 px-4 whitespace-nowrap shrink-0 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          데이터 새로고침
        </Button>
      </div>

      {/* 핵심 지표 카드 (KPI Strip) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500">무료 수강 쿠폰 종류</span>
            <Ticket className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 tabular-nums">
            {stats.activeTemplates}
            <span className="text-sm font-bold text-slate-400 ml-1">/ 총 {stats.totalTemplates}종</span>
          </p>
          <p className="text-xs font-bold text-purple-600 mt-1">강의 100% 무료 수강권 전용</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500">발행된 유효 쿠폰</span>
            <Send className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 tabular-nums">
            {stats.validIssued.toLocaleString()}
            <span className="text-sm font-bold text-slate-400 ml-1">매</span>
          </p>
          <p className="text-xs font-bold text-slate-500 mt-1 tabular-nums">
            미사용 보유: {stats.availableCount.toLocaleString()}매
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500">쿠폰 수강 전환 완료</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 tabular-nums">
            {stats.usedCount.toLocaleString()}
            <span className="text-sm font-bold text-slate-400 ml-1">건</span>
          </p>
          <p className="text-xs font-bold text-emerald-600 mt-1 tabular-nums">
            사용률 {stats.validIssued > 0 ? Math.round((stats.usedCount / stats.validIssued) * 100) : 0}%
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500">전체 회원 보유 마일리지</span>
            <Coins className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 tabular-nums">
            {stats.totalMileage.toLocaleString()}
            <span className="text-sm font-bold text-slate-400 ml-1">P</span>
          </p>
          <p className="text-xs font-bold text-slate-500 mt-1 tabular-nums">
            누적 지급/차감 기록 {mileageLogs.length.toLocaleString()}건
          </p>
        </div>
      </div>

      {/* 상단 탭 네비게이션 */}
      <div className="bg-white p-1.5 rounded-xl border border-slate-200/80 flex flex-wrap gap-1.5 shadow-xs">
        {[
          { id: 'templates' as const, label: '1. 쿠폰 종류 생성 · 관리', icon: <Ticket className="w-4 h-4" /> },
          { id: 'issue-coupon' as const, label: '2. 쿠폰 개별 · 다량 발행', icon: <Send className="w-4 h-4" /> },
          { id: 'coupon-ledger' as const, label: '3. 쿠폰 발행 · 사용 내역', icon: <BookOpen className="w-4 h-4" /> },
          { id: 'mileage' as const, label: '4. 마일리지 개별 · 다량 관리', icon: <Coins className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-purple-600'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: 쿠폰 종류 생성 및 관리                                           */}
      {/* ===================================================================== */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* 쿠폰 종류 생성 / 수정 폼 */}
          <form
            onSubmit={handleSaveTemplate}
            className="xl:col-span-5 bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  {editingTemplateId ? '쿠폰 종류 수정' : '새 무료 수강 쿠폰 종류 생성'}
                </h2>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  특정 강의를 지정된 일수 동안 무료로 수강할 수 있는 전용 쿠폰을 생성합니다.
                </p>
              </div>
              <Badge className="bg-purple-50 text-purple-700 border border-purple-200 font-black text-xs rounded-md whitespace-nowrap">
                강의 무료 수강권
              </Badge>
            </div>

            {/* 대상 강의 선택 */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block">
                대상 강의 선택 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={tplCourseSearch}
                  onChange={(e) => setTplCourseSearch(e.target.value)}
                  placeholder="강의명 또는 강사명으로 빠른 필터..."
                  className="pl-9 h-9 text-xs font-bold rounded-lg border-slate-200 mb-2"
                />
              </div>
              <select
                value={tplCourseId}
                onChange={(e) => setTplCourseId(e.target.value)}
                required
                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="" disabled>
                  무료 수강을 허용할 강의를 선택하세요
                </option>
                {filteredCoursesForForm.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} {course.instructor ? `(${course.instructor})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 수강 가능 기간 설정 */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block">
                쿠폰 사용 시점 기준 수강 가능 기간(일) <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setTplDurationDays(String(d))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all tabular-nums cursor-pointer ${
                      Number(tplDurationDays) === d
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-purple-300'
                    }`}
                  >
                    {d}일
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  required
                  value={tplDurationDays}
                  onChange={(e) => setTplDurationDays(e.target.value)}
                  className="h-11 rounded-lg border-slate-200 font-black text-base tabular-nums"
                />
                <span className="text-sm font-black text-slate-700 shrink-0">일 동안 무료 수강</span>
              </div>
              <div className="p-3.5 rounded-lg bg-purple-50/70 border border-purple-100 text-xs font-bold text-purple-900 leading-relaxed">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <span>
                    회원이 이 쿠폰을 <strong>사용한 날로부터 {Math.max(1, Number(tplDurationDays) || 1)}일째 23:59까지</strong>{' '}
                    선택 강의가 자동으로 활성화되며, 기간 만료 후 자동으로 수강이 종료됩니다.
                  </span>
                </div>
              </div>
            </div>

            {/* 쿠폰 이름 */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block">
                쿠폰 종류 이름 <span className="text-slate-400 font-bold">(미입력 시 강의명+기간으로 자동 생성)</span>
              </label>
              <Input
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="예: A강의 7일 무료 체험 수강권"
                className="h-11 rounded-lg border-slate-200 font-bold text-sm"
              />
            </div>

            {/* 쿠폰 설명 */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block">쿠폰 안내 문구 / 내부 메모 (선택)</label>
              <Input
                value={tplDescription}
                onChange={(e) => setTplDescription(e.target.value)}
                placeholder="예: 신규 회원 특별 혜택 · 사용 시작일로부터 7일간 무제한 시청"
                className="h-11 rounded-lg border-slate-200 font-medium text-sm"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              {editingTemplateId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingTemplateId(null);
                    setTplName('');
                    setTplDurationDays('7');
                    setTplDescription('');
                  }}
                  className="h-11 rounded-lg font-bold border-slate-200 whitespace-nowrap"
                >
                  수정 취소
                </Button>
              )}
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 h-11 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-lg whitespace-nowrap"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {submitting
                  ? '저장 중...'
                  : editingTemplateId
                    ? '쿠폰 종류 수정 저장'
                    : '무료 수강 쿠폰 종류 생성'}
              </Button>
            </div>
          </form>

          {/* 등록된 쿠폰 종류 목록 */}
          <div className="xl:col-span-7 bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">생성된 쿠폰 종류 목록</h2>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  원하는 쿠폰 종류의 [발행하기] 버튼을 누르면 개별 또는 다량 회원에게 즉시 지급할 수 있습니다.
                </p>
              </div>
              <Badge variant="outline" className="font-black text-xs border-slate-200 tabular-nums shrink-0">
                총 {templates.length}종
              </Badge>
            </div>

            {loading ? (
              <div className="p-16 text-center text-sm font-bold text-slate-400">
                쿠폰 종류 목록을 불러오는 중입니다...
              </div>
            ) : templates.length === 0 ? (
              <div className="p-16 text-center space-y-2">
                <Ticket className="w-10 h-10 text-slate-200 mx-auto" />
                <p className="text-sm font-black text-slate-700">아직 생성된 무료 수강 쿠폰 종류가 없습니다.</p>
                <p className="text-xs font-bold text-slate-400">좌측 폼에서 대상 강의와 수강 가능 일수를 지정해 첫 쿠폰을 만들어 보세요.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="p-5 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          className={`text-[11px] font-black border-none rounded-md px-2 py-0.5 ${
                            tpl.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {tpl.active ? '발행 가능' : '비활성'}
                        </Badge>
                        <Badge className="bg-purple-100 text-purple-700 border-none text-[11px] font-black rounded-md px-2 py-0.5 tabular-nums">
                          사용 시작부터 {tpl.duration_days}일 무료 수강
                        </Badge>
                        <span className="text-[11px] font-bold text-slate-400 tabular-nums">
                          생성일 {formatDateTime(tpl.created_at)}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-slate-900 break-keep">{tpl.name}</h3>
                      <p className="text-xs font-bold text-slate-600 break-keep">
                        대상 강의: <span className="text-purple-700 font-extrabold">{tpl.course_title}</span>
                      </p>
                      {tpl.description && (
                        <p className="text-xs font-medium text-slate-400 break-keep">{tpl.description}</p>
                      )}
                      <div className="flex items-center gap-4 pt-1 text-xs font-bold text-slate-500 tabular-nums">
                        <span>발행 {tpl.issued_count.toLocaleString()}매</span>
                        <span>사용 완료 {tpl.used_count.toLocaleString()}매</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                      <Button
                        size="sm"
                        disabled={!tpl.active}
                        onClick={() => {
                          setSelectedTemplateId(tpl.id);
                          setActiveTab('issue-coupon');
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-black rounded-lg h-9 px-3.5 text-xs whitespace-nowrap"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        회원 발행하기
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartEditTemplate(tpl)}
                        className="rounded-lg h-9 px-2.5 border-slate-200 text-slate-600 font-bold text-xs whitespace-nowrap"
                        title="수정"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleTemplateActive(tpl)}
                        className="rounded-lg h-9 px-2.5 border-slate-200 text-slate-600 font-bold text-xs whitespace-nowrap"
                      >
                        {tpl.active ? '중지' : '활성'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPendingDeleteTemplate(tpl)}
                        className="rounded-lg h-9 px-2.5 border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs whitespace-nowrap"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: 쿠폰 개별 · 다량 발행                                           */}
      {/* ===================================================================== */}
      {activeTab === 'issue-coupon' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* 좌측: 발행할 쿠폰 종류 및 옵션 설정 */}
          <div className="xl:col-span-5 bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900">발행할 쿠폰 설정</h2>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                지급할 쿠폰 종류를 고른 뒤 우측에서 개별 회원 선택, 명단 붙여넣기, 또는 전체 회원 일괄 발행을 실행하세요.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block">발행할 쿠폰 종류 선택</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="">쿠폰 종류를 선택하세요</option>
                {templates
                  .filter((t) => t.active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.course_title} · {t.duration_days}일 무료)
                    </option>
                  ))}
              </select>
            </div>

            {selectedTemplate ? (
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge className="bg-purple-500 text-white border-none text-[11px] font-black rounded-md">
                    무료 수강 쿠폰
                  </Badge>
                  <span className="text-xs font-black text-purple-300 tabular-nums">
                    사용일로부터 {selectedTemplate.duration_days}일간 수강
                  </span>
                </div>
                <p className="text-base font-black break-keep">{selectedTemplate.name}</p>
                <p className="text-xs font-bold text-slate-300 break-keep">
                  적용 강의: {selectedTemplate.course_title}
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>먼저 [1. 쿠폰 종류 생성 · 관리] 탭에서 활성 상태의 쿠폰 종류를 생성해 주세요.</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 block">발급 안내 메모 (회원 쿠폰함에 함께 표시 · 선택)</label>
              <Input
                value={couponIssueMemo}
                onChange={(e) => setCouponIssueMemo(e.target.value)}
                placeholder="예: 오픈 기념 7일 무료 수강 혜택이 도착했습니다!"
                className="h-11 rounded-lg border-slate-200 text-sm font-bold"
              />
            </div>

            <label className="flex items-start gap-2.5 p-3.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={preventDuplicateUnused}
                onChange={(e) => setPreventDuplicateUnused(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-purple-600 rounded"
              />
              <div className="text-xs">
                <p className="font-black text-slate-800">동일 쿠폰 미사용 보유 회원 중복 발행 방지</p>
                <p className="font-semibold text-slate-500 mt-0.5">
                  체크 시 이미 같은 종류의 미사용 쿠폰을 가진 회원은 자동으로 건너뜁니다. (동일 회원에게 여러 장 지급하려면 체크 해제)
                </p>
              </div>
            </label>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-600">현재 선택된 발행 대상</span>
                <span className="font-black text-purple-600 text-lg tabular-nums">
                  총 {resolvedCouponRecipientCount.toLocaleString()}명
                </span>
              </div>
              <Button
                type="button"
                disabled={!selectedTemplate || resolvedCouponRecipientCount === 0 || submitting}
                onClick={() => setConfirmCouponModalOpen(true)}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl text-sm whitespace-nowrap"
              >
                <Send className="w-4 h-4 mr-2" />
                {resolvedCouponRecipientCount.toLocaleString()}명에게 무료 수강 쿠폰 발행하기
              </Button>
            </div>
          </div>

          {/* 우측: 발급 대상 회원 선택 (개별 / 강의 수강자 / 다량 붙여넣기 / 전체 회원) */}
          <div className="xl:col-span-7 bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">발급 대상 회원 지정 (개별 · 강의 수강자 · 다량)</h2>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  개별 회원, 특정 강의를 듣는 수강자, 엑셀 명단 붙여넣기, 전 회원 일괄 발행을 지원합니다.
                </p>
              </div>
              <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg gap-1 self-start">
                {[
                  { id: 'selected' as const, label: '개별·선택 회원' },
                  { id: 'course_students' as const, label: '강의 수강자' },
                  { id: 'bulk_paste' as const, label: '다량 명단 붙여넣기' },
                  { id: 'all_members' as const, label: '전체 회원 일괄' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setCouponTargetMode(m.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                      couponTargetMode === m.id
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {couponTargetMode === 'selected' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={couponMemberSearch}
                      onChange={(e) => setCouponMemberSearch(e.target.value)}
                      placeholder="이름, 닉네임, 이메일, 휴대폰 번호로 회원 검색..."
                      className="pl-9 h-10 rounded-lg border-slate-200 text-sm font-bold"
                    />
                  </div>
                  <select
                    value={couponRoleFilter}
                    onChange={(e) => setCouponRoleFilter(e.target.value)}
                    className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700"
                  >
                    <option value="ALL">전체 등급 ({members.length}명)</option>
                    <option value="user">일반회원</option>
                    <option value="regular_member">정회원</option>
                    <option value="paid_member">유료회원</option>
                    <option value="beone_member">비원회원</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-slate-500 bg-slate-50 px-3.5 py-2.5 rounded-lg">
                  <span>
                    검색 결과 <strong className="text-slate-900 tabular-nums">{filteredMembersForCoupon.length}</strong>명 중{' '}
                    <strong className="text-purple-600 tabular-nums">{selectedCouponUserIds.size}</strong>명 선택됨
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCouponUserIds((prev) => {
                          const next = new Set(prev);
                          filteredMembersForCoupon.forEach((m) => next.add(m.id));
                          return next;
                        });
                      }}
                      className="text-purple-600 hover:underline font-black cursor-pointer"
                    >
                      검색 결과 전체 선택
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCouponUserIds(new Set())}
                      className="text-slate-500 hover:underline font-bold cursor-pointer"
                    >
                      선택 초기화
                    </button>
                  </div>
                </div>

                <div className="max-h-[420px] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {filteredMembersForCoupon.length === 0 ? (
                    <div className="p-10 text-center text-xs font-bold text-slate-400">
                      조건에 일치하는 회원이 없습니다.
                    </div>
                  ) : (
                    filteredMembersForCoupon.map((member) => {
                      const checked = selectedCouponUserIds.has(member.id);
                      return (
                        <label
                          key={member.id}
                          className={`flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors ${
                            checked ? 'bg-purple-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleUserInSet(member.id, setSelectedCouponUserIds)}
                              className="w-4 h-4 accent-purple-600 rounded shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-900 truncate">
                                  {member.name || member.nickname || '이름없음'}
                                </span>
                                <Badge variant="outline" className="text-[10px] font-bold border-slate-200 px-1.5 py-0">
                                  {ROLE_LABELS[member.role] || member.role}
                                </Badge>
                              </div>
                              <p className="text-xs font-medium text-slate-500 truncate">
                                {member.email} {member.phone ? `· ${member.phone}` : ''}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-slate-400 tabular-nums shrink-0">
                            {member.mileage.toLocaleString()}P
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {couponTargetMode === 'course_students' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-purple-600" />
                      수강자를 불러올 기준 강의 선택
                    </label>
                    <span className="text-[11px] font-bold text-slate-400">
                      강의 선택 시 해당 강의 수강자가 자동 선택됩니다
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="relative sm:col-span-5">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        value={couponStudentCourseSearch}
                        onChange={(e) => setCouponStudentCourseSearch(e.target.value)}
                        placeholder="강의명·강사명 빠른 필터..."
                        className="pl-8 h-10 bg-white rounded-lg border-slate-200 text-xs font-bold"
                      />
                    </div>
                    <select
                      value={couponStudentCourseId}
                      onChange={(e) => handleChangeCouponStudentCourse(e.target.value)}
                      className="sm:col-span-7 h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    >
                      <option value="">기준 강의를 선택하세요</option>
                      {couponCourseDropdownOptions.map((c) => {
                        const stat = courseEnrollmentSummaryMap.get(c.id);
                        const totalCnt = stat?.total || 0;
                        const activeCnt = stat?.active || 0;
                        return (
                          <option key={c.id} value={c.id}>
                            {c.title} — 수강자 {totalCnt}명 (수강중 {activeCnt}명)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {couponStudentCourseId && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap gap-1.5">
                        {(() => {
                          const stat = courseEnrollmentSummaryMap.get(couponStudentCourseId);
                          return [
                            { id: 'all' as const, label: `전체 수강자 (${stat?.total || 0}명)` },
                            { id: 'active' as const, label: `현재 수강 중 (${stat?.active || 0}명)` },
                            { id: 'expired' as const, label: `수강 만료 (${stat?.expired || 0}명)` },
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => handleChangeCouponStudentCourse(couponStudentCourseId, f.id)}
                              className={`px-2.5 py-1 rounded-md text-xs font-black border transition-all whitespace-nowrap cursor-pointer ${
                                couponStudentStatusFilter === f.id
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                              }`}
                            >
                              {f.label}
                            </button>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={couponStudentMemberSearch}
                    onChange={(e) => setCouponStudentMemberSearch(e.target.value)}
                    placeholder="조회된 강의 수강자 내 이름, 이메일, 연락처 검색..."
                    className="pl-9 h-10 rounded-lg border-slate-200 text-sm font-bold"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500 bg-slate-50 px-3.5 py-2.5 rounded-lg">
                  <span>
                    현재 강의 수강자 <strong className="text-slate-900 tabular-nums">{filteredCouponCourseStudents.length}</strong>명 ·{' '}
                    발행 대상 <strong className="text-purple-600 tabular-nums">{selectedCouponCourseStudentIds.size}</strong>명 선택됨
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCouponCourseStudentIds(
                          new Set(filteredCouponCourseStudents.map((x) => x.member.id))
                        )
                      }
                      className="text-purple-600 hover:underline font-black cursor-pointer whitespace-nowrap"
                    >
                      이 강의 전체 선택
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCouponCourseStudentIds((prev) => {
                          const next = new Set(prev);
                          filteredCouponCourseStudents.forEach((x) => next.add(x.member.id));
                          return next;
                        })
                      }
                      className="text-indigo-600 hover:underline font-black cursor-pointer whitespace-nowrap"
                      title="다른 강의 수강자와 합쳐서 선택할 때 사용합니다"
                    >
                      + 목록 추가 선택
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCouponCourseStudentIds(new Set())}
                      className="text-slate-500 hover:underline font-bold cursor-pointer whitespace-nowrap"
                    >
                      선택 초기화
                    </button>
                  </div>
                </div>

                <div className="max-h-[380px] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {!couponStudentCourseId ? (
                    <div className="p-10 text-center text-xs font-bold text-slate-400">
                      상단에서 수강자를 조회할 강의를 선택해 주세요.
                    </div>
                  ) : filteredCouponCourseStudents.length === 0 ? (
                    <div className="p-10 text-center text-xs font-bold text-slate-400">
                      선택한 조건에 해당하는 강의 수강자가 없습니다.
                    </div>
                  ) : (
                    filteredCouponCourseStudents.map(({ member, enrollment }) => {
                      const checked = selectedCouponCourseStudentIds.has(member.id);
                      return (
                        <label
                          key={member.id}
                          className={`flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors ${
                            checked ? 'bg-purple-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleUserInSet(member.id, setSelectedCouponCourseStudentIds)
                              }
                              className="w-4 h-4 accent-purple-600 rounded shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-slate-900 truncate">
                                  {member.name || member.nickname || '이름없음'}
                                </span>
                                <Badge variant="outline" className="text-[10px] font-bold border-slate-200 px-1.5 py-0">
                                  {ROLE_LABELS[member.role] || member.role}
                                </Badge>
                                <Badge
                                  className={`text-[10px] font-black border-none px-1.5 py-0 rounded ${
                                    enrollment.is_active
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-slate-200 text-slate-600'
                                  }`}
                                >
                                  {enrollment.is_active ? '수강 중' : '수강 만료'}
                                </Badge>
                              </div>
                              <p className="text-xs font-medium text-slate-500 truncate">
                                {member.email} {member.phone ? `· ${member.phone}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right text-[11px] font-bold text-slate-400 tabular-nums shrink-0">
                            <p>등록 {new Date(enrollment.created_at).toLocaleDateString('ko-KR')}</p>
                            <p className="text-slate-500">
                              {enrollment.expires_at
                                ? `만료 ${new Date(enrollment.expires_at).toLocaleDateString('ko-KR')}`
                                : '상시 수강'}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {couponTargetMode === 'bulk_paste' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs font-bold text-slate-600">
                    엑셀(CSV)에서 복사한 <strong>이메일 주소</strong> 또는 <strong>휴대폰 번호</strong>를 줄바꿈/쉼표로 구분해 붙여넣으세요.
                  </p>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-black text-slate-700 cursor-pointer whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" />
                    CSV/TXT 파일 불러오기
                    <input
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={(e) => handleTextFileImport(e, setCouponBulkPasteText)}
                    />
                  </label>
                </div>

                <textarea
                  value={couponBulkPasteText}
                  onChange={(e) => setCouponBulkPasteText(e.target.value)}
                  placeholder={`예시:\nuser1@example.com\nuser2@example.com\n010-1234-5678`}
                  className="w-full min-h-[200px] p-4 rounded-lg border border-slate-200 bg-slate-50/50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-600"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-xs font-bold text-emerald-700">일치하는 가입 회원</p>
                    <p className="text-2xl font-black text-emerald-900 mt-1 tabular-nums">
                      {couponBulkMatch.matchedMembers.length.toLocaleString()}명
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-xs font-bold text-slate-600">미일치 입력 항목</p>
                    <p className="text-2xl font-black text-slate-800 mt-1 tabular-nums">
                      {couponBulkMatch.unmatchedTokens.length.toLocaleString()}건
                    </p>
                    {couponBulkMatch.unmatchedTokens.length > 0 && (
                      <p className="text-[11px] font-medium text-rose-600 mt-1 truncate">
                        미매칭 예: {couponBulkMatch.unmatchedTokens.slice(0, 3).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {couponTargetMode === 'all_members' && (
              <div className="p-8 rounded-xl bg-purple-50/70 border border-purple-200 text-center space-y-3">
                <Users className="w-10 h-10 text-purple-600 mx-auto" />
                <h3 className="text-lg font-black text-slate-900">
                  전체 활성 회원 <span className="text-purple-600 tabular-nums">{members.length.toLocaleString()}명</span> 일괄 발행 모드
                </h3>
                <p className="text-xs font-bold text-slate-600 max-w-md mx-auto leading-relaxed break-keep">
                  현재 등록된 모든 회원에게 선택한 무료 수강 쿠폰을 한 번에 일괄 발행합니다. 좌측의 [쿠폰 발행하기] 버튼을 누르면 최종 확인 창이 표시됩니다.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: 쿠폰 발행 · 사용 내역                                           */}
      {/* ===================================================================== */}
      {activeTab === 'coupon-ledger' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">회원별 쿠폰 발행 및 사용 내역</h2>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                쿠폰 사용 시각과 자동 계산된 강의 만료일을 실시간으로 확인하고, 미사용 쿠폰을 회수할 수 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="회원명, 이메일, 강의명, 코드..."
                  className="pl-9 h-9 rounded-lg border-slate-200 text-xs font-bold"
                />
              </div>

              <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
                {[
                  { id: 'ALL' as const, label: '전체' },
                  { id: 'available' as const, label: '미사용' },
                  { id: 'used' as const, label: '사용완료' },
                  { id: 'revoked' as const, label: '회수됨' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLedgerStatusFilter(f.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-black whitespace-nowrap cursor-pointer ${
                      ledgerStatusFilter === f.id ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {selectedRevokeIds.size > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingRevokeIds(Array.from(selectedRevokeIds))}
                  className="h-9 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 font-black text-xs whitespace-nowrap"
                >
                  선택 회수 ({selectedRevokeIds.size}건)
                </Button>
              )}
            </div>
          </div>

          {filteredUserCoupons.length === 0 ? (
            <div className="p-16 text-center text-sm font-bold text-slate-400">
              조회된 쿠폰 발행 내역이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black text-slate-500 uppercase">
                    <th className="py-3.5 px-4 w-10">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            const revocable = filteredUserCoupons
                              .filter((c) => c.status === 'available')
                              .map((c) => c.id);
                            setSelectedRevokeIds(new Set(revocable));
                          } else {
                            setSelectedRevokeIds(new Set());
                          }
                        }}
                        className="w-4 h-4 accent-purple-600 rounded"
                      />
                    </th>
                    <th className="py-3.5 px-4">회원 정보</th>
                    <th className="py-3.5 px-4">쿠폰명 / 코드</th>
                    <th className="py-3.5 px-4">무료 대상 강의 · 기간</th>
                    <th className="py-3.5 px-4">상태</th>
                    <th className="py-3.5 px-4">발행일 / 사용일 / 수강 만료일</th>
                    <th className="py-3.5 px-4 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredUserCoupons.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="py-3.5 px-4">
                        {item.status === 'available' && (
                          <input
                            type="checkbox"
                            checked={selectedRevokeIds.has(item.id)}
                            onChange={() => toggleUserInSet(item.id, setSelectedRevokeIds)}
                            className="w-4 h-4 accent-purple-600 rounded"
                          />
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-black text-slate-900">{item.user_name}</p>
                        <p className="text-slate-400 font-medium">{item.user_email}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-extrabold text-slate-800">{item.coupon_name}</p>
                        <p className="font-mono text-[11px] text-slate-400 mt-0.5">{item.code}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-800">{item.course_title}</p>
                        <span className="inline-block mt-0.5 text-[11px] font-black text-purple-600 tabular-nums">
                          사용 시작부터 {item.duration_days}일 무료
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.status === 'available' && (
                          <Badge className="bg-blue-50 text-blue-700 border border-blue-200 font-black text-[11px] rounded-md whitespace-nowrap">
                            미사용
                          </Badge>
                        )}
                        {item.status === 'used' && (
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-[11px] rounded-md whitespace-nowrap">
                            사용완료
                          </Badge>
                        )}
                        {item.status === 'revoked' && (
                          <Badge className="bg-slate-100 text-slate-500 border border-slate-200 font-black text-[11px] rounded-md whitespace-nowrap">
                            회수됨
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums space-y-0.5 text-[11px]">
                        <p className="text-slate-500">발행: {formatDateTime(item.issued_at)}</p>
                        {item.used_at && (
                          <p className="text-emerald-700 font-bold">사용: {formatDateTime(item.used_at)}</p>
                        )}
                        {item.enrollment_expires_at && (
                          <p className="text-purple-700 font-extrabold">
                            만료: {formatDateTime(item.enrollment_expires_at)}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {item.status === 'available' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPendingRevokeIds([item.id])}
                            className="h-8 px-2.5 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs whitespace-nowrap"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            회수
                          </Button>
                        ) : (
                          <span className="text-slate-300 font-bold">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: 마일리지 개별 · 다량 관리                                       */}
      {/* ===================================================================== */}
      {activeTab === 'mileage' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* 좌측: 마일리지 지급/차감 설정 */}
            <div className="xl:col-span-5 bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-900">마일리지 지급 / 차감 설정</h2>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  개별 회원 또는 다량 회원에게 즉시 사용 가능한 마일리지 포인트를 지급하거나 차감합니다.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMileageAdjustType('add')}
                  className={`py-2.5 rounded-md text-xs font-black transition-all cursor-pointer ${
                    mileageAdjustType === 'add'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  + 마일리지 지급 (적립)
                </button>
                <button
                  type="button"
                  onClick={() => setMileageAdjustType('subtract')}
                  className={`py-2.5 rounded-md text-xs font-black transition-all cursor-pointer ${
                    mileageAdjustType === 'subtract'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  - 마일리지 차감 (회수)
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 block">
                  1인당 {mileageAdjustType === 'add' ? '지급' : '차감'}할 포인트 수량 (P)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MILEAGE_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setMileageAmount(String(amt))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black border tabular-nums cursor-pointer ${
                        Number(mileageAmount) === amt
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {amt.toLocaleString()}P
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    type="number"
                    min={1}
                    max={100000000}
                    value={mileageAmount}
                    onChange={(e) => setMileageAmount(e.target.value)}
                    className="h-11 rounded-lg border-slate-200 font-black text-base tabular-nums"
                  />
                  <span className="text-sm font-black text-slate-700 shrink-0">P</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 block">지급 / 차감 사유 (회원 내역에 표시)</label>
                <Input
                  value={mileageReason}
                  onChange={(e) => setMileageReason(e.target.value)}
                  placeholder={
                    mileageAdjustType === 'add'
                      ? '예: 이벤트 참여 보상 마일리지 적립'
                      : '예: 오지급 포인트 회수 조정'
                  }
                  className="h-11 rounded-lg border-slate-200 text-sm font-bold"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-xs font-bold">
                  <div className="flex justify-between text-slate-600">
                    <span>선택된 대상 인원</span>
                    <span className="font-black text-slate-900 tabular-nums">
                      {resolvedMileageRecipientCount.toLocaleString()}명
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>총 변동 예정 포인트 합계</span>
                    <span
                      className={`font-black tabular-nums ${
                        mileageAdjustType === 'add' ? 'text-purple-600' : 'text-rose-600'
                      }`}
                    >
                      {mileageAdjustType === 'add' ? '+' : '-'}
                      {(resolvedMileageRecipientCount * (Math.max(0, Number(mileageAmount)) || 0)).toLocaleString()}P
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  disabled={resolvedMileageRecipientCount === 0 || submitting || Number(mileageAmount) <= 0}
                  onClick={() => setConfirmMileageModalOpen(true)}
                  className={`w-full h-12 text-white font-black rounded-xl text-sm whitespace-nowrap ${
                    mileageAdjustType === 'add'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  <Coins className="w-4 h-4 mr-2" />
                  {resolvedMileageRecipientCount.toLocaleString()}명 마일리지{' '}
                  {mileageAdjustType === 'add' ? '지급 실행' : '차감 실행'}
                </Button>
              </div>
            </div>

            {/* 우측: 마일리지 대상 회원 선택 */}
            <div className="xl:col-span-7 bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-5">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">마일리지 대상 회원 선택 (개별 · 강의 수강자 · 다량)</h2>
                  <p className="text-xs font-bold text-slate-500 mt-0.5">
                    개별 선택, 특정 강의 수강자 선택, 다량 명단 붙여넣기, 전 회원 일괄 지급을 지원합니다.
                  </p>
                </div>
                <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg gap-1 self-start">
                  {[
                    { id: 'selected' as const, label: '개별·선택 회원' },
                    { id: 'course_students' as const, label: '강의 수강자' },
                    { id: 'bulk_paste' as const, label: '다량 명단 붙여넣기' },
                    { id: 'all_members' as const, label: '전체 회원 일괄' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMileageTargetMode(m.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                        mileageTargetMode === m.id
                          ? 'bg-white text-purple-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {mileageTargetMode === 'selected' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        value={mileageMemberSearch}
                        onChange={(e) => setMileageMemberSearch(e.target.value)}
                        placeholder="이름, 닉네임, 이메일, 휴대폰 번호 검색..."
                        className="pl-9 h-10 rounded-lg border-slate-200 text-sm font-bold"
                      />
                    </div>
                    <select
                      value={mileageRoleFilter}
                      onChange={(e) => setMileageRoleFilter(e.target.value)}
                      className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700"
                    >
                      <option value="ALL">전체 등급 ({members.length}명)</option>
                      <option value="user">일반회원</option>
                      <option value="regular_member">정회원</option>
                      <option value="paid_member">유료회원</option>
                      <option value="beone_member">비원회원</option>
                      <option value="admin">관리자</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 bg-slate-50 px-3.5 py-2.5 rounded-lg">
                    <span>
                      검색 결과 <strong className="text-slate-900 tabular-nums">{filteredMembersForMileage.length}</strong>명 중{' '}
                      <strong className="text-purple-600 tabular-nums">{selectedMileageUserIds.size}</strong>명 선택됨
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMileageUserIds((prev) => {
                            const next = new Set(prev);
                            filteredMembersForMileage.forEach((m) => next.add(m.id));
                            return next;
                          });
                        }}
                        className="text-purple-600 hover:underline font-black cursor-pointer"
                      >
                        검색 결과 전체 선택
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMileageUserIds(new Set())}
                        className="text-slate-500 hover:underline font-bold cursor-pointer"
                      >
                        선택 초기화
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[380px] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {filteredMembersForMileage.map((member) => {
                      const checked = selectedMileageUserIds.has(member.id);
                      return (
                        <label
                          key={member.id}
                          className={`flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors ${
                            checked ? 'bg-purple-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleUserInSet(member.id, setSelectedMileageUserIds)}
                              className="w-4 h-4 accent-purple-600 rounded shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-900 truncate">
                                  {member.name || member.nickname || '이름없음'}
                                </span>
                                <Badge variant="outline" className="text-[10px] font-bold border-slate-200 px-1.5 py-0">
                                  {ROLE_LABELS[member.role] || member.role}
                                </Badge>
                              </div>
                              <p className="text-xs font-medium text-slate-500 truncate">{member.email}</p>
                            </div>
                          </div>
                          <span className="text-xs font-black text-purple-700 tabular-nums shrink-0">
                            보유 {member.mileage.toLocaleString()}P
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {mileageTargetMode === 'course_students' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-purple-600" />
                      수강자를 불러올 기준 강의 선택
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="relative sm:col-span-5">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          value={mileageStudentCourseSearch}
                          onChange={(e) => setMileageStudentCourseSearch(e.target.value)}
                          placeholder="강의명 빠른 필터..."
                          className="pl-8 h-10 bg-white rounded-lg border-slate-200 text-xs font-bold"
                        />
                      </div>
                      <select
                        value={mileageStudentCourseId}
                        onChange={(e) => handleChangeMileageStudentCourse(e.target.value)}
                        className="sm:col-span-7 h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                      >
                        <option value="">기준 강의를 선택하세요</option>
                        {mileageCourseDropdownOptions.map((c) => {
                          const stat = courseEnrollmentSummaryMap.get(c.id);
                          return (
                            <option key={c.id} value={c.id}>
                              {c.title} — 수강자 {stat?.total || 0}명 (수강중 {stat?.active || 0}명)
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {mileageStudentCourseId && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(() => {
                          const stat = courseEnrollmentSummaryMap.get(mileageStudentCourseId);
                          return [
                            { id: 'all' as const, label: `전체 수강자 (${stat?.total || 0}명)` },
                            { id: 'active' as const, label: `현재 수강 중 (${stat?.active || 0}명)` },
                            { id: 'expired' as const, label: `수강 만료 (${stat?.expired || 0}명)` },
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => handleChangeMileageStudentCourse(mileageStudentCourseId, f.id)}
                              className={`px-2.5 py-1 rounded-md text-xs font-black border transition-all whitespace-nowrap cursor-pointer ${
                                mileageStudentStatusFilter === f.id
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                              }`}
                            >
                              {f.label}
                            </button>
                          ));
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      value={mileageStudentMemberSearch}
                      onChange={(e) => setMileageStudentMemberSearch(e.target.value)}
                      placeholder="조회된 강의 수강자 내 이름, 이메일, 연락처 검색..."
                      className="pl-9 h-10 rounded-lg border-slate-200 text-sm font-bold"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500 bg-slate-50 px-3.5 py-2.5 rounded-lg">
                    <span>
                      현재 강의 수강자 <strong className="text-slate-900 tabular-nums">{filteredMileageCourseStudents.length}</strong>명 ·{' '}
                      대상 <strong className="text-purple-600 tabular-nums">{selectedMileageCourseStudentIds.size}</strong>명 선택됨
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedMileageCourseStudentIds(
                            new Set(filteredMileageCourseStudents.map((x) => x.member.id))
                          )
                        }
                        className="text-purple-600 hover:underline font-black cursor-pointer whitespace-nowrap"
                      >
                        이 강의 전체 선택
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedMileageCourseStudentIds((prev) => {
                            const next = new Set(prev);
                            filteredMileageCourseStudents.forEach((x) => next.add(x.member.id));
                            return next;
                          })
                        }
                        className="text-indigo-600 hover:underline font-black cursor-pointer whitespace-nowrap"
                      >
                        + 목록 추가 선택
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMileageCourseStudentIds(new Set())}
                        className="text-slate-500 hover:underline font-bold cursor-pointer whitespace-nowrap"
                      >
                        선택 초기화
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[340px] overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {filteredMileageCourseStudents.length === 0 ? (
                      <div className="p-10 text-center text-xs font-bold text-slate-400">
                        선택한 조건에 해당하는 강의 수강자가 없습니다.
                      </div>
                    ) : (
                      filteredMileageCourseStudents.map(({ member, enrollment }) => {
                        const checked = selectedMileageCourseStudentIds.has(member.id);
                        return (
                          <label
                            key={member.id}
                            className={`flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors ${
                              checked ? 'bg-purple-50/60' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  toggleUserInSet(member.id, setSelectedMileageCourseStudentIds)
                                }
                                className="w-4 h-4 accent-purple-600 rounded shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-black text-slate-900 truncate">
                                    {member.name || member.nickname || '이름없음'}
                                  </span>
                                  <Badge
                                    className={`text-[10px] font-black border-none px-1.5 py-0 rounded ${
                                      enrollment.is_active
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-200 text-slate-600'
                                    }`}
                                  >
                                    {enrollment.is_active ? '수강 중' : '수강 만료'}
                                  </Badge>
                                </div>
                                <p className="text-xs font-medium text-slate-500 truncate">{member.email}</p>
                              </div>
                            </div>
                            <span className="text-xs font-black text-purple-700 tabular-nums shrink-0">
                              보유 {member.mileage.toLocaleString()}P
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {mileageTargetMode === 'bulk_paste' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-bold text-slate-600">
                      마일리지를 일괄 처리할 회원들의 <strong>이메일 주소</strong> 또는 <strong>휴대폰 번호</strong>를 붙여넣으세요.
                    </p>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-black text-slate-700 cursor-pointer whitespace-nowrap">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      CSV/TXT 파일 불러오기
                      <input
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        onChange={(e) => handleTextFileImport(e, setMileageBulkPasteText)}
                      />
                    </label>
                  </div>

                  <textarea
                    value={mileageBulkPasteText}
                    onChange={(e) => setMileageBulkPasteText(e.target.value)}
                    placeholder={`예시:\nstudent1@example.com\nstudent2@example.com\n010-9876-5432`}
                    className="w-full min-h-[180px] p-4 rounded-lg border border-slate-200 bg-slate-50/50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                      <p className="text-xs font-bold text-emerald-700">일치하는 가입 회원</p>
                      <p className="text-2xl font-black text-emerald-900 mt-1 tabular-nums">
                        {mileageBulkMatch.matchedMembers.length.toLocaleString()}명
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-600">미일치 입력 항목</p>
                      <p className="text-2xl font-black text-slate-800 mt-1 tabular-nums">
                        {mileageBulkMatch.unmatchedTokens.length.toLocaleString()}건
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {mileageTargetMode === 'all_members' && (
                <div className="p-8 rounded-xl bg-amber-50/60 border border-amber-200 text-center space-y-3">
                  <Coins className="w-10 h-10 text-amber-600 mx-auto" />
                  <h3 className="text-lg font-black text-slate-900">
                    전체 활성 회원 <span className="text-purple-600 tabular-nums">{members.length.toLocaleString()}명</span> 일괄 마일리지 모드
                  </h3>
                  <p className="text-xs font-bold text-slate-600 max-w-md mx-auto leading-relaxed break-keep">
                    모든 활성 회원의 마일리지 잔액을 일괄 지급 또는 차감합니다. 차감 시 보유 잔액이 부족한 회원은 0P까지만 안전하게 차감됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 마일리지 지급/차감 내역 원장 */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">마일리지 지급 · 차감 이력</h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  관리자가 지급하거나 차감한 모든 마일리지 변동 내역입니다.
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={mileageLogSearch}
                  onChange={(e) => setMileageLogSearch(e.target.value)}
                  placeholder="회원명, 이메일, 사유 검색..."
                  className="pl-9 h-9 rounded-lg border-slate-200 text-xs font-bold"
                />
              </div>
            </div>

            {filteredMileageLogs.length === 0 ? (
              <div className="p-14 text-center text-sm font-bold text-slate-400">
                기록된 마일리지 지급/차감 내역이 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black text-slate-500 uppercase">
                      <th className="py-3.5 px-5">처리 일시</th>
                      <th className="py-3.5 px-5">대상 회원</th>
                      <th className="py-3.5 px-5">구분</th>
                      <th className="py-3.5 px-5">변동 포인트</th>
                      <th className="py-3.5 px-5">변경 전 → 변경 후</th>
                      <th className="py-3.5 px-5">사유</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredMileageLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60">
                        <td className="py-3.5 px-5 text-slate-500 font-medium tabular-nums">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="py-3.5 px-5">
                          <p className="font-black text-slate-900">{log.user_name}</p>
                          <p className="text-slate-400 font-medium">{log.user_email}</p>
                        </td>
                        <td className="py-3.5 px-5">
                          {log.amount >= 0 ? (
                            <Badge className="bg-purple-50 text-purple-700 border border-purple-200 font-black text-[11px] rounded-md">
                              지급
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-50 text-rose-700 border border-rose-200 font-black text-[11px] rounded-md">
                              차감
                            </Badge>
                          )}
                        </td>
                        <td
                          className={`py-3.5 px-5 font-black tabular-nums ${
                            log.amount >= 0 ? 'text-purple-600' : 'text-rose-600'
                          }`}
                        >
                          {log.amount >= 0 ? `+${log.amount.toLocaleString()}P` : `${log.amount.toLocaleString()}P`}
                        </td>
                        <td className="py-3.5 px-5 font-bold text-slate-600 tabular-nums">
                          {log.previous_mileage.toLocaleString()}P →{' '}
                          <span className="text-slate-900 font-black">{log.after_mileage.toLocaleString()}P</span>
                        </td>
                        <td className="py-3.5 px-5 font-bold text-slate-700">{log.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 쿠폰 발행 최종 확인 모달 */}
      <Dialog open={confirmCouponModalOpen} onOpenChange={setConfirmCouponModalOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              무료 수강 쿠폰 발행 확인
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500">
              아래 내용을 확인하신 후 발행 버튼을 눌러주세요.
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-3 py-2 text-sm">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-bold text-xs">쿠폰 종류</span>
                  <span className="font-black text-slate-900 text-xs text-right">{selectedTemplate.name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-bold text-xs">대상 강의</span>
                  <span className="font-bold text-purple-700 text-xs text-right">{selectedTemplate.course_title}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-bold text-xs">수강 적용 기간</span>
                  <span className="font-black text-slate-900 text-xs tabular-nums">
                    쿠폰 사용일로부터 {selectedTemplate.duration_days}일
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-bold text-xs">발급 방식</span>
                  <span className="font-bold text-slate-800 text-xs text-right">
                    {couponTargetMode === 'course_students'
                      ? `강의 수강자 (${courses.find((c) => c.id === couponStudentCourseId)?.title || '선택 강의'})`
                      : couponTargetMode === 'all_members'
                        ? '전체 회원 일괄'
                        : couponTargetMode === 'bulk_paste'
                          ? '다량 명단 매칭'
                          : '개별·선택 회원'}
                  </span>
                </div>
                <div className="flex justify-between gap-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-600 font-extrabold text-xs">발급 대상 인원</span>
                  <span className="font-black text-purple-600 text-sm tabular-nums">
                    총 {resolvedCouponRecipientCount.toLocaleString()}명
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmCouponModalOpen(false)}
              className="rounded-lg font-bold"
            >
              취소
            </Button>
            <Button
              disabled={submitting}
              onClick={handleExecuteIssueCoupons}
              className="bg-purple-600 hover:bg-purple-700 text-white font-black rounded-lg"
            >
              {submitting ? '발행 처리 중...' : '지금 쿠폰 발행하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 마일리지 지급/차감 최종 확인 모달 */}
      <Dialog open={confirmMileageModalOpen} onOpenChange={setConfirmMileageModalOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              마일리지 {mileageAdjustType === 'add' ? '지급' : '차감'} 확인
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500">
              실행 즉시 회원의 보유 마일리지 잔액에 반영됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="font-bold text-slate-500">처리 구분</span>
              <span className="font-black text-slate-900">
                {mileageAdjustType === 'add' ? '마일리지 지급 (+)' : '마일리지 차감 (-)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-slate-500">대상 인원</span>
              <span className="font-black text-slate-900 tabular-nums">
                {resolvedMileageRecipientCount.toLocaleString()}명
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-slate-500">1인당 변동 포인트</span>
              <span
                className={`font-black tabular-nums ${
                  mileageAdjustType === 'add' ? 'text-purple-600' : 'text-rose-600'
                }`}
              >
                {mileageAdjustType === 'add' ? '+' : '-'}
                {(Number(mileageAmount) || 0).toLocaleString()}P
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="font-bold text-slate-500">사유</span>
              <span className="font-bold text-slate-800">
                {mileageReason.trim() ||
                  (mileageAdjustType === 'add' ? '관리자 마일리지 지급' : '관리자 마일리지 차감')}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmMileageModalOpen(false)}
              className="rounded-lg font-bold"
            >
              취소
            </Button>
            <Button
              disabled={submitting}
              onClick={handleExecuteIssueMileage}
              className={`text-white font-black rounded-lg ${
                mileageAdjustType === 'add'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {submitting ? '처리 중...' : '확인 및 즉시 반영'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 쿠폰 종류 삭제 확인 모달 */}
      <Dialog open={Boolean(pendingDeleteTemplate)} onOpenChange={(open) => !open && setPendingDeleteTemplate(null)}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">쿠폰 종류 삭제 확인</DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500">
              {pendingDeleteTemplate
                ? `'${pendingDeleteTemplate.name}' 쿠폰 종류를 삭제하시겠습니까? 삭제 후에는 신규 발행 목록에서 제외됩니다.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingDeleteTemplate(null)} className="rounded-lg font-bold">
              취소
            </Button>
            <Button
              disabled={submitting}
              onClick={() => pendingDeleteTemplate && handleDeleteTemplate(pendingDeleteTemplate)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-black rounded-lg"
            >
              {submitting ? '삭제 중...' : '삭제하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 미사용 쿠폰 회수 확인 모달 */}
      <Dialog open={pendingRevokeIds.length > 0} onOpenChange={(open) => !open && setPendingRevokeIds([])}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">발급 쿠폰 회수 확인</DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500">
              선택한 {pendingRevokeIds.length}건의 미사용 쿠폰을 회수하시겠습니까? 회수된 쿠폰은 회원이 더 이상 사용할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingRevokeIds([])} className="rounded-lg font-bold">
              취소
            </Button>
            <Button
              disabled={submitting}
              onClick={() => handleRevokeCoupons(pendingRevokeIds)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-black rounded-lg"
            >
              {submitting ? '회수 중...' : '쿠폰 회수하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
