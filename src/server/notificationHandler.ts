import type { SupabaseClient, User } from "@supabase/supabase-js";

export type NotificationCategory =
  | "notice"
  | "inquiry_reply"
  | "coupon_issued"
  | "mileage_issued"
  | "admin_message"
  | "chat";

export const NOTIFICATION_ACTIONS = new Set([
  "get-my-notifications",
  "get-my-notification-detail",
  "mark-notification-read",
  "mark-all-notifications-read",
  "create-member-notification",
  "admin-reply-inquiry",
  "admin-get-notification-dashboard",
  "admin-send-notification",
  "admin-push-existing-notice",
  "admin-delete-notification",
]);

export interface CoreApiResult {
  httpStatus: number;
  payload: Record<string, any>;
}

function safeParseJson<T = Record<string, any>>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function stripHtmlToPlainText(htmlOrText: string): string {
  if (!htmlOrText) return "";
  return htmlOrText
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildSummary(text: string, maxLen = 90): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen)}...`;
}

async function fetchAllRows<T = any>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000,
  maxRows = 15000
): Promise<{ data: T[]; error: any }> {
  const all: T[] = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const { data, error } = await buildQuery(offset, offset + pageSize - 1);
    if (error) return { data: all, error };
    const batch = data || [];
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return { data: all, error: null };
}

async function fetchProfilesByIds(
  supabaseAdmin: SupabaseClient,
  ids: string[]
): Promise<{ data: any[]; error: any }> {
  const all: any[] = [];
  const chunkSize = 150;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .in("id", chunk)
      .eq("is_deleted", false);
    if (error) return { data: all, error };
    if (data) all.push(...data);
  }
  return { data: all, error: null };
}

function isRecipientForNotification(parsed: Record<string, any>, userId: string): boolean {
  if (!userId) return false;
  if (parsed.userId === "all" || parsed.userId === userId) return true;
  if (Array.isArray(parsed.targetUserIds) && parsed.targetUserIds.includes(userId)) {
    return true;
  }
  return false;
}

function normalizeCategory(rawCategory: any, title: string): NotificationCategory {
  if (
    rawCategory === "notice" ||
    rawCategory === "inquiry_reply" ||
    rawCategory === "coupon_issued" ||
    rawCategory === "mileage_issued" ||
    rawCategory === "admin_message" ||
    rawCategory === "chat"
  ) {
    return rawCategory;
  }
  if (title.startsWith("문의 답변:") || title.includes("1:1 문의 답변")) {
    return "inquiry_reply";
  }
  return "admin_message";
}

function mapRowToMemberNotification(row: any, userId: string) {
  const parsed = safeParseJson<Record<string, any>>(row.content, {});
  const readBy: string[] = Array.isArray(parsed.readBy) ? parsed.readBy : [];
  const category = normalizeCategory(parsed.category, row.title || "");
  const plainMessage = String(parsed.message || "");
  const summary = String(parsed.summary || buildSummary(plainMessage, 90));

  return {
    id: row.id,
    title: row.title || "알림 안내",
    userId: parsed.userId || "",
    category,
    summary,
    message: plainMessage,
    htmlContent: parsed.htmlContent || "",
    link: parsed.link || "",
    linkLabel: parsed.linkLabel || "",
    senderName: parsed.senderName || "비원아카데미 운영팀",
    metadata: parsed.metadata || null,
    isRead: readBy.includes(userId),
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  };
}

/**
 * 쿠폰 발급 시 각 대상 회원에게 상세 쿠폰 발행 알림을 생성합니다.
 */
export async function insertCouponIssuedNotifications(params: {
  supabaseAdmin: SupabaseClient;
  issuedItems: Array<{
    userId: string;
    userName: string;
    couponName: string;
    couponCode: string;
    courseId: string;
    courseTitle: string;
    durationDays: number;
    maxViews?: number | null;
    issueMemo: string;
  }>;
  senderName?: string;
}): Promise<number> {
  const { supabaseAdmin, issuedItems, senderName = "비원아카데미 운영팀" } = params;
  if (!issuedItems.length) return 0;

  const nowIso = new Date().toISOString();
  const notifRows = issuedItems.map((item) => {
    const viewLimitLabel =
      item.maxViews && item.maxViews > 0
        ? `수강 기간 내 최대 ${item.maxViews}회 시청 가능`
        : "수강 기간 내 무제한 시청";
    const lines = [
      `안녕하세요, ${item.userName || "회원"}님! 비원아카데미에서 무료 수강 쿠폰을 발급해 드렸습니다.`,
      "",
      `• 발급 쿠폰명: ${item.couponName}`,
      `• 적용 강의: ${item.courseTitle}`,
      `• 무료 수강 기간: 쿠폰 사용 시작일로부터 ${item.durationDays}일간 수강 가능`,
      `• 시청 가능 횟수: ${viewLimitLabel}`,
      `• 전용 쿠폰 코드: ${item.couponCode}`,
    ];
    if (item.issueMemo) {
      lines.push(`• 발급 안내 메모: ${item.issueMemo}`);
    }
    lines.push(
      "",
      "마이페이지 > 결제 · 쿠폰 · 마일리지 탭(또는 해당 강의 상세 페이지)에서 쿠폰을 적용하시면 사용 즉시 수강 권한이 활성화됩니다."
    );

    const fullMessage = lines.join("\n");
    const summaryLimit =
      item.maxViews && item.maxViews > 0 ? ` · 최대 ${item.maxViews}회 시청` : "";
    return {
      type: "notification",
      title: `[쿠폰 발급] '${item.couponName}' 쿠폰이 도착했습니다`,
      active: true,
      is_deleted: false,
      created_at: nowIso,
      updated_at: nowIso,
      content: JSON.stringify({
        userId: item.userId,
        category: "coupon_issued" satisfies NotificationCategory,
        summary: `${item.courseTitle} · 사용 시작일로부터 ${item.durationDays}일 무료 수강${summaryLimit} (${item.couponCode})`,
        message: fullMessage,
        senderName,
        link: "/mypage?tab=payments",
        linkLabel: "내 쿠폰함에서 확인 · 사용하기",
        metadata: {
          couponName: item.couponName,
          couponCode: item.couponCode,
          courseId: item.courseId,
          courseTitle: item.courseTitle,
          durationDays: item.durationDays,
          maxViews: item.maxViews ?? null,
          issueMemo: item.issueMemo,
        },
        readBy: [],
      }),
    };
  });

  const chunkSize = 200;
  let insertedCount = 0;
  for (let i = 0; i < notifRows.length; i += chunkSize) {
    const chunk = notifRows.slice(i, i + chunkSize);
    const { error } = await supabaseAdmin.from("support_contents").insert(chunk);
    if (!error) {
      insertedCount += chunk.length;
    } else {
      console.warn("[Notification] Coupon push insert warning:", error.message);
    }
  }
  return insertedCount;
}

/**
 * 마일리지 지급/차감 시 각 대상 회원에게 상세 내역 알림을 생성합니다.
 */
export async function insertMileageIssuedNotifications(params: {
  supabaseAdmin: SupabaseClient;
  mileageItems: Array<{
    userId: string;
    userName: string;
    adjustType: "add" | "subtract";
    requestedAmount: number;
    actualDelta: number;
    previousMileage: number;
    afterMileage: number;
    reason: string;
  }>;
  senderName?: string;
}): Promise<number> {
  const { supabaseAdmin, mileageItems, senderName = "비원아카데미 운영팀" } = params;
  if (!mileageItems.length) return 0;

  const nowIso = new Date().toISOString();
  const notifRows = mileageItems.map((item) => {
    const isAdd = item.adjustType === "add";
    const absAmount = Math.abs(isAdd ? item.requestedAmount : item.actualDelta || item.requestedAmount);
    const lines = [
      `안녕하세요, ${item.userName || "회원"}님! 회원님의 마일리지 ${isAdd ? "적립(지급)" : "차감(조정)"} 내역을 안내해 드립니다.`,
      "",
      `• 처리 구분: 마일리지 ${isAdd ? "지급 (+)" : "차감 (-)"}`,
      `• 변동 마일리지: ${isAdd ? "+" : "-"}${absAmount.toLocaleString()}P`,
      `• 변경 전 보유 마일리지: ${item.previousMileage.toLocaleString()}P`,
      `• 변경 후 보유 마일리지: ${item.afterMileage.toLocaleString()}P`,
      `• 상세 사유: ${item.reason}`,
      "",
      "보유하신 마일리지 내역은 마이페이지 > 결제 · 쿠폰 · 마일리지 탭에서 언제든지 확인하실 수 있습니다.",
    ];

    return {
      type: "notification",
      title: isAdd
        ? `[마일리지 지급] ${absAmount.toLocaleString()}P 마일리지가 적립되었습니다`
        : `[마일리지 조정] ${absAmount.toLocaleString()}P 마일리지가 차감되었습니다`,
      active: true,
      is_deleted: false,
      created_at: nowIso,
      updated_at: nowIso,
      content: JSON.stringify({
        userId: item.userId,
        category: "mileage_issued" satisfies NotificationCategory,
        summary: `${item.reason} · 현재 보유 마일리지 ${item.afterMileage.toLocaleString()}P`,
        message: lines.join("\n"),
        senderName,
        link: "/mypage?tab=payments",
        linkLabel: "내 마일리지 내역 확인하기",
        metadata: {
          adjustType: item.adjustType,
          amount: isAdd ? absAmount : -absAmount,
          previousMileage: item.previousMileage,
          afterMileage: item.afterMileage,
          reason: item.reason,
        },
        readBy: [],
      }),
    };
  });

  const chunkSize = 200;
  let insertedCount = 0;
  for (let i = 0; i < notifRows.length; i += chunkSize) {
    const chunk = notifRows.slice(i, i + chunkSize);
    const { error } = await supabaseAdmin.from("support_contents").insert(chunk);
    if (!error) {
      insertedCount += chunk.length;
    } else {
      console.warn("[Notification] Mileage push insert warning:", error.message);
    }
  }
  return insertedCount;
}

export async function handleNotificationAction(params: {
  action: string;
  body: Record<string, any>;
  supabaseAdmin: SupabaseClient;
  requestingUser: User | null;
  isAdminCheck: (userId: string) => Promise<boolean>;
}): Promise<CoreApiResult> {
  const { action, body, supabaseAdmin, requestingUser, isAdminCheck } = params;

  if (!requestingUser) {
    return {
      httpStatus: 401,
      payload: { status: "error", message: "로그인이 필요한 기능입니다. 다시 로그인해 주세요." },
    };
  }

  const isAdminAction = action.startsWith("admin-");
  if (isAdminAction) {
    const callerIsAdmin = await isAdminCheck(requestingUser.id);
    if (!callerIsAdmin) {
      return {
        httpStatus: 403,
        payload: { status: "error", message: "관리자 권한이 필요합니다." },
      };
    }
  }

  // ===========================================================================
  // 1. MEMBER: 내 알림 전체 목록 조회
  // ===========================================================================
  if (action === "get-my-notifications") {
    const uid = requestingUser.id;
    const limit = Math.min(300, Math.max(20, Number(body.limit) || 120));

    const { data, error } = await fetchAllRows(
      (from, to) =>
        supabaseAdmin
          .from("support_contents")
          .select("*")
          .eq("type", "notification")
          .eq("active", true)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .range(from, to),
      500,
      3000
    );

    if (error) {
      return { httpStatus: 500, payload: { status: "error", message: error.message } };
    }

    const notifications = (data || [])
      .filter((row: any) => {
        const parsed = safeParseJson<Record<string, any>>(row.content, {});
        if (parsed.category === "chat") return false;
        return isRecipientForNotification(parsed, uid);
      })
      .slice(0, limit)
      .map((row: any) => mapRowToMemberNotification(row, uid));

    return {
      httpStatus: 200,
      payload: {
        status: "success",
        notifications,
        unreadCount: notifications.filter((n) => !n.isRead).length,
      },
    };
  }

  // ===========================================================================
  // 2. MEMBER: 알림 단건 상세 조회 + 자동 읽음 처리 + 연결 문의/공지 보강
  // ===========================================================================
  if (action === "get-my-notification-detail") {
    const uid = requestingUser.id;
    const { notificationId, markRead = true } = body;

    if (!notificationId) {
      return { httpStatus: 400, payload: { status: "error", message: "조회할 알림 ID가 필요합니다." } };
    }

    const { data: row, error } = await supabaseAdmin
      .from("support_contents")
      .select("*")
      .eq("id", notificationId)
      .eq("type", "notification")
      .eq("is_deleted", false)
      .maybeSingle();

    if (error || !row) {
      return { httpStatus: 404, payload: { status: "error", message: "해당 알림을 찾을 수 없거나 삭제되었습니다." } };
    }

    const parsed = safeParseJson<Record<string, any>>(row.content, {});
    const callerIsAdmin = await isAdminCheck(uid);

    if (!isRecipientForNotification(parsed, uid) && !callerIsAdmin) {
      return { httpStatus: 403, payload: { status: "error", message: "본인에게 발송된 알림만 열람할 수 있습니다." } };
    }

    const readBy: string[] = Array.isArray(parsed.readBy) ? [...parsed.readBy] : [];
    if (markRead && isRecipientForNotification(parsed, uid) && !readBy.includes(uid)) {
      readBy.push(uid);
      parsed.readBy = readBy;
      await supabaseAdmin
        .from("support_contents")
        .update({
          content: JSON.stringify(parsed),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      row.content = JSON.stringify(parsed);
    }

    const detail = mapRowToMemberNotification(row, uid);

    // 연결된 원본 1:1 문의 레코드가 있다면 최신 질문/답변 전문 보강 (구버전 알림과도 완벽 호환)
    const inquiryId = detail.metadata?.inquiryId;
    if (inquiryId) {
      const { data: inqRow } = await supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("id", inquiryId)
        .eq("type", "inquiry")
        .eq("is_deleted", false)
        .maybeSingle();
      if (inqRow) {
        const inqParsed = safeParseJson<Record<string, any>>(inqRow.content, {});
        detail.metadata = {
          ...(detail.metadata || {}),
          inquiryId: inqRow.id,
          inquiryCategory: inqParsed.category || detail.metadata?.inquiryCategory || "1:1 문의",
          inquiryTitle: inqRow.title || detail.metadata?.inquiryTitle || "",
          inquiryQuestion: inqParsed.message || detail.metadata?.inquiryQuestion || "",
          inquiryCreatedAt: inqRow.created_at || detail.metadata?.inquiryCreatedAt || "",
          replyContent: inqParsed.reply || detail.metadata?.replyContent || detail.message,
          repliedAt: inqParsed.replied_at || detail.metadata?.repliedAt || detail.created_at,
        };
      }
    }

    // 연결된 공지사항 ID가 있고 htmlContent가 비어있다면 최신 공지 본문 보강
    const noticeId = detail.metadata?.noticeId;
    if (noticeId && !detail.htmlContent) {
      const { data: noticeRow } = await supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("id", noticeId)
        .eq("type", "notice")
        .eq("is_deleted", false)
        .maybeSingle();
      if (noticeRow && noticeRow.content) {
        detail.htmlContent = noticeRow.content;
      }
    }

    return {
      httpStatus: 200,
      payload: {
        status: "success",
        notification: detail,
      },
    };
  }

  // ===========================================================================
  // 3. MEMBER: 단건 알림 읽음 처리
  // ===========================================================================
  if (action === "mark-notification-read") {
    const uid = requestingUser.id;
    const { notificationId } = body;
    if (!notificationId) {
      return { httpStatus: 400, payload: { status: "error", message: "알림 ID가 필요합니다." } };
    }

    const { data: row, error } = await supabaseAdmin
      .from("support_contents")
      .select("id, content")
      .eq("id", notificationId)
      .eq("type", "notification")
      .eq("is_deleted", false)
      .maybeSingle();

    if (error || !row) {
      return { httpStatus: 404, payload: { status: "error", message: "알림을 찾을 수 없습니다." } };
    }

    const parsed = safeParseJson<Record<string, any>>(row.content, {});
    if (!isRecipientForNotification(parsed, uid)) {
      return { httpStatus: 403, payload: { status: "error", message: "권한이 없습니다." } };
    }

    const readBy: string[] = Array.isArray(parsed.readBy) ? parsed.readBy : [];
    if (!readBy.includes(uid)) {
      parsed.readBy = [...readBy, uid];
      await supabaseAdmin
        .from("support_contents")
        .update({
          content: JSON.stringify(parsed),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }

    return { httpStatus: 200, payload: { status: "success" } };
  }

  // ===========================================================================
  // 4. MEMBER: 내 미읽음 알림 전체 읽음 처리
  // ===========================================================================
  if (action === "mark-all-notifications-read") {
    const uid = requestingUser.id;

    const { data, error } = await fetchAllRows(
      (from, to) =>
        supabaseAdmin
          .from("support_contents")
          .select("id, content")
          .eq("type", "notification")
          .eq("active", true)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .range(from, to),
      500,
      2000
    );

    if (error) {
      return { httpStatus: 500, payload: { status: "error", message: error.message } };
    }

    const unreadRows = (data || []).filter((row: any) => {
      const parsed = safeParseJson<Record<string, any>>(row.content, {});
      if (!isRecipientForNotification(parsed, uid)) return false;
      const readBy: string[] = Array.isArray(parsed.readBy) ? parsed.readBy : [];
      return !readBy.includes(uid);
    });

    const nowIso = new Date().toISOString();
    const concurrency = 25;
    for (let i = 0; i < unreadRows.length; i += concurrency) {
      const chunk = unreadRows.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (row: any) => {
          const parsed = safeParseJson<Record<string, any>>(row.content, {});
          const readBy: string[] = Array.isArray(parsed.readBy) ? parsed.readBy : [];
          if (!readBy.includes(uid)) {
            parsed.readBy = [...readBy, uid];
            await supabaseAdmin
              .from("support_contents")
              .update({
                content: JSON.stringify(parsed),
                updated_at: nowIso,
              })
              .eq("id", row.id);
          }
        })
      );
    }

    return {
      httpStatus: 200,
      payload: { status: "success", markedCount: unreadRows.length },
    };
  }

  // ===========================================================================
  // 5. MEMBER: 실시간 채팅 초대 등 일반 회원의 상대방 알림 생성
  // ===========================================================================
  if (action === "create-member-notification") {
    const { targetUserId, title, message, category, link, senderName } = body;
    if (category === "chat" || String(link || "").startsWith("/chat")) {
      return {
        httpStatus: 403,
        payload: { status: "error", message: "현재 실시간 채팅 기능이 비활성화되어 있습니다." },
      };
    }
    if (!targetUserId || targetUserId === "all") {
      return { httpStatus: 400, payload: { status: "error", message: "유효한 수신 대상 회원 ID가 필요합니다." } };
    }
    const cleanTitle = String(title || "").trim();
    const cleanMessage = String(message || "").trim();
    if (!cleanTitle || !cleanMessage) {
      return { httpStatus: 400, payload: { status: "error", message: "알림 제목과 내용을 입력해 주세요." } };
    }

    const safeCategory: NotificationCategory = "admin_message";
    const nowIso = new Date().toISOString();
    const { data: inserted, error } = await supabaseAdmin
      .from("support_contents")
      .insert([
        {
          type: "notification",
          title: cleanTitle,
          active: true,
          is_deleted: false,
          created_at: nowIso,
          updated_at: nowIso,
          content: JSON.stringify({
            userId: targetUserId,
            category: safeCategory,
            summary: buildSummary(cleanMessage, 90),
            message: cleanMessage,
            link: link || "",
            senderName: senderName || requestingUser.user_metadata?.name || "회원",
            readBy: [],
          }),
        },
      ])
      .select("id")
      .single();

    if (error) {
      return { httpStatus: 500, payload: { status: "error", message: error.message } };
    }

    return {
      httpStatus: 200,
      payload: { status: "success", notificationId: inserted?.id },
    };
  }

  // ===========================================================================
  // 6. ADMIN: 1:1 문의 답변 저장 + 문의 원문 & 답변 전문 알림 푸시
  // ===========================================================================
  if (action === "admin-reply-inquiry") {
    const { inquiryId, replyMessage } = body;
    const cleanReply = String(replyMessage || "").trim();

    if (!inquiryId || !cleanReply) {
      return {
        httpStatus: 400,
        payload: { status: "error", message: "문의 ID와 답변 내용을 정확히 입력해 주세요." },
      };
    }

    const { data: inquiryRow, error: fetchErr } = await supabaseAdmin
      .from("support_contents")
      .select("*")
      .eq("id", inquiryId)
      .eq("type", "inquiry")
      .eq("is_deleted", false)
      .maybeSingle();

    if (fetchErr || !inquiryRow) {
      return { httpStatus: 404, payload: { status: "error", message: "원본 1:1 문의 내역을 찾을 수 없습니다." } };
    }

    const parsedInq = safeParseJson<Record<string, any>>(inquiryRow.content, {});
    const repliedAtIso = new Date().toISOString();
    const updatedInqContent = {
      ...parsedInq,
      reply: cleanReply,
      replied_at: repliedAtIso,
      replied_by: requestingUser.id,
    };

    const { error: updErr } = await supabaseAdmin
      .from("support_contents")
      .update({
        content: JSON.stringify(updatedInqContent),
        updated_at: repliedAtIso,
      })
      .eq("id", inquiryId);

    if (updErr) {
      return { httpStatus: 500, payload: { status: "error", message: updErr.message } };
    }

    let targetUserId: string | null = parsedInq.userId || null;
    if (!targetUserId && parsedInq.email) {
      const { data: matchedProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", String(parsedInq.email).trim())
        .eq("is_deleted", false)
        .maybeSingle();
      if (matchedProfile?.id) {
        targetUserId = matchedProfile.id;
      }
    }

    let notificationSent = false;
    if (targetUserId) {
      const inquiryTitle = inquiryRow.title || "1:1 문의";
      const inquiryCategory = parsedInq.category || "일반문의";
      const inquiryQuestion = String(parsedInq.message || "");

      const fullMessage = [
        `문의하신 '${inquiryTitle}' 건에 대한 답변이 등록되었습니다.`,
        "",
        "[관리자 답변 내용]",
        cleanReply,
      ].join("\n");

      const { error: notifErr } = await supabaseAdmin.from("support_contents").insert([
        {
          type: "notification",
          title: `[1:1 문의 답변] ${inquiryTitle}`,
          active: true,
          is_deleted: false,
          created_at: repliedAtIso,
          updated_at: repliedAtIso,
          content: JSON.stringify({
            userId: targetUserId,
            category: "inquiry_reply" satisfies NotificationCategory,
            summary: buildSummary(cleanReply, 90),
            message: fullMessage,
            senderName: "비원아카데미 고객지원팀",
            link: "/support/inquiry",
            linkLabel: "추가 1:1 문의하기",
            metadata: {
              inquiryId: inquiryRow.id,
              inquiryCategory,
              inquiryTitle,
              inquiryQuestion,
              inquiryCreatedAt: inquiryRow.created_at,
              replyContent: cleanReply,
              repliedAt: repliedAtIso,
            },
            readBy: [],
          }),
        },
      ]);

      notificationSent = !notifErr;
    }

    return {
      httpStatus: 200,
      payload: {
        status: "success",
        notificationSent,
        message: notificationSent
          ? "1:1 문의 답변이 저장되었으며, 문의하신 회원에게 상세 답변 알림이 즉시 발송되었습니다."
          : "1:1 문의 답변이 저장되었습니다. (비회원 문의로 푸시 알림은 생략되었습니다.)",
      },
    };
  }

  // ===========================================================================
  // 7. ADMIN: CMS 알림/푸시 통합 관리 대시보드 조회
  // ===========================================================================
  if (action === "admin-get-notification-dashboard") {
    const [notifsRes, noticesRes, coursesRes, membersRes, enrollmentsRes] = await Promise.all([
      fetchAllRows(
        (from, to) =>
          supabaseAdmin
            .from("support_contents")
            .select("*")
            .eq("type", "notification")
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .range(from, to),
        1000,
        5000
      ),
      supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("type", "notice")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("courses")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false }),
      fetchAllRows((from, to) =>
        supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .range(from, to)
      ),
      fetchAllRows((from, to) =>
        supabaseAdmin
          .from("enrollments")
          .select("*")
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .range(from, to)
      ),
    ]);

    const firstErr =
      notifsRes.error || noticesRes.error || coursesRes.error || membersRes.error || enrollmentsRes.error;
    if (firstErr) {
      return { httpStatus: 500, payload: { status: "error", message: firstErr.message } };
    }

    const courses = (coursesRes.data || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      instructor: c.instructor || "",
      category: c.category || "",
      thumbnail: c.thumbnail || c.thumbnail_url || "",
    }));
    const members = membersRes.data || [];
    const courseMap = new Map<string, any>(courses.map((c: any) => [c.id, c]));
    const memberMap = new Map<string, any>(members.map((m: any) => [m.id, m]));

    const now = new Date();
    const enrollments = (enrollmentsRes.data || [])
      .filter((enr: any) => memberMap.has(enr.user_id) && courseMap.has(enr.course_id))
      .map((enr: any) => {
        const rawCourse = (coursesRes.data || []).find((c: any) => c.id === enr.course_id);
        let isActive = enr.status !== "expired";
        if (isActive) {
          if (enr.expires_at) {
            isActive = new Date(enr.expires_at) > now;
          } else if (rawCourse && !rawCourse.is_duration_based && rawCourse.end_date) {
            isActive = new Date(rawCourse.end_date) > now;
          }
        }
        return {
          id: enr.id,
          user_id: enr.user_id,
          course_id: enr.course_id,
          status: enr.status || "active",
          created_at: enr.created_at,
          expires_at: enr.expires_at || null,
          is_active: isActive,
        };
      });

    const sentNotifications = (notifsRes.data || [])
      .filter((row: any) => {
        if (row.active === false) return false;
        const parsed = safeParseJson<Record<string, any>>(row.content, {});
        return parsed.category !== "chat";
      })
      .slice(0, 500)
      .map((row: any) => {
        const parsed = safeParseJson<Record<string, any>>(row.content, {});
        const category = normalizeCategory(parsed.category, row.title || "");
        const readBy: string[] = Array.isArray(parsed.readBy) ? parsed.readBy : [];
        const targetIds: string[] = Array.isArray(parsed.targetUserIds) ? parsed.targetUserIds : [];

        let targetType: "all" | "group" | "single" = "single";
        let targetCount = 1;
        let recipientLabel = "개별 회원";

        if (parsed.userId === "all") {
          targetType = "all";
          targetCount = members.length;
          recipientLabel = parsed.metadata?.targetLabel || `전체 회원 (${members.length.toLocaleString()}명)`;
        } else if (targetIds.length > 0) {
          targetType = "group";
          targetCount = targetIds.length;
          recipientLabel = parsed.metadata?.targetLabel || `선택 회원 ${targetIds.length.toLocaleString()}명`;
        } else if (parsed.userId) {
          const m = memberMap.get(parsed.userId);
          recipientLabel = m
            ? `${m.name || m.full_name || m.nickname || "회원"} (${m.email || ""})`
            : "개별 회원";
        }

        return {
          id: row.id,
          title: row.title || "알림",
          category,
          summary: String(parsed.summary || buildSummary(String(parsed.message || ""), 90)),
          message: String(parsed.message || ""),
          htmlContent: parsed.htmlContent || "",
          link: parsed.link || "",
          linkLabel: parsed.linkLabel || "",
          senderName: parsed.senderName || "비원아카데미 운영팀",
          metadata: parsed.metadata || null,
          targetType,
          targetCount,
          recipientLabel,
          readCount: readBy.length,
          created_at: row.created_at,
        };
      });

    const notices = (noticesRes.data || []).map((n: any) => ({
      id: n.id,
      title: n.title || "",
      content: n.content || "",
      plainPreview: buildSummary(stripHtmlToPlainText(n.content || ""), 120),
      active: Boolean(n.active),
      created_at: n.created_at,
    }));

    return {
      httpStatus: 200,
      payload: {
        status: "success",
        sentNotifications,
        notices,
        courses,
        enrollments,
        members: members.map((m: any) => ({
          id: m.id,
          name: m.name || m.full_name || "",
          nickname: m.nickname || "",
          email: m.email || "",
          phone: m.mobile_phone || m.phone || "",
          role: m.role || "user",
          created_at: m.created_at,
        })),
      },
    };
  }

  // ===========================================================================
  // 8. ADMIN: 맞춤 알림 / 전체 공지사항 푸시 발송
  // ===========================================================================
  if (action === "admin-send-notification") {
    const {
      category,
      targetMode,
      userIds,
      targetLabel,
      title,
      summary,
      message,
      htmlContent,
      link,
      linkLabel,
      senderName,
      noticeId,
    } = body;

    const cleanTitle = String(title || "").trim();
    const rawHtml = String(htmlContent || "").trim();
    const cleanMessage = String(message || "").trim() || stripHtmlToPlainText(rawHtml);

    if (!cleanTitle) {
      return { httpStatus: 400, payload: { status: "error", message: "알림 제목을 입력해 주세요." } };
    }
    if (!cleanMessage && !rawHtml) {
      return { httpStatus: 400, payload: { status: "error", message: "알림 상세 내용을 입력해 주세요." } };
    }

    const resolvedCategory: NotificationCategory =
      category === "notice" ? "notice" : "admin_message";
    const resolvedSummary = String(summary || "").trim() || buildSummary(cleanMessage, 90);
    const resolvedSender = String(senderName || "").trim() || "비원아카데미 운영팀";
    const resolvedLink = String(link || "").trim();
    const resolvedLinkLabel =
      String(linkLabel || "").trim() ||
      (resolvedLink === "/support/notice"
        ? "공지사항 게시판 바로가기"
        : resolvedLink === "/mypage?tab=payments"
          ? "내 쿠폰 · 마일리지함 보기"
          : resolvedLink
            ? "관련 페이지 바로가기"
            : "");

    const nowIso = new Date().toISOString();

    if (targetMode === "all_members") {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("support_contents")
        .insert([
          {
            type: "notification",
            title: cleanTitle,
            active: true,
            is_deleted: false,
            created_at: nowIso,
            updated_at: nowIso,
            content: JSON.stringify({
              userId: "all",
              category: resolvedCategory,
              summary: resolvedSummary,
              message: cleanMessage,
              htmlContent: rawHtml || undefined,
              link: resolvedLink,
              linkLabel: resolvedLinkLabel,
              senderName: resolvedSender,
              metadata: {
                noticeId: noticeId || undefined,
                isGlobalNotice: true,
                targetLabel: targetLabel || "전체 회원 일괄 발송",
              },
              readBy: [],
            }),
          },
        ])
        .select("id")
        .single();

      if (insErr) {
        return { httpStatus: 500, payload: { status: "error", message: insErr.message } };
      }

      return {
        httpStatus: 200,
        payload: {
          status: "success",
          notificationId: inserted?.id,
          recipientScope: "all_members",
          message: "전체 회원을 대상으로 실시간 알림 푸시가 발송되었습니다.",
        },
      };
    }

    const uniqueIds = Array.from(new Set(Array.isArray(userIds) ? userIds.filter(Boolean) : []));
    if (uniqueIds.length === 0) {
      return {
        httpStatus: 400,
        payload: { status: "error", message: "알림을 수신할 대상 회원을 1명 이상 선택해 주세요." },
      };
    }

    const { data: validProfiles, error: profErr } = await fetchProfilesByIds(supabaseAdmin, uniqueIds);
    if (profErr) {
      return { httpStatus: 500, payload: { status: "error", message: profErr.message } };
    }
    const validIds = (validProfiles || []).map((p: any) => p.id);
    if (validIds.length === 0) {
      return { httpStatus: 400, payload: { status: "error", message: "유효한 수신 대상 회원이 없습니다." } };
    }

    const isSingle = validIds.length === 1;
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("support_contents")
      .insert([
        {
          type: "notification",
          title: cleanTitle,
          active: true,
          is_deleted: false,
          created_at: nowIso,
          updated_at: nowIso,
          content: JSON.stringify({
            userId: isSingle ? validIds[0] : "targeted",
            targetUserIds: isSingle ? undefined : validIds,
            category: resolvedCategory,
            summary: resolvedSummary,
            message: cleanMessage,
            htmlContent: rawHtml || undefined,
            link: resolvedLink,
            linkLabel: resolvedLinkLabel,
            senderName: resolvedSender,
            metadata: {
              noticeId: noticeId || undefined,
              isGlobalNotice: false,
              targetLabel:
                targetLabel ||
                (isSingle ? "개별 회원 발송" : `선택 회원 ${validIds.length.toLocaleString()}명 발송`),
            },
            readBy: [],
          }),
        },
      ])
      .select("id")
      .single();

    if (insErr) {
      return { httpStatus: 500, payload: { status: "error", message: insErr.message } };
    }

    return {
      httpStatus: 200,
      payload: {
        status: "success",
        notificationId: inserted?.id,
        recipientCount: validIds.length,
        message: `총 ${validIds.length.toLocaleString()}명의 회원에게 알림 푸시가 발송되었습니다.`,
      },
    };
  }

  // ===========================================================================
  // 9. ADMIN: 등록된 공지사항(noticeId) 원클릭 전체 회원 알림 푸시
  // ===========================================================================
  if (action === "admin-push-existing-notice") {
    const { noticeId } = body;
    if (!noticeId) {
      return { httpStatus: 400, payload: { status: "error", message: "푸시할 공지사항 ID가 필요합니다." } };
    }

    const { data: noticeRow, error: fetchErr } = await supabaseAdmin
      .from("support_contents")
      .select("*")
      .eq("id", noticeId)
      .eq("type", "notice")
      .eq("is_deleted", false)
      .maybeSingle();

    if (fetchErr || !noticeRow) {
      return { httpStatus: 404, payload: { status: "error", message: "해당 공지사항을 찾을 수 없습니다." } };
    }

    const plainBody = stripHtmlToPlainText(noticeRow.content || "");
    const nowIso = new Date().toISOString();
    const notifTitle = noticeRow.title?.startsWith("[공지")
      ? noticeRow.title
      : `[공지사항] ${noticeRow.title}`;

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("support_contents")
      .insert([
        {
          type: "notification",
          title: notifTitle,
          active: true,
          is_deleted: false,
          created_at: nowIso,
          updated_at: nowIso,
          content: JSON.stringify({
            userId: "all",
            category: "notice" satisfies NotificationCategory,
            summary: buildSummary(plainBody || noticeRow.title, 90),
            message: plainBody || noticeRow.title,
            htmlContent: noticeRow.content || "",
            link: "/support/notice",
            linkLabel: "공지사항 게시판 바로가기",
            senderName: "비원아카데미 운영팀",
            metadata: {
              noticeId: noticeRow.id,
              isGlobalNotice: true,
              targetLabel: "전체 회원 공지사항 푸시",
            },
            readBy: [],
          }),
        },
      ])
      .select("id")
      .single();

    if (insErr) {
      return { httpStatus: 500, payload: { status: "error", message: insErr.message } };
    }

    return {
      httpStatus: 200,
      payload: {
        status: "success",
        notificationId: inserted?.id,
        message: `'${noticeRow.title}' 공지사항 알림이 전체 회원에게 푸시되었습니다.`,
      },
    };
  }

  // ===========================================================================
  // 10. ADMIN: 발송 알림 회수 / 삭제
  // ===========================================================================
  if (action === "admin-delete-notification") {
    const { notificationId, notificationIds } = body;
    const ids: string[] = Array.isArray(notificationIds)
      ? notificationIds.filter(Boolean)
      : notificationId
        ? [notificationId]
        : [];

    if (ids.length === 0) {
      return { httpStatus: 400, payload: { status: "error", message: "삭제할 알림을 선택해 주세요." } };
    }

    const { error } = await supabaseAdmin
      .from("support_contents")
      .update({
        is_deleted: true,
        active: false,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids)
      .eq("type", "notification");

    if (error) {
      return { httpStatus: 500, payload: { status: "error", message: error.message } };
    }

    return {
      httpStatus: 200,
      payload: {
        status: "success",
        deletedCount: ids.length,
        message: `${ids.length}건의 알림이 회수(삭제) 처리되었습니다.`,
      },
    };
  }

  return {
    httpStatus: 400,
    payload: { status: "error", message: `지원하지 않는 알림 액션입니다: ${action}` },
  };
}
