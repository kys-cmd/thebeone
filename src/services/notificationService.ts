import { supabase } from '@/lib/supabase';

export type NotificationCategory =
  | 'notice'
  | 'inquiry_reply'
  | 'coupon_issued'
  | 'mileage_issued'
  | 'admin_message'
  | 'chat';

export interface NotificationMetadata {
  // 1:1 문의 답변 상세
  inquiryId?: string;
  inquiryCategory?: string;
  inquiryTitle?: string;
  inquiryQuestion?: string;
  inquiryCreatedAt?: string;
  replyContent?: string;
  repliedAt?: string;
  // 쿠폰 발행 상세
  couponName?: string;
  couponCode?: string;
  courseId?: string;
  courseTitle?: string;
  durationDays?: number;
  issueMemo?: string;
  // 마일리지 지급/차감 상세
  adjustType?: 'add' | 'subtract';
  amount?: number;
  previousMileage?: number;
  afterMileage?: number;
  reason?: string;
  // 공지사항 연동 상세
  noticeId?: string;
  isGlobalNotice?: boolean;
  targetLabel?: string;
}

export interface NotificationPayload {
  userId: string;
  targetUserIds?: string[];
  summary?: string;
  message: string;
  htmlContent?: string;
  category: NotificationCategory;
  link?: string;
  linkLabel?: string;
  senderName?: string;
  metadata?: NotificationMetadata | null;
  readBy?: string[];
}

export interface MemberNotificationItem {
  id: string;
  title: string;
  userId: string;
  category: NotificationCategory;
  summary: string;
  message: string;
  htmlContent?: string;
  link?: string;
  linkLabel?: string;
  senderName: string;
  metadata?: NotificationMetadata | null;
  isRead: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AdminSentNotificationRecord {
  id: string;
  title: string;
  category: NotificationCategory;
  summary: string;
  message: string;
  htmlContent?: string;
  link?: string;
  linkLabel?: string;
  senderName: string;
  metadata?: NotificationMetadata | null;
  targetType: 'all' | 'group' | 'single';
  targetCount: number;
  recipientLabel: string;
  readCount: number;
  created_at: string;
}

export interface AdminNoticeSummary {
  id: string;
  title: string;
  content: string;
  plainPreview: string;
  active: boolean;
  created_at: string;
}

export interface AdminNotificationMember {
  id: string;
  name: string;
  nickname: string;
  email: string;
  phone: string;
  role: string;
  created_at: string;
}

export interface AdminNotificationCourse {
  id: string;
  title: string;
  instructor?: string;
  category?: string;
  thumbnail?: string;
}

export interface AdminNotificationEnrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export function getNotificationCategoryLabel(category: string): string {
  switch (category) {
    case 'notice':
      return '공지사항';
    case 'inquiry_reply':
      return '1:1 문의 답변';
    case 'coupon_issued':
      return '쿠폰 발급';
    case 'mileage_issued':
      return '마일리지 안내';
    case 'chat':
      return '실시간 채팅';
    case 'admin_message':
    default:
      return '관리자 안내';
  }
}

async function callNotificationApi<T = any>(
  action: string,
  payload: Record<string, any> = {}
): Promise<T> {
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
    throw new Error(data?.message || '알림 요청을 처리하는 중 오류가 발생했습니다.');
  }

  return data as T;
}

export const notificationService = {
  /**
   * 개별 사용자에게 알림 생성 (채팅 초대 등 일반 사용자 간 알림 및 관리자 발송 호환)
   */
  async createNotification(
    userId: string,
    title: string,
    message: string,
    category: NotificationCategory = 'admin_message',
    link?: string,
    senderName?: string
  ) {
    if (category === 'chat' || (link && link.startsWith('/chat'))) {
      return false;
    }
    try {
      if (userId === 'all') {
        await callNotificationApi('admin-send-notification', {
          category,
          targetMode: 'all_members',
          title,
          message,
          link,
          senderName,
        });
        return true;
      }

      await callNotificationApi('create-member-notification', {
        targetUserId: userId,
        title,
        message,
        category,
        link,
        senderName,
      });
      return true;
    } catch (apiErr) {
      // Fallback to direct client insert if needed
      try {
        const payload: NotificationPayload = {
          userId,
          summary: message.slice(0, 90),
          message,
          category,
          link,
          senderName,
          readBy: [],
        };

        const { error } = await supabase.from('support_contents').insert([
          {
            type: 'notification',
            title,
            content: JSON.stringify(payload),
            active: true,
            is_deleted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);

        if (error) throw error;
        return true;
      } catch (err) {
        console.error('[NotificationService] Failed to create notification:', apiErr, err);
        return false;
      }
    }
  },

  /**
   * 전체 사용자에게 브로드캐스트 알림 생성
   */
  async createGlobalNotification(
    title: string,
    message: string,
    category: NotificationCategory = 'notice',
    link?: string
  ) {
    return this.createNotification('all', title, message, category, link, '비원아카데미 운영팀');
  },

  /**
   * 로그인한 사용자의 알림 목록 조회
   */
  async getNotificationsForUser(userId: string, limit = 120): Promise<MemberNotificationItem[]> {
    if (!userId) return [];
    try {
      const res = await callNotificationApi<{
        notifications: MemberNotificationItem[];
      }>('get-my-notifications', { limit });
      return res.notifications || [];
    } catch (err) {
      console.warn('[NotificationService] API fetch fallback:', err);
      try {
        const { data, error } = await supabase
          .from('support_contents')
          .select('*')
          .eq('type', 'notification')
          .eq('active', true)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(200);

        if (error || !data) return [];

        return data
          .map((item): MemberNotificationItem | null => {
            try {
              const parsed = JSON.parse(item.content || '{}');
              if (parsed.category === 'chat') return null;
              const isTarget =
                parsed.userId === 'all' ||
                parsed.userId === userId ||
                (Array.isArray(parsed.targetUserIds) && parsed.targetUserIds.includes(userId));
              if (!isTarget) return null;
              const readBy: string[] = Array.isArray(parsed.readBy) ? parsed.readBy : [];
              return {
                id: item.id,
                title: item.title || '알림 안내',
                userId: parsed.userId || '',
                category: (parsed.category || 'admin_message') as NotificationCategory,
                summary: parsed.summary || String(parsed.message || '').slice(0, 90),
                message: parsed.message || '',
                htmlContent: parsed.htmlContent || '',
                link: parsed.link || '',
                linkLabel: parsed.linkLabel || '',
                senderName: parsed.senderName || '비원아카데미 운영팀',
                metadata: parsed.metadata || null,
                isRead: readBy.includes(userId),
                created_at: item.created_at,
                updated_at: item.updated_at,
              };
            } catch {
              return null;
            }
          })
          .filter((v): v is MemberNotificationItem => v !== null)
          .slice(0, limit);
      } catch {
        return [];
      }
    }
  },

  /**
   * 알림 단건 상세 조회 (자동 읽음 처리 및 원본 문의/공지 전문 보강 포함)
   */
  async getNotificationDetail(
    notificationId: string,
    markRead = true
  ): Promise<MemberNotificationItem> {
    const res = await callNotificationApi<{ notification: MemberNotificationItem }>(
      'get-my-notification-detail',
      { notificationId, markRead }
    );
    window.dispatchEvent(new Event('notifications-updated'));
    return res.notification;
  },

  /**
   * 단건 알림 읽음 처리
   */
  async markAsRead(notificationId: string, userId?: string): Promise<boolean> {
    try {
      await callNotificationApi('mark-notification-read', { notificationId });
      window.dispatchEvent(new Event('notifications-updated'));
      return true;
    } catch (err) {
      if (!userId) return false;
      try {
        const { data } = await supabase
          .from('support_contents')
          .select('*')
          .eq('id', notificationId)
          .single();
        if (!data) return false;
        const parsed = JSON.parse(data.content || '{}');
        const readBy: string[] = Array.isArray(parsed.readBy) ? parsed.readBy : [];
        if (!readBy.includes(userId)) {
          parsed.readBy = [...readBy, userId];
          await supabase
            .from('support_contents')
            .update({ content: JSON.stringify(parsed), updated_at: new Date().toISOString() })
            .eq('id', notificationId);
        }
        window.dispatchEvent(new Event('notifications-updated'));
        return true;
      } catch {
        console.error('[NotificationService] markAsRead failed:', err);
        return false;
      }
    }
  },

  /**
   * 전체 미읽음 알림 일괄 읽음 처리
   */
  async markAllAsRead(userId?: string): Promise<boolean> {
    try {
      await callNotificationApi('mark-all-notifications-read');
      window.dispatchEvent(new Event('notifications-updated'));
      return true;
    } catch (err) {
      if (!userId) return false;
      console.error('[NotificationService] markAllAsRead failed:', err);
      return false;
    }
  },

  /**
   * CMS 관리자: 1:1 문의 답변 저장 + 질문 원문 & 답변 전문 알림 즉시 발송
   */
  async replyInquiryWithNotification(params: {
    inquiryId: string;
    replyMessage: string;
  }): Promise<{ status: string; notificationSent: boolean; message: string }> {
    return callNotificationApi('admin-reply-inquiry', params);
  },

  /**
   * CMS 관리자: 알림/푸시 센터 통합 대시보드 조회
   */
  async getAdminDashboardData(): Promise<{
    sentNotifications: AdminSentNotificationRecord[];
    notices: AdminNoticeSummary[];
    courses: AdminNotificationCourse[];
    members: AdminNotificationMember[];
    enrollments: AdminNotificationEnrollment[];
  }> {
    const res = await callNotificationApi('admin-get-notification-dashboard');
    return {
      sentNotifications: res.sentNotifications || [],
      notices: res.notices || [],
      courses: res.courses || [],
      members: res.members || [],
      enrollments: res.enrollments || [],
    };
  },

  /**
   * CMS 관리자: 맞춤 알림 / 전체 공지사항 푸시 발송
   */
  async sendAdminNotification(params: {
    category: 'notice' | 'admin_message';
    targetMode: 'all_members' | 'selected';
    userIds?: string[];
    targetLabel?: string;
    title: string;
    summary?: string;
    message: string;
    htmlContent?: string;
    link?: string;
    linkLabel?: string;
    senderName?: string;
    noticeId?: string;
  }): Promise<{
    status: string;
    notificationId?: string;
    recipientCount?: number;
    message: string;
  }> {
    return callNotificationApi('admin-send-notification', params);
  },

  /**
   * CMS 관리자: 기존 등록 공지사항 원클릭 전체 회원 푸시
   */
  async pushExistingNotice(noticeId: string): Promise<{
    status: string;
    notificationId?: string;
    message: string;
  }> {
    return callNotificationApi('admin-push-existing-notice', { noticeId });
  },

  /**
   * CMS 관리자: 발송된 알림 회수/삭제
   */
  async deleteAdminNotifications(notificationIds: string[]): Promise<{
    status: string;
    deletedCount: number;
    message: string;
  }> {
    return callNotificationApi('admin-delete-notification', { notificationIds });
  },

  /**
   * Supabase Realtime 실시간 알림 변경 구독
   */
  subscribeToNotifications(onNewNotification: (payload: any) => void) {
    const channelName = `support_notifications_${Math.random().toString(36).slice(2, 9)}`;
    return supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_contents',
          filter: 'type=eq.notification',
        },
        (payload) => {
          onNewNotification(payload.new);
        }
      )
      .subscribe();
  },
};
