import crypto from "crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export const COUPON_MILEAGE_ACTIONS = new Set([
  "admin-get-coupon-mileage-dashboard",
  "admin-create-coupon-template",
  "admin-update-coupon-template",
  "admin-delete-coupon-template",
  "admin-issue-coupons",
  "admin-revoke-user-coupon",
  "admin-issue-mileage",
  "get-my-coupons-and-mileage",
  "redeem-user-coupon",
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

function generateCouponCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 4; i++) {
    part1 += chars[bytes[i] % chars.length];
    part2 += chars[bytes[i + 4] % chars.length];
  }
  return `CPN-${part1}-${part2}`;
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

/**
 * 쿠폰 사용 시점(usedAt)으로부터 설정된 수강 일수(durationDays)만큼 수강 가능하도록
 * 한국 표준시(KST, UTC+9) 기준 종료일 23:59:59.999로 만료 시각을 계산합니다.
 * 예: 11월 15일 쿠폰 사용 + 7일 설정 -> 11월 22일 23:59:59 (KST) 만료
 */
export function calculateCouponEnrollmentExpiry(usedAt: Date, durationDays: number): string {
  const days = Math.max(1, Math.floor(Number(durationDays) || 1));
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstTime = new Date(usedAt.getTime() + kstOffsetMs);
  const year = kstTime.getUTCFullYear();
  const month = kstTime.getUTCMonth();
  const date = kstTime.getUTCDate() + days;
  const expiryUtcMs = Date.UTC(year, month, date, 23, 59, 59, 999) - kstOffsetMs;
  return new Date(expiryUtcMs).toISOString();
}

function formatKstDateTime(dateInput: Date | string): string {
  const parsed = new Date(dateInput);
  if (isNaN(parsed.getTime())) return "";
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kst = new Date(parsed.getTime() + kstOffsetMs);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const hours = kst.getUTCHours();
  const minutes = kst.getUTCMinutes();
  if (hours === 0 && minutes === 0) {
    return `${year}년 ${month}월 ${day}일`;
  }
  return `${year}년 ${month}월 ${day}일 ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export async function handleCouponMileageAction(params: {
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
  // 1. ADMIN: 쿠폰/마일리지 통합 관리 데이터 조회
  // ===========================================================================
  if (action === "admin-get-coupon-mileage-dashboard") {
    const [templatesRes, userCouponsRes, mileageLogsRes, coursesRes, membersRes, enrollmentsRes] = await Promise.all([
      supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("type", "coupon_template")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false }),
      fetchAllRows(
        (from, to) =>
          supabaseAdmin
            .from("support_contents")
            .select("*")
            .eq("type", "user_coupon")
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .range(from, to),
        1000,
        10000
      ),
      fetchAllRows(
        (from, to) =>
          supabaseAdmin
            .from("support_contents")
            .select("*")
            .eq("type", "mileage_log")
            .eq("is_deleted", false)
            .order("created_at", { ascending: false })
            .range(from, to),
        1000,
        5000
      ),
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

    const firstQueryErr =
      templatesRes.error ||
      userCouponsRes.error ||
      mileageLogsRes.error ||
      coursesRes.error ||
      membersRes.error ||
      enrollmentsRes.error;
    if (firstQueryErr) {
      return { httpStatus: 500, payload: { status: "error", message: firstQueryErr.message } };
    }

    const courses = (coursesRes.data || []).map((c: any) => ({
      ...c,
      thumbnail: c.thumbnail || c.thumbnail_url || "",
    }));
    const members = membersRes.data || [];
    const courseMap = new Map<string, any>(courses.map((c: any) => [c.id, c]));
    const memberMap = new Map<string, any>(members.map((m: any) => [m.id, m]));

    const rawUserCoupons = userCouponsRes.data || [];
    const issuedCountByTemplate = new Map<string, number>();
    const usedCountByTemplate = new Map<string, number>();

    const userCoupons = rawUserCoupons.map((row: any) => {
      const meta = safeParseJson<Record<string, any>>(row.content, {});
      const templateId = meta.template_id || "";
      const status: "available" | "used" | "revoked" =
        meta.status === "used"
          ? "used"
          : meta.status === "revoked" || row.active === false
            ? "revoked"
            : "available";

      if (templateId) {
        if (status !== "revoked") {
          issuedCountByTemplate.set(templateId, (issuedCountByTemplate.get(templateId) || 0) + 1);
        }
        if (status === "used") {
          usedCountByTemplate.set(templateId, (usedCountByTemplate.get(templateId) || 0) + 1);
        }
      }

      const member = memberMap.get(row.title);
      const course = courseMap.get(meta.course_id);

      return {
        id: row.id,
        user_id: row.title,
        user_name: member?.name || member?.full_name || meta.user_name || "회원",
        user_nickname: member?.nickname || "",
        user_email: member?.email || meta.user_email || "",
        user_phone: member?.mobile_phone || member?.phone || "",
        template_id: templateId,
        code: meta.code || "",
        coupon_type: "FREE_COURSE",
        coupon_name: meta.coupon_name || "무료 수강 쿠폰",
        course_id: meta.course_id || "",
        course_title: course?.title || meta.course_title || "삭제된 강의",
        duration_days: Number(meta.duration_days) || 7,
        status,
        issue_memo: meta.issue_memo || "",
        issued_at: meta.issued_at || row.created_at,
        used_at: meta.used_at || null,
        enrollment_expires_at: meta.enrollment_expires_at || null,
      };
    });

    const templates = (templatesRes.data || []).map((row: any) => {
      const meta = safeParseJson<Record<string, any>>(row.content, {});
      const course = courseMap.get(meta.course_id);
      return {
        id: row.id,
        name: row.title,
        coupon_type: "FREE_COURSE",
        course_id: meta.course_id || "",
        course_title: course?.title || meta.course_title || "선택된 강의 없음",
        course_instructor: course?.instructor || "",
        course_thumbnail: course?.thumbnail || "",
        duration_days: Number(meta.duration_days) || 7,
        description: meta.description || "",
        active: Boolean(row.active),
        issued_count: issuedCountByTemplate.get(row.id) || 0,
        used_count: usedCountByTemplate.get(row.id) || 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    const mileageLogs = (mileageLogsRes.data || []).map((row: any) => {
      const meta = safeParseJson<Record<string, any>>(row.content, {});
      const member = memberMap.get(row.title);
      return {
        id: row.id,
        user_id: row.title,
        user_name: member?.name || member?.full_name || meta.user_name || "회원",
        user_nickname: member?.nickname || "",
        user_email: member?.email || meta.user_email || "",
        batch_id: meta.batch_id || "",
        adjust_type: meta.adjust_type || (Number(meta.amount) >= 0 ? "add" : "subtract"),
        amount: Number(meta.amount) || 0,
        previous_mileage: Number(meta.previous_mileage) || 0,
        after_mileage: Number(meta.after_mileage) || 0,
        reason: meta.reason || "",
        created_at: row.created_at,
      };
    });

    const now = new Date();
    const enrollments = (enrollmentsRes.data || [])
      .filter((enr: any) => memberMap.has(enr.user_id) && courseMap.has(enr.course_id))
      .map((enr: any) => {
        const course = courseMap.get(enr.course_id);
        let isActive = enr.status !== "expired";
        if (isActive) {
          if (enr.expires_at) {
            isActive = new Date(enr.expires_at) > now;
          } else if (course && !course.is_duration_based && course.end_date) {
            isActive = new Date(course.end_date) > now;
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

    return {
      httpStatus: 200,
      payload: {
        status: "success",
        templates,
        userCoupons,
        mileageLogs,
        courses,
        enrollments,
        members: members.map((m: any) => ({
          id: m.id,
          name: m.name || m.full_name || "",
          nickname: m.nickname || "",
          email: m.email || "",
          phone: m.mobile_phone || m.phone || "",
          role: m.role || "user",
          mileage: Number(m.mileage) || 0,
          created_at: m.created_at,
        })),
      },
    };
  }

  // ===========================================================================
  // 2. ADMIN: 강의 무료 수강 쿠폰 종류(템플릿) 생성
  // ===========================================================================
  if (action === "admin-create-coupon-template") {
    const { name, courseId, durationDays, description } = body;
    const cleanName = String(name || "").trim();
    const parsedDays = Math.floor(Number(durationDays));

    if (!cleanName) {
      return { httpStatus: 400, payload: { status: "error", message: "쿠폰 종류 이름을 입력해 주세요." } };
    }
    if (!courseId) {
      return { httpStatus: 400, payload: { status: "error", message: "무료 수강을 허용할 대상 강의를 선택해 주세요." } };
    }
    if (!Number.isFinite(parsedDays) || parsedDays < 1 || parsedDays > 3650) {
      return { httpStatus: 400, payload: { status: "error", message: "수강 가능 기간은 1일 이상 3,650일 이하의 숫자로 입력해 주세요." } };
    }

    const { data: course, error: courseErr } = await supabaseAdmin
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .maybeSingle();

    if (courseErr || !course || course.is_deleted) {
      return { httpStatus: 404, payload: { status: "error", message: "선택한 강의를 찾을 수 없습니다." } };
    }

    const nowIso = new Date().toISOString();
    const contentPayload = {
      coupon_type: "FREE_COURSE",
      course_id: course.id,
      course_title: course.title,
      duration_days: parsedDays,
      description: String(description || "").trim(),
      created_by: requestingUser.id,
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("support_contents")
      .insert([
        {
          type: "coupon_template",
          title: cleanName,
          content: JSON.stringify(contentPayload),
          active: true,
          is_deleted: false,
          created_at: nowIso,
          updated_at: nowIso,
        },
      ])
      .select("*")
      .single();

    if (insertErr) {
      return { httpStatus: 500, payload: { status: "error", message: insertErr.message } };
    }

    return {
      httpStatus: 200,
      payload: {
        status: "success",
        message: `'${cleanName}' (${course.title} · 사용 시점부터 ${parsedDays}일 무료 수강) 쿠폰 종류가 생성되었습니다.`,
        templateId: inserted.id,
      },
    };
  }

  // ===========================================================================
  // 3. ADMIN: 쿠폰 종류 수정 / 활성 상태 변경
  // ===========================================================================
  if (action === "admin-update-coupon-template") {
    const { templateId, name, courseId, durationDays, description, active } = body;
    if (!templateId) {
      return { httpStatus: 400, payload: { status: "error", message: "수정할 쿠폰 종류 ID가 필요합니다." } };
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("support_contents")
      .select("*")
      .eq("id", templateId)
      .eq("type", "coupon_template")
      .eq("is_deleted", false)
      .maybeSingle();

    if (fetchErr || !existing) {
      return { httpStatus: 404, payload: { status: "error", message: "해당 쿠폰 종류를 찾을 수 없습니다." } };
    }

    const prevMeta = safeParseJson<Record<string, any>>(existing.content, {});
    let nextCourseId = prevMeta.course_id;
    let nextCourseTitle = prevMeta.course_title;

    if (courseId && courseId !== prevMeta.course_id) {
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .maybeSingle();
      if (!course || course.is_deleted) {
        return { httpStatus: 404, payload: { status: "error", message: "선택한 대상 강의를 찾을 수 없습니다." } };
      }
      nextCourseId = course.id;
      nextCourseTitle = course.title;
    }

    const nextDays =
      durationDays !== undefined ? Math.floor(Number(durationDays)) : Number(prevMeta.duration_days) || 7;
    if (!Number.isFinite(nextDays) || nextDays < 1 || nextDays > 3650) {
      return { httpStatus: 400, payload: { status: "error", message: "수강 가능 기간은 1일 이상 3,650일 이하로 설정해 주세요." } };
    }

    const nextTitle = name !== undefined ? String(name).trim() : existing.title;
    if (!nextTitle) {
      return { httpStatus: 400, payload: { status: "error", message: "쿠폰 종류 이름을 입력해 주세요." } };
    }

    const nextActive = active !== undefined ? Boolean(active) : Boolean(existing.active);
    const nextMeta = {
      ...prevMeta,
      coupon_type: "FREE_COURSE",
      course_id: nextCourseId,
      course_title: nextCourseTitle,
      duration_days: nextDays,
      description: description !== undefined ? String(description).trim() : prevMeta.description || "",
      updated_by: requestingUser.id,
    };

    const { error: updateErr } = await supabaseAdmin
      .from("support_contents")
      .update({
        title: nextTitle,
        active: nextActive,
        content: JSON.stringify(nextMeta),
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId);

    if (updateErr) {
      return { httpStatus: 500, payload: { status: "error", message: updateErr.message } };
    }

    return {
      httpStatus: 200,
      payload: { status: "success", message: "쿠폰 종류 정보가 업데이트되었습니다." },
    };
  }

  // ===========================================================================
  // 4. ADMIN: 쿠폰 종류 삭제
  // ===========================================================================
  if (action === "admin-delete-coupon-template") {
    const { templateId } = body;
    if (!templateId) {
      return { httpStatus: 400, payload: { status: "error", message: "삭제할 쿠폰 종류 ID가 필요합니다." } };
    }

    const { error: delErr } = await supabaseAdmin
      .from("support_contents")
      .update({
        is_deleted: true,
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .eq("type", "coupon_template");

    if (delErr) {
      return { httpStatus: 500, payload: { status: "error", message: delErr.message } };
    }

    return {
      httpStatus: 200,
      payload: { status: "success", message: "쿠폰 종류가 삭제되었습니다." },
    };
  }

  // ===========================================================================
  // 5. ADMIN: 회원별 개별 / 다량 쿠폰 발행
  // ===========================================================================
  if (action === "admin-issue-coupons") {
    const { templateId, targetMode, userIds, issueMemo, preventDuplicateUnused } = body;

    if (!templateId) {
      return { httpStatus: 400, payload: { status: "error", message: "발급할 쿠폰 종류를 선택해 주세요." } };
    }

    const { data: templateRow, error: tplErr } = await supabaseAdmin
      .from("support_contents")
      .select("*")
      .eq("id", templateId)
      .eq("type", "coupon_template")
      .eq("is_deleted", false)
      .maybeSingle();

    if (tplErr || !templateRow) {
      return { httpStatus: 404, payload: { status: "error", message: "선택한 쿠폰 종류가 존재하지 않습니다." } };
    }
    if (!templateRow.active) {
      return { httpStatus: 400, payload: { status: "error", message: "비활성화된 쿠폰 종류입니다. 활성화 후 발급해 주세요." } };
    }

    const tplMeta = safeParseJson<Record<string, any>>(templateRow.content, {});
    const courseId = tplMeta.course_id;
    const durationDays = Math.max(1, Math.floor(Number(tplMeta.duration_days) || 7));

    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .maybeSingle();

    if (!course || course.is_deleted) {
      return { httpStatus: 404, payload: { status: "error", message: "쿠폰에 연결된 강의가 삭제되었거나 존재하지 않습니다." } };
    }

    let targetMembers: any[] = [];
    if (targetMode === "all_members") {
      const { data: allProfiles, error: profErr } = await fetchAllRows((from, to) =>
        supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("is_deleted", false)
          .range(from, to)
      );
      if (profErr) {
        return { httpStatus: 500, payload: { status: "error", message: profErr.message } };
      }
      targetMembers = allProfiles || [];
    } else {
      const uniqueIds = Array.from(new Set(Array.isArray(userIds) ? userIds.filter(Boolean) : []));
      if (uniqueIds.length === 0) {
        return { httpStatus: 400, payload: { status: "error", message: "쿠폰을 지급할 대상 회원을 1명 이상 선택해 주세요." } };
      }
      const { data: selectedProfiles, error: profErr } = await fetchProfilesByIds(supabaseAdmin, uniqueIds);
      if (profErr) {
        return { httpStatus: 500, payload: { status: "error", message: profErr.message } };
      }
      targetMembers = selectedProfiles || [];
    }

    if (targetMembers.length === 0) {
      return { httpStatus: 400, payload: { status: "error", message: "유효한 발급 대상 회원이 없습니다." } };
    }

    let skippedCount = 0;
    if (preventDuplicateUnused) {
      const { data: existingRows } = await fetchAllRows((from, to) =>
        supabaseAdmin
          .from("support_contents")
          .select("title, active, content")
          .eq("type", "user_coupon")
          .eq("active", true)
          .eq("is_deleted", false)
          .range(from, to)
      );

      const alreadyHoldingUsers = new Set<string>();
      for (const r of existingRows || []) {
        const parsed = safeParseJson<Record<string, any>>(r.content, {});
        if (parsed.template_id === templateId && parsed.status === "available") {
          alreadyHoldingUsers.add(r.title);
        }
      }

      const beforeLen = targetMembers.length;
      targetMembers = targetMembers.filter((m) => !alreadyHoldingUsers.has(m.id));
      skippedCount = beforeLen - targetMembers.length;
    }

    if (targetMembers.length === 0) {
      return {
        httpStatus: 200,
        payload: {
          status: "success",
          issuedCount: 0,
          skippedCount,
          message: `선택한 모든 회원(${skippedCount}명)이 이미 미사용 상태의 동일 쿠폰을 보유하고 있어 중복 발급을 건너뛰었습니다.`,
        },
      };
    }

    const nowIso = new Date().toISOString();
    const cleanMemo = String(issueMemo || "").trim();
    const rowsToInsert = targetMembers.map((member) => ({
      type: "user_coupon",
      title: member.id,
      active: true,
      is_deleted: false,
      created_at: nowIso,
      updated_at: nowIso,
      content: JSON.stringify({
        template_id: templateRow.id,
        code: generateCouponCode(),
        coupon_type: "FREE_COURSE",
        coupon_name: templateRow.title,
        course_id: course.id,
        course_title: course.title,
        duration_days: durationDays,
        status: "available",
        issued_at: nowIso,
        issued_by: requestingUser.id,
        issue_memo: cleanMemo,
        used_at: null,
        enrollment_expires_at: null,
        user_email: member.email || "",
        user_name: member.name || member.full_name || member.nickname || "",
      }),
    }));

    const chunkSize = 200;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      const { error: batchErr } = await supabaseAdmin.from("support_contents").insert(chunk);
      if (batchErr) {
        return { httpStatus: 500, payload: { status: "error", message: `쿠폰 일괄 저장 중 오류 발생: ${batchErr.message}` } };
      }
    }

    return {
      httpStatus: 200,
      payload: {
        status: "success",
        issuedCount: rowsToInsert.length,
        skippedCount,
        message:
          skippedCount > 0
            ? `총 ${rowsToInsert.length}명에게 '${templateRow.title}' 쿠폰을 발행했습니다. (기보유 ${skippedCount}명 제외)`
            : `총 ${rowsToInsert.length}명에게 '${templateRow.title}' 쿠폰을 발행했습니다.`,
      },
    };
  }

  // ===========================================================================
  // 6. ADMIN: 미사용 발급 쿠폰 회수 처리
  // ===========================================================================
  if (action === "admin-revoke-user-coupon") {
    const { userCouponId, userCouponIds } = body;
    const ids: string[] = Array.isArray(userCouponIds)
      ? userCouponIds.filter(Boolean)
      : userCouponId
        ? [userCouponId]
        : [];

    if (ids.length === 0) {
      return { httpStatus: 400, payload: { status: "error", message: "회수할 쿠폰을 선택해 주세요." } };
    }

    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from("support_contents")
      .select("*")
      .in("id", ids)
      .eq("type", "user_coupon")
      .eq("is_deleted", false);

    if (fetchErr) {
      return { httpStatus: 500, payload: { status: "error", message: fetchErr.message } };
    }

    let revokedCount = 0;
    const nowIso = new Date().toISOString();
    for (const row of rows || []) {
      const meta = safeParseJson<Record<string, any>>(row.content, {});
      if (meta.status === "used") continue;
      const nextMeta = {
        ...meta,
        status: "revoked",
        revoked_at: nowIso,
        revoked_by: requestingUser.id,
      };
      const { error: updErr } = await supabaseAdmin
        .from("support_contents")
        .update({
          active: false,
          content: JSON.stringify(nextMeta),
          updated_at: nowIso,
        })
        .eq("id", row.id);
      if (!updErr) revokedCount++;
    }

    return {
      httpStatus: 200,
      payload: {
        status: "success",
        revokedCount,
        message: `${revokedCount}건의 미사용 쿠폰이 회수 처리되었습니다.`,
      },
    };
  }

  // ===========================================================================
  // 7. ADMIN: 회원별 개별 / 다량 마일리지 지급 및 차감
  // ===========================================================================
  if (action === "admin-issue-mileage") {
    const { targetMode, userIds, adjustType, amount, reason } = body;
    const parsedAmount = Math.floor(Number(amount));
    const mode: "add" | "subtract" = adjustType === "subtract" ? "subtract" : "add";
    const cleanReason = String(reason || "").trim() || (mode === "add" ? "관리자 마일리지 지급" : "관리자 마일리지 차감");

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100000000) {
      return {
        httpStatus: 400,
        payload: { status: "error", message: "마일리지 수량은 1P 이상의 올바른 숫자로 입력해 주세요." },
      };
    }

    let targetMembers: any[] = [];
    if (targetMode === "all_members") {
      const { data: allProfiles, error: profErr } = await fetchAllRows((from, to) =>
        supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("is_deleted", false)
          .range(from, to)
      );
      if (profErr) {
        return { httpStatus: 500, payload: { status: "error", message: profErr.message } };
      }
      targetMembers = allProfiles || [];
    } else {
      const uniqueIds = Array.from(new Set(Array.isArray(userIds) ? userIds.filter(Boolean) : []));
      if (uniqueIds.length === 0) {
        return { httpStatus: 400, payload: { status: "error", message: "마일리지를 처리할 대상 회원을 1명 이상 선택해 주세요." } };
      }
      const { data: selectedProfiles, error: profErr } = await fetchProfilesByIds(supabaseAdmin, uniqueIds);
      if (profErr) {
        return { httpStatus: 500, payload: { status: "error", message: profErr.message } };
      }
      targetMembers = selectedProfiles || [];
    }

    if (targetMembers.length === 0) {
      return { httpStatus: 400, payload: { status: "error", message: "유효한 대상 회원이 없습니다." } };
    }

    const batchId = `MLG-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const logRows: any[] = [];
    let updatedCount = 0;
    let firstUpdateError: string | null = null;

    const concurrency = 25;
    for (let i = 0; i < targetMembers.length; i += concurrency) {
      const batch = targetMembers.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (member) => {
          const prevMileage = Math.max(0, Number(member.mileage) || 0);
          const nextMileage =
            mode === "add" ? prevMileage + parsedAmount : Math.max(0, prevMileage - parsedAmount);
          const actualDelta = nextMileage - prevMileage;

          const { error: updErr } = await supabaseAdmin
            .from("profiles")
            .update({ mileage: nextMileage })
            .eq("id", member.id);

          if (updErr) {
            if (!firstUpdateError) firstUpdateError = updErr.message;
            return;
          }

          updatedCount++;
          logRows.push({
            type: "mileage_log",
            title: member.id,
            active: true,
            is_deleted: false,
            created_at: nowIso,
            updated_at: nowIso,
            content: JSON.stringify({
              batch_id: batchId,
              adjust_type: mode,
              amount: actualDelta,
              requested_amount: mode === "add" ? parsedAmount : -parsedAmount,
              previous_mileage: prevMileage,
              after_mileage: nextMileage,
              reason: cleanReason,
              issued_by: requestingUser.id,
              user_email: member.email || "",
              user_name: member.name || member.full_name || member.nickname || "",
            }),
          });
        })
      );
    }

    if (updatedCount === 0 && firstUpdateError) {
      return {
        httpStatus: 500,
        payload: { status: "error", message: `마일리지 DB 업데이트 중 오류가 발생했습니다: ${firstUpdateError}` },
      };
    }

    const chunkSize = 200;
    for (let i = 0; i < logRows.length; i += chunkSize) {
      const chunk = logRows.slice(i, i + chunkSize);
      const { error: logErr } = await supabaseAdmin.from("support_contents").insert(chunk);
      if (logErr) {
        return {
          httpStatus: 500,
          payload: { status: "error", message: `마일리지 이력 저장 중 오류가 발생했습니다: ${logErr.message}` },
        };
      }
    }

    return {
      httpStatus: 200,
      payload: {
        status: "success",
        updatedCount,
        message: `총 ${updatedCount}명의 회원에게 ${parsedAmount.toLocaleString()}P 마일리지 ${mode === "add" ? "지급" : "차감"} 처리가 완료되었습니다.`,
      },
    };
  }

  // ===========================================================================
  // 8. MEMBER: 내 보유 쿠폰 및 마일리지 내역 조회
  // ===========================================================================
  if (action === "get-my-coupons-and-mileage") {
    const userId = requestingUser.id;

    const [couponsRes, logsRes, profileRes] = await Promise.all([
      supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("type", "user_coupon")
        .eq("title", userId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("type", "mileage_log")
        .eq("title", userId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const rawCoupons = couponsRes.data || [];
    const courseIds = Array.from(
      new Set(
        rawCoupons
          .map((row: any) => safeParseJson<Record<string, any>>(row.content, {}).course_id)
          .filter(Boolean)
      )
    );

    const courseMap = new Map<string, any>();
    if (courseIds.length > 0) {
      const { data: coursesData } = await supabaseAdmin
        .from("courses")
        .select("*")
        .in("id", courseIds);
      for (const c of coursesData || []) {
        courseMap.set(c.id, c);
      }
    }

    const coupons = rawCoupons.map((row: any) => {
      const meta = safeParseJson<Record<string, any>>(row.content, {});
      const course = courseMap.get(meta.course_id);
      const status: "available" | "used" | "revoked" =
        meta.status === "used"
          ? "used"
          : meta.status === "revoked" || row.active === false
            ? "revoked"
            : "available";

      const courseStartDate = course?.start_date || null;
      const courseStartMs = courseStartDate ? new Date(courseStartDate).getTime() : NaN;
      const courseNotStarted = Number.isFinite(courseStartMs) && courseStartMs > Date.now();

      const isDurationBased = Boolean(course?.is_duration_based);
      const courseEndDate = course?.end_date || null;
      const courseEndMs = !isDurationBased && courseEndDate ? new Date(courseEndDate).getTime() : NaN;
      const courseEnded = Number.isFinite(courseEndMs) && courseEndMs <= Date.now();

      return {
        id: row.id,
        code: meta.code || "",
        template_id: meta.template_id || "",
        coupon_type: "FREE_COURSE",
        coupon_name: meta.coupon_name || "무료 수강 쿠폰",
        course_id: meta.course_id || "",
        course_title: course?.title || meta.course_title || "강의 정보 없음",
        course_instructor: course?.instructor || "",
        course_thumbnail: course?.thumbnail || course?.thumbnail_url || "",
        course_available: Boolean(course && !course.is_deleted),
        course_start_date: courseStartDate,
        course_not_started: courseNotStarted,
        course_end_date: courseEndDate,
        course_is_duration_based: isDurationBased,
        course_ended: courseEnded,
        duration_days: Math.max(1, Number(meta.duration_days) || 7),
        status,
        issue_memo: meta.issue_memo || "",
        issued_at: meta.issued_at || row.created_at,
        used_at: meta.used_at || null,
        enrollment_expires_at: meta.enrollment_expires_at || null,
      };
    });

    const mileageLogs = (logsRes.data || []).map((row: any) => {
      const meta = safeParseJson<Record<string, any>>(row.content, {});
      return {
        id: row.id,
        adjust_type: meta.adjust_type || (Number(meta.amount) >= 0 ? "add" : "subtract"),
        amount: Number(meta.amount) || 0,
        previous_mileage: Number(meta.previous_mileage) || 0,
        after_mileage: Number(meta.after_mileage) || 0,
        reason: meta.reason || "",
        created_at: row.created_at,
      };
    });

    return {
      httpStatus: 200,
      payload: {
        status: "success",
        mileage: Number(profileRes.data?.mileage) || 0,
        coupons,
        mileageLogs,
      },
    };
  }

  // ===========================================================================
  // 9. MEMBER: 무료 수강 쿠폰 사용 (사용 시점부터 duration_days일 동안 수강 권한 활성화)
  // ===========================================================================
  if (action === "redeem-user-coupon") {
    const userId = requestingUser.id;
    const { userCouponId, couponCode } = body;

    if (!userCouponId && !couponCode) {
      return {
        httpStatus: 400,
        payload: { status: "error", message: "사용할 쿠폰을 선택하거나 쿠폰 코드를 입력해 주세요." },
      };
    }

    const { data: myCouponRows, error: couponFetchErr } = await supabaseAdmin
      .from("support_contents")
      .select("*")
      .eq("type", "user_coupon")
      .eq("title", userId)
      .eq("is_deleted", false);

    if (couponFetchErr) {
      return { httpStatus: 500, payload: { status: "error", message: couponFetchErr.message } };
    }

    const normalizedInputCode = String(couponCode || "").trim().toUpperCase();
    const matchedRow = (myCouponRows || []).find((row: any) => {
      if (userCouponId && row.id === userCouponId) return true;
      if (normalizedInputCode) {
        const meta = safeParseJson<Record<string, any>>(row.content, {});
        return String(meta.code || "").trim().toUpperCase() === normalizedInputCode;
      }
      return false;
    });

    if (!matchedRow) {
      return {
        httpStatus: 404,
        payload: { status: "error", message: "보유하신 쿠폰 중에서 일치하는 쿠폰을 찾을 수 없습니다." },
      };
    }

    const couponMeta = safeParseJson<Record<string, any>>(matchedRow.content, {});
    if (couponMeta.status === "used") {
      return {
        httpStatus: 400,
        payload: { status: "error", message: "이미 사용이 완료된 쿠폰입니다." },
      };
    }
    if (couponMeta.status === "revoked" || matchedRow.active === false) {
      return {
        httpStatus: 400,
        payload: { status: "error", message: "회수되었거나 사용할 수 없는 상태의 쿠폰입니다." },
      };
    }

    const courseId = couponMeta.course_id;
    const durationDays = Math.max(1, Math.floor(Number(couponMeta.duration_days) || 7));

    const { data: course, error: courseErr } = await supabaseAdmin
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .maybeSingle();

    if (courseErr || !course || course.is_deleted) {
      return {
        httpStatus: 404,
        payload: { status: "error", message: "쿠폰 대상 강의가 현재 운영 중이지 않거나 삭제되었습니다." },
      };
    }

    // 1) 강의 개시 전인지 검사: 개시 전 강의에 쿠폰을 미리 소진하지 않도록 차단 및 경고 안내 반환
    const usedAt = new Date();
    if (course.start_date) {
      const courseStartMs = new Date(course.start_date).getTime();
      if (Number.isFinite(courseStartMs) && usedAt.getTime() < courseStartMs) {
        const startLabel = formatKstDateTime(course.start_date);
        return {
          httpStatus: 400,
          payload: {
            status: "error",
            code: "COURSE_NOT_STARTED",
            courseTitle: course.title,
            courseStartDate: course.start_date,
            message: startLabel
              ? `강의 개시일 이후에 사용할 수 있습니다. (개시 예정일: ${startLabel} · 쿠폰이 차감되지 않았습니다.)`
              : "강의 개시일 이후에 사용할 수 있습니다. (쿠폰이 차감되지 않았습니다.)",
          },
        };
      }
    }

    // 2) 정규 모집형(고정 종료일) 강의의 종료일(end_date) 경과 검사: 이미 종료된 강의에 쿠폰 소진 차단
    if (!course.is_duration_based && course.end_date) {
      const courseEndMs = new Date(course.end_date).getTime();
      if (Number.isFinite(courseEndMs) && usedAt.getTime() >= courseEndMs) {
        const endLabel = formatKstDateTime(course.end_date);
        return {
          httpStatus: 400,
          payload: {
            status: "error",
            code: "COURSE_ALREADY_ENDED",
            courseTitle: course.title,
            courseEndDate: course.end_date,
            message: endLabel
              ? `이미 종료된 강의입니다. (강의 종료일: ${endLabel} · 쿠폰이 차감되지 않았습니다.)`
              : "이미 종료된 강의입니다. (쿠폰이 차감되지 않았습니다.)",
          },
        };
      }
    }

    // 쿠폰 사용 시작 시각(usedAt) 기준 설정된 일수(durationDays)만큼 무료 수강 만료일 계산
    const usedAtIso = usedAt.toISOString();
    const expiresAtIso = calculateCouponEnrollmentExpiry(usedAt, durationDays);

    // 기존 수강 이력 확인 (실수로 상시 수강 중이거나 더 긴 수강권을 덮어쓰지 않도록 보호)
    const { data: existingRows, error: existCheckErr } = await supabaseAdmin
      .from("enrollments")
      .select("*")
      .eq("user_id", userId)
      .eq("course_id", course.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existCheckErr) {
      return { httpStatus: 500, payload: { status: "error", message: existCheckErr.message } };
    }
    const existingEnrollment = existingRows?.[0] || null;

    if (
      existingEnrollment &&
      !existingEnrollment.is_deleted &&
      (existingEnrollment.status === "active" || !existingEnrollment.status)
    ) {
      if (!existingEnrollment.expires_at) {
        return {
          httpStatus: 400,
          payload: {
            status: "error",
            message: "이미 해당 강의를 기간 제한 없이 수강 중입니다. 쿠폰이 차감되지 않았습니다.",
          },
        };
      }
      const existingExpiryDate = new Date(existingEnrollment.expires_at);
      if (existingExpiryDate > new Date(expiresAtIso)) {
        return {
          httpStatus: 400,
          payload: {
            status: "error",
            message: "현재 보유하신 수강 만료일이 쿠폰 적용 기간보다 더 길게 남아있습니다. 기존 수강 만료 후 사용해 주세요.",
          },
        };
      }
    }

    if (existingEnrollment) {
      const { error: enrollUpdErr } = await supabaseAdmin
        .from("enrollments")
        .update({
          status: "active",
          is_deleted: false,
          created_at: usedAtIso,
          expires_at: expiresAtIso,
        })
        .eq("id", existingEnrollment.id);

      if (enrollUpdErr) {
        return {
          httpStatus: 500,
          payload: { status: "error", message: `수강 권한 갱신에 실패했습니다: ${enrollUpdErr.message}` },
        };
      }
    } else {
      const { error: enrollInsErr } = await supabaseAdmin.from("enrollments").insert([
        {
          user_id: userId,
          course_id: course.id,
          status: "active",
          is_deleted: false,
          created_at: usedAtIso,
          expires_at: expiresAtIso,
        },
      ]);

      if (enrollInsErr) {
        return {
          httpStatus: 500,
          payload: { status: "error", message: `수강 권한 등록에 실패했습니다: ${enrollInsErr.message}` },
        };
      }
    }

    // 강의 연동 커뮤니티 멤버십 자동 활성화
    try {
      const { data: linkedCommunities } = await supabaseAdmin
        .from("communities")
        .select("id")
        .eq("course_id", course.id)
        .eq("is_deleted", false);

      if (linkedCommunities && linkedCommunities.length > 0) {
        for (const comm of linkedCommunities) {
          const { data: existingMember } = await supabaseAdmin
            .from("community_members")
            .select("id")
            .eq("community_id", comm.id)
            .eq("user_id", userId)
            .maybeSingle();

          if (existingMember) {
            await supabaseAdmin
              .from("community_members")
              .update({ is_deleted: false, joined_at: usedAtIso })
              .eq("id", existingMember.id);
          } else {
            await supabaseAdmin.from("community_members").insert([
              {
                community_id: comm.id,
                user_id: userId,
                joined_at: usedAtIso,
                is_deleted: false,
              },
            ]);
          }
        }
      }
    } catch (commErr) {
      console.warn("[redeem-user-coupon] Linked community sync skipped:", commErr);
    }

    // 쿠폰 사용 완료 마킹
    const updatedMeta = {
      ...couponMeta,
      status: "used",
      used_at: usedAtIso,
      enrollment_expires_at: expiresAtIso,
    };

    const { error: markUsedErr } = await supabaseAdmin
      .from("support_contents")
      .update({
        active: false,
        content: JSON.stringify(updatedMeta),
        updated_at: usedAtIso,
      })
      .eq("id", matchedRow.id);

    if (markUsedErr) {
      return {
        httpStatus: 500,
        payload: { status: "error", message: `쿠폰 사용 상태 저장 중 오류가 발생했습니다: ${markUsedErr.message}` },
      };
    }

    return {
      httpStatus: 200,
      payload: {
        status: "success",
        message: `'${course.title}' 강의 무료 수강 쿠폰이 적용되었습니다! 오늘부터 ${durationDays}일간 자유롭게 수강하실 수 있습니다.`,
        courseId: course.id,
        courseTitle: course.title,
        durationDays,
        usedAt: usedAtIso,
        expiresAt: expiresAtIso,
      },
    };
  }

  return {
    httpStatus: 400,
    payload: { status: "error", message: `Unsupported coupon/mileage action: ${action}` },
  };
}
