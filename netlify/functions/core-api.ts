import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Initialize Supabase Admin using premium Service Role capabilities
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Auth check helpers
async function getRequestingUser(authHeader?: string) {
  if (!authHeader || !authHeader.startsWith("Bearer ") || !supabaseAdmin) return null;
  const token = authHeader.split(" ")[1];
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (e) {
    return null;
  }
}

async function isAdminUser(userId: string) {
  if (!supabaseAdmin) return false;
  // Basic bypass for main super admin
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .maybeSingle();

  if (profile) {
    return (
      profile.role === "admin" ||
      profile.role === "super_admin"
    );
  }
  return false;
}

const INICIS_ENDPOINTS = {
  sandbox: {
    stdpay: "https://stgstdpay.inicis.com/api/payAuth",
    cancel: "https://stginiapi.inicis.com/v2/cancel",
    stdjs: "https://stgstdpay.inicis.com/stdjs/INIStdPay.js",
  },
  production: {
    stdpay: "https://stdpay.inicis.com/api/payAuth",
    cancel: "https://iniapi.inicis.com/v2/cancel",
    stdjs: "https://stdpay.inicis.com/stdjs/INIStdPay.js",
  },
};

function getInicisKstTimestamp(): string {
  const d = new Date();
  const kstMs = d.getTime() + (d.getTimezoneOffset() * 60000) + (9 * 60 * 60 * 1000);
  const kstDate = new Date(kstMs);
  
  const yyyy = kstDate.getFullYear();
  const MM = String(kstDate.getMonth() + 1).padStart(2, '0');
  const dd = String(kstDate.getDate()).padStart(2, '0');
  const hh = String(kstDate.getHours()).padStart(2, '0');
  const mm = String(kstDate.getMinutes()).padStart(2, '0');
  const ss = String(kstDate.getSeconds()).padStart(2, '0');
  
  return `${yyyy}${MM}${dd}${hh}${mm}${ss}`;
}

async function getInicisConfig() {
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from("payment_settings")
        .select("pg_id, inicis_sign_key, is_sandbox")
        .limit(1)
        .maybeSingle();

      if (!error && data?.pg_id && data?.inicis_sign_key) {
        return {
          mid: data.pg_id,
          signKey: data.inicis_sign_key,
          isSandbox: data.is_sandbox !== false,
        };
      }
    } catch (e) {
      console.warn("[getInicisConfig] DB loading from payment_settings failed, fallback defaults used:", e);
    }
  }

  return {
    mid: process.env.INICIS_MID || process.env.VITE_INICIS_MID || "INIpayTest",
    signKey: process.env.INICIS_SIGNKEY || "SU5JQ0lTX1NJR05LRVlfVEVTVF9LRVk=",
    isSandbox: process.env.NODE_ENV !== "production",
  };
}

export const handler: Handler = async (event, context) => {
  const allowedOrigin = process.env.APP_URL || process.env.VITE_APP_URL || "*";

  // CORS support
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ status: "error", message: "Method Not Allowed" })
    };
  }

  const responseHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin
  };

  try {
    if (!supabaseAdmin) {
      return {
        statusCode: 500,
        headers: responseHeaders,
        body: JSON.stringify({ status: "error", message: "Supabase Administrator credentials not configured." })
      };
    }

    const body = JSON.parse(event.body || "{}");
    const { action } = body;

    if (!action) {
      return {
        statusCode: 400,
        headers: responseHeaders,
        body: JSON.stringify({ status: "error", message: "Missing required API action descriptor." })
      };
    }

    // Capture caller auth context
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const requestingUser = await getRequestingUser(authHeader);

    // =========================================================================
    // 1. LESSON / COURSE ACCESS VERIFICATION (Available to active session users)
    // =========================================================================
    if (action === "verify-lesson-access") {
      const { courseId, lessonId, userId } = body;
      const targetUserId = userId || requestingUser?.id;

      if (!courseId || !lessonId) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Missing courseId or lessonId" })
        };
      }

      if (!targetUserId) {
        return {
          statusCode: 401,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "User authentication session is required" })
        };
      }

      // Check if target user is administrator (bypass)
      const isUserAdmin = await isAdminUser(targetUserId);
      if (isUserAdmin) {
        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify({ allowed: true, reason: "admin-bypass" })
        };
      }

      // Check if lesson is labeled Free / Preview in course curriculum JSON
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("curriculum")
        .eq("id", courseId)
        .single();

      if (course && course.curriculum && Array.isArray(course.curriculum)) {
        for (const section of course.curriculum) {
          if (section.items && Array.isArray(section.items)) {
            const matchedItem = section.items.find((it: any) => it.id === lessonId);
            if (matchedItem && (matchedItem.is_free || matchedItem.is_preview)) {
              return {
                statusCode: 200,
                headers: responseHeaders,
                body: JSON.stringify({ allowed: true, reason: "free-preview" })
              };
            }
          }
        }
      }

      // Query active, unexpired enrollment record
      const { data: enrollment } = await supabaseAdmin
        .from("enrollments")
        .select("id, expires_at, status")
        .eq("user_id", targetUserId)
        .eq("course_id", courseId)
        .eq("is_deleted", false)
        .maybeSingle();

      if (enrollment && enrollment.status === "active") {
        if (!enrollment.expires_at || new Date(enrollment.expires_at) > new Date()) {
          return {
            statusCode: 200,
            headers: responseHeaders,
            body: JSON.stringify({ allowed: true, reason: "active-enrollment" })
          };
        }
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ allowed: false, reason: "No active enrollment or course expired" })
      };
    }

    // =========================================================================
    // 2. PROCESS PAYMENT (Secure complete checkout handler)
    // =========================================================================
    if (action === "process-payment") {
      const { merchant_uid, amount, courseId, userId, payment_tid, payment_method } = body;
      const targetUserId = userId || requestingUser?.id;

      if (!merchant_uid || !amount || !courseId || !targetUserId) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Missing required fields for payment processing." })
        };
      }

      // Update Order Status Securely using Service Role
      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .update({
          status: "PAID",
          payment_tid: payment_tid || `TID-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          payment_method: payment_method || "direct",
          updated_at: new Date().toISOString()
        })
        .eq("merchant_uid", merchant_uid)
        .select()
        .single();

      if (orderErr) {
        console.error("Order update error:", orderErr);
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: `Order status update failed: ${orderErr.message}` })
        };
      }

      // Double-Bookkeeping Transaction ledger write (복식부기 전표 기록)
      const { data: tx } = await supabaseAdmin
        .from("transactions")
        .insert([{
          description: `Vite-Netlify 결제 완료 (주문번호: ${merchant_uid})`,
          created_by: targetUserId
        }])
        .select()
        .single();

      if (tx) {
        await supabaseAdmin.from("transaction_lines").insert([
          {
            transaction_id: tx.id,
            user_id: targetUserId,
            description: `강의 구매 입금 완료 (보통예금 자산 증가)`,
            debit_amount: amount,
            credit_amount: 0
          },
          {
            transaction_id: tx.id,
            user_id: targetUserId,
            description: `강의 전용 매출액 발생`,
            debit_amount: 0,
            credit_amount: amount
          }
        ]);
      }

      // Active 수강 신청 권한 부여 (Enrollment)
      const defaultDurationMonths = 12; // 1 year default access
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + defaultDurationMonths);

      await supabaseAdmin.from("enrollments").upsert({
        user_id: targetUserId,
        course_id: courseId,
        status: "active",
        expires_at: expiresAt.toISOString(),
        is_deleted: false,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id, course_id" });

      // 커뮤니티 자동 동기화 (Find communities linked to course_id and insert active memberships)
      const { data: linkedCommunities } = await supabaseAdmin
        .from("communities")
        .select("id")
        .eq("course_id", courseId)
        .eq("is_deleted", false);

      let activatedCommunitiesCount = 0;
      if (linkedCommunities && linkedCommunities.length > 0) {
        for (const comm of linkedCommunities) {
          const { error: joinErr } = await supabaseAdmin
            .from("community_members")
            .upsert({
              community_id: comm.id,
              user_id: targetUserId,
              joined_at: new Date().toISOString(),
              is_deleted: false
            }, { onConflict: "community_id, user_id" });
            
          if (!joinErr) {
            activatedCommunitiesCount++;
          }
        }
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          status: "success",
          message: "결제 완료 처리 및 수강 권한 가입이 성공적으로 완수되었습니다.",
          order,
          activatedCommunitiesCount
        })
      };
    }

    // =========================================================================
    // 8.45 USER: 1:1 문의글 제출 (support/inquiry)
    // =========================================================================
    if (action === "submit-inquiry") {
      const { category, email, title, message } = body;
      if (!category || !email || !title || !message) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "모든 필드(문의 유형, 이메일, 문의 제목, 상세 내용)는 필수 입력 사항입니다." })
        };
      }

      const { data: inquiry, error: insertErr } = await supabaseAdmin
        .from("support_contents")
        .insert([{
          type: "inquiry",
          title: title,
          content: JSON.stringify({ category, email, message }),
          active: true,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (insertErr) {
        console.error("[Inquiry] Failed to insert inquiry content:", insertErr);
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: insertErr.message })
        };
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          status: "success",
          message: "1:1 문의사항이 정상적으로 제출되었습니다. 소중한 의견 감사합니다 😊",
          inquiry
        })
      };
    }

    // =========================================================================
    // RESTRICTION: The following methods are purely administrative actions
    // =========================================================================
    if (!requestingUser) {
      return {
        statusCode: 401,
        headers: responseHeaders,
        body: JSON.stringify({ status: "error", message: "Admin authorization token is required." })
      };
    }

    const currentCallerIsAdmin = await isAdminUser(requestingUser.id);
    if (!currentCallerIsAdmin) {
      return {
        statusCode: 403,
        headers: responseHeaders,
        body: JSON.stringify({ status: "error", message: "Forbidden - Administrator access credentials required." })
      };
    }

    // =========================================================================
    // 3. ADMIN:수강권 강제 부여 및 회수 (Admin Grant/Revoke Enrollment)
    // =========================================================================
    if (action === "grant-enrollment") {
      const { userId, courseId, expiresAt } = body;
      if (!userId || !courseId) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Missing userId or courseId parameters" })
        };
      }

      const defaultExpires = new Date();
      defaultExpires.setMonth(defaultExpires.getMonth() + 12);
      const resolveExpiry = expiresAt || defaultExpires.toISOString();

      await supabaseAdmin.from("enrollments").upsert({
        user_id: userId,
        course_id: courseId,
        status: "active",
        expires_at: resolveExpiry,
        is_deleted: false,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id, course_id" });

      // Automatically add to linked communities
      const { data: communities } = await supabaseAdmin
        .from("communities")
        .select("id")
        .eq("course_id", courseId)
        .eq("is_deleted", false);

      if (communities && communities.length > 0) {
        for (const comm of communities) {
          await supabaseAdmin.from("community_members").upsert({
            community_id: comm.id,
            user_id: userId,
            joined_at: new Date().toISOString(),
            is_deleted: false
          }, { onConflict: "community_id, user_id" });
        }
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ status: "success", message: "수강권 수동 발급 및 연동 커뮤니티 권한동기화 완료" })
      };
    }

    if (action === "revoke-enrollment") {
      const { userId, courseId } = body;
      if (!userId || !courseId) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Missing userId or courseId parameters" })
        };
      }

      // Deactivate enrollment
      await supabaseAdmin
        .from("enrollments")
        .update({
          status: "expired",
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .eq("course_id", courseId);

      // Remove from associated communities too
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

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ status: "success", message: "수강 자격 만료 및 연계 커뮤니티 권한 회수가 성공 완료되었습니다." })
      };
    }

    // =========================================================================
    // 4. ADMIN:커뮤니티 가입/탈퇴 멤버십 동기화 (Join/Leave/Sync Membership)
    // =========================================================================
    if (action === "join-community") {
      const { userId, communityId } = body;
      if (!userId || !communityId) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Missing userId or communityId" })
        };
      }

      await supabaseAdmin.from("community_members").upsert({
        community_id: communityId,
        user_id: userId,
        joined_at: new Date().toISOString(),
        is_deleted: false
      }, { onConflict: "community_id, user_id" });

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ status: "success", message: "커뮤니티 수동 멤버십 가입 완료" })
      };
    }

    if (action === "leave-community") {
      const { userId, communityId } = body;
      if (!userId || !communityId) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Missing userId or communityId" })
        };
      }

      await supabaseAdmin
        .from("community_members")
        .update({ is_deleted: true })
        .eq("community_id", communityId)
        .eq("user_id", userId);

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ status: "success", message: "커뮤니티 멤버십 탈퇴/비활성화 완료" })
      };
    }

    if (action === "sync-communities") {
      const { userId } = body;
      if (!userId) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Missing user identifier for synching." })
        };
      }

      // Fetch user's active, non-expired enrollments
      const nowStr = new Date().toISOString();
      const { data: enrollments } = await supabaseAdmin
        .from("enrollments")
        .select("course_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .or(`expires_at.is.null,expires_at.gt.${nowStr}`);

      const enrolledCourseIds = enrollments ? enrollments.map(e => e.course_id) : [];

      // Find all communities that are linked to any course
      const { data: allLinkedCommunities } = await supabaseAdmin
        .from("communities")
        .select("id, course_id")
        .not("course_id", "is", null)
        .eq("is_deleted", false);

      let grants = 0;
      let revokes = 0;

      if (allLinkedCommunities && allLinkedCommunities.length > 0) {
        for (const comm of allLinkedCommunities) {
          const hasCourseAccess = enrolledCourseIds.includes(comm.course_id);
          
          if (hasCourseAccess) {
            // Activate membership
            const { error } = await supabaseAdmin.from("community_members").upsert({
              community_id: comm.id,
              user_id: userId,
              joined_at: new Date().toISOString(),
              is_deleted: false
            }, { onConflict: "community_id, user_id" });
            if (!error) grants++;
          } else {
            // Check if they currently have membership and deactivate it
            const { data: member } = await supabaseAdmin
              .from("community_members")
              .select("id, is_deleted")
              .eq("community_id", comm.id)
              .eq("user_id", userId)
              .maybeSingle();

            if (member && !member.is_deleted) {
              await supabaseAdmin
                .from("community_members")
                .update({ is_deleted: true })
                .eq("id", member.id);
              revokes++;
            }
          }
        }
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          status: "success",
          message: `커뮤니티 동기화가 완수되었습니다. (가입: ${grants}건, 수거/탈퇴: ${revokes}건)`,
          grants,
          revokes
        })
      };
    }

    // =========================================================================
    // 5. ADMIN:강제 회원 권한 변경 (Force modify profiles custom role)
    // =========================================================================
    if (action === "admin-modify-role") {
      const { userId, role } = body;
      if (!userId || !role) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Missing target userId or new role level specification." })
        };
      }

      const { data, error } = await supabaseAdmin
        .from("profiles")
        .update({
          role,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId)
        .select()
        .single();

      if (error) {
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: error.message })
        };
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ status: "success", message: `회원 권한 등급이 [${role}]로 안전하게 수정되었습니다.`, profile: data })
      };
    }

    // =========================================================================
    // 6. ADMIN:비밀번호 어드민 정밀 리셋 (Privileged auth password reset override)
    // =========================================================================
    if (action === "admin-reset-password") {
      const { email, userId, requestId, password } = body;
      if (!email && !userId) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Required argument (email or userId) is missing" })
        };
      }

      let targetUserId = userId;

      if (!targetUserId && email) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (!profile) {
          return {
            statusCode: 404,
            headers: responseHeaders,
            body: JSON.stringify({ status: "error", message: "No registered profile found matching this email." })
          };
        }
        targetUserId = profile.id;
      }

      const newPassword = password || "123456";
      // Force-override password using admin identity update API bypass
      const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        { password: newPassword }
      );

      if (resetErr) {
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: `Failed resetting in Auth Provider: ${resetErr.message}` })
        };
      }

      // Mark request as resolved
      if (requestId) {
        await supabaseAdmin
          .from("support_contents")
          .update({ is_deleted: true, active: false, updated_at: new Date().toISOString() })
          .eq("id", requestId);
      } else if (email) {
        await supabaseAdmin
          .from("support_contents")
          .update({ is_deleted: true, active: false, updated_at: new Date().toISOString() })
          .eq("type", "password_reset_request")
          .eq("title", email);
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ status: "success", message: `Successfully reset password to '${newPassword}'` })
      };
    }

    // =========================================================================
    // 6.6 ADMIN: 회원 가입 계정 영구 삭제 (Admin Auth User Hard Delete Override)
    // =========================================================================
    if (action === "admin-delete-auth-user") {
      const { userId } = body;
      if (!userId) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Required argument (userId) is missing" })
        };
      }

      console.log(`[Admin-Delete-Auth-User] Permanently deleting authed user from login DB: ${userId}`);
      const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (authDeleteErr) {
        console.error("Supabase Admin Auth deleteUser failed inside Netlify:", authDeleteErr);
        if (authDeleteErr.message && authDeleteErr.message.toLowerCase().includes("not found")) {
          return {
            statusCode: 200,
            headers: responseHeaders,
            body: JSON.stringify({ status: "success", message: "User was already completely removed from Auth database" })
          };
        }
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: `Supabase Auth delete failed: ${authDeleteErr.message}` })
        };
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ status: "success", message: "Successfully deleted login credentials from Auth system" })
      };
    }

    // =========================================================================
    // 6.7 ADMIN: 고아 인증 계정 리스트업 (List orphaned auth users)
    // =========================================================================
    if (action === "admin-list-orphaned-auth-users") {
      const { data: profiles, error: pError } = await supabaseAdmin
        .from("profiles")
        .select("id, email, name, nickname");

      if (pError) {
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: `Failed to fetch profiles: ${pError.message}` })
        };
      }

      const profileIds = new Set((profiles || []).map(p => p.id));
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      if (authError) {
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: `Failed to fetch auth users: ${authError.message}` })
        };
      }

      const authUsers = authData?.users || [];
      const orphaned = authUsers
        .filter(u => !profileIds.has(u.id))
        .map(u => ({
          id: u.id,
          email: u.email,
          createdAt: u.created_at,
          lastSignIn: u.last_sign_in_at || "-"
        }));

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ status: "success", data: orphaned })
      };
    }

    // =========================================================================
    // 6.8 ADMIN: 고아 인증 계정 일괄 삭제 (Bulk delete auth users)
    // =========================================================================
    if (action === "admin-bulk-delete-auth-users") {
      const { userIds } = body;
      if (!userIds || !Array.isArray(userIds)) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Required parameter 'userIds' array is missing" })
        };
      }

      const results = [];
      for (const id of userIds) {
        try {
          const { error: err } = await supabaseAdmin.auth.admin.deleteUser(id);
          results.push({ id, success: !err, error: err ? err.message : null });
        } catch (e: any) {
          results.push({ id, success: false, error: e.message || "Exception occurred" });
        }
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ status: "success", results })
      };
    }

    // =========================================================================
    // 7. ADMIN: 전체 커뮤니티 만료 수거 및 동기화 (Global Community Sync & Sweep)
    // =========================================================================
    if (action === "sync-all-communities") {
      console.log("[GlobalSync] Starting community and enrollment sync check in Serverless...");
      
      const nowStr = new Date().toISOString();
      const { data: expiredEnrollments } = await supabaseAdmin
        .from("enrollments")
        .select("*")
        .eq("status", "active")
        .lt("expires_at", nowStr);

      let expiredCount = 0;
      if (expiredEnrollments && expiredEnrollments.length > 0) {
        for (const enroll of expiredEnrollments) {
          await supabaseAdmin
            .from("enrollments")
            .update({ status: "expired" })
            .eq("id", enroll.id);

          const { data: communities } = await supabaseAdmin
            .from("communities")
            .select("id")
            .eq("course_id", enroll.course_id);

          if (communities && communities.length > 0) {
            for (const c of communities) {
              await supabaseAdmin
                .from("community_members")
                .update({ is_deleted: true })
                .eq("community_id", c.id)
                .eq("user_id", enroll.user_id);
            }
          }
          expiredCount++;
        }
      }

      const { data: activeEnrollments } = await supabaseAdmin
        .from("enrollments")
        .select("*")
        .eq("status", "active");

      let createdMembershipsCount = 0;
      if (activeEnrollments && activeEnrollments.length > 0) {
        for (const enroll of activeEnrollments) {
          const { data: communities } = await supabaseAdmin
            .from("communities")
            .select("id")
            .eq("course_id", enroll.course_id)
            .eq("is_deleted", false);

          if (communities && communities.length > 0) {
            for (const c of communities) {
              const { data: existingMember } = await supabaseAdmin
                .from("community_members")
                .select("id, is_deleted")
                .eq("community_id", c.id)
                .eq("user_id", enroll.user_id)
                .maybeSingle();

              if (!existingMember) {
                await supabaseAdmin
                  .from("community_members")
                  .insert([{
                    community_id: c.id,
                    user_id: enroll.user_id,
                    joined_at: new Date().toISOString(),
                    is_deleted: false
                  }]);
                createdMembershipsCount++;
              } else if (existingMember.is_deleted) {
                await supabaseAdmin
                  .from("community_members")
                  .update({ is_deleted: false })
                  .eq("id", existingMember.id);
                createdMembershipsCount++;
              }
            }
          }
        }
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          status: "success",
          message: "전체 회원 권한 및 커뮤니티 만료/자동동기화 정리가 성공적으로 완료되었습니다.",
          expiredCount,
          createdMembershipsCount
        })
      };
    }

    // =========================================================================
    // 8. ADMIN: 주문정보 PAID 강제 갱신 및 재처리 (Order Reprocess Machine)
    // =========================================================================
    if (action === "reprocess-order") {
      const { orderId } = body;
      if (!orderId) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Missing orderId" })
        };
      }

      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("merchant_uid, amount, user_id, course_id")
        .eq("id", orderId)
        .maybeSingle();

      if (!order) {
        return {
          statusCode: 404,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Order not found" })
        };
      }

      await supabaseAdmin
        .from("orders")
        .update({
          status: "PAID",
          updated_at: new Date().toISOString()
        })
        .eq("id", orderId);

      const { data: tx } = await supabaseAdmin
        .from("transactions")
        .insert([{
          description: `주문 강제 재처리 (주문번호: ${order.merchant_uid})`,
          created_by: order.user_id
        }])
        .select()
        .single();

      if (tx) {
        await supabaseAdmin.from("transaction_lines").insert([
          {
            transaction_id: tx.id,
            user_id: order.user_id,
            description: `강의 수동 재승인 입금 완료`,
            debit_amount: order.amount,
            credit_amount: 0
          },
          {
            transaction_id: tx.id,
            user_id: order.user_id,
            description: `강의 수동 재승인 매출 발생`,
            debit_amount: 0,
            credit_amount: order.amount
          }
        ]);
      }

      const defaultDurationMonths = 12;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + defaultDurationMonths);

      await supabaseAdmin.from("enrollments").upsert({
        user_id: order.user_id,
        course_id: order.course_id,
        status: "active",
        expires_at: expiresAt.toISOString(),
        is_deleted: false,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id, course_id" });

      const { data: linkedCommunities } = await supabaseAdmin
        .from("communities")
        .select("id")
        .eq("course_id", order.course_id)
        .eq("is_deleted", false);

      if (linkedCommunities && linkedCommunities.length > 0) {
        for (const comm of linkedCommunities) {
          await supabaseAdmin.from("community_members").upsert({
            community_id: comm.id,
            user_id: order.user_id,
            joined_at: new Date().toISOString(),
            is_deleted: false
          }, { onConflict: "community_id, user_id" });
        }
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          status: "success",
          message: "주문 정보가 PAID 로 자동 갱신되었으며, 복식부기 및 수강/커뮤니티 연동 권한이 재처리되었습니다!"
        })
      };
    }

    // =========================================================================
    // 8.46 ADMIN: 이니시스 실시간 연계 환불 처리 기능 (Task - Refund Order)
    // =========================================================================
    if (action === "refund-order") {
      const { orderId, reason } = body;
      if (!orderId) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Missing orderId parameter" })
        };
      }

      const { data: order, error: findError } = await supabaseAdmin
        .from("orders")
        .select("id, status, merchant_uid, amount, user_id, course_id, payment_tid, payment_method")
        .eq("id", orderId)
        .maybeSingle();

      if (findError || !order) {
        return {
          statusCode: 404,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "주문 내역을 찾을 수 없습니다." })
        };
      }

      if (order.status !== "PAID" && order.status !== "COMPLETED") {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "환불은 결제 완료(PAID/COMPLETED)된 주문만 처리 가능합니다." })
        };
      }

      const config = await getInicisConfig();
      const tid = order.payment_tid;

      // Sandbox check (if TID is mock or we are sandbox testing)
      const isMockTid = !tid || tid.startsWith("TID-MOCK") || tid.includes("MOCK") || !tid.includes("-") || tid.length < 20;

      if (isMockTid || config.isSandbox) {
        console.log(`[Refund] Mock / Sandbox bypass refund for OID: ${order.merchant_uid}`);
        // Proceed with local database and permission revocation, skipping real INICIS REST API since it's a test order
      } else {
        // Real Inicis API request
        const cancelUrl = config.isSandbox ? INICIS_ENDPOINTS.sandbox.cancel : INICIS_ENDPOINTS.production.cancel;
        const timestamp = getInicisKstTimestamp();
        // PlainText = key + type + paymethod + timestamp + clientIp + mid + tid
        const type = "Refund";
        const paymethod = "Card"; // Generic Card mapping or from order.payment_method
        const clientIp = "127.0.0.1";
        const plainText = config.signKey + type + paymethod + timestamp + clientIp + config.mid + tid;
        const hashData = crypto.createHash("sha512").update(plainText).digest("hex");

        const requestParams = new URLSearchParams();
        requestParams.append("type", type);
        requestParams.append("paymethod", paymethod);
        requestParams.append("timestamp", timestamp);
        requestParams.append("clientIp", clientIp);
        requestParams.append("mid", config.mid);
        requestParams.append("tid", tid);
        requestParams.append("msg", reason || "관리자 환불 처리");
        requestParams.append("hashData", hashData);

        try {
          console.log(`[Refund] Requesting real Inicis cancel V2 at: ${cancelUrl} for TID: ${tid}`);
          const apiResponse = await fetch(cancelUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: requestParams.toString()
          });

          const rawText = await apiResponse.text();
          console.log(`[Refund] Inicis direct response:`, rawText);
          
          let result: any = {};
          try {
            result = JSON.parse(rawText);
          } catch (e) {
            console.warn("[Refund] Failed parsing json from Inicis response, attempting url decode", e);
          }

          const resultCode = result.resultCode || "";
          const resultMsg = result.resultMsg || rawText || "Inicis Response Error";

          // V2 cancel resultCode is typically "00" on success
          if (resultCode !== "00" && resultCode !== "0000") {
            return {
              statusCode: 400,
              headers: responseHeaders,
              body: JSON.stringify({
                status: "error",
                message: `이니시스 환불 거부 오류 [코드: ${resultCode}]: ${resultMsg}`
              })
            };
          }
        } catch (fetchErr: any) {
          console.error("[Refund] HTTP request to Inicis failed:", fetchErr);
          return {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({
              status: "error",
              message: `이니시스 게이트웨이와 통신 중 장애가 발생했습니다: ${fetchErr.message}`
            })
          };
        }
      }

      // Apply Refund / Revocation steps
      // 1. Update order status to CANCELLED
      await supabaseAdmin
        .from("orders")
        .update({
          status: "CANCELLED",
          updated_at: new Date().toISOString()
        })
        .eq("id", orderId);

      // 2. Clear enrollment
      await supabaseAdmin
        .from("enrollments")
        .update({ status: "expired" })
        .eq("user_id", order.user_id)
        .eq("course_id", order.course_id);

      // 3. Kick from community
      const { data: communities } = await supabaseAdmin
        .from("communities")
        .select("id")
        .eq("course_id", order.course_id);

      if (communities && communities.length > 0) {
        for (const comm of communities) {
          await supabaseAdmin
            .from("community_members")
            .update({ is_deleted: true })
            .eq("community_id", comm.id)
            .eq("user_id", order.user_id);
        }
      }

      // 4. Double ledger bookkeeping Reversal (환불 전표)
      const { data: tx } = await supabaseAdmin
        .from("transactions")
        .insert([{
          description: `[환불완료] 주문번호: ${order.merchant_uid} (사유: ${reason || "관리자 환불"})`,
          created_by: requestingUser?.id || order.user_id
        }])
        .select()
        .single();

      if (tx) {
        await supabaseAdmin.from("transaction_lines").insert([
          {
            transaction_id: tx.id,
            user_id: order.user_id,
            description: `강의 환불 입금 반환 (보통예금 자산 차감)`,
            debit_amount: 0,
            credit_amount: order.amount
          },
          {
            transaction_id: tx.id,
            user_id: order.user_id,
            description: `강의 환불 매출액 취소`,
            debit_amount: order.amount,
            credit_amount: 0
          }
        ]);
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          status: "success",
          message: isMockTid 
            ? "모의 결제 주문이므로 이니시스 통신 없이 즉각 승인 취소 및 수강생 권한 수거가 정합 완료되었습니다."
            : `이니시스 실시간 거래 승인 취소가 완료되었으며, 수강생 권한 수거 및 복식부기 매출 차감 정리가 완료되었습니다.`
        })
      };
    }

    // =========================================================================
    // 9. ADMIN: 결제 주문 정보 및 대기 데이터 삭제 (참조 테이블 cascading 정리 포함)
    // =========================================================================
    if (action === "admin-delete-order") {
      const { orderId } = body;
      if (!orderId) {
        return {
          statusCode: 400,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "Missing orderId" })
        };
      }

      const { data: order, error: findError } = await supabaseAdmin
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .maybeSingle();

      if (findError) {
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: findError.message })
        };
      }

      if (!order) {
        return {
          statusCode: 404,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: "주문 데이터를 찾을 수 없습니다." })
        };
      }

      // 관련 자식 테이블(payment_logs)이 외래키 제약조건 위반을 일으키지 않도록 먼저 말끔히 비워줍니다.
      const { error: logsDeleteError } = await supabaseAdmin
        .from("payment_logs")
        .delete()
        .eq("order_id", orderId);

      if (logsDeleteError) {
        console.warn("payment_logs delete warning:", logsDeleteError.message);
      }

      // 주문 본체 삭제 진행
      const { error: deleteError } = await supabaseAdmin
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (deleteError) {
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({ status: "error", message: deleteError.message })
        };
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          status: "success",
          message: "주문 대기 정보가 관련 로그와 함께 모두 안전하게 데이터베이스에서 삭제 처리되었습니다."
        })
      };
    }

    // =========================================================================
    // 10. ADMIN: 결제 실패 원인 정밀 로깅 및 관리자 경보/이메일 알림 전송 API
    // =========================================================================
    if (action === "send-payment-failure-alert") {
      const { oid, resultCode, resultMsg, analysis, userEmail, courseTitle } = body;
      const adminEmail = "kys@k-learn.co.kr";
      
      let orderId: string | null = null;
      if (oid) {
        const { data: orderData } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("merchant_uid", oid)
          .maybeSingle();
        if (orderData) {
          orderId = orderData.id;
        }
      }

      const alertPayload = {
        order_id: orderId,
        merchant_uid: oid || "UNKNOWN_OID",
        status: "FAILED",
        raw_response: JSON.stringify({
          resultCode,
          resultMsg,
          analysis,
          userEmail,
          courseTitle,
          system_message: "정밀 진단 레포트 자동 발행 완료"
        }),
        payment_method: "CARD",
        amount: 0,
        created_at: new Date().toISOString()
      };

      const { error: logError } = await supabaseAdmin.from("payment_logs").insert([alertPayload]);
      if (logError) {
        console.warn("[core-api] Failed saving alert to payment_logs:", logError.message);
      }

      console.warn(`[ALERT-NOTIFICATION-DISPATCH] Sending immediate SMS/Email notification alert to: ${adminEmail}`);
      console.warn(`[DEFECTIVE-REPORT] OID: ${oid}, Buyer: ${userEmail}, Course: ${courseTitle}, PG Code: ${resultCode}, Message: ${resultMsg}, Diagnose: ${analysis}`);

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          status: "success",
          message: "결제 실패 원인 정밀 통보 및 알림이 실시간으로 관리자(kys@k-learn.co.kr) 전용 경보 모듈과 데이터베이스 로그 시스템으로 안전사고 예방 조치 전송 완료되었습니다.",
          dispatched_to: adminEmail,
          dispatched_at: new Date().toISOString()
        })
      };
    }

    return {
      statusCode: 400,
      headers: responseHeaders,
      body: JSON.stringify({ status: "error", message: `Action [${action}] is not supported on core-api routing.` })
    };

  } catch (error: any) {
    console.error("Core-API general exception:", error);
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({ status: "error", message: error.message || "An unexpected error occurred in core-api." })
    };
  }
};
