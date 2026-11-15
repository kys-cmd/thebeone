import { supabase } from '@/lib/supabase';

export interface CouponTemplate {
  id: string;
  name: string;
  coupon_type: 'FREE_COURSE';
  course_id: string;
  course_title: string;
  course_instructor?: string;
  course_thumbnail?: string;
  duration_days: number;
  description: string;
  active: boolean;
  issued_count: number;
  used_count: number;
  created_at: string;
  updated_at?: string;
}

export interface AdminUserCouponRecord {
  id: string;
  user_id: string;
  user_name: string;
  user_nickname: string;
  user_email: string;
  user_phone: string;
  template_id: string;
  code: string;
  coupon_type: 'FREE_COURSE';
  coupon_name: string;
  course_id: string;
  course_title: string;
  duration_days: number;
  status: 'available' | 'used' | 'revoked';
  issue_memo: string;
  issued_at: string;
  used_at: string | null;
  enrollment_expires_at: string | null;
}

export interface AdminMileageLogRecord {
  id: string;
  user_id: string;
  user_name: string;
  user_nickname: string;
  user_email: string;
  batch_id: string;
  adjust_type: 'add' | 'subtract';
  amount: number;
  previous_mileage: number;
  after_mileage: number;
  reason: string;
  created_at: string;
}

export interface AdminMemberSummary {
  id: string;
  name: string;
  nickname: string;
  email: string;
  phone: string;
  role: string;
  mileage: number;
  created_at: string;
}

export interface AdminCourseOption {
  id: string;
  title: string;
  instructor?: string;
  category?: string;
  price?: number;
  discount_price?: number;
  thumbnail?: string;
  is_free?: boolean;
}

export interface AdminEnrollmentRecord {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export interface MemberCouponItem {
  id: string;
  code: string;
  template_id: string;
  coupon_type: 'FREE_COURSE';
  coupon_name: string;
  course_id: string;
  course_title: string;
  course_instructor: string;
  course_thumbnail: string;
  course_available: boolean;
  course_start_date?: string | null;
  course_not_started?: boolean;
  course_end_date?: string | null;
  course_is_duration_based?: boolean;
  course_ended?: boolean;
  duration_days: number;
  status: 'available' | 'used' | 'revoked';
  issue_memo: string;
  issued_at: string;
  used_at: string | null;
  enrollment_expires_at: string | null;
}

export function isCourseBeforeStartDate(startDate?: string | null): boolean {
  if (!startDate) return false;
  const startMs = new Date(startDate).getTime();
  return Number.isFinite(startMs) && Date.now() < startMs;
}

export function isCourseAfterEndDate(
  endDate?: string | null,
  isDurationBased?: boolean | null
): boolean {
  if (isDurationBased || !endDate) return false;
  const endMs = new Date(endDate).getTime();
  return Number.isFinite(endMs) && Date.now() >= endMs;
}

export function formatCourseStartDateLabel(startDate?: string | null): string {
  if (!startDate) return '';
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return '';
  const datePart = d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const hours = d.getHours();
  const minutes = d.getMinutes();
  if (hours === 0 && minutes === 0) {
    return datePart;
  }
  return `${datePart} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export interface MemberMileageLogItem {
  id: string;
  adjust_type: 'add' | 'subtract';
  amount: number;
  previous_mileage: number;
  after_mileage: number;
  reason: string;
  created_at: string;
}

async function callCoreApi<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('로그인이 필요합니다.');
  }

  const response = await fetch('/api/core-api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      action,
      ...payload,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.status === 'error') {
    const err: any = new Error(data?.message || '요청을 처리하는 중 오류가 발생했습니다.');
    err.code = data?.code;
    err.courseTitle = data?.courseTitle;
    err.courseStartDate = data?.courseStartDate;
    err.courseEndDate = data?.courseEndDate;
    throw err;
  }

  return data as T;
}

export const couponMileageService = {
  // CMS 관리자 대시보드 통합 조회
  async getAdminDashboardData(): Promise<{
    templates: CouponTemplate[];
    userCoupons: AdminUserCouponRecord[];
    mileageLogs: AdminMileageLogRecord[];
    courses: AdminCourseOption[];
    members: AdminMemberSummary[];
    enrollments: AdminEnrollmentRecord[];
  }> {
    const res = await callCoreApi('admin-get-coupon-mileage-dashboard');
    return {
      templates: res.templates || [],
      userCoupons: res.userCoupons || [],
      mileageLogs: res.mileageLogs || [],
      courses: res.courses || [],
      members: res.members || [],
      enrollments: res.enrollments || [],
    };
  },

  // 쿠폰 종류(무료 강의 수강권) 생성
  async createCouponTemplate(params: {
    name: string;
    courseId: string;
    durationDays: number;
    description?: string;
  }) {
    return callCoreApi('admin-create-coupon-template', params);
  },

  // 쿠폰 종류 수정 / 활성 토글
  async updateCouponTemplate(params: {
    templateId: string;
    name?: string;
    courseId?: string;
    durationDays?: number;
    description?: string;
    active?: boolean;
  }) {
    return callCoreApi('admin-update-coupon-template', params);
  },

  // 쿠폰 종류 삭제
  async deleteCouponTemplate(templateId: string) {
    return callCoreApi('admin-delete-coupon-template', { templateId });
  },

  // 회원 개별 / 다량 쿠폰 발행
  async issueCoupons(params: {
    templateId: string;
    targetMode: 'selected' | 'all_members';
    userIds?: string[];
    issueMemo?: string;
    preventDuplicateUnused?: boolean;
  }): Promise<{
    status: string;
    issuedCount: number;
    skippedCount: number;
    message: string;
  }> {
    return callCoreApi('admin-issue-coupons', params);
  },

  // 발급 쿠폰 회수 (단건 / 다건)
  async revokeUserCoupons(userCouponIds: string[]) {
    return callCoreApi('admin-revoke-user-coupon', { userCouponIds });
  },

  // 회원 개별 / 다량 마일리지 지급 및 차감
  async issueMileage(params: {
    targetMode: 'selected' | 'all_members';
    userIds?: string[];
    adjustType: 'add' | 'subtract';
    amount: number;
    reason: string;
  }): Promise<{
    status: string;
    updatedCount: number;
    message: string;
  }> {
    return callCoreApi('admin-issue-mileage', params);
  },

  // 일반 회원: 내 보유 쿠폰 및 마일리지 적립/차감 내역 조회
  async getMyCouponsAndMileage(): Promise<{
    mileage: number;
    coupons: MemberCouponItem[];
    mileageLogs: MemberMileageLogItem[];
  }> {
    const res = await callCoreApi('get-my-coupons-and-mileage');
    return {
      mileage: Number(res.mileage) || 0,
      coupons: res.coupons || [],
      mileageLogs: res.mileageLogs || [],
    };
  },

  // 일반 회원: 보유 무료 수강 쿠폰 사용 (사용 시작일로부터 설정된 일수만큼 강의 수강 등록)
  async redeemCoupon(params: {
    userCouponId?: string;
    couponCode?: string;
  }): Promise<{
    status: string;
    message: string;
    courseId: string;
    courseTitle: string;
    durationDays: number;
    usedAt: string;
    expiresAt: string;
  }> {
    return callCoreApi('redeem-user-coupon', params);
  },
};
