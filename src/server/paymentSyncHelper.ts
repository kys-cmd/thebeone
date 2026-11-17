import { SupabaseClient } from "@supabase/supabase-js";

export interface InitPayOrderItemInput {
  orderId?: string;
  courseId: string;
}

export interface PrepareOrdersForInitPayParams {
  oid: string;
  price: number;
  userId?: string;
  courseId?: string;
  items?: InitPayOrderItemInput[];
  orderName?: string;
  mileageUsed?: number;
}

export interface PrepareOrdersForInitPayResult {
  verifiedPrice: number;
  verifiedMileage: number;
  orderIds: string[];
  courseIds: string[];
}

export interface MerchantCallbackMeta {
  originUrl: string;
  userId?: string;
  courseId?: string;
  orderIds?: string[];
}

export interface ReconciliationSummary {
  recoveredOrdersCount: number;
  backfilledEnrollmentsCount: number;
}

/**
 * Strip `__SUB_N` suffix used when multiple cart items are paid in a single KG Inicis transaction.
 */
export function getBaseMerchantUid(merchantUid?: string | null): string {
  if (!merchantUid) return "";
  return String(merchantUid).replace(/__SUB_\d+$/, "");
}

/**
 * Parse origin URL and optional metadata (`?uid=...&cid=...&oids=...`) from KG Inicis `merchantData` / `P_NOTI`.
 */
export function parseInicisMerchantMeta(raw?: string | null): MerchantCallbackMeta {
  if (!raw || typeof raw !== "string") {
    return { originUrl: "" };
  }
  const trimmed = raw.trim();
  if (!trimmed) return { originUrl: "" };

  try {
    if (trimmed.startsWith("{")) {
      const obj = JSON.parse(trimmed);
      return {
        originUrl: typeof obj.origin === "string" ? obj.origin.replace(/\/+$/, "") : "",
        userId: obj.uid || obj.userId || undefined,
        courseId: obj.cid || obj.courseId || undefined,
        orderIds: Array.isArray(obj.oids)
          ? obj.oids.filter(Boolean)
          : typeof obj.oids === "string"
            ? obj.oids.split(",").map((s: string) => s.trim()).filter(Boolean)
            : undefined,
      };
    }

    const parsed = new URL(trimmed);
    const uid = parsed.searchParams.get("uid") || undefined;
    const cid = parsed.searchParams.get("cid") || undefined;
    const oidsRaw = parsed.searchParams.get("oids") || "";
    const orderIds = oidsRaw
      ? oidsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    return {
      originUrl: `${parsed.protocol}//${parsed.host}`,
      userId: uid,
      courseId: cid,
      orderIds,
    };
  } catch {
    return { originUrl: trimmed.replace(/\/+$/, "") };
  }
}

/**
 * Calculate duration-based enrollment expiry timestamp accurately from payment/enrollment baseDate.
 */
export function calculateCourseEnrollmentExpiry(
  course: {
    is_duration_based?: boolean | null;
    duration_days?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    layout?: any;
  } | null | undefined,
  baseNow: Date = new Date()
): string | null {
  if (!course) return null;
  if (course.is_duration_based && course.duration_days && Number(course.duration_days) > 0) {
    const validBaseNow = !isNaN(baseNow.getTime()) ? baseNow : new Date();
    const startDate = course.start_date ? new Date(course.start_date) : null;
    const effectiveBase =
      startDate && !isNaN(startDate.getTime()) && validBaseNow.getTime() < startDate.getTime()
        ? new Date(startDate)
        : new Date(validBaseNow);

    const expDate = new Date(effectiveBase);
    expDate.setDate(expDate.getDate() + Number(course.duration_days));
    const endTimeStr = (course.layout as any)?.duration_end_time || "23:59";
    const [hours, minutes] = String(endTimeStr).split(":").map(Number);
    expDate.setHours(
      !isNaN(hours) ? hours : 23,
      !isNaN(minutes) ? minutes : 59,
      59,
      999
    );
    return expDate.toISOString();
  }
  return null;
}

function isMissingColumnError(err: any): boolean {
  const msg = String(err?.message || err?.details || "").toLowerCase();
  const code = String(err?.code || "");
  return (
    code === "42703" ||
    code === "PGRST204" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the") ||
    msg.includes("schema cache")
  );
}

/**
 * Safely write to `payment_api_logs` if the table exists (never throws).
 */
export async function safeWritePaymentApiLog(
  supabaseAdmin: SupabaseClient | null,
  params: {
    orderId?: string | null;
    merchant_uid?: string | null;
    type: string;
    api_url?: string;
    request_data?: any;
    response_data?: any;
    status: "SUCCESS" | "FAILED";
    error_code?: string | null;
    error_message?: string | null;
  }
): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    let resolvedOrderId = params.orderId || null;
    const baseUid = getBaseMerchantUid(params.merchant_uid);
    if (!resolvedOrderId && baseUid) {
      const { data: ord } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("merchant_uid", baseUid)
        .maybeSingle();
      if (ord?.id) resolvedOrderId = ord.id;
    }

    const { error } = await supabaseAdmin.from("payment_api_logs").insert([
      {
        order_id: resolvedOrderId,
        merchant_uid: params.merchant_uid || null,
        type: params.type,
        api_url: params.api_url || null,
        request_data: params.request_data || null,
        response_data: params.response_data || null,
        status: params.status,
        error_code: params.error_code || null,
        error_message: params.error_message || null,
      },
    ]);
    if (error && !String(error.message || "").includes("does not exist")) {
      console.warn("[safeWritePaymentApiLog] Warning:", error.message);
    }
  } catch (e: any) {
    console.warn("[safeWritePaymentApiLog] Ignored exception:", e?.message || e);
  }
}

/**
 * Safely insert a row into `payment_logs`, gracefully supporting both extended schema
 * (`order_id, status, raw_response, payment_method, amount`) and legacy schema (`order_id, merchant_uid, raw_data`).
 */
export async function safeInsertPaymentLog(
  supabaseAdmin: SupabaseClient | null,
  params: {
    orderId?: string | null;
    merchantUid?: string | null;
    status: "SUCCESS" | "FAILED";
    amount?: number;
    paymentMethod?: string;
    payloadObj: Record<string, any>;
  }
): Promise<void> {
  if (!supabaseAdmin) return;

  const nowIso = new Date().toISOString();
  const enrichedPayload = {
    ...params.payloadObj,
    merchant_uid: params.merchantUid || params.payloadObj?.merchant_uid || params.payloadObj?.MOID || params.payloadObj?.P_OID || null,
    status: params.status,
  };

  const candidatePayloads: Record<string, any>[] = [
    {
      order_id: params.orderId || null,
      status: params.status,
      raw_response: JSON.stringify(enrichedPayload),
      payment_method: params.paymentMethod || "CARD",
      amount: Number(params.amount || 0),
      created_at: nowIso,
    },
    {
      order_id: params.orderId || null,
      merchant_uid: params.merchantUid || null,
      raw_data: enrichedPayload,
      created_at: nowIso,
    },
    {
      order_id: params.orderId || null,
      raw_response: JSON.stringify(enrichedPayload),
      created_at: nowIso,
    },
  ];

  for (const row of candidatePayloads) {
    try {
      const { error } = await supabaseAdmin.from("payment_logs").insert([row]);
      if (!error) return;
      if (!isMissingColumnError(error)) {
        console.warn("[safeInsertPaymentLog] Insert warning:", error.message);
        return;
      }
    } catch (e: any) {
      console.warn("[safeInsertPaymentLog] Exception:", e?.message || e);
    }
  }
}

/**
 * Schema-resilient insert or update on `orders` table (never fails if `updated_at`, `mileage_used`, or `order_name` is missing).
 */
export async function safeSaveOrderRow(
  supabaseAdmin: SupabaseClient,
  existingOrderId: string | null,
  fields: {
    user_id: string;
    course_id: string;
    amount: number;
    status: string;
    merchant_uid: string;
    order_name?: string;
    mileage_used?: number;
    created_at?: string;
  }
): Promise<{ id: string; [key: string]: any }> {
  const nowIso = new Date().toISOString();

  if (existingOrderId) {
    const updateAttempts: Record<string, any>[] = [
      {
        merchant_uid: fields.merchant_uid,
        amount: fields.amount,
        status: fields.status,
        order_name: fields.order_name || "온라인 강좌 수강권 구매",
        mileage_used: Number(fields.mileage_used || 0),
        updated_at: nowIso,
      },
      {
        merchant_uid: fields.merchant_uid,
        amount: fields.amount,
        status: fields.status,
        order_name: fields.order_name || "온라인 강좌 수강권 구매",
        mileage_used: Number(fields.mileage_used || 0),
      },
      {
        merchant_uid: fields.merchant_uid,
        amount: fields.amount,
        status: fields.status,
      },
    ];

    let lastErr: any = null;
    for (const patch of updateAttempts) {
      const { data, error } = await supabaseAdmin
        .from("orders")
        .update(patch)
        .eq("id", existingOrderId)
        .select("*")
        .maybeSingle();

      if (!error && data) return data;
      lastErr = error;
      if (error && !isMissingColumnError(error)) break;
    }

    if (lastErr) {
      throw new Error(`주문 정보 업데이트 실패: ${lastErr.message}`);
    }
  }

  const insertAttempts: Record<string, any>[] = [
    {
      user_id: fields.user_id,
      course_id: fields.course_id,
      amount: fields.amount,
      status: fields.status,
      merchant_uid: fields.merchant_uid,
      order_name: fields.order_name || "온라인 강좌 수강권 구매",
      mileage_used: Number(fields.mileage_used || 0),
      created_at: fields.created_at || nowIso,
    },
    {
      user_id: fields.user_id,
      course_id: fields.course_id,
      amount: fields.amount,
      status: fields.status,
      merchant_uid: fields.merchant_uid,
      order_name: fields.order_name || "온라인 강좌 수강권 구매",
      created_at: fields.created_at || nowIso,
    },
    {
      user_id: fields.user_id,
      course_id: fields.course_id,
      amount: fields.amount,
      status: fields.status,
      merchant_uid: fields.merchant_uid,
      created_at: fields.created_at || nowIso,
    },
  ];

  let lastInsertErr: any = null;
  for (const row of insertAttempts) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .insert([row])
      .select("*")
      .maybeSingle();

    if (!error && data) return data;
    lastInsertErr = error;

    // Handle duplicate merchant_uid race condition gracefully
    if (error && String(error.code) === "23505") {
      const { data: existingByUid } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("merchant_uid", fields.merchant_uid)
        .maybeSingle();
      if (existingByUid) return existingByUid;
    }

    if (error && !isMissingColumnError(error)) break;
  }

  throw new Error(`주문 레코드 생성 실패: ${lastInsertErr?.message || "Unknown DB Error"}`);
}

/**
 * Safely update `orders.status` for one or more order IDs without failing if `updated_at` column is absent.
 */
export async function safeUpdateOrdersStatusByIds(
  supabaseAdmin: SupabaseClient,
  orderIds: string[],
  newStatus: string,
  extraFields?: { merchant_uid?: string }
): Promise<void> {
  if (!orderIds || orderIds.length === 0) return;
  const nowIso = new Date().toISOString();

  const withUpdatedAt: Record<string, any> = {
    status: newStatus,
    updated_at: nowIso,
    ...(extraFields?.merchant_uid ? { merchant_uid: extraFields.merchant_uid } : {}),
  };

  const { error } = await supabaseAdmin
    .from("orders")
    .update(withUpdatedAt)
    .in("id", orderIds);

  if (!error) return;

  if (isMissingColumnError(error)) {
    const fallbackPatch: Record<string, any> = {
      status: newStatus,
      ...(extraFields?.merchant_uid ? { merchant_uid: extraFields.merchant_uid } : {}),
    };
    const { error: retryErr } = await supabaseAdmin
      .from("orders")
      .update(fallbackPatch)
      .in("id", orderIds);
    if (retryErr) {
      throw new Error(`주문 상태(${newStatus}) 갱신 실패: ${retryErr.message}`);
    }
    return;
  }

  throw new Error(`주문 상태(${newStatus}) 갱신 실패: ${error.message}`);
}

/**
 * Explicitly join a single community without relying on `ON CONFLICT (community_id, user_id)` unique index.
 */
export async function safeUpsertCommunityMember(
  supabaseAdmin: SupabaseClient,
  communityId: string,
  userId: string
): Promise<boolean> {
  if (!communityId || !userId) return false;
  try {
    const { data: existingRows } = await supabaseAdmin
      .from("community_members")
      .select("id, is_deleted")
      .eq("community_id", communityId)
      .eq("user_id", userId)
      .limit(1);

    const existing = existingRows?.[0];
    if (existing) {
      if (existing.is_deleted) {
        await supabaseAdmin
          .from("community_members")
          .update({ is_deleted: false, joined_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
      return true;
    }

    const { error } = await supabaseAdmin.from("community_members").insert([
      {
        community_id: communityId,
        user_id: userId,
        joined_at: new Date().toISOString(),
        is_deleted: false,
      },
    ]);
    return !error;
  } catch (e) {
    console.warn("[safeUpsertCommunityMember] Warning:", e);
    return false;
  }
}

/**
 * Activate community memberships for all active communities linked to `courseId`.
 */
export async function safeJoinCourseCommunities(
  supabaseAdmin: SupabaseClient,
  courseId: string,
  userId: string
): Promise<void> {
  if (!courseId || !userId) return;
  try {
    const { data: linkedCommunities } = await supabaseAdmin
      .from("communities")
      .select("id")
      .eq("course_id", courseId)
      .eq("is_deleted", false);

    if (linkedCommunities && linkedCommunities.length > 0) {
      for (const comm of linkedCommunities) {
        await safeUpsertCommunityMember(supabaseAdmin, comm.id, userId);
      }
    }
  } catch (e) {
    console.warn("[safeJoinCourseCommunities] Warning:", e);
  }
}

/**
 * Grant course enrollment (`enrollments`), sync linked communities, and optionally upgrade member role to `paid_member`.
 * Never uses `ON CONFLICT (user_id, course_id)` or `enrollments.updated_at` so it works across all DB schemas.
 */
export async function safeGrantCourseEnrollment(
  supabaseAdmin: SupabaseClient,
  params: {
    userId: string;
    courseId: string;
    customExpiresAt?: string | null;
    baseDate?: Date;
    skipIfAnyRowExists?: boolean;
    upgradeRole?: boolean;
  }
): Promise<{ enrolled: boolean; enrollmentId?: string }> {
  const {
    userId,
    courseId,
    customExpiresAt,
    baseDate = new Date(),
    skipIfAnyRowExists = false,
    upgradeRole = true,
  } = params;

  if (!userId || !courseId) return { enrolled: false };

  // 1. Check existing rows in `enrollments`
  const { data: existingRows, error: selectErr } = await supabaseAdmin
    .from("enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (selectErr) {
    throw new Error(`수강 내역 조회 실패: ${selectErr.message}`);
  }

  if (skipIfAnyRowExists && existingRows && existingRows.length > 0) {
    return { enrolled: false, enrollmentId: existingRows[0].id };
  }

  // 2. Calculate expiry if not explicitly provided
  let resolvedExpiry: string | null = customExpiresAt !== undefined ? customExpiresAt : null;
  if (customExpiresAt === undefined) {
    try {
      const { data: courseInfo } = await supabaseAdmin
        .from("courses")
        .select("is_duration_based, duration_days, start_date, end_date, layout")
        .eq("id", courseId)
        .maybeSingle();
      resolvedExpiry = calculateCourseEnrollmentExpiry(courseInfo, baseDate);
    } catch (e) {
      console.warn("[safeGrantCourseEnrollment] Course duration lookup fallback:", e);
    }
  }

  const createdIso = !isNaN(baseDate.getTime()) ? baseDate.toISOString() : new Date().toISOString();
  let enrollmentId: string | undefined;

  if (existingRows && existingRows.length > 0) {
    const primary = existingRows[0];
    enrollmentId = primary.id;

    // Preserve a longer active expiry if user is re-purchasing / extending
    let finalExpiry = resolvedExpiry;
    if (
      customExpiresAt === undefined &&
      !primary.is_deleted &&
      primary.status === "active" &&
      primary.expires_at &&
      resolvedExpiry
    ) {
      const prevExp = new Date(primary.expires_at).getTime();
      const nextExp = new Date(resolvedExpiry).getTime();
      if (Number.isFinite(prevExp) && prevExp > nextExp) {
        finalExpiry = primary.expires_at;
      }
    }

    const updateCandidates: Record<string, any>[] = [
      {
        status: "active",
        is_deleted: false,
        expires_at: finalExpiry,
        created_at: createdIso,
      },
      {
        is_deleted: false,
        expires_at: finalExpiry,
        created_at: createdIso,
      },
      {
        is_deleted: false,
      },
    ];

    let updatedOk = false;
    let lastUpdErr: any = null;
    for (const patch of updateCandidates) {
      const { error } = await supabaseAdmin
        .from("enrollments")
        .update(patch)
        .eq("id", primary.id);
      if (!error) {
        updatedOk = true;
        break;
      }
      lastUpdErr = error;
      if (!isMissingColumnError(error)) break;
    }

    if (!updatedOk && lastUpdErr) {
      throw new Error(`수강 내역 활성화 실패: ${lastUpdErr.message}`);
    }

    // Soft-clean any accidental duplicate active rows
    if (existingRows.length > 1) {
      const dupIds = existingRows.slice(1).map((r: any) => r.id).filter(Boolean);
      if (dupIds.length > 0) {
        await supabaseAdmin
          .from("enrollments")
          .update({ is_deleted: true })
          .in("id", dupIds);
      }
    }
  } else {
    const insertCandidates: Record<string, any>[] = [
      {
        user_id: userId,
        course_id: courseId,
        status: "active",
        is_deleted: false,
        expires_at: resolvedExpiry,
        created_at: createdIso,
      },
      {
        user_id: userId,
        course_id: courseId,
        is_deleted: false,
        expires_at: resolvedExpiry,
        created_at: createdIso,
      },
      {
        user_id: userId,
        course_id: courseId,
        is_deleted: false,
        created_at: createdIso,
      },
    ];

    let insertedOk = false;
    let lastInsErr: any = null;
    for (const row of insertCandidates) {
      const { data: insRow, error } = await supabaseAdmin
        .from("enrollments")
        .insert([row])
        .select("id")
        .maybeSingle();
      if (!error) {
        insertedOk = true;
        enrollmentId = insRow?.id;
        break;
      }
      lastInsErr = error;
      if (!isMissingColumnError(error)) break;
    }

    if (!insertedOk && lastInsErr) {
      throw new Error(`수강 내역 신규 등록 실패: ${lastInsErr.message}`);
    }
  }

  // 3. Best-effort backup to `course_enrollments` if that optional table exists
  try {
    const { data: existingCe, error: ceSelErr } = await supabaseAdmin
      .from("course_enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (!ceSelErr && !existingCe) {
      await supabaseAdmin.from("course_enrollments").insert([
        {
          user_id: userId,
          course_id: courseId,
          status: "active",
          enrolled_at: createdIso,
        },
      ]);
    }
  } catch {
    // ignore if table does not exist
  }

  // 4. Sync course communities
  await safeJoinCourseCommunities(supabaseAdmin, courseId, userId);

  // 5. Upgrade profile role to `paid_member` unless already `beone_member` / `admin` / `super_admin`
  if (upgradeRole) {
    try {
      const { data: currentProfile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      const currentRole = currentProfile?.role || "user";
      const retainRoles = new Set(["paid_member", "beone_member", "bione_member", "admin", "super_admin"]);
      if (!retainRoles.has(currentRole)) {
        await supabaseAdmin
          .from("profiles")
          .update({ role: "paid_member" })
          .eq("id", userId);
      }
    } catch (e) {
      console.warn("[safeGrantCourseEnrollment] Profile role sync warning:", e);
    }
  }

  return { enrolled: true, enrollmentId };
}

/**
 * Safely revoke course enrollment without failing on non-existent `enrollments.updated_at`.
 */
export async function safeRevokeCourseEnrollment(
  supabaseAdmin: SupabaseClient,
  userId: string,
  courseId: string
): Promise<void> {
  if (!userId || !courseId) return;

  const { error } = await supabaseAdmin
    .from("enrollments")
    .update({ status: "expired" })
    .eq("user_id", userId)
    .eq("course_id", courseId);

  if (error && isMissingColumnError(error)) {
    await supabaseAdmin
      .from("enrollments")
      .update({ is_deleted: true })
      .eq("user_id", userId)
      .eq("course_id", courseId);
  }

  const { data: communities } = await supabaseAdmin
    .from("communities")
    .select("id")
    .eq("course_id", courseId);

  if (communities && communities.length > 0) {
    for (const comm of communities) {
      await supabaseAdmin
        .from("community_members")
        .update({ is_deleted: true })
        .eq("community_id", comm.id)
        .eq("user_id", userId);
    }
  }
}

/**
 * Prepare and persist PENDING order row(s) during `/api/init-pay` (supports both single course & multi-item Cart).
 */
export async function safePrepareOrdersForInitPay(
  supabaseAdmin: SupabaseClient,
  params: PrepareOrdersForInitPayParams
): Promise<PrepareOrdersForInitPayResult> {
  const { oid, price, userId, courseId, items, orderName, mileageUsed } = params;

  const normalizedItems: InitPayOrderItemInput[] =
    Array.isArray(items) && items.length > 0
      ? items.filter((it) => Boolean(it?.courseId))
      : courseId
        ? [{ courseId }]
        : [];

  if (!userId || normalizedItems.length === 0) {
    return {
      verifiedPrice: Math.max(0, Math.round(Number(price) || 0)),
      verifiedMileage: Math.max(0, Math.round(Number(mileageUsed) || 0)),
      orderIds: [],
      courseIds: [],
    };
  }

  const courseIds = Array.from(new Set(normalizedItems.map((it) => it.courseId)));

  const [{ data: courseRows }, { data: profileRow }] = await Promise.all([
    supabaseAdmin.from("courses").select("id, title, price, discount_price").in("id", courseIds),
    supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
  ]);

  const coursesMap = new Map<string, any>((courseRows || []).map((c: any) => [c.id, c]));

  // Look up existing PENDING orders if orderId was supplied from Cart
  const explicitOrderIds = normalizedItems.map((it) => it.orderId).filter(Boolean) as string[];
  let existingCartMap = new Map<string, any>();
  if (explicitOrderIds.length > 0) {
    const { data: cartOrders } = await supabaseAdmin
      .from("orders")
      .select("*")
      .in("id", explicitOrderIds);
    existingCartMap = new Map((cartOrders || []).map((o: any) => [o.id, o]));
  }

  // Compute each item's base price
  const itemPrices = normalizedItems.map((it) => {
    const c = coursesMap.get(it.courseId);
    const cartRow = it.orderId ? existingCartMap.get(it.orderId) : null;
    if (c && typeof c.price === "number" && Number(c.price) > 0) {
      return Number(c.price);
    }
    if (cartRow && typeof cartRow.amount === "number" && Number(cartRow.amount) > 0) {
      return Number(cartRow.amount);
    }
    return normalizedItems.length === 1 ? Math.max(0, Number(price) || 0) : 0;
  });

  const subtotal = itemPrices.reduce((acc, p) => acc + p, 0);
  const availableMileage = Math.max(0, Number((profileRow as any)?.mileage) || 0);
  let safeMileage = Math.max(0, Math.round(Number(mileageUsed) || 0));

  if (safeMileage > availableMileage) {
    throw new Error("보유한 마일리지를 초과하여 사용할 수 없습니다.");
  }

  if (subtotal > 0) {
    safeMileage = Math.min(safeMileage, subtotal);
  }

  const expectedTotalPrice = subtotal > 0 ? Math.max(0, subtotal - safeMileage) : Math.max(0, Math.round(Number(price) || 0));

  // Distribute mileage across items sequentially so sum(netAmounts) === expectedTotalPrice
  let remainingMileageToAllocate = safeMileage;
  const savedOrderIds: string[] = [];

  for (let idx = 0; idx < normalizedItems.length; idx++) {
    const item = normalizedItems[idx];
    const baseItemPrice = itemPrices[idx];
    const itemMileage = Math.min(remainingMileageToAllocate, baseItemPrice);
    remainingMileageToAllocate -= itemMileage;
    const itemNetAmount = Math.max(0, baseItemPrice - itemMileage);

    const itemMerchantUid = idx === 0 ? oid : `${oid}__SUB_${idx}`;
    const courseObj = coursesMap.get(item.courseId);
    const resolvedOrderName =
      normalizedItems.length === 1
        ? orderName || courseObj?.title || "온라인 강좌 수강권 구매"
        : courseObj?.title || orderName || "온라인 강좌 수강권 구매";

    // Find target existing PENDING order row
    let targetOrderId: string | null = item.orderId || null;

    if (!targetOrderId) {
      const { data: byOid } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("merchant_uid", itemMerchantUid)
        .maybeSingle();
      if (byOid?.id) {
        targetOrderId = byOid.id;
      }
    }

    if (!targetOrderId) {
      const { data: pendingRows } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("user_id", userId)
        .eq("course_id", item.courseId)
        .in("status", ["PENDING", "pending"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (pendingRows?.[0]?.id) {
        targetOrderId = pendingRows[0].id;
      }
    }

    const saved = await safeSaveOrderRow(supabaseAdmin, targetOrderId, {
      user_id: userId,
      course_id: item.courseId,
      amount: itemNetAmount,
      status: "PENDING",
      merchant_uid: itemMerchantUid,
      order_name: resolvedOrderName,
      mileage_used: itemMileage,
    });

    savedOrderIds.push(saved.id);
  }

  return {
    verifiedPrice: expectedTotalPrice,
    verifiedMileage: safeMileage,
    orderIds: savedOrderIds,
    courseIds,
  };
}

/**
 * Locate order row(s) in `inicis-return` by `oid`, including `__SUB_N` multi-item cart rows and self-healing fallback
 * if an order's `merchant_uid` failed to update before payment.
 */
export async function findOrdersForInicisReturn(
  supabaseAdmin: SupabaseClient,
  params: {
    oid: string;
    approvedAmount: number;
    authResponseData?: any;
    merchantMeta?: MerchantCallbackMeta;
  }
): Promise<any[]> {
  const { oid, approvedAmount, authResponseData, merchantMeta } = params;
  const baseOid = getBaseMerchantUid(oid);

  // 1. Primary lookup: exact `merchant_uid = oid` + any `${oid}__SUB_%` rows
  const [{ data: primaryRows, error: primaryErr }, { data: subRows }] = await Promise.all([
    supabaseAdmin.from("orders").select("*").eq("merchant_uid", baseOid),
    supabaseAdmin.from("orders").select("*").like("merchant_uid", `${baseOid}__SUB_%`),
  ]);

  if (primaryErr) throw primaryErr;

  const combined = [...(primaryRows || []), ...(subRows || [])];
  if (combined.length > 0) {
    return combined;
  }

  // 2. Fallback A: Check explicit `orderIds` from `merchantMeta`
  if (merchantMeta?.orderIds && merchantMeta.orderIds.length > 0) {
    const { data: byIds } = await supabaseAdmin
      .from("orders")
      .select("*")
      .in("id", merchantMeta.orderIds);

    if (byIds && byIds.length > 0) {
      for (let i = 0; i < byIds.length; i++) {
        const targetUid = i === 0 ? baseOid : `${baseOid}__SUB_${i}`;
        await safeUpdateOrdersStatusByIds(supabaseAdmin, [byIds[i].id], byIds[i].status || "PENDING", {
          merchant_uid: targetUid,
        }).catch(() => {});
        byIds[i].merchant_uid = targetUid;
      }
      return byIds;
    }
  }

  // 3. Fallback B: Check `payment_api_logs` `INIT_PAY_REQ` for this `oid`
  let fallbackUserId = merchantMeta?.userId || "";
  let fallbackCourseId = merchantMeta?.courseId || "";

  try {
    const { data: initLog } = await supabaseAdmin
      .from("payment_api_logs")
      .select("request_data")
      .eq("merchant_uid", baseOid)
      .eq("type", "INIT_PAY_REQ")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const reqData = initLog?.request_data;
    if (reqData && typeof reqData === "object") {
      if (!fallbackUserId && reqData.userId) fallbackUserId = reqData.userId;
      if (!fallbackCourseId && reqData.courseId) fallbackCourseId = reqData.courseId;
    }
  } catch {
    // ignore if payment_api_logs does not exist
  }

  // 4. Fallback C: Infer user by buyerEmail in `authResponseData` and course by `OID_{COURSE8}_` prefix
  if (!fallbackUserId && authResponseData) {
    const buyerEmail = String(
      authResponseData.buyerEmail ||
        authResponseData.P_EMAIL ||
        authResponseData.buyeremail ||
        ""
    ).trim();
    if (buyerEmail && buyerEmail !== "user@example.com") {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", buyerEmail)
        .limit(1)
        .maybeSingle();
      if (prof?.id) fallbackUserId = prof.id;
    }
  }

  if (!fallbackCourseId && baseOid.startsWith("OID_")) {
    const parts = baseOid.split("_");
    const prefix8 = (parts[1] || "").toLowerCase();
    if (prefix8.length === 8) {
      const { data: allCourses } = await supabaseAdmin.from("courses").select("id");
      const matchedCourse = (allCourses || []).find((c: any) =>
        String(c.id || "").toLowerCase().startsWith(prefix8)
      );
      if (matchedCourse?.id) fallbackCourseId = matchedCourse.id;
    }
  }

  // 5. If we recovered userId & courseId, look for a matching PENDING order or create one on the spot!
  if (fallbackUserId && fallbackCourseId) {
    const { data: pendingMatch } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("user_id", fallbackUserId)
      .eq("course_id", fallbackCourseId)
      .in("status", ["PENDING", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingMatch) {
      const updated = await safeSaveOrderRow(supabaseAdmin, pendingMatch.id, {
        user_id: fallbackUserId,
        course_id: fallbackCourseId,
        amount: approvedAmount,
        status: "PENDING",
        merchant_uid: baseOid,
        order_name: pendingMatch.order_name || authResponseData?.goodName || authResponseData?.P_GOODS || "온라인 강좌 수강권 구매",
        mileage_used: Number(pendingMatch.mileage_used || 0),
      });
      return [updated];
    }

    const created = await safeSaveOrderRow(supabaseAdmin, null, {
      user_id: fallbackUserId,
      course_id: fallbackCourseId,
      amount: approvedAmount,
      status: "PENDING",
      merchant_uid: baseOid,
      order_name: authResponseData?.goodName || authResponseData?.P_GOODS || "온라인 강좌 수강권 구매",
      mileage_used: 0,
    });
    return [created];
  }

  return [];
}

/**
 * Finalize approved KG Inicis order(s): update status to `COMPLETED`, clean duplicate cart items,
 * deduct mileage, write `payment_logs` + accounting ledger, and grant `enrollments` + community access.
 */
export async function completeApprovedOrdersAndEnroll(
  supabaseAdmin: SupabaseClient,
  params: {
    oid: string;
    orders: any[];
    approvedAmount: number;
    authResponseData: any;
    isMobileFlow: boolean;
  }
): Promise<{ alreadyCompleted: boolean }> {
  const { oid, orders, approvedAmount, authResponseData, isMobileFlow } = params;
  const baseOid = getBaseMerchantUid(oid);

  const allAlreadyCompleted = orders.every((o) => {
    const s = String(o.status || "").toUpperCase();
    return s === "COMPLETED" || s === "PAID";
  });

  if (allAlreadyCompleted) {
    // Still ensure enrollments exist (idempotent self-healing!)
    for (const ord of orders) {
      if (ord.user_id && ord.course_id) {
        await safeGrantCourseEnrollment(supabaseAdmin, {
          userId: ord.user_id,
          courseId: ord.course_id,
          baseDate: ord.created_at ? new Date(ord.created_at) : new Date(),
        }).catch((e) => console.warn("[completeApprovedOrdersAndEnroll] Idempotent enrollment sync warning:", e));
      }
    }
    return { alreadyCompleted: true };
  }

  const orderIds = orders.map((o) => o.id).filter(Boolean);
  await safeUpdateOrdersStatusByIds(supabaseAdmin, orderIds, "COMPLETED");

  // Clean up duplicate leftover PENDING cart items for the same user & course
  for (const ord of orders) {
    if (ord.user_id && ord.course_id) {
      try {
        await supabaseAdmin
          .from("orders")
          .delete()
          .eq("user_id", ord.user_id)
          .eq("course_id", ord.course_id)
          .in("status", ["PENDING", "pending"])
          .not("id", "in", `(${orderIds.join(",")})`);
      } catch {
        // ignore cleanup warning
      }
    }
  }

  // Deduct mileage once across the order group
  const primaryOrder = orders[0];
  const userId = primaryOrder?.user_id;
  const totalMileageUsed = orders.reduce((acc, o) => acc + Math.max(0, Number(o.mileage_used || 0)), 0);

  if (userId && totalMileageUsed > 0) {
    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (prof) {
        const beforeMileage = Math.max(0, Number((prof as any).mileage || 0));
        const afterMileage = Math.max(0, beforeMileage - totalMileageUsed);
        const { error: mErr } = await supabaseAdmin
          .from("profiles")
          .update({ mileage: afterMileage })
          .eq("id", userId);

        if (!mErr) {
          // Record mileage usage log in `support_contents`
          await supabaseAdmin
            .from("support_contents")
            .insert([
              {
                type: "mileage_log",
                title: userId,
                active: true,
                is_deleted: false,
                content: JSON.stringify({
                  amount: -totalMileageUsed,
                  before_mileage: beforeMileage,
                  after_mileage: afterMileage,
                  reason: `강의 결제 마일리지 사용 (주문번호: ${baseOid})`,
                  created_by: userId,
                }),
              },
            ])
            .then(() => {}, () => {});
        }
      }
    } catch (mEx) {
      console.warn("[completeApprovedOrdersAndEnroll] Mileage deduction warning:", mEx);
    }
  }

  // Write payment_logs linked to primary order (and sub-orders if multi-item)
  const payMethodLabel = isMobileFlow
    ? authResponseData?.payMethod || "INICIS_MOBILE"
    : authResponseData?.payMethod || "CARD";

  for (let i = 0; i < orders.length; i++) {
    const ord = orders[i];
    await safeInsertPaymentLog(supabaseAdmin, {
      orderId: ord.id,
      merchantUid: ord.merchant_uid || baseOid,
      status: "SUCCESS",
      amount: i === 0 ? approvedAmount : Number(ord.amount || 0),
      paymentMethod: payMethodLabel,
      payloadObj: {
        ...authResponseData,
        merchant_uid: baseOid,
      },
    });
  }

  // Grant course enrollments + community memberships + paid_member role for EVERY course in the order
  for (const ord of orders) {
    if (ord.user_id && ord.course_id) {
      await safeGrantCourseEnrollment(supabaseAdmin, {
        userId: ord.user_id,
        courseId: ord.course_id,
        baseDate: new Date(),
        upgradeRole: true,
      });
    }
  }

  // Best-effort double-entry accounting ledger (`transactions` + `transaction_lines`)
  if (primaryOrder?.user_id && approvedAmount > 0) {
    try {
      const { data: tx, error: txErr } = await supabaseAdmin
        .from("transactions")
        .insert([
          {
            description: `KG이니시스 강의 결제 승인 (주문번호: ${baseOid})`,
            created_by: primaryOrder.user_id,
            created_at: new Date().toISOString(),
          },
        ])
        .select("id")
        .maybeSingle();

      if (!txErr && tx?.id) {
        await supabaseAdmin.from("transaction_lines").insert([
          {
            transaction_id: tx.id,
            user_id: primaryOrder.user_id,
            description: `KG이니시스 결제 입금 (${baseOid})`,
            debit_amount: approvedAmount,
            credit_amount: 0,
          },
          {
            transaction_id: tx.id,
            user_id: primaryOrder.user_id,
            description: `온라인 강의 수강 매출 (${baseOid})`,
            debit_amount: 0,
            credit_amount: approvedAmount,
          },
        ]);
      }
    } catch {
      // Never block payment completion on optional accounting tables
    }
  }

  return { alreadyCompleted: false };
}

/**
 * Parse a `payment_logs` or `payment_api_logs` JSON payload into normalized PG approval fields.
 */
export function parsePgPayloadObject(rawInput: any): Record<string, any> | null {
  if (!rawInput) return null;
  try {
    const parsed = typeof rawInput === "string" ? JSON.parse(rawInput) : rawInput;
    if (!parsed || typeof parsed !== "object") return null;
    const rawObj = parsed.details && typeof parsed.details === "object" ? parsed.details : parsed;
    return { ...parsed, ...rawObj };
  } catch {
    return null;
  }
}

export function extractPgApprovalFields(rawObj: Record<string, any> | null | undefined): {
  tid: string;
  applNum: string;
  payDevice: string;
  cardName: string;
  applDate: string;
  applTime: string;
  payMethod: string;
  merchantUid: string;
  approvedAmount: number;
  isApprovedSuccess: boolean;
  isNetCancelled: boolean;
} {
  if (!rawObj || typeof rawObj !== "object") {
    return {
      tid: "",
      applNum: "",
      payDevice: "",
      cardName: "",
      applDate: "",
      applTime: "",
      payMethod: "",
      merchantUid: "",
      approvedAmount: 0,
      isApprovedSuccess: false,
      isNetCancelled: false,
    };
  }

  const tid = String(
    rawObj.tid ||
      rawObj.TID ||
      rawObj.P_TID ||
      rawObj.AuthTID ||
      rawObj.payment_tid ||
      ""
  ).trim();

  const applNum = String(
    rawObj.applNum ||
      rawObj.CARD_ApplNum ||
      rawObj.applNo ||
      rawObj.P_AUTH_NO ||
      rawObj.P_AUTH_NUM ||
      rawObj.AuthCode ||
      rawObj.applCode ||
      rawObj.appl_num ||
      ""
  ).trim();

  let payDevice = String(rawObj.payDevice || "").trim();
  if (!payDevice) {
    if (tid.startsWith("INIMX_") || rawObj.P_TID) payDevice = "MOBILE";
    else if (tid.startsWith("Stdpay")) payDevice = "PC";
  }

  const cardName = String(rawObj.P_FN_NM || rawObj.CARD_PurchaseName || rawObj.cardName || "").trim();
  const applDate = String(
    rawObj.applDate || (rawObj.P_AUTH_DT ? String(rawObj.P_AUTH_DT).substring(0, 8) : "")
  ).trim();
  const applTime = String(
    rawObj.applTime || (rawObj.P_AUTH_DT ? String(rawObj.P_AUTH_DT).substring(8, 14) : "")
  ).trim();

  const payMethod = String(rawObj.payMethod || rawObj.P_TYPE || rawObj.payment_method || "CARD").trim();
  const merchantUid = String(
    rawObj.merchant_uid || rawObj.MOID || rawObj.P_OID || rawObj.oid || rawObj.orderNumber || ""
  ).trim();

  const approvedAmount = Number(rawObj.TotPrice || rawObj.P_AMT || rawObj.price || rawObj.amount || 0);
  const resCode = String(rawObj.resultCode ?? rawObj.P_STATUS ?? "").trim();
  const isNetCancelled = Boolean(rawObj.netCancelExecuted || rawObj.triggeredNetCancel);

  const hasRealInicisTid =
    Boolean(tid) &&
    !tid.startsWith("TID-MOCK") &&
    !tid.toLowerCase().includes("mock") &&
    (tid.startsWith("Stdpay") || tid.startsWith("INIMX_") || tid.startsWith("INI") || tid.length >= 20);

  const isApprovedSuccess =
    !isNetCancelled &&
    hasRealInicisTid &&
    (resCode === "0000" || resCode === "00" || (Boolean(applNum) && resCode === ""));

  return {
    tid,
    applNum,
    payDevice,
    cardName,
    applDate,
    applTime,
    payMethod,
    merchantUid,
    approvedAmount,
    isApprovedSuccess,
    isNetCancelled,
  };
}

let lastGlobalReconcileMs = 0;

/**
 * Self-Healing Reconciliation Engine:
 * 1) Recovers stuck `PENDING` or unlinked orders that have a verified KG Inicis S2S final approval
 *    (with no NetCancel or Refund) in `payment_logs` or `payment_api_logs`.
 * 2) Backfills missing `enrollments` rows for any `COMPLETED` / `PAID` orders where 0 enrollment rows exist
 *    (never overwrites manually revoked or expired enrollments).
 */
export async function reconcileApprovedPaymentsAndEnrollments(
  supabaseAdmin: SupabaseClient,
  options?: { targetUserId?: string; force?: boolean }
): Promise<ReconciliationSummary> {
  const nowMs = Date.now();
  if (!options?.targetUserId && !options?.force && nowMs - lastGlobalReconcileMs < 15_000) {
    return { recoveredOrdersCount: 0, backfilledEnrollmentsCount: 0 };
  }
  if (!options?.targetUserId) {
    lastGlobalReconcileMs = nowMs;
  }

  let recoveredOrdersCount = 0;
  let backfilledEnrollmentsCount = 0;

  try {
    // --- STEP 1: Recover stuck PENDING / unlinked Inicis-approved orders (Global or User-scoped) ---
    if (!options?.targetUserId || options?.force) {
      const [payLogsRes, apiLogsRes] = await Promise.all([
        supabaseAdmin.from("payment_logs").select("*").order("created_at", { ascending: false }).limit(500),
        supabaseAdmin
          .from("payment_api_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500)
          .then(
            (r) => r,
            () => ({ data: [] as any[], error: null })
          ),
      ]);

      const payLogs = payLogsRes.data || [];
      const apiLogs = apiLogsRes.data || [];

      const cancelledUids = new Set<string>();
      const cancelledTids = new Set<string>();
      const initReqByUid = new Map<string, any>();

      for (const aLog of apiLogs) {
        const baseUid = getBaseMerchantUid(aLog.merchant_uid);
        if (aLog.type === "INIT_PAY_REQ" && baseUid && aLog.request_data && !initReqByUid.has(baseUid)) {
          initReqByUid.set(baseUid, aLog.request_data);
        }
        if (
          (aLog.type === "NET_CANCEL_REQ" ||
            aLog.type === "NET_CANCEL_RES" ||
            (aLog.type === "REFUND_RES" && aLog.status === "SUCCESS")) &&
          baseUid
        ) {
          cancelledUids.add(baseUid);
          const reqTid = aLog.request_data?.tid;
          if (reqTid) cancelledTids.add(String(reqTid));
        }
      }

      for (const pLog of payLogs) {
        const obj = parsePgPayloadObject(pLog.raw_response ?? pLog.raw_data);
        const info = extractPgApprovalFields(obj);
        const baseUid = getBaseMerchantUid(pLog.merchant_uid || info.merchantUid);
        if (info.isNetCancelled && baseUid) {
          cancelledUids.add(baseUid);
        }
      }

      // Collect verified S2S approvals keyed by base merchant_uid
      const verifiedApprovals = new Map<
        string,
        {
          baseUid: string;
          orderId: string | null;
          approvedAmount: number;
          rawObj: Record<string, any>;
          payMethod: string;
        }
      >();

      for (const pLog of payLogs) {
        if (pLog.status && String(pLog.status).toUpperCase() === "FAILED") continue;
        const obj = parsePgPayloadObject(pLog.raw_response ?? pLog.raw_data);
        const info = extractPgApprovalFields(obj);
        const baseUid = getBaseMerchantUid(pLog.merchant_uid || info.merchantUid);
        if (!info.isApprovedSuccess) continue;
        if (baseUid && cancelledUids.has(baseUid)) continue;
        if (info.tid && cancelledTids.has(info.tid)) continue;

        const key = baseUid || pLog.order_id || info.tid;
        if (key && !verifiedApprovals.has(key)) {
          verifiedApprovals.set(key, {
            baseUid,
            orderId: pLog.order_id || null,
            approvedAmount: Number(pLog.amount || info.approvedAmount || 0),
            rawObj: obj || {},
            payMethod: pLog.payment_method || info.payMethod || "CARD",
          });
        }
      }

      for (const aLog of apiLogs) {
        if (aLog.type !== "S2S_APPROVAL_RES" || aLog.status !== "SUCCESS") continue;
        const obj = parsePgPayloadObject(aLog.response_data);
        const info = extractPgApprovalFields(obj);
        const baseUid = getBaseMerchantUid(aLog.merchant_uid || info.merchantUid);
        if (!info.isApprovedSuccess) continue;
        if (baseUid && cancelledUids.has(baseUid)) continue;
        if (info.tid && cancelledTids.has(info.tid)) continue;

        const key = baseUid || aLog.order_id || info.tid;
        if (key && !verifiedApprovals.has(key)) {
          verifiedApprovals.set(key, {
            baseUid,
            orderId: aLog.order_id || null,
            approvedAmount: info.approvedAmount,
            rawObj: obj || {},
            payMethod: info.payMethod || "CARD",
          });
        }
      }

      if (verifiedApprovals.size > 0) {
        const { data: recentOrders } = await supabaseAdmin
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1000);

        const ordersById = new Map<string, any>();
        const ordersByBaseUid = new Map<string, any[]>();
        for (const ord of recentOrders || []) {
          ordersById.set(ord.id, ord);
          const bUid = getBaseMerchantUid(ord.merchant_uid);
          if (bUid) {
            if (!ordersByBaseUid.has(bUid)) ordersByBaseUid.set(bUid, []);
            ordersByBaseUid.get(bUid)!.push(ord);
          }
        }

        for (const [, approval] of verifiedApprovals) {
          let matchedOrders: any[] = [];
          if (approval.baseUid && ordersByBaseUid.has(approval.baseUid)) {
            matchedOrders = ordersByBaseUid.get(approval.baseUid)!;
          } else if (approval.orderId && ordersById.has(approval.orderId)) {
            matchedOrders = [ordersById.get(approval.orderId)!];
          } else if (approval.baseUid) {
            const initReq = initReqByUid.get(approval.baseUid);
            const recovered = await findOrdersForInicisReturn(supabaseAdmin, {
              oid: approval.baseUid,
              approvedAmount: approval.approvedAmount,
              authResponseData: approval.rawObj,
              merchantMeta: initReq
                ? {
                    originUrl: "",
                    userId: initReq.userId,
                    courseId: initReq.courseId,
                  }
                : undefined,
            });
            matchedOrders = recovered;
          }

          const stuckPendingOrders = matchedOrders.filter((o) => {
            const s = String(o.status || "").toUpperCase();
            return s === "PENDING" || s === "";
          });

          if (stuckPendingOrders.length > 0) {
            const idsToPromote = stuckPendingOrders.map((o) => o.id);
            await safeUpdateOrdersStatusByIds(supabaseAdmin, idsToPromote, "COMPLETED");
            recoveredOrdersCount += idsToPromote.length;

            // Ensure payment_logs also has a linked record for SalesManagement TID/applNum display
            await safeInsertPaymentLog(supabaseAdmin, {
              orderId: stuckPendingOrders[0].id,
              merchantUid: approval.baseUid || stuckPendingOrders[0].merchant_uid,
              status: "SUCCESS",
              amount: approval.approvedAmount || Number(stuckPendingOrders[0].amount || 0),
              paymentMethod: approval.payMethod,
              payloadObj: approval.rawObj,
            });
          }
        }
      }
    }

    // --- STEP 2: Backfill missing `enrollments` for all `COMPLETED` / `PAID` orders ---
    let paidOrdersQuery = supabaseAdmin
      .from("orders")
      .select("*")
      .in("status", ["COMPLETED", "PAID", "completed", "paid"])
      .order("created_at", { ascending: false })
      .limit(1000);

    if (options?.targetUserId) {
      paidOrdersQuery = paidOrdersQuery.eq("user_id", options.targetUserId);
    }

    const { data: paidOrders, error: paidOrdersErr } = await paidOrdersQuery;
    if (!paidOrdersErr && paidOrders && paidOrders.length > 0) {
      const userIds = Array.from(new Set(paidOrders.map((o: any) => o.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: existingEnrollments } = await supabaseAdmin
          .from("enrollments")
          .select("id, user_id, course_id, status, is_deleted")
          .in("user_id", userIds);

        const existingKeySet = new Set<string>();
        for (const e of existingEnrollments || []) {
          if (e.user_id && e.course_id) {
            existingKeySet.add(`${e.user_id}::${e.course_id}`);
          }
        }

        for (const ord of paidOrders) {
          if (!ord.user_id || !ord.course_id) continue;
          if (ord.is_deleted === true) continue;
          const pairKey = `${ord.user_id}::${ord.course_id}`;
          if (existingKeySet.has(pairKey)) continue;

          existingKeySet.add(pairKey);
          const baseDate = ord.created_at ? new Date(ord.created_at) : new Date();
          const res = await safeGrantCourseEnrollment(supabaseAdmin, {
            userId: ord.user_id,
            courseId: ord.course_id,
            baseDate,
            skipIfAnyRowExists: true,
            upgradeRole: true,
          });
          if (res.enrolled) {
            backfilledEnrollmentsCount++;
          }
        }
      }
    }
  } catch (reconcileErr: any) {
    console.warn("[reconcileApprovedPaymentsAndEnrollments] Warning:", reconcileErr?.message || reconcileErr);
  }

  return { recoveredOrdersCount, backfilledEnrollmentsCount };
}

/**
 * Schema-safe Admin Orders Fetcher for `SalesManagement.tsx`:
 * - Runs reconciliation first so previously stuck/missed Inicis approvals appear immediately.
 * - Uses `.select("*")` on `orders` and `payment_logs` so missing optional columns (`payment_method`, `raw_response` vs `raw_data`) NEVER error!
 * - Also merges `payment_api_logs` (`S2S_APPROVAL_RES`) so TID & approval numbers are always populated.
 */
export async function fetchEnrichedAdminOrders(
  supabaseAdmin: SupabaseClient,
  limit: number = 300,
  forceReconcile: boolean = false
): Promise<{ orders: any[]; reconciliation: ReconciliationSummary }> {
  const reconciliation = await reconcileApprovedPaymentsAndEnrollments(supabaseAdmin, {
    force: forceReconcile,
  });

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (ordersError) {
    throw new Error(ordersError.message);
  }
  if (!orders || orders.length === 0) {
    return { orders: [], reconciliation };
  }

  const userIds = Array.from(new Set(orders.map((o: any) => o.user_id).filter(Boolean)));
  const courseIds = Array.from(new Set(orders.map((o: any) => o.course_id).filter(Boolean)));

  const [profilesRes, coursesRes, payLogsRes, apiLogsRes] = await Promise.all([
    userIds.length > 0
      ? supabaseAdmin.from("profiles").select("*").in("id", userIds)
      : Promise.resolve({ data: [] as any[] }),
    courseIds.length > 0
      ? supabaseAdmin.from("courses").select("id, title, thumbnail").in("id", courseIds)
      : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin.from("payment_logs").select("*").order("created_at", { ascending: false }).limit(1000),
    supabaseAdmin
      .from("payment_api_logs")
      .select("*")
      .eq("type", "S2S_APPROVAL_RES")
      .eq("status", "SUCCESS")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(
        (r) => r,
        () => ({ data: [] as any[] })
      ),
  ]);

  const profilesMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
  const coursesMap = new Map((coursesRes.data || []).map((c: any) => [c.id, c]));

  const logsByOrderId = new Map<string, any[]>();
  const logsByBaseUid = new Map<string, any[]>();

  const registerLog = (normLog: any, orderId?: string | null, mUid?: string | null) => {
    if (orderId) {
      if (!logsByOrderId.has(orderId)) logsByOrderId.set(orderId, []);
      logsByOrderId.get(orderId)!.push(normLog);
    }
    const baseUid = getBaseMerchantUid(mUid);
    if (baseUid) {
      if (!logsByBaseUid.has(baseUid)) logsByBaseUid.set(baseUid, []);
      logsByBaseUid.get(baseUid)!.push(normLog);
    }
  };

  for (const log of payLogsRes.data || []) {
    const parsedObj = parsePgPayloadObject(log.raw_response ?? log.raw_data);
    const info = extractPgApprovalFields(parsedObj);
    const normalizedLog = {
      ...log,
      status: log.status || (info.isApprovedSuccess ? "SUCCESS" : "INFO"),
      raw_response: log.raw_response || (parsedObj ? JSON.stringify(parsedObj) : null),
    };
    registerLog(normalizedLog, log.order_id, log.merchant_uid || info.merchantUid);
  }

  for (const aLog of apiLogsRes.data || []) {
    const parsedObj = parsePgPayloadObject(aLog.response_data);
    const info = extractPgApprovalFields(parsedObj);
    const syntheticLog = {
      id: `api_${aLog.id}`,
      order_id: aLog.order_id || null,
      status: "SUCCESS",
      raw_response: parsedObj ? JSON.stringify(parsedObj) : null,
      payment_method: info.payMethod || "CARD",
      amount: info.approvedAmount || 0,
      created_at: aLog.created_at,
    };
    registerLog(syntheticLog, aLog.order_id, aLog.merchant_uid || info.merchantUid);
  }

  const enrichedOrders = orders.map((order: any) => {
    const baseUid = getBaseMerchantUid(order.merchant_uid);
    const directLogs = logsByOrderId.get(order.id) || [];
    const uidLogs = baseUid ? logsByBaseUid.get(baseUid) || [] : [];

    const mergedMap = new Map<string, any>();
    for (const l of [...directLogs, ...uidLogs]) {
      mergedMap.set(l.id || `${l.order_id}_${l.created_at}`, l);
    }
    const orderLogs = Array.from(mergedMap.values()).sort((a, b) => {
      if (a.status === "SUCCESS" && b.status !== "SUCCESS") return -1;
      if (a.status !== "SUCCESS" && b.status === "SUCCESS") return 1;
      return 0;
    });

    let tid = "";
    let applNum = "";
    let payDevice = "";
    let cardName = "";
    let applDate = "";
    let applTime = "";
    let inferredPayMethod = order.payment_method || "";

    for (const logItem of orderLogs) {
      const obj = parsePgPayloadObject(logItem.raw_response ?? logItem.raw_data);
      const info = extractPgApprovalFields(obj);
      if (info.tid && !tid) tid = info.tid;
      if (info.applNum && !applNum) applNum = info.applNum;
      if (info.payDevice && !payDevice) payDevice = info.payDevice;
      if (info.cardName && !cardName) cardName = info.cardName;
      if (info.applDate && !applDate) applDate = info.applDate;
      if (info.applTime && !applTime) applTime = info.applTime;
      if (!inferredPayMethod && (logItem.payment_method || info.payMethod)) {
        inferredPayMethod = logItem.payment_method || info.payMethod;
      }
    }

    const isInicisLinked = Boolean(
      (tid &&
        !tid.startsWith("TID-MOCK") &&
        (tid.startsWith("Stdpay") || tid.startsWith("INIMX_") || tid.startsWith("INI") || tid.length >= 20)) ||
        (applNum && tid && !tid.startsWith("direct_"))
    );

    const courseObj = coursesMap.get(order.course_id) || (order.order_name ? { id: order.course_id, title: order.order_name, thumbnail: "" } : null);

    return {
      ...order,
      payment_method: inferredPayMethod || "CARD",
      profile: profilesMap.get(order.user_id) || null,
      course: courseObj,
      logs: orderLogs,
      tid: tid || "-",
      applNum: applNum || "-",
      payDevice: payDevice || (tid.startsWith("INIMX_") ? "MOBILE" : tid.startsWith("Stdpay") ? "PC" : ""),
      cardName: cardName || "",
      applDate: applDate || "",
      applTime: applTime || "",
      isInicisLinked,
    };
  });

  return { orders: enrichedOrders, reconciliation };
}

/**
 * Resolve real KG Inicis TID for an order during refund (`refund-order`) across both `payment_logs` (`raw_response`/`raw_data`)
 * and `payment_api_logs` (`S2S_APPROVAL_RES`).
 */
export async function resolveOrderInicisTidAndMethod(
  supabaseAdmin: SupabaseClient,
  order: any
): Promise<{ tid: string; payMethod: string }> {
  let tid = String(order?.payment_tid || "").trim();
  let rawMethod = String(order?.payment_method || "").trim();
  const baseUid = getBaseMerchantUid(order?.merchant_uid);

  try {
    const { data: logsByOrder } = await supabaseAdmin
      .from("payment_logs")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const candidates: any[] = [...(logsByOrder || [])];
    if (candidates.length === 0 && baseUid) {
      const { data: recentLogs } = await supabaseAdmin
        .from("payment_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      for (const l of recentLogs || []) {
        const obj = parsePgPayloadObject(l.raw_response ?? l.raw_data);
        const info = extractPgApprovalFields(obj);
        if (getBaseMerchantUid(l.merchant_uid || info.merchantUid) === baseUid) {
          candidates.push(l);
        }
      }
    }

    for (const l of candidates) {
      const obj = parsePgPayloadObject(l.raw_response ?? l.raw_data);
      const info = extractPgApprovalFields(obj);
      if (info.tid && !tid) tid = info.tid;
      if (info.payMethod && !rawMethod) rawMethod = info.payMethod;
      if (tid) break;
    }

    if (!tid && baseUid) {
      const { data: apiLog } = await supabaseAdmin
        .from("payment_api_logs")
        .select("*")
        .eq("merchant_uid", baseUid)
        .eq("type", "S2S_APPROVAL_RES")
        .eq("status", "SUCCESS")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (apiLog?.response_data) {
        const obj = parsePgPayloadObject(apiLog.response_data);
        const info = extractPgApprovalFields(obj);
        if (info.tid) tid = info.tid;
        if (info.payMethod && !rawMethod) rawMethod = info.payMethod;
      }
    }
  } catch (e: any) {
    console.warn("[resolveOrderInicisTidAndMethod] Warning:", e?.message || e);
  }

  let inicisCancelMethod = "Card";
  const upper = rawMethod.toUpperCase();
  if (upper.includes("CARD") || upper.includes("신용카드")) inicisCancelMethod = "Card";
  else if (upper.includes("VBANK") || upper.includes("가상계좌")) inicisCancelMethod = "Vacct";
  else if (upper.includes("BANK") || upper.includes("DIRECTBANK") || upper.includes("계좌")) inicisCancelMethod = "Acct";
  else if (upper.includes("HPP") || upper.includes("휴대폰")) inicisCancelMethod = "HPP";

  return { tid, payMethod: inicisCancelMethod };
}

/**
 * Fetch all active enrollments with profiles and courses via `supabaseAdmin` (bypassing client RLS for `StudentManagement.tsx`).
 */
export async function fetchAdminEnrollments(supabaseAdmin: SupabaseClient): Promise<any[]> {
  await reconcileApprovedPaymentsAndEnrollments(supabaseAdmin);

  const { data: enrollments, error } = await supabaseAdmin
    .from("enrollments")
    .select("*")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  if (!enrollments || enrollments.length === 0) return [];

  const userIds = Array.from(new Set(enrollments.map((e: any) => e.user_id).filter(Boolean)));
  const courseIds = Array.from(new Set(enrollments.map((e: any) => e.course_id).filter(Boolean)));

  const [profilesRes, coursesRes] = await Promise.all([
    userIds.length > 0
      ? supabaseAdmin.from("profiles").select("*").in("id", userIds)
      : Promise.resolve({ data: [] as any[] }),
    courseIds.length > 0
      ? supabaseAdmin
          .from("courses")
          .select("*")
          .in("id", courseIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const profilesMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
  const coursesMap = new Map((coursesRes.data || []).map((c: any) => [c.id, c]));

  return enrollments
    .filter((e: any) => e.status !== "expired")
    .map((e: any) => {
      const p = profilesMap.get(e.user_id);
      const c = coursesMap.get(e.course_id);
      return {
        id: e.id,
        user_id: e.user_id,
        course_id: e.course_id,
        created_at: e.created_at,
        expires_at: e.expires_at ?? null,
        status: e.status || "active",
        profiles: p
          ? {
              id: p.id,
              name: p.name || p.full_name || "익명",
              nickname: p.nickname || "",
              email: p.email || "",
              mobile_phone: p.mobile_phone || "",
              phone: p.phone || "",
              role: p.role || "user",
            }
          : null,
        courses: c || null,
      };
    });
}

/**
 * Reconcile a specific member's approved Inicis payments & missing enrollments, and return
 * RLS-safe `orders` + `enrolledCourses` for `MyPage.tsx`.
 */
export async function fetchMemberSyncedData(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<{
  reconciliation: ReconciliationSummary;
  orders: any[];
  enrolledCourses: any[];
}> {
  const reconciliation = await reconcileApprovedPaymentsAndEnrollments(supabaseAdmin, {
    targetUserId: userId,
    force: true,
  });

  const [ordersRes, enrollRes, couponsRes] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("enrollments")
      .select("*")
      .eq("user_id", userId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("support_contents")
      .select("*")
      .eq("type", "user_coupon")
      .eq("title", userId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false }),
  ]);

  const rawOrders = (ordersRes.data || []).filter(
    (o: any) => String(o.status || "").toUpperCase() !== "PENDING"
  );
  const activeEnrollments = (enrollRes.data || []).filter(
    (e: any) => String(e.status || "active").toLowerCase() !== "expired"
  );

  const courseIds = Array.from(
    new Set([
      ...rawOrders.map((o: any) => o.course_id).filter(Boolean),
      ...activeEnrollments.map((e: any) => e.course_id).filter(Boolean),
    ])
  );

  const { data: coursesData } =
    courseIds.length > 0
      ? await supabaseAdmin.from("courses").select("*").in("id", courseIds)
      : { data: [] as any[] };

  const coursesMap = new Map((coursesData || []).map((c: any) => [c.id, c]));

  const orders = rawOrders.map((o: any) => ({
    ...o,
    courses: coursesMap.get(o.course_id) || null,
  }));

  // Map latest paid order timestamp per course
  const latestPaidOrderMsByCourse = new Map<string, number>();
  for (const ord of rawOrders) {
    const st = String(ord.status || "").toUpperCase();
    if ((st === "COMPLETED" || st === "PAID") && ord.course_id) {
      const ms = new Date(ord.created_at).getTime();
      const prev = latestPaidOrderMsByCourse.get(ord.course_id) || 0;
      if (Number.isFinite(ms) && ms > prev) {
        latestPaidOrderMsByCourse.set(ord.course_id, ms);
      }
    }
  }

  // Map latest used coupon per course
  const latestUsedCouponByCourse = new Map<
    string,
    { id: string; meta: Record<string, any>; usedMs: number }
  >();
  for (const row of couponsRes.data || []) {
    let meta: Record<string, any> = {};
    try {
      meta = row.content ? JSON.parse(row.content) : {};
    } catch {
      meta = {};
    }
    if (meta.status !== "used" || !meta.course_id) continue;
    const usedMs = new Date(meta.used_at || row.updated_at || row.created_at).getTime();
    const safeUsedMs = Number.isFinite(usedMs) ? usedMs : 0;
    const prev = latestUsedCouponByCourse.get(meta.course_id);
    if (!prev || safeUsedMs > prev.usedMs) {
      latestUsedCouponByCourse.set(meta.course_id, { id: row.id, meta, usedMs: safeUsedMs });
    }
  }

  const seenCourseIds = new Set<string>();
  const enrolledCourses: any[] = [];
  for (const enr of activeEnrollments) {
    if (!enr.course_id || seenCourseIds.has(enr.course_id)) continue;
    const course = coursesMap.get(enr.course_id);
    if (!course) continue;
    seenCourseIds.add(enr.course_id);

    let couponFields: Record<string, any> = {};
    const usedCoupon = latestUsedCouponByCourse.get(enr.course_id);
    const paidMs = latestPaidOrderMsByCourse.get(enr.course_id) || 0;

    if (usedCoupon && enr.expires_at && !course.is_free) {
      const supersededByPaidOrder =
        (!course.is_duration_based && paidMs > 0) ||
        (paidMs > 0 && paidMs > usedCoupon.usedMs) ||
        (paidMs > 0 &&
          usedCoupon.meta.enrollment_expires_at &&
          new Date(enr.expires_at).getTime() -
            new Date(usedCoupon.meta.enrollment_expires_at).getTime() >
            60_000);

      if (!supersededByPaidOrder) {
        const rawMax = usedCoupon.meta.max_views;
        const maxViews =
          rawMax !== null &&
          rawMax !== undefined &&
          rawMax !== "" &&
          Number(rawMax) > 0
            ? Math.floor(Number(rawMax))
            : null;
        const viewCount = Math.max(0, Math.floor(Number(usedCoupon.meta.view_count) || 0));
        couponFields = {
          is_coupon_enrollment: true,
          coupon_id: usedCoupon.id,
          coupon_name: usedCoupon.meta.coupon_name || "무료 수강 쿠폰",
          coupon_max_views: maxViews,
          coupon_view_count: viewCount,
          coupon_view_limit_reached: maxViews !== null && viewCount >= maxViews,
        };
      }
    }

    enrolledCourses.push({
      ...course,
      enrollment_created_at: enr.created_at,
      enrollment_expires_at: enr.expires_at ?? null,
      ...couponFields,
    });
  }

  return {
    reconciliation,
    orders,
    enrolledCourses,
  };
}

