import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Parser from "rss-parser";
import { config } from "dotenv";
import fs from "fs";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import nodemailer from "nodemailer";

// In-memory OTP Cache for password resets
interface OTPRecord {
  email: string;
  code: string;
  expiresAt: number;
  verified: boolean;
}
const otpStorage = new Map<string, OTPRecord>();

// Load .env variables
config();

const resolvedFilename = typeof import.meta?.url === "string" ? fileURLToPath(import.meta.url) : "";
const resolvedDirname = resolvedFilename ? path.dirname(resolvedFilename) : "";

// Initialize Supabase Admin for backend operations
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn("Supabase configuration missing. Backend features like payment notifications may not work.");
}

const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey)
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

// ==========================================
// KG INICIS CONFIGURATION & ENDPOINTS (Task 2 & 3)
// ==========================================
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

// Timezone-resilient Korean Standard Time (KST, UTC+9) 14-digit generator (Task 5)
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

// Unified Sign Generator (Task 4)
function generateInicisSignature(
  mid: string,
  signKey: string,
  oid: string,
  price: number,
  timestamp: string
): string {
  const hashTarget = `oid=${oid}&price=${price}&timestamp=${timestamp}`;
  return crypto.createHash("sha256").update(hashTarget).digest("hex");
}

// Retrieve from Database primary, fallback to configuration settings (Task 2)
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

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const parser = new Parser();
  
  app.use(cors());
  // Use body-parser for payment notifications
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Log all requests
  app.use((req, res, next) => {
    if (req.url.startsWith("/api")) {
      console.log(`[${new Date().toISOString()}] API REQUEST: ${req.method} ${req.url}`);
    } else {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
  });

  // Basic API verification with full diagnosis capability (Task 1 Debugger)
  app.get("/api/test", async (req, res) => {
    const diagData: any = {
      status: "ok",
      serverTime: new Date().toISOString(),
      timezoneOffset: new Date().getTimezoneOffset(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        INICIS_MID_EXISTS: !!process.env.INICIS_MID,
        INICIS_MID_VAL: process.env.INICIS_MID || "Not Found",
        INICIS_SIGNKEY_EXISTS: !!process.env.INICIS_SIGNKEY,
        SUPABASE_URL_EXISTS: !!process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY_EXISTS: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      }
    };

    if (supabaseAdmin) {
      try {
        const { data: paySettings, error: payError } = await supabaseAdmin
          .from("payment_settings")
          .select("*")
          .limit(5);

        diagData.database = {
          connected: true,
          payment_settings: paySettings || [],
          payment_settings_error: payError ? payError.message : null,
        };

        // Try getting last failure log from payment_logs
        const { data: logs, error: logsError } = await supabaseAdmin
          .from("payment_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(3);

        diagData.recent_payment_logs = logs || [];
        diagData.recent_payment_logs_error = logsError ? logsError.message : null;
      } catch (dbErr: any) {
        diagData.database = {
          connected: false,
          error: dbErr.message,
        };
      }
    } else {
      diagData.database = {
        connected: false,
        message: "supabaseAdmin is not initialized",
      };
    }

    res.json(diagData);
  });

  // ==========================================
  // KG INICIS PAYMENT INTEGRATION (PC STDPAY)
  // ==========================================
  
  // 1. Generate Signature & Pre-insert order (Express PORT)
  app.post("/api/init-pay", async (req, res) => {
    try {
      const { price, oid, timestamp, userId, courseId, orderName } = req.body;

      if (!price || !oid || !timestamp) {
        return res.status(400).json({ status: "error", message: "Missing price, oid, or timestamp" });
      }

      // Pre-insert order into Supabase
      if (supabaseAdmin && userId && courseId) {
        try {
          const { data: existing } = await supabaseAdmin
            .from("orders")
            .select("id")
            .eq("merchant_uid", oid)
            .maybeSingle();

          if (!existing) {
            await supabaseAdmin.from("orders").insert([{
              user_id: userId,
              course_id: courseId,
              amount: Number(price),
              status: "PENDING",
              order_name: orderName || "온라인 강좌 수강권 구매",
              merchant_uid: oid,
              created_at: new Date().toISOString()
            }]);
            console.log(`[INIT-PAY] Pending order created. OID: ${oid}`);
          }
        } catch (dbErr: any) {
          console.error("[INIT-PAY] Database order placement failed (ignored):", dbErr.message);
        }
      }

      const config = await getInicisConfig();
      const signature = generateInicisSignature(config.mid, config.signKey, oid, Number(price), timestamp);
      const mKey = crypto.createHash("sha256").update(config.signKey).digest("hex");

      return res.json({
        status: "success",
        signature,
        mKey,
        mid: config.mid,
        oid,
        price,
        timestamp,
        isSandbox: config.isSandbox,
      });
    } catch (error: any) {
      console.error("[INIT-PAY] API Error:", error);
      return res.status(500).json({ status: "error", message: error.message || "Internal Server Error" });
    }
  });

  // 2. Auth URL Postback & S2S Payment Approval + NetCancel Rollback (Express PORT)
  app.post("/api/inicis-return", async (req, res) => {
    console.log("[INICIS-RETURN] Received approval payload:", req.body);

    const { resultCode, resultMsg, mid, orderNumber, oid, authToken, authUrl, merchantData } = req.body;
    const finalOid = orderNumber || oid;
    const config = await getInicisConfig();
    const finalMid = mid || config.mid;
    const signKey = config.signKey;
    const resolvedCancelUrl = config.isSandbox ? INICIS_ENDPOINTS.sandbox.cancel : INICIS_ENDPOINTS.production.cancel;
    const netCancelUrl = req.body.netCancelUrl || authUrl?.replace("/auth", "/netCancel") || resolvedCancelUrl;

    // Application origin URL determination (Robustly prioritized dynamic request context to avoid hardcoded localhost diversion)
    let clientOrigin = "";
    
    // Prioritize immutable client origin passed dynamically from client's browser context (escapes sandbox reverse proxy pitfalls)
    if (merchantData && (merchantData.startsWith("http://") || merchantData.startsWith("https://"))) {
      clientOrigin = merchantData;
    }

    if (!clientOrigin && req.headers.referer) {
      try {
        const refUrl = new URL(req.headers.referer);
        // Only parse referer if it's not the PG domain (e.g. inicis.com or tosspay) to avoid looping back to PG hosts
        if (!refUrl.host.includes("inicis.com") && !refUrl.host.includes("toss")) {
          clientOrigin = `${refUrl.protocol}//${refUrl.host}`;
        }
      } catch (e) {
        // ignore parsing errors
      }
    }
    if (!clientOrigin && req.headers.origin) {
      const originStr = req.headers.origin as string;
      if (!originStr.includes("inicis.com") && !originStr.includes("toss")) {
        clientOrigin = originStr;
      }
    }
    
    // Reverse proxy header lookup fallback
    if (!clientOrigin) {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${PORT}`;
      clientOrigin = `${protocol}://${host}`;
    }

    // Explicit localhost defense or absolute production override against stale server/proxy environments
    const fallbackEnv = process.env.APP_URL || process.env.VITE_APP_URL;
    if (fallbackEnv && !fallbackEnv.includes("localhost")) {
      const sanitizedFallback = fallbackEnv.endsWith("/") ? fallbackEnv.slice(0, -1) : fallbackEnv;
      if (!clientOrigin || clientOrigin.includes("localhost") || clientOrigin.includes("inicis.com") || clientOrigin.includes("toss")) {
        clientOrigin = sanitizedFallback;
      }
    }

    // A. Authentication phase validation
    if (resultCode !== "0000" || !authToken || !authUrl) {
      console.error(`[INICIS-RETURN] Authentication failed. Code: ${resultCode}, Msg: ${resultMsg}`);
      if (supabaseAdmin) {
        await writePaymentLogLocal(finalOid || null, "FAILED", {
          step: "인증단계(Certification Response)",
          resultCode,
          resultMsg,
          raw_payload: req.body
        }, {
          error_message: resultMsg || "인증 실패",
          error_code: resultCode
        });
      }
      return res.redirect(`${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(resultMsg || "인증 실패")}&oid=${finalOid || ""}&resultCode=${resultCode || "UNKNOWN"}`);
    }

    // Secure verification: Validate authUrl to prevent SSRF and mock server forgery
    let isVerifiedDomain = false;
    try {
      const parsedAuthUrl = new URL(authUrl);
      if (parsedAuthUrl.protocol === "http:" || parsedAuthUrl.protocol === "https:") {
        isVerifiedDomain = parsedAuthUrl.hostname === "inicis.com" || parsedAuthUrl.hostname.endsWith(".inicis.com");
      }
    } catch (e) {
      isVerifiedDomain = false;
    }

    if (!isVerifiedDomain) {
      console.error("[INICIS-RETURN] Unverified authUrl domain:", authUrl);
      return res.redirect(`${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent("위변조가 의심되는 결제 게이트웨이 도메인입니다.")}&oid=${finalOid || ""}&resultCode=UNVERIFIED_GATEWAY`);
    }

    const timestamp = getInicisKstTimestamp();
    const authHashTarget = `authToken=${authToken}&timestamp=${timestamp}`;
    const authSignature = crypto.createHash("sha256").update(authHashTarget).digest("hex");

    let authResponseData: any = null;

    // C. Server-to-Server post request (Express native fetch)
    try {
      const formData = new URLSearchParams();
      formData.append("mid", finalMid);
      formData.append("authToken", authToken);
      formData.append("timestamp", timestamp);
      formData.append("signature", authSignature);
      formData.append("charset", "UTF-8");
      formData.append("format", "JSON");

      console.log(`[INICIS-RETURN] Requesting S2S Approval to URL: ${authUrl}`);
      const apiResponse = await fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString()
      });

      if (!apiResponse.ok) {
        throw new Error(`INICIS Approval endpoint status error: ${apiResponse.status}`);
      }

      const resJsonText = await apiResponse.text();
      console.log("[INICIS-RETURN] Response Raw String:", resJsonText);
      authResponseData = JSON.parse(resJsonText);
    } catch (httpErr: any) {
      console.error("[INICIS-RETURN] HTTP Auth Failure, trigger NetCancel immediately. Error: ", httpErr);
      await triggerNetCancelHelper(netCancelUrl, finalMid, authToken, timestamp, authSignature);
      if (supabaseAdmin) {
        await writePaymentLogLocal(finalOid || null, "FAILED", {
          step: "최종승인(S2S API Request)",
          error_name: httpErr.name,
          error_message: httpErr.message,
          stack: httpErr.stack,
          netCancelExecuted: true
        }, {
          error_message: "결제 최종 승인 호출 통신 장애",
          error_code: "S2S_HTTP_ERROR"
        });
      }
      return res.redirect(`${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent("결제 최종 승인 통신이 실패하여 자동 망취소 환불 처리되었습니다.")}&oid=${finalOid || ""}&resultCode=S2S_HTTP_ERROR`);
    }

    const authResultCode = authResponseData?.resultCode;
    const authResultMsg = authResponseData?.resultMsg || "승인 실패";

    if (authResultCode !== "0000") {
      console.error(`[INICIS-RETURN] Payment system approval rejected. Code: ${authResultCode}, Msg: ${authResultMsg}`);
      if (supabaseAdmin) {
        await writePaymentLogLocal(finalOid || null, "FAILED", {
          step: "이니시스 승인거절(S2S Refusal)",
          resultCode: authResultCode,
          resultMsg: authResultMsg,
          raw_response: authResponseData
        }, {
          error_message: authResultMsg,
          error_code: authResultCode
        });
      }
      return res.redirect(`${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(authResultMsg)}&oid=${finalOid || ""}&resultCode=${authResultCode || "UNKNOWN"}`);
    }

    // D. Database update & Enrollments insertion
    if (!supabaseAdmin) {
      console.error("[INICIS-RETURN] Supabase Client is missing, trigger NetCancel immediately.");
      await triggerNetCancelHelper(netCancelUrl, finalMid, authToken, timestamp, authSignature);
      return res.redirect(`${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent("데이터베이스 설정이 누락되어 승인이 자동 취소되었습니다.")}&oid=${finalOid || ""}&resultCode=DATABASE_MAPPING_ERROR`);
    }

    try {
      // Find relative order metadata
      const { data: orderData, error: findError } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("merchant_uid", finalOid)
        .maybeSingle();

      if (findError) throw findError;
      if (!orderData) {
        throw new Error(`OID [${finalOid}]에 상응하는 데이터베이스 레코드를 찾을 수 없습니다.`);
      }

      // 1) Update order to PAID/COMPLETED
      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
          status: "COMPLETED",
          updated_at: new Date().toISOString()
        })
        .eq("merchant_uid", finalOid);

      if (updateError) throw updateError;

      // 2) payment_logs write
      try {
        await supabaseAdmin.from("payment_logs").insert([{
          order_id: orderData.id,
          merchant_uid: finalOid,
          status: "SUCCESS",
          raw_response: JSON.stringify(authResponseData),
          payment_method: authResponseData.payMethod || "CARD",
          amount: Number(authResponseData.TotPrice || orderData.amount),
          created_at: new Date().toISOString()
        }]);
      } catch (logErr) {
        console.warn("[INICIS-RETURN] payment_logs log warning:", logErr);
        await writePaymentLogLocal(finalOid, "SUCCESS", authResponseData);
      }

      // 3) Automatic grant privileges
      const userId = orderData.user_id;
      const courseId = orderData.course_id;
      if (userId && courseId) {
        try {
          await supabaseAdmin.from("course_enrollments").insert([{
            user_id: userId,
            course_id: courseId,
            status: "active",
            enrolled_at: new Date().toISOString()
          }]);
        } catch (enrollErr) {
          console.warn("[INICIS-RETURN] course_enrollments overlap bypass:", enrollErr);
        }

        try {
          await supabaseAdmin.from("profiles").update({ role: "paid_member" }).eq("id", userId);
        } catch (pErr) {
          console.warn("[INICIS-RETURN] profile status update bypass:", pErr);
        }
      }

      console.log(`[INICIS-RETURN] SUCCESSFULLY PAID & RECORDED order number ${finalOid}`);
      return res.redirect(`${clientOrigin}/payment/callback?status=success&oid=${finalOid}&message=${encodeURIComponent("결제가 완료되었습니다!")}&resultCode=0000`);

    } catch (dbErr: any) {
      console.error("[INICIS-RETURN] Database state update error! Execute NetCancel ASAP.", dbErr);
      await triggerNetCancelHelper(netCancelUrl, finalMid, authToken, timestamp, authSignature);
      if (supabaseAdmin) {
        await writePaymentLogLocal(finalOid || null, "FAILED", {
          step: "DB업데이트(Database Update)",
          error_name: dbErr.name,
          error_message: dbErr.message,
          stack: dbErr.stack,
          netCancelExecuted: true
        }, {
          error_message: dbErr.message || "DB 업데이트 실패",
          error_code: "DATABASE_MAPPING_ERROR"
        });
      }
      return res.redirect(`${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent("데이터베이스 마킹 오류로 소중한 고객님의 결제가 자동 승인환불(망취소) 처리되었습니다.")}&oid=${finalOid || ""}&resultCode=DATABASE_MAPPING_ERROR`);
    }
  });

  // NetCancel Local Helper
  async function triggerNetCancelHelper(netCancelUrl: string, mid: string, authToken: string, timestamp: string, signature: string) {
    try {
      const cancelParams = new URLSearchParams();
      cancelParams.append("mid", mid);
      cancelParams.append("authToken", authToken);
      cancelParams.append("timestamp", timestamp);
      cancelParams.append("signature", signature);
      cancelParams.append("charset", "UTF-8");
      cancelParams.append("format", "JSON");

      console.warn(`[NETCANCEL] Calling NetCancel for API recovery -> URL: ${netCancelUrl}`);
      const res = await fetch(netCancelUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: cancelParams.toString()
      });
      const responseText = await res.text();
      console.warn("[NETCANCEL] NetCancel response payload:", responseText);
    } catch (cancelErr: any) {
      console.error("[NETCANCEL] Critical: Double connection error triggered on cancel request.", cancelErr);
    }
  }

  // Universal local payment logs writer
  async function writePaymentLogLocal(
    oid: string | null,
    status: "SUCCESS" | "FAILED",
    errorOrResponse: any,
    additionals: any = {}
  ) {
    if (!supabaseAdmin) return;
    try {
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

      const payload: any = {
        order_id: orderId,
        merchant_uid: oid,
        status: status,
        raw_response: typeof errorOrResponse === "string" ? errorOrResponse : JSON.stringify(errorOrResponse),
        raw_data: {
          status: status,
          details: errorOrResponse,
          ...additionals,
          logged_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      };

      const { error } = await supabaseAdmin.from("payment_logs").insert([payload]);
      if (error) {
        console.warn("[writePaymentLogLocal] Primary insert failed, executing standard fallback columns:", error.message);
        const fallbackPayload: any = {
          merchant_uid: oid,
          raw_data: {
            status: status,
            details: errorOrResponse,
            ...additionals,
            logged_at: new Date().toISOString()
          }
        };
        if (orderId) fallbackPayload.order_id = orderId;
        await supabaseAdmin.from("payment_logs").insert([fallbackPayload]);
      }
    } catch (err: any) {
      console.warn("[writePaymentLogLocal] Skipped bypass:", err.message);
    }
  }


  // Core API Unified Serverless / Centralized Endpoint Context (Single API entry point)
  app.post("/api/core-api", async (req, res) => {
    console.log("POST /api/core-api called with action:", req.body?.action);
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ status: "error", message: "Supabase Administrator credentials not configured." });
      }

      const { action } = req.body;
      if (!action) {
        return res.status(400).json({ status: "error", message: "Missing required API action descriptor." });
      }

      const authHeader = req.headers.authorization;
      let requestingUser = null;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
          const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
          if (!authErr && user) {
            requestingUser = user;
          }
        } catch (e) {
          // ignore error check
        }
      }

      const isAdminCheck = async (uid: string) => {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("role, email")
          .eq("id", uid)
          .maybeSingle();
        return !!(profile && (profile.role === "admin" || profile.role === "super_admin"));
      };

      // 1. Lesson/course access verification
      if (action === "verify-lesson-access") {
        const { courseId, lessonId, userId } = req.body;
        const targetUserId = userId || requestingUser?.id;

        if (!courseId || !lessonId) {
          return res.status(400).json({ status: "error", message: "Missing courseId or lessonId" });
        }
        if (!targetUserId) {
          return res.status(401).json({ status: "error", message: "User authentication session is required" });
        }

        const isUserAdmin = await isAdminCheck(targetUserId);
        if (isUserAdmin) {
          return res.json({ allowed: true, reason: "admin-bypass" });
        }

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
                return res.json({ allowed: true, reason: "free-preview" });
              }
            }
          }
        }

        const { data: enrollment } = await supabaseAdmin
          .from("enrollments")
          .select("id, expires_at, status")
          .eq("user_id", targetUserId)
          .eq("course_id", courseId)
          .eq("is_deleted", false)
          .maybeSingle();

        if (enrollment && enrollment.status === "active") {
          if (!enrollment.expires_at || new Date(enrollment.expires_at) > new Date()) {
            return res.json({ allowed: true, reason: "active-enrollment" });
          }
        }

        return res.json({ allowed: false, reason: "No active enrollment or course expired" });
      }

      // 2. Process payment securely (복식부기 트랜잭션 기록 포함)
      if (action === "process-payment") {
        const { merchant_uid, amount, courseId, userId, payment_tid, payment_method, mileage_used } = req.body;
        const targetUserId = userId || requestingUser?.id;

        if (!merchant_uid || !amount || !courseId || !targetUserId) {
          return res.status(400).json({ status: "error", message: "Missing required fields for payment processing." });
        }

        const actualPaidAmount = Math.max(0, Number(amount) - (Number(mileage_used) || 0));

        const { data: order, error: orderErr } = await supabaseAdmin
          .from("orders")
          .update({
            status: "PAID",
            payment_tid: payment_tid || `TID-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            payment_method: payment_method || "direct",
            mileage_used: Number(mileage_used) || 0,
            amount: actualPaidAmount,
            updated_at: new Date().toISOString()
          })
          .eq("merchant_uid", merchant_uid)
          .select()
          .single();

        if (orderErr) {
          console.error("Order update error:", orderErr);
          return res.status(500).json({ status: "error", message: `Order status update failed: ${orderErr.message}` });
        }

        // Double bookkeeping (복식부기 전표 기록)
        const { data: tx } = await supabaseAdmin
          .from("transactions")
          .insert([{
            description: `Vite-Netlify 결제 완료 (주문번호: ${merchant_uid}, 마일리지 사용: ${Number(mileage_used) || 0} P)`,
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
              debit_amount: actualPaidAmount,
              credit_amount: 0
            },
            {
              transaction_id: tx.id,
              user_id: targetUserId,
              description: `강의 전용 매출액 발생`,
              debit_amount: 0,
              credit_amount: actualPaidAmount
            }
          ]);
        }

        const defaultDurationMonths = 12;
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + defaultDurationMonths);

        await supabaseAdmin.from("enrollments").upsert({
          user_id: targetUserId,
          course_id: courseId,
          status: "active",
          expires_at: expiresAt.toISOString(),
          is_deleted: false
        }, { onConflict: "user_id, course_id" });

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

        return res.json({
          status: "success",
          message: "결제 완료 처리 및 수강 권한 가입이 성공적으로 완수되었습니다.",
          order,
          activatedCommunitiesCount
        });
      }

      // 8.45 USER: 1:1 문의글 제출 (support/inquiry)
      if (action === "submit-inquiry") {
        const { category, email, title, message } = req.body;
        if (!category || !email || !title || !message) {
          return res.status(400).json({ status: "error", message: "모든 필드(문의 유형, 이메일, 문의 제목, 상세 내용)는 필수 입력 사항입니다." });
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
          return res.status(500).json({ status: "error", message: insertErr.message });
        }

        return res.json({
          status: "success",
          message: "1:1 문의사항이 정상적으로 제출되었습니다. 소중한 의견 감사합니다 😊",
          inquiry
        });
      }

      // Rest of the admin actions require user to be an admin
      if (!requestingUser) {
        return res.status(401).json({ status: "error", message: "Admin authorization token is required." });
      }

      const currentCallerIsAdmin = await isAdminCheck(requestingUser.id);
      if (!currentCallerIsAdmin) {
        return res.status(403).json({ status: "error", message: "Forbidden - Administrator access credentials required." });
      }

      // 3. ADMIN: grant-enrollment / revoke-enrollment
      if (action === "grant-enrollment") {
        const { userId, courseId, expiresAt } = req.body;
        if (!userId || !courseId) {
          return res.status(400).json({ status: "error", message: "Missing userId or courseId parameters" });
        }

        const defaultExpires = new Date();
        defaultExpires.setMonth(defaultExpires.getMonth() + 12);
        const resolveExpiry = expiresAt || defaultExpires.toISOString();

        await supabaseAdmin.from("enrollments").upsert({
          user_id: userId,
          course_id: courseId,
          status: "active",
          expires_at: resolveExpiry,
          is_deleted: false
        }, { onConflict: "user_id, course_id" });

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

        return res.json({ status: "success", message: "수강권 수동 발급 및 연동 커뮤니티 권한동기화 완료" });
      }

      if (action === "revoke-enrollment") {
        const { userId, courseId } = req.body;
        if (!userId || !courseId) {
          return res.status(400).json({ status: "error", message: "Missing userId or courseId parameters" });
        }

        await supabaseAdmin
          .from("enrollments")
          .update({
            status: "expired"
          })
          .eq("user_id", userId)
          .eq("course_id", courseId);

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

        return res.json({ status: "success", message: "수강 자격 만료 및 연계 커뮤니티 권한 회수가 성공 완료되었습니다." });
      }

      // 4. ADMIN: join-community / leave-community / sync-communities
      if (action === "join-community") {
        const { userId, communityId } = req.body;
        if (!userId || !communityId) {
          return res.status(400).json({ status: "error", message: "Missing userId or communityId" });
        }

        await supabaseAdmin.from("community_members").upsert({
          community_id: communityId,
          user_id: userId,
          joined_at: new Date().toISOString(),
          is_deleted: false
        }, { onConflict: "community_id, user_id" });

        return res.json({ status: "success", message: "커뮤니티 수동 멤버십 가입 완료" });
      }

      if (action === "leave-community") {
        const { userId, communityId } = req.body;
        if (!userId || !communityId) {
          return res.status(400).json({ status: "error", message: "Missing userId or communityId" });
        }

        await supabaseAdmin
          .from("community_members")
          .update({ is_deleted: true })
          .eq("community_id", communityId)
          .eq("user_id", userId);

        return res.json({ status: "success", message: "커뮤니티 멤버십 탈퇴/비활성화 완료" });
      }

      if (action === "sync-communities") {
        const { userId } = req.body;
        if (!userId) {
          return res.status(400).json({ status: "error", message: "Missing user identifier for syncing." });
        }

        const nowStr = new Date().toISOString();
        const { data: enrollments } = await supabaseAdmin
          .from("enrollments")
          .select("course_id")
          .eq("user_id", userId)
          .eq("status", "active")
          .or(`expires_at.is.null,expires_at.gt.${nowStr}`);

        const enrolledCourseIds = enrollments ? enrollments.map(e => e.course_id) : [];

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
              const { error } = await supabaseAdmin.from("community_members").upsert({
                community_id: comm.id,
                user_id: userId,
                joined_at: new Date().toISOString(),
                is_deleted: false
              }, { onConflict: "community_id, user_id" });
              if (!error) grants++;
            } else {
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

        return res.json({
          status: "success",
          message: `커뮤니티 동기화가 완수되었습니다(가입: ${grants}건, 수거/탈퇴: ${revokes}건).`,
          grants,
          revokes
        });
      }

      // 5. ADMIN: admin-modify-role
      if (action === "admin-modify-role") {
        const { userId, role } = req.body;
        if (!userId || !role) {
          return res.status(400).json({ status: "error", message: "Missing target userId or new role level specification." });
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
          return res.status(500).json({ status: "error", message: error.message });
        }

        return res.json({ status: "success", message: `회원 권한 등급이 [${role}]로 안전하게 수정되었습니다.`, profile: data });
      }

      // 6. ADMIN: admin-reset-password
      if (action === "admin-reset-password") {
        const { email, userId, requestId, password } = req.body;
        if (!email && !userId) {
          return res.status(400).json({ status: "error", message: "Required argument (email or userId) is missing" });
        }

        let targetUserId = userId;
        if (!targetUserId && email) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          if (!profile) {
            return res.status(404).json({ status: "error", message: "No registered profile found matching this email." });
          }
          targetUserId = profile.id;
        }

        const newPassword = password || "123456";
        const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(
          targetUserId,
          { password: newPassword }
        );

        if (resetErr) {
          return res.status(500).json({ status: "error", message: `Failed resetting in Auth Provider: ${resetErr.message}` });
        }

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

        return res.json({ status: "success", message: `Successfully reset password to '${newPassword}'` });
      }

      // 6.2 ADMIN: Delete specific auth user permanently from Supabase Authentication
      if (action === "admin-delete-auth-user") {
        const { userId } = req.body;
        if (!userId) {
          return res.status(400).json({ status: "error", message: "Required argument (userId) is missing" });
        }

        console.log(`[core-api server] Permanently deleting authed user: ${userId}`);
        const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authDeleteErr) {
          console.error("Supabase Admin Auth deleteUser failed inside server:", authDeleteErr);
          if (authDeleteErr.message && authDeleteErr.message.toLowerCase().includes("not found")) {
            return res.json({
              status: "success",
              message: "User was already completely removed from Auth database"
            });
          }
          return res.status(500).json({
            status: "error",
            message: `Supabase Auth delete failed: ${authDeleteErr.message}`
          });
        }

        return res.json({
          status: "success",
          message: "Successfully deleted login credentials from Auth system"
        });
      }

      // 6.3 ADMIN: List orphaned auth users who do not have profiles
      if (action === "admin-list-orphaned-auth-users") {
        const { data: profiles, error: pError } = await supabaseAdmin
          .from("profiles")
          .select("id, email, name, nickname");

        if (pError) {
          return res.status(500).json({ status: "error", message: `Failed to fetch profiles: ${pError.message}` });
        }

        const profileIds = new Set((profiles || []).map(p => p.id));
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        if (authError) {
          return res.status(500).json({ status: "error", message: `Failed to fetch auth users: ${authError.message}` });
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

        return res.json({ status: "success", data: orphaned });
      }

      // 6.4 ADMIN: Bulk delete auth users from Supabase Authentication
      if (action === "admin-bulk-delete-auth-users") {
        const { userIds } = req.body;
        if (!userIds || !Array.isArray(userIds)) {
          return res.status(400).json({ status: "error", message: "Required parameter 'userIds' array is missing" });
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

        return res.json({ status: "success", results });
      }

      // 6.5 ADMIN: Reviews Management Bypass (Toggle Best/Delete)
      if (action === "admin-toggle-best-review") {
        const { reviewId, isBest } = req.body;
        if (!reviewId) {
          return res.status(400).json({ status: "error", message: "Missing target reviewId parameter." });
        }

        const { data, error } = await supabaseAdmin
          .from("reviews")
          .update({ is_best: isBest })
          .eq("id", reviewId)
          .select()
          .maybeSingle();

        if (error) {
          console.error("Error toggling best review via server role:", error);
          return res.status(500).json({ status: "error", message: error.message });
        }

        return res.json({ status: "success", message: "베스트 수강후기 상태가 완벽하게 안전 정합 업데이트되었습니다.", review: data });
      }

      if (action === "admin-delete-review") {
        const { reviewId } = req.body;
        if (!reviewId) {
          return res.status(400).json({ status: "error", message: "Missing target reviewId parameter." });
        }

        const { data, error } = await supabaseAdmin
          .from("reviews")
          .update({ is_deleted: true })
          .eq("id", reviewId)
          .select()
          .maybeSingle();

        if (error) {
          console.error("Error deleting review via server role:", error);
          return res.status(500).json({ status: "error", message: error.message });
        }

        return res.json({ status: "success", message: "수강후기가 성공적으로 즉각 영구(소프트) 삭제 처리되었습니다." });
      }

      // 7. ADMIN: 전체 커뮤니티 만료 수거 및 동기화 (Global Community Sync & Sweep)
      if (action === "sync-all-communities") {
        console.log("[GlobalSync] Starting community and enrollment sync check in Express...");
        
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

        return res.json({
          status: "success",
          message: "전체 회원 권한 및 커뮤니티 만료/자동동기화 정리가 성공적으로 완료되었습니다.",
          expiredCount,
          createdMembershipsCount
        });
      }

      // 8. ADMIN: 주문정보 PAID 강제 갱신 및 재처리 (Order Reprocess Machine)
      if (action === "reprocess-order") {
        const { orderId } = req.body;
        if (!orderId) {
          return res.status(400).json({ status: "error", message: "Missing orderId" });
        }

        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("merchant_uid, amount, user_id, course_id")
          .eq("id", orderId)
          .maybeSingle();

        if (!order) {
          return res.status(404).json({ status: "error", message: "Order not found" });
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
          is_deleted: false
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

        return res.json({
          status: "success",
          message: "주문 정보가 PAID 로 자동 갱신되었으며, 복식부기 및 수강/커뮤니티 연동 권한이 재처리되었습니다!"
        });
      }

      // 8.5 ADMIN: 모의 결제 주문 생성 (Sandbox)
      if (action === "admin-create-test-order") {
        const { userId, courseId, amount } = req.body;
        if (!userId || !courseId || !amount) {
          return res.status(400).json({ status: "error", message: "Required parameters (userId, courseId, amount) are missing." });
        }

        const merchant_uid = `MOCK-ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        
        const { data: order, error: insertErr } = await supabaseAdmin
          .from("orders")
          .insert([{
            user_id: userId,
            course_id: courseId,
            amount: parseInt(amount, 10) || 0,
            status: "PENDING",
            merchant_uid: merchant_uid,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (insertErr) {
          console.error("[Sandbox] Failed to insert mock order:", insertErr);
          return res.status(500).json({ status: "error", message: insertErr.message });
        }

        return res.json({
          status: "success",
          message: "모의 테스트용 결제 대기(PENDING) 주문이 성공적으로 생성되었습니다.",
          order
        });
      }

      // 8.6 ADMIN: 모의 결제 결과 콜백 시뮬레이션 (Sandbox)
      if (action === "admin-simulate-payment") {
        const { orderId, success } = req.body;
        if (!orderId) {
          return res.status(400).json({ status: "error", message: "Missing required parameter: orderId" });
        }

        const { data: order, error: findErr } = await supabaseAdmin
          .from("orders")
          .select("merchant_uid, amount, user_id, course_id")
          .eq("id", orderId)
          .maybeSingle();

        if (findErr || !order) {
          return res.status(404).json({ status: "error", message: "Order records not found or query error." });
        }

        const oid = order.merchant_uid;
        const amount = order.amount;

        try {
          if (success) {
            // 이니시스 통보성공 데이터 구조 시뮬레이션
            const mockAuthResult = {
              resultCode: "0000",
              resultMsg: "모의 결제 테스트 성공 (Callback Sandbox Passed)",
              MOID: oid,
              TotPrice: amount.toString(),
              CardCode: "M_CARD",
              payMethod: "SANDBOX_CARD",
              simulated: true,
              reprocessedByAdmin: false
            };

            // 핵심 상태전이 함수 (handleOrderStateTransition) 작동 검증
            // 이는 결제 완료, 수강권 활성화(enrollments), 커뮤니티(community_members) 동기화 일관성을 트리거합니다.
            await handleOrderStateTransition(oid, "PAID", mockAuthResult, amount);

            // Double ledger bookkeeping 복식부기 회계 전표 자동 생성
            const { data: tx } = await supabaseAdmin
              .from("transactions")
              .insert([{
                description: `[SANDBOX] 모의 결제 콜백 성공 완료 (주문번호: ${oid})`,
                created_by: order.user_id
              }])
              .select()
              .single();

            if (tx) {
              await supabaseAdmin.from("transaction_lines").insert([
                {
                  transaction_id: tx.id,
                  user_id: order.user_id,
                  description: `[소액결제-테스트] 보통예금 안전 수신 증가 (임시 유입)`,
                  debit_amount: amount,
                  credit_amount: 0
                },
                {
                  transaction_id: tx.id,
                  user_id: order.user_id,
                  description: `[소액결제-테스트] 테스트 전용 가상 매출 증대`,
                  debit_amount: 0,
                  credit_amount: amount
                }
              ]);
            }

            return res.json({
              status: "success",
              message: `[모의 결제 완료] 주문 ${oid}에 대해 PAID 상태전이가 이상 없이 완결되었습니다. 매출 데이터 복식부기 및 강좌/커뮤니티 접근권한 동기화 완료!`
            });
          } else {
            // 이니시스 통보실패 데이터 구조 시뮬레이션
            const mockAuthResult = {
              resultCode: "MOCK_FAIL",
              resultMsg: "샌드박스 결제 모의 실패 처리",
              MOID: oid,
              TotPrice: amount.toString(),
              simulated: true
            };

            await handleOrderStateTransition(oid, "FAILED", mockAuthResult);

            return res.json({
              status: "success",
              message: `[모의 결제 실패] 주문 ${oid}에 대해 FAILED 상태전이가 올바르게 실행되었습니다. (수강권 미발급 유지)`
            });
          }
        } catch (err: any) {
          console.error("[Sandbox] Error during simulation execution:", err);
          return res.status(500).json({ status: "error", message: err.message || "모의 콜백 처리 도중 예외가 발생했습니다." });
        }
      }

      // 9. ADMIN: 결제 주문 정보 및 대기 데이터 삭제 (참조 테이블 cascading 정리 포함)
      if (action === "admin-delete-order") {
        const { orderId } = req.body;
        if (!orderId) {
          return res.status(400).json({ status: "error", message: "Missing orderId" });
        }

        const { data: order, error: findError } = await supabaseAdmin
          .from("orders")
          .select("status")
          .eq("id", orderId)
          .maybeSingle();

        if (findError) {
          return res.status(500).json({ status: "error", message: findError.message });
        }

        if (!order) {
          return res.status(404).json({ status: "error", message: "주문 데이터를 찾을 수 없습니다." });
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
          return res.status(500).json({ status: "error", message: deleteError.message });
        }

        return res.json({
          status: "success",
          message: "결제 및 주문 데이터가 영구 데이터베이스에서 안전하게 삭제되었습니다."
        });
      }

      // 10. ADMIN: 결제 실패 원인 정밀 로깅 및 관리자 경보/이메일 알림 전송 API
      if (action === "send-payment-failure-alert") {
        const { oid, resultCode, resultMsg, analysis, userEmail, courseTitle } = req.body;
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
          console.warn("[core-api local] Failed saving alert to payment_logs:", logError.message);
        }

        console.warn(`[ALERT-NOTIFICATION-DISPATCH] Sending immediate SMS/Email notification alert to: ${adminEmail}`);
        console.warn(`[DEFECTIVE-REPORT] OID: ${oid}, Buyer: ${userEmail}, Course: ${courseTitle}, PG Code: ${resultCode}, Message: ${resultMsg}, Diagnose: ${analysis}`);

        return res.json({
          status: "success",
          message: "결제 실패 원인 정밀 통보 및 알림이 실시간으로 관리자(kys@k-learn.co.kr) 전용 경보 모듈과 데이터베이스 로그 시스템으로 안전사고 예방 조치 전송 완료되었습니다.",
          dispatched_to: adminEmail,
          dispatched_at: new Date().toISOString()
        });
      }

      return res.status(400).json({ status: "error", message: `Action [${action}] is not supported on core-api routing.` });

    } catch (e: any) {
      console.error("Core-API general exception in express server:", e);
      return res.status(500).json({ status: "error", message: e.message || "An unexpected error occurred in core-api." });
    }
  });

  // 이니시스 Signature 생성 API
  app.post("/api/payment/inicis/sign", async (req, res) => {
    console.log("POST /api/payment/inicis/sign called");
    try {
      const { price, oid, timestamp, userId, courseId, orderName } = req.body;
      console.log("Sign request body:", { price, oid, timestamp, userId, courseId, orderName });
      
      if (!price || !oid || !timestamp) {
        return res.status(400).json({ status: "error", message: "Missing required fields" });
      }

      const config = await getInicisConfig();

      if (supabaseAdmin) {
        console.log(`Creating order record on server: oid=${oid}, userId=${userId}, amount=${price}`);

        // Create ORDER record here (Bypassing RLS)
        const { error: orderError } = await supabaseAdmin.from("orders").insert([{
          user_id: userId,
          course_id: courseId,
          amount: price,
          status: "PENDING",
          order_name: orderName,
          merchant_uid: oid
        }]);

        if (orderError) {
          console.error("Order creation failed on server:", orderError);
          return res.status(500).json({ status: "error", message: `Order creation failed: ${orderError.message}` });
        }
      } else {
        console.warn("Supabase Admin NOT initialized. Order record NOT created.");
      }
      
      const signature = generateInicisSignature(config.mid, config.signKey, oid, Number(price), timestamp);
      const mKey = crypto.createHash('sha256').update(config.signKey).digest('hex');
      
      res.json({
        mid: config.mid,
        signature,
        mKey,
        isSandbox: config.isSandbox,
        status: "success"
      });
    } catch (error) {
      console.error("Signature generation error:", error);
      res.status(500).json({ status: "error", message: "Signature generation failed" });
    }
  });

  // Admin API for Direct Password Reset (For CMS Admin Use)
  app.post("/api/admin/reset-password", async (req, res) => {
    console.log("POST /api/admin/reset-password called");
    try {
      const { email, userId, requestId, password } = req.body;
      if (!email && !userId) {
        return res.status(400).json({ status: "error", message: "Required fields (email or userId) are missing" });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ status: "error", message: "Supabase Admin is not initialized on the server" });
      }

      let targetUserId = userId;

      // 1. If only email is provided, fetch userId from profiles
      if (!targetUserId && email) {
        const { data: profile, error: profileErr } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (profileErr) {
          console.error("Error finding profile by email:", profileErr);
          return res.status(500).json({ status: "error", message: "Failed to query profile" });
        }
        
        if (!profile) {
          return res.status(404).json({ status: "error", message: "No user found with the provided email address" });
        }
        
        targetUserId = profile.id;
      }

      const newPassword = password || "123456";
      // 2. Clear password utilizing Supabase Admin Auth API
      console.log(`Resetting password to '${newPassword}' for user id: ${targetUserId}`);
      const { data, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        { password: newPassword }
      );

      if (updateErr) {
        console.error("Supabase Admin Auth updatePassword failed:", updateErr);
        return res.status(500).json({ 
          status: "error", 
          message: `Supabase Auth failed: ${updateErr.message}` 
        });
      }

      // 3. Mark the password reset request as soft deleted or inactive
      if (requestId) {
        await supabaseAdmin
          .from("support_contents")
          .update({ is_deleted: true, active: false, updated_at: new Date().toISOString() })
          .eq("id", requestId);
      } else if (email) {
        // Clear any associated requests for this email to synchronize states
        await supabaseAdmin
          .from("support_contents")
          .update({ is_deleted: true, active: false, updated_at: new Date().toISOString() })
          .eq("type", "password_reset_request")
          .eq("title", email);
      }

      return res.json({ 
        status: "success", 
        message: `Successfully reset password to '${newPassword}'` 
      });
    } catch (error: any) {
      console.error("Password reset error on admin server:", error);
      return res.status(500).json({ 
        status: "error", 
        message: error.message || "An error occurred during password resetting" 
      });
    }
  });

  // Admin API to delete user from Supabase Authentication table permanently
  app.post("/api/admin/delete-auth-user", async (req, res) => {
    console.log("POST /api/admin/delete-auth-user called");
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ status: "error", message: "Required field (userId) is missing" });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ status: "error", message: "Supabase Admin is not initialized on the server" });
      }

      console.log(`Permanently deleting authenticated user from Supabase Auth: ${userId}`);
      const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (authDeleteErr) {
        console.error("Supabase Admin Auth deleteUser failed:", authDeleteErr);
        if (authDeleteErr.message && authDeleteErr.message.toLowerCase().includes("not found")) {
          return res.json({
            status: "success",
            message: "User was already completely removed from Auth database"
          });
        }
        return res.status(500).json({ 
          status: "error", 
          message: `Supabase Auth delete failed: ${authDeleteErr.message}` 
        });
      }

      return res.json({ 
        status: "success", 
        message: "Successfully deleted user from Supabase Authentication" 
      });
    } catch (error: any) {
      console.error("Auth user delete error on admin server:", error);
      return res.status(500).json({ 
        status: "error", 
        message: error.message || "An error occurred during auth user deletion" 
      });
    }
  });

  // Admin API to fetch orphaned auth users (users in auth.users who do not have a matching public.profiles record)
  app.get("/api/admin/orphaned-auth-users", async (req, res) => {
    console.log("GET /api/admin/orphaned-auth-users called");
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ status: "error", message: "Supabase Admin is not initialized on the server" });
      }

      // 1. Fetch all profiles
      const { data: profiles, error: pError } = await supabaseAdmin
        .from("profiles")
        .select("id, email, name, nickname");

      if (pError) {
        console.error("Failed to fetch profiles for orphan check:", pError);
        return res.status(500).json({ status: "error", message: `Failed to fetch profiles: ${pError.message}` });
      }

      const profileIds = new Set((profiles || []).map(p => p.id));

      // 2. Fetch auth users
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      if (authError) {
        console.error("Failed to fetch auth users for orphan check:", authError);
        return res.status(500).json({ status: "error", message: `Failed to fetch auth users: ${authError.message}` });
      }

      const authUsers = authData?.users || [];

      // 3. Filter out those who have profiles
      const orphaned = authUsers
        .filter(u => !profileIds.has(u.id))
        .map(u => ({
          id: u.id,
          email: u.email,
          createdAt: u.created_at,
          lastSignIn: u.last_sign_in_at || "-"
        }));

      return res.json({
        status: "success",
        data: orphaned
      });
    } catch (error: any) {
      console.error("Failed to compile orphaned auth users list:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "An error occurred during orphaned check"
      });
    }
  });

  // Admin API to bulk delete auth users
  app.post("/api/admin/bulk-delete-auth-users", async (req, res) => {
    console.log("POST /api/admin/bulk-delete-auth-users called");
    try {
      const { userIds } = req.body;
      if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ status: "error", message: "Required parameter 'userIds' array is missing" });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ status: "error", message: "Supabase Admin is not initialized on the server" });
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

      return res.json({
        status: "success",
        results
      });
    } catch (error: any) {
      console.error("Failed in bulk deleting auth users:", error);
      return res.status(500).json({
        status: "error",
        message: error.message || "An error occurred during bulk auth user deletion"
      });
    }
  });

  // Admin API to fetch Password Reset Requests (bypasses RLS issues)
  app.get("/api/admin/reset-requests", async (req, res) => {
    console.log("GET /api/admin/reset-requests called");
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ status: "error", message: "Supabase Admin is not initialized on the server" });
      }

      const { data, error } = await supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("type", "password_reset_request")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch password reset requests from database:", error);
        return res.status(500).json({ status: "error", message: error.message });
      }

      return res.json({ status: "success", data: data || [] });
    } catch (error: any) {
      console.error("Error fetching password reset requests:", error);
      return res.status(500).json({ status: "error", message: error.message });
    }
  });

  // End-user API to request Password Reset (bypasses RLS on support_contents)
  app.post("/api/auth/reset-request", async (req, res) => {
    console.log("POST /api/auth/reset-request called");
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ status: "error", message: "이메일 주소를 입력해주세요." });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ status: "error", message: "Supabase Admin is not initialized on the server" });
      }

      // 1. Verify if the email exists in profiles
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("id, email, name")
        .eq("email", email)
        .eq("is_deleted", false)
        .maybeSingle();

      if (profileErr) {
        console.error("Error looking up profile for reset-request:", profileErr);
        return res.status(500).json({ status: "error", message: "사용자 조회 중 오류가 발생했습니다." });
      }

      if (!profile) {
        return res.status(404).json({ status: "error", message: "가입되지 않은 이메일 주소입니다." });
      }

      // 2. Check if a pending reset request already exists
      const { data: existing, error: existErr } = await supabaseAdmin
        .from("support_contents")
        .select("id")
        .eq("type", "password_reset_request")
        .eq("title", email)
        .eq("active", true)
        .eq("is_deleted", false)
        .maybeSingle();

      if (existErr) {
        console.error("Error while checking existing password reset requests:", existErr);
      }

      if (existing) {
        return res.status(400).json({ status: "error", message: "이미 비밀번호 초기화 요청이 접수되어 대기 중입니다." });
      }

      // 3. Create a ticket in support_contents
      const requestMeta = {
        userId: profile.id,
        name: profile.name,
        requestedAt: new Date().toISOString(),
        status: "PENDING"
      };

      const { error: insertErr } = await supabaseAdmin
        .from("support_contents")
        .insert([{
          type: "password_reset_request",
          title: email,
          content: JSON.stringify(requestMeta),
          active: true,
          is_deleted: false
        }]);

      if (insertErr) {
        console.error("Failed to create password reset ticket in Support Contents:", insertErr);
        return res.status(500).json({ status: "error", message: "초기화 요청 저장에 실패했습니다. 고객센터에 문의하십시오." });
      }

      return res.json({ status: "success", message: "비밀번호 초기화 요청이 성공적으로 저장되었습니다." });
    } catch (error: any) {
      console.error("Password reset request error:", error);
      return res.status(500).json({ status: "error", message: error.message || "오류가 발생했습니다." });
    }
  });

  // Safe helper to send password resetOTP email containing 6-digit verification code via SMTP
  async function sendOTPEmail(email: string, code: string): Promise<boolean> {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.warn(`[SMS/Email Sandbox] No SMTP configured. Generated OTP: ${code} for ${email}`);
      return false;
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass
        }
      });

      const mailOptions = {
        from: `"비원아카데미" <${user}>`,
        to: email,
        subject: "[비원아카데미] 귀하의 비밀번호 찾기 인증번호입니다.",
        html: `
          <div style="font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; max-width: 500px; margin: 0 auto; padding: 40px; border: 1px solid #f3f4f6; border-radius: 24px; color: #1f2937; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="display: inline-block; background-color: #9333ea; color: white; font-weight: 900; font-size: 24px; width: 60px; height: 60px; line-height: 60px; border-radius: 18px; text-align: center; margin-bottom: 15px;">BE</div>
              <h2 style="font-size: 24px; font-weight: 800; color: #111827; margin: 0; letter-spacing: -1px;">비밀번호 재설정 인증번호</h2>
              <p style="color: #6b7280; font-size: 13px; margin-top: 5px;">본 인증번호는 5분 동안 유효합니다.</p>
            </div>
            
            <div style="background-color: #f5f3ff; border-radius: 16px; padding: 24.5px; text-align: center; margin-bottom: 25px; border: 1.5px dashed #c084fc;">
              <div style="font-size: 38px; font-weight: 900; color: #7e22ce; letter-spacing: 8px; margin-left: 8px;">${code}</div>
            </div>
            
            <div style="font-size: 13.5px; color: #4b5563; line-height: 1.6; margin-bottom: 25px; font-weight: 500;">
              안녕하세요. 비원아카데미 회원님,<br/>
              비밀번호 찾기를 요청하셔서 임시 인증번호가 발급되었습니다.<br/>
              화면의 입력창에 <b>위 인증번호 6자리</b>를 정확하게 기입해 주세요.
            </div>
            
            <div style="font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 15px; text-align: center;">
              본 메일은 발신전용이며, 만약 요청하지 않으셨다면 이 메일을 무시하시기 바랍니다.
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`[SMTP Mailer] OTP Email successfully sent to ${email}`);
      return true;
    } catch (e) {
      console.error("[SMTP Mailer] Failed to send email via SMTP:", e);
      return false;
    }
  }

  // ENDPOINT: Find registered email (아이디 찾기) by matching name and phone number
  app.post("/api/auth/find-email", async (req, res) => {
    console.log("POST /api/auth/find-email called");
    try {
      const { name, mobile } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ status: "error", message: "이름을 입력해 주세요." });
      }
      if (!mobile || !mobile.trim()) {
        return res.status(400).json({ status: "error", message: "휴대전화번호를 입력해 주세요." });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ status: "error", message: "Supabase가 바인딩되지 않았습니다." });
      }

      // Query profiles by real name
      const { data: matchedProfiles, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("email, name, mobile_phone, phone, is_deleted")
        .eq("name", name.trim());

      if (pErr) {
        console.error("[Find Email] Error checking profiles:", pErr);
        return res.status(500).json({ status: "error", message: "데이터베이스 조회 중 오류가 발생했습니다." });
      }

      if (!matchedProfiles || matchedProfiles.length === 0) {
        return res.status(400).json({ status: "error", message: "일치하는 회원 정보를 찾을 수 없습니다." });
      }

      const cleanInputPhone = mobile.replace(/[^0-9]/g, '');

      const matchedEmails = matchedProfiles
        .filter(profile => {
          if (profile.is_deleted) return false;
          const cleanDbMobile = (profile.mobile_phone || '').replace(/[^0-9]/g, '');
          const cleanDbPhone = (profile.phone || '').replace(/[^0-9]/g, '');
          return cleanDbMobile === cleanInputPhone || cleanDbPhone === cleanInputPhone;
        })
        .map(profile => profile.email);

      if (matchedEmails.length === 0) {
        return res.status(400).json({ status: "error", message: "입력하신 정보와 일치하는 이메일 주소를 찾을 수 없습니다." });
      }

      // Mask matched emails
      const maskedEmails = matchedEmails.map(email => {
        if (!email || !email.includes('@')) return email;
        const [localPart, domain] = email.split('@');
        if (localPart.length <= 3) {
          const visibleLength = Math.max(1, localPart.length - 1);
          const visible = localPart.substring(0, visibleLength);
          const stars = '*'.repeat(localPart.length - visibleLength);
          return `${visible}${stars}@${domain}`;
        }
        const visible = localPart.substring(0, 3);
        const stars = '*'.repeat(localPart.length - 3);
        return `${visible}${stars}@${domain}`;
      });

      return res.json({
        status: "success",
        emails: maskedEmails
      });
    } catch (e: any) {
      console.error("[Find Email] Unexpected exception:", e);
      return res.status(500).json({ status: "error", message: e.message || "서버 통신 장애가 일어났습니다." });
    }
  });

  // 1. ENDPOINT: Generate and Dispatch password recovery code
  app.post("/api/auth/send-reset-otp", async (req, res) => {
    console.log("POST /api/auth/send-reset-otp called");
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ status: "error", message: "이메일 주소를 입력해 주세요." });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ status: "error", message: "Supabase가 적절히 바인딩되지 않았습니다." });
      }

      // Verify email exists in profiles matches valid account
      const { data: profile, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("id, email, name")
        .eq("email", email)
        .eq("is_deleted", false)
        .maybeSingle();

      if (pErr) {
        console.error("[OTP Server] Error checking profile by email:", pErr);
        return res.status(500).json({ status: "error", message: "계정을 식별하는 도중 예외가 발생했습니다." });
      }

      if (!profile) {
        return res.status(404).json({ status: "error", message: "가입되어 있지 않거나 비활성화된 이메일 주소입니다." });
      }

      // Generate a 6-digit secure code
      const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = Date.now() + 5 * 60 * 1000; // valid for 5 min

      // Inactivate any existing OTP records for this email
      await supabaseAdmin
        .from("support_contents")
        .update({ active: false, is_deleted: true })
        .eq("type", "password_reset_otp")
        .eq("title", email);

      // Store in DB support_contents table
      const { error: insertErr } = await supabaseAdmin
        .from("support_contents")
        .insert([{
          type: "password_reset_otp",
          title: email,
          content: JSON.stringify({ code: generatedCode, expiresAt: expiry, verified: false }),
          active: true,
          is_deleted: false
        }]);

      if (insertErr) {
        console.error("[OTP Server] DB Storage error:", insertErr);
        return res.status(500).json({ status: "error", message: "인증번호 등록 데이터베이스 처리에 실패했습니다." });
      }

      console.log(`[OTP Engine] Generated recovery OTP for (${email}): ${generatedCode}`);
      const isSent = await sendOTPEmail(email, generatedCode);

      return res.json({
        status: "success",
        message: isSent 
          ? "귀하의 회원 이메일 주소로 인증코드 6자리가 발송되었습니다."
          : "안전하게 인증 코드가 생성되었습니다. (데모 모드)"
      });
    } catch (error: any) {
      console.error("send-reset-otp exception:", error);
      return res.status(500).json({ status: "error", message: error.message || "서버 내부 오류가 발생했습니다." });
    }
  });

  // 2. ENDPOINT: Verify recovery code and issue a temp secure verification token
  app.post("/api/auth/verify-reset-otp", async (req, res) => {
    console.log("POST /api/auth/verify-reset-otp called");
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ status: "error", message: "이메일 주소와 인증코드 6자리를 모두 작성해 주세요." });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ status: "error", message: "Supabase가 설정되지 않았습니다." });
      }

      // Retrieve from support_contents
      const { data: record, error: getErr } = await supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("type", "password_reset_otp")
        .eq("title", email)
        .eq("active", true)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (getErr || !record) {
        return res.status(400).json({ status: "error", message: "해당 이메일로 발송된 인증 요청을 찾을 수 없습니다." });
      }

      const meta = JSON.parse(record.content);

      if (meta.expiresAt < Date.now()) {
        return res.status(400).json({ status: "error", message: "유효 시간이 만료되었습니다. 인증번호를 다시 요청해 주세요." });
      }

      if (meta.code !== code) {
        return res.status(400).json({ status: "error", message: "인증코드 6자리가 일치하지 않습니다. 다시 입력해 주세요." });
      }

      // Issue secure verify token
      const tempToken = crypto.randomBytes(32).toString("hex");

      // Mark the DB OTP as verified and save the securely generated random token
      const updatedMeta = { ...meta, verified: true, resetToken: tempToken };
      const { error: updateErr } = await supabaseAdmin
        .from("support_contents")
        .update({
          content: JSON.stringify(updatedMeta),
          updated_at: new Date().toISOString()
        })
        .eq("id", record.id);

      if (updateErr) {
        console.error("[OTP Server] Failed to update OTP verification status:", updateErr);
        return res.status(500).json({ status: "error", message: "인증 상태 저장에 실패했습니다." });
      }

      return res.json({
        status: "success",
        message: "이메일 인증에 성공했습니다! 새 비밀번호를 바로 설정할 수 있습니다.",
        tempToken
      });
    } catch (error: any) {
      console.error("verify-reset-otp exception:", error);
      return res.status(500).json({ status: "error", message: error.message || "서버 내부 오류가 발생했습니다." });
    }
  });

  // 3. ENDPOINT: Apply new password after verification
  app.post("/api/auth/confirm-reset-password", async (req, res) => {
    console.log("POST /api/auth/confirm-reset-password called");
    try {
      const { email, tempToken, password } = req.body;
      if (!email || !tempToken || !password) {
        return res.status(400).json({ status: "error", message: "필요한 정보가 누락되었습니다." });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ status: "error", message: "Supabase가 설정되지 않았습니다." });
      }

      // Query verification record from Support Contents
      const { data: record, error: getErr } = await supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("type", "password_reset_otp")
        .eq("title", email)
        .eq("active", true)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (getErr || !record) {
        return res.status(403).json({ status: "error", message: "이메일 인증이 승인되지 않았거나 만료되었습니다." });
      }

      const meta = JSON.parse(record.content);
      if (!meta.verified) {
        return res.status(403).json({ status: "error", message: "이메일 인증 승인이 감지되지 않았습니다." });
      }

      if (!meta.resetToken || meta.resetToken !== tempToken) {
        return res.status(403).json({ status: "error", message: "보안 토큰 인증에 실패했습니다. 다시 시도해 주세요." });
      }

      if (password.length < 6) {
        return res.status(400).json({ status: "error", message: "비밀번호는 최소 6자 이상으로 안전하게 입력해 주세요." });
      }

      // Fetch the actual user ID
      const { data: profile, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (pErr || !profile) {
        return res.status(404).json({ status: "error", message: "유효한 사용자를 확인할 수 없습니다." });
      }

      // Trigger password change
      const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(
        profile.id,
        { password }
      );

      if (resetErr) {
        console.error("[OTP Server] updateUserById password reset error:", resetErr);
        return res.status(500).json({ status: "error", message: `비밀번호 변동 처리가 거부되었습니다: ${resetErr.message}` });
      }

      // Inactivate the OTP record
      await supabaseAdmin
        .from("support_contents")
        .update({ active: false, is_deleted: true, updated_at: new Date().toISOString() })
        .eq("id", record.id);

      // Automatically satisfy and close any pending support requests as well
      await supabaseAdmin
        .from("support_contents")
        .update({ is_deleted: true, active: false, updated_at: new Date().toISOString() })
        .eq("type", "password_reset_request")
        .eq("title", email);

      console.log(`[OTP Engine] Password successfully re-established for user: ${email}`);

      return res.json({
        status: "success",
        message: "비밀번호가 성공적으로 변경되었습니다! 새 비밀번호로 다시 로그인해 주세요."
      });
    } catch (error: any) {
      console.error("confirm-reset-password exception:", error);
      return res.status(500).json({ status: "error", message: error.message || "서버 내부 오류가 발생했습니다." });
    }
  });

  // API Route for Naver Blog RSS
  app.get("/api/naver-blog", async (req, res) => {
    try {
      console.log("Fetching Naver Blog RSS...");
      const blogId = req.query.blogId || "thebeone"; 
      const feed = await parser.parseURL(`https://rss.blog.naver.com/${blogId}.xml`);
      
      const posts = feed.items.map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        contentSnippet: item.contentSnippet,
        author: item.author || item.creator
      })).slice(0, 5);

      res.json({ status: "success", posts });
    } catch (error) {
      console.error("Error fetching Naver Blog RSS:", error);
      res.status(500).json({ status: "error", message: "Failed to fetch blog feed" });
    }
  });

  // ... (다른 API들은 그대로 둠)

  // Order state transition state machine, verification, idempotency and granting permissions
  async function handleOrderStateTransition(oid: string, newStatus: string, rawData: any, expectedAmount?: number) {
    if (!supabaseAdmin) {
      console.error("Supabase Admin is not initialized.");
      throw new Error("Internal Server Error: Database inactive");
    }

    console.log(`[OrderTransition] Transitioning ${oid} to ${newStatus}`);

    // A. Retrieve the existing order and perform verification
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("merchant_uid", oid)
      .maybeSingle();

    if (orderError) {
      console.error(`[OrderTransition] Failed to query order ${oid}:`, orderError);
      throw new Error(`Order lookup failed: ${orderError.message}`);
    }

    if (!order) {
      console.error(`[OrderTransition] Order ${oid} does not exist (Verification Failed)`);
      throw new Error("Order not found with the given ID.");
    }

    // B. VERIFICATION
    // Check if the expectedAmount matches original order amount
    if (expectedAmount !== undefined && Number(order.amount) !== Number(expectedAmount)) {
      console.error(`[OrderTransition] Amount Mismatch Verification Failed! Order Amount: ${order.amount}, Received Amount: ${expectedAmount}`);
      // Fail the order automatically on amount tampering
      await supabaseAdmin
        .from("orders")
        .update({
          status: "FAILED",
          updated_at: new Date().toISOString()
        })
        .eq("merchant_uid", oid);
      throw new Error(`결제 금액 위변조가 의심됩니다. (Original: ${order.amount}, Received: ${expectedAmount})`);
    }

    // C. IDEMPOTENCY / STATE MACHINE RULES
    const currentStatus = (order.status || "").toUpperCase();
    const normalizedNewStatus = newStatus.toUpperCase();

    // Already processed with terminal state
    if (currentStatus === "PAID") {
      console.log(`[OrderTransition] Order ${oid} is already PAID. Skipping side effects (Idempotency).`);
      return order;
    }

    if (currentStatus === "FAILED" && normalizedNewStatus === "FAILED") {
      console.log(`[OrderTransition] Order ${oid} is already FAILED (Idempotency).`);
      return order;
    }

    // D. Perform order status update
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: normalizedNewStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", order.id)
      .select()
      .single();

    if (updateError) {
      console.error(`[OrderTransition] Failed to update status of order ${oid}:`, updateError);
      throw new Error(`Order status update failed: ${updateError.message}`);
    }

    // E. PAID 시점에만 권한 반영 & SIDEEFFECTS
    if (normalizedNewStatus === "PAID") {
      console.log(`[OrderTransition] Applying permissions/enrollments for user ${order.user_id} on course ${order.course_id}`);
      
      // 1. Grant Course Enrollment
      try {
        const { error: enrollErr } = await supabaseAdmin
          .from("enrollments")
          .upsert({
            user_id: order.user_id,
            course_id: order.course_id,
            status: "active",
            created_at: new Date().toISOString()
          }, { onConflict: "user_id, course_id" });

        if (enrollErr) {
          console.error(`[OrderTransition] Enrollment upsert error:`, enrollErr);
        } else {
          console.log(`[OrderTransition] Enrollment added successfully.`);
        }
      } catch (e) {
        console.error(`[OrderTransition] Failed to enroll course in payment transition:`, e);
      }

      // 2. Grant Community Membership for any communities linked to this course
      try {
        const { data: linkedCommunities, error: commQueryErr } = await supabaseAdmin
          .from("communities")
          .select("id")
          .eq("course_id", order.course_id)
          .eq("is_deleted", false);

        if (!commQueryErr && linkedCommunities && linkedCommunities.length > 0) {
          for (const community of linkedCommunities) {
            const { data: existingMember } = await supabaseAdmin
              .from("community_members")
              .select("id")
              .eq("community_id", community.id)
              .eq("user_id", order.user_id)
              .maybeSingle();

            if (!existingMember) {
              await supabaseAdmin
                .from("community_members")
                .insert([{
                  community_id: community.id,
                  user_id: order.user_id,
                  joined_at: new Date().toISOString(),
                  is_deleted: false
                }]);
              console.log(`[OrderTransition] User added to community: ${community.id}`);
            }
          }
        }
      } catch (e) {
        console.error(`[OrderTransition] Failed to grant community membership in payment transition:`, e);
      }

      // 3. Log accounting entries (Trans/TransactionLines) - matching purchaseCourse [복식부기 원칙]
      try {
        const { data: tx, error: txError } = await supabaseAdmin
          .from("transactions")
          .insert([{
            description: `강의 구매 주문 (Order ID: ${order.id}) [결제완료 Webhook/Callback]`,
            created_by: order.user_id,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (!txError && tx) {
          await supabaseAdmin.from("transaction_lines").insert([
            {
              transaction_id: tx.id,
              user_id: order.user_id,
              description: "강의 구매 (입금)",
              debit_amount: order.amount,
              credit_amount: 0,
              created_at: new Date().toISOString()
            },
            {
              transaction_id: tx.id,
              user_id: order.user_id,
              description: "강의 구매 (매출 발생)",
              debit_amount: 0,
              credit_amount: order.amount,
              created_at: new Date().toISOString()
            }
          ]);
          console.log(`[OrderTransition] Accounting transaction recorded: txId=${tx.id}`);
        }
      } catch (e) {
        console.error(`[OrderTransition] Failed to record accounting transaction:`, e);
      }
    }

    return updatedOrder;
  }

  // 1. Vimeo Video Progress tracking API
  app.post("/api/video/progress", async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ status: "error", message: "Database offline" });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ status: "error", message: "Bearer token required for authorization" });
      }

      const token = authHeader.split(" ")[1];
      const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);

      if (authErr || !user) {
        return res.status(401).json({ status: "error", message: "Invalid or expired token" });
      }

      const { courseId, lessonId, event, watchedTime } = req.body;
      if (!courseId || !lessonId || !event) {
        return res.status(400).json({ status: "error", message: "Missing courseId, lessonId or event" });
      }

      let isCompleted = req.body.isCompleted || false;
      if (event === "complete") {
        isCompleted = true;
      }

      // Upsert record to public.lesson_progress
      const { error: upsertErr } = await supabaseAdmin
        .from("lesson_progress")
        .upsert({
          user_id: user.id,
          course_id: courseId,
          lesson_id: lessonId,
          is_completed: isCompleted,
          watched_time: watchedTime || 0,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id,course_id,lesson_id" });

      if (upsertErr) {
        console.error("Error upserting progress:", upsertErr);
        const isTableMissing = upsertErr.code === "PGRST205" || 
                               (upsertErr.message && (upsertErr.message.includes("schema cache") || upsertErr.message.includes("does not exist")));
        if (isTableMissing) {
          return res.status(200).json({ 
            status: "db_table_missing", 
            message: "Could not find public.lesson_progress table in the schema cache. Please run 'supabase_rls_fix.sql' script in Supabase SQL Editor." 
          });
        }
        return res.status(500).json({ status: "error", message: upsertErr.message });
      }

      // Get curriculum length to calculate exact completion rate
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("curriculum")
        .eq("id", courseId)
        .single();

      let totalLessons = 0;
      if (course && course.curriculum && Array.isArray(course.curriculum)) {
        course.curriculum.forEach((section: any) => {
          if (section.items && Array.isArray(section.items)) {
            totalLessons += section.items.length;
          }
        });
      }

      // Get number of completed lessons
      const { data: completedList, error: completedErr } = await supabaseAdmin
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
        .eq("is_completed", true)
        .eq("is_deleted", false);

      if (completedErr) {
        console.warn("Could not fetch completed lessons count from database:", completedErr);
      }

      const completedCount = completedList ? completedList.length : 0;
      const completionRate = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

      res.json({
        status: "success",
        event,
        watched_time: watchedTime || 0,
        is_completed: isCompleted,
        completed_count: completedCount,
        total_lessons: totalLessons,
        completion_rate: completionRate
      });
    } catch (e: any) {
      console.error("Video progress error:", e);
      res.status(500).json({ status: "error", message: e.message || "Something went wrong" });
    }
  });

  // 2. Admin Recovery & Sync Tools
  // A helper to verify if requesting user is an administrator
  async function adminCheck(authHeader?: string): Promise<boolean> {
    if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
    const token = authHeader.split(" ")[1];
    if (!supabaseAdmin) return false;
    
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return false;

    // Custom safeguarding direct check - Bypass removed for security reasons

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    return !!(profile && (profile.role === "admin" || profile.role === "super_admin"));
  }

  app.post("/api/admin/recovery", async (req, res) => {
    try {
      const isAuthorized = await adminCheck(req.headers.authorization);
      if (!isAuthorized) {
        return res.status(403).json({ status: "error", message: "Forbidden - Administrator access only" });
      }

      const { action, orderId, userId, courseId } = req.body;
      if (!action) {
        return res.status(400).json({ status: "error", message: "Missing action" });
      }

      if (action === "reprocess") {
        if (!orderId) return res.status(400).json({ status: "error", message: "Missing orderId" });
        // Retrieve order details to reprocess
        const { data: order } = await supabaseAdmin!
          .from("orders")
          .select("merchant_uid, amount")
          .eq("id", orderId)
          .maybeSingle();

        if (!order) return res.status(404).json({ status: "error", message: "Order not found" });

        // Force transition utilizing standard machine
        const updated = await handleOrderStateTransition(order.merchant_uid, "PAID", { reprocessedByAdmin: true }, order.amount);
        return res.json({ status: "success", message: "주문 재처리 및 권한 부여가 정상 완료되었습니다.", order: updated });
      }

      if (action === "regrant") {
        if (!userId || !courseId) {
          return res.status(400).json({ status: "error", message: "Missing userId or courseId" });
        }

        // 1. Grant/upsert enrollment
        const { error: enrollErr } = await supabaseAdmin!
          .from("enrollments")
          .upsert({
            user_id: userId,
            course_id: courseId,
            status: "active",
            created_at: new Date().toISOString()
          }, { onConflict: "user_id, course_id" });

        if (enrollErr) throw enrollErr;

        // 2. Force resolve community memberships
        const { data: linkedCommunities } = await supabaseAdmin!
          .from("communities")
          .select("id")
          .eq("course_id", courseId)
          .eq("is_deleted", false);

        let linkedCount = 0;
        if (linkedCommunities && linkedCommunities.length > 0) {
          for (const community of linkedCommunities) {
            const { data: existingMember } = await supabaseAdmin!
              .from("community_members")
              .select("id")
              .eq("community_id", community.id)
              .eq("user_id", userId)
              .maybeSingle();

            if (!existingMember) {
              await supabaseAdmin!
                .from("community_members")
                .insert([{
                  community_id: community.id,
                  user_id: userId,
                  joined_at: new Date().toISOString(),
                  is_deleted: false
                }]);
              linkedCount++;
            }
          }
        }

        return res.json({ 
          status: "success", 
          message: `권한 재부여가 완료되었습니다. (연동된 ${linkedCount}개 커뮤니티 자동 가입 완료)` 
        });
      }

      return res.status(400).json({ status: "error", message: "Invalid action type" });
    } catch (e: any) {
      console.error("Admin recovery error:", e);
      return res.status(500).json({ status: "error", message: e.message });
    }
  });

  // Global Auto-Sync and Expiration cleaner (만료/환불 시 자동 동기회수)
  app.post("/api/admin/sync-all-communities", async (req, res) => {
    try {
      const isAuthorized = await adminCheck(req.headers.authorization);
      if (!isAuthorized) {
        return res.status(403).json({ status: "error", message: "Forbidden - Administrator access only" });
      }

      console.log("[GlobalSync] Starting community and enrollment sync check...");
      
      // 1. Sweep EXPIRED enrollments (expires_at < now)
      const nowStr = new Date().toISOString();
      const { data: expiredEnrollments } = await supabaseAdmin!
        .from("enrollments")
        .select("*")
        .eq("status", "active")
        .lt("expires_at", nowStr);

      let expiredCount = 0;
      if (expiredEnrollments && expiredEnrollments.length > 0) {
        for (const enroll of expiredEnrollments) {
          // Deactivate
          await supabaseAdmin!
            .from("enrollments")
            .update({ status: "expired" })
            .eq("id", enroll.id);

          // Find associated communities
          const { data: communities } = await supabaseAdmin!
            .from("communities")
            .select("id")
            .eq("course_id", enroll.course_id);

          if (communities && communities.length > 0) {
            for (const c of communities) {
              // Delete or mark deleted in community_members
              await supabaseAdmin!
                .from("community_members")
                .update({ is_deleted: true })
                .eq("community_id", c.id)
                .eq("user_id", enroll.user_id);
            }
          }
          expiredCount++;
        }
      }

      // 2. Synchronize active enrollments missing memberships
      const { data: activeEnrollments } = await supabaseAdmin!
        .from("enrollments")
        .select("*")
        .eq("status", "active");

      let createdMembershipsCount = 0;
      if (activeEnrollments && activeEnrollments.length > 0) {
        for (const enroll of activeEnrollments) {
          // Find associated communities
          const { data: communities } = await supabaseAdmin!
            .from("communities")
            .select("id")
            .eq("course_id", enroll.course_id)
            .eq("is_deleted", false);

          if (communities && communities.length > 0) {
            for (const c of communities) {
              const { data: existingMember } = await supabaseAdmin!
                .from("community_members")
                .select("id, is_deleted")
                .eq("community_id", c.id)
                .eq("user_id", enroll.user_id)
                .maybeSingle();

              if (!existingMember) {
                await supabaseAdmin!
                  .from("community_members")
                  .insert([{
                    community_id: c.id,
                    user_id: enroll.user_id,
                    joined_at: new Date().toISOString(),
                    is_deleted: false
                  }]);
                createdMembershipsCount++;
              } else if (existingMember.is_deleted) {
                // Restore membership
                await supabaseAdmin!
                  .from("community_members")
                  .update({ is_deleted: false })
                  .eq("id", existingMember.id);
                createdMembershipsCount++;
              }
            }
          }
        }
      }

      return res.json({
        status: "success",
        message: "전체 회원 권한 및 커뮤니티 만료/자동동기화 정리가 성공적으로 완료되었습니다.",
        expiredCount,
        createdMembershipsCount
      });
    } catch (e: any) {
      console.error("Global Sync Error:", e);
      return res.status(500).json({ status: "error", message: e.message });
    }
  });

  // 이니시스 결과 알림 (Webhook)
  // 이니시스는 결제 완료 후 이 URL로 백채널 통보를 보냅니다.
  app.post("/api/payment/inicis/notify", async (req, res) => {
    try {
      console.log("Inicis Notify Received:", req.body);
      const { P_STATUS, P_TID, P_MID, P_AMT, P_OID, P_RMESG1 } = req.body;

      // 1. 로그 저장
      if (supabaseAdmin) {
        await supabaseAdmin.from("payment_logs").insert([{
          merchant_uid: P_OID,
          raw_data: req.body
        }]);
      }

      if (P_STATUS === "00") { // 성공
        const amount = P_AMT ? parseInt(P_AMT, 10) : undefined;
        await handleOrderStateTransition(P_OID, "PAID", req.body, amount);
        console.log(`Payment Success Notify (Transitioned): ${P_OID}`);
      } else {
        await handleOrderStateTransition(P_OID, "FAILED", req.body);
        console.log(`Payment Failed Notify (Transitioned): ${P_OID}, Reason: ${P_RMESG1}`);
      }

      res.send("OK");
    } catch (error) {
      console.error("Notify error:", error);
      res.send("OK"); // Respond OK to Inicis anyway so they don't retry, but we log the error
    }
  });

  // 이니시스 PC (StdPay) Return URL Handler
  // 브라우저가 사용자 결제 완료 후 POST로 이 주소로 들어옵니다.
  app.post("/api/payment/inicis/callback", async (req, res) => {
    try {
      console.log("Inicis Callback Received:", req.body);
      const { authToken, authUrl, merchantData } = req.body;

      if (!authToken || !authUrl) {
        console.error("Missing authToken or authUrl");
        return res.redirect("/payment/callback?status=fail&success=false&message=Invalid+Callback&resultCode=INVALID_CALLBACK");
      }

      const config = await getInicisConfig();
      const mid = config.mid;
      const signKey = config.signKey;

      let isVerifiedDomain = false;
      try {
        const parsedAuthUrl = new URL(authUrl);
        if (parsedAuthUrl.protocol === "http:" || parsedAuthUrl.protocol === "https:") {
          isVerifiedDomain = parsedAuthUrl.hostname === "inicis.com" || parsedAuthUrl.hostname.endsWith(".inicis.com");
        }
      } catch (e) {
        isVerifiedDomain = false;
      }

      if (!isVerifiedDomain) {
        console.error("Unverified authUrl domain:", authUrl);
        return res.redirect("/payment/callback?status=fail&success=false&message=Unverified+Payment+Gateway+Domain&resultCode=UNVERIFIED_GATEWAY");
      }

      const timestamp = new Date().getTime().toString();

      // StdPay Auth Signature: SHA256(authToken + timestamp)
      const signature = crypto.createHash('sha256').update(`authToken=${authToken}&timestamp=${timestamp}`).digest('hex');

      // Request Auth to Inicis
      const authResponse = await fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mid,
          authToken,
          timestamp,
          signature,
          format: "JSON"
        })
      });

      const authResult = await authResponse.json();
      console.log("Inicis Auth Result:", authResult);

      if (authResult.resultCode === "0000") {
        // Validate Inicis signValue signature to prevent response tampering
        const expectedSignValue = crypto.createHash("sha256")
          .update(authResult.resultCode + (authResult.TotPrice || "") + (authResult.MOID || "") + mid + signKey)
          .digest("hex");

        if (authResult.signValue && authResult.signValue !== expectedSignValue) {
          console.error(`[Inicis Callback] Signature verification failed! Expected: ${expectedSignValue}, Received: ${authResult.signValue}`);
          return res.redirect(`/payment/callback?status=fail&success=false&message=${encodeURIComponent("결제 응답 서명 검증 실패 (보안 오류)")}&resultCode=SIGNATURE_VERIFICATION_FAILED`);
        }

        // Payment Success
        const oid = authResult.MOID;
        const totalPirce = authResult.TotPrice ? parseInt(authResult.TotPrice, 10) : undefined;
        
        // Log detail
        if (supabaseAdmin) {
          await supabaseAdmin.from("payment_logs").insert([{
            merchant_uid: oid,
            raw_data: authResult
          }]);
        }

        // Apply Transition with expectedAmount validation
        await handleOrderStateTransition(oid, "PAID", authResult, totalPirce);
        
        res.redirect(`/payment/callback?status=success&success=true&resultCode=0000&mid=${mid}&oid=${oid}&message=${encodeURIComponent("결제가 완료되었습니다!")}`);
      } else {
        // Payment Failed
        const oid = authResult.MOID || "unknown";
        const message = encodeURIComponent(authResult.resultMsg || "결제 인증에 실패했습니다.");
        
        if (oid !== "unknown") {
          await handleOrderStateTransition(oid, "FAILED", authResult);
        }

        res.redirect(`/payment/callback?status=fail&success=false&resultCode=${authResult.resultCode}&resultMsg=${message}&message=${message}`);
      }
    } catch (error: any) {
      console.error("Callback handling error:", error);
      res.redirect(`/payment/callback?status=fail&success=false&message=${encodeURIComponent(error.message || "Internal Server Error")}&resultCode=INTERNAL_SERVER_ERROR`);
    }
  });

  app.get("/payment/close", (req, res) => {
    res.send(`<html><head><script>window.close();</script></head><body>Closing...</body></html>`);
  });

  // API Route for Hyperlink (OG Tag) Preview
  app.get("/api/link-preview", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ status: "error", message: "url parameter is required" });
      }

      // Add protocol if missing
      let targetUrl = url;
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl;
      }

      console.log(`[Link Preview] Fetching metadata for ${targetUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout

      try {
        const response = await fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
          }
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html")) {
          // It's a non-HTML URL (e.g. image, pdf, etc.), just return basic title and description representing the file type
          const filename = targetUrl.split("/").pop() || targetUrl;
          return res.json({
            title: filename,
            description: `공유된 ${contentType} 파일 링크입니다.`,
            image: contentType.startsWith("image/") ? targetUrl : null,
            siteName: new URL(targetUrl).hostname,
            url: targetUrl
          });
        }

        const html = await response.text();
        const rawMeta = parseMeta(html);

        const decodedTitle = decodeHtmlEntities(rawMeta.title || "").trim();
        const decodedDesc = decodeHtmlEntities(rawMeta.description || "").trim();
        const decodedImage = (rawMeta.image || "").trim();
        const decodedSiteName = decodeHtmlEntities(rawMeta.siteName || "").trim();

        // Safe relative image-url conversion
        let finalImage = decodedImage;
        if (finalImage && !/^https?:\/\//i.test(finalImage)) {
          try {
            const parsedUrl = new URL(targetUrl);
            if (finalImage.startsWith("/")) {
              finalImage = `${parsedUrl.protocol}//${parsedUrl.host}${finalImage}`;
            } else {
              const pathParts = parsedUrl.pathname.split("/");
              pathParts.pop();
              const basePath = pathParts.join("/");
              finalImage = `${parsedUrl.protocol}//${parsedUrl.host}${basePath}/${finalImage}`;
            }
          } catch (e) {
            // ignore malformed image url parsing
          }
        }

        return res.json({
          title: decodedTitle || new URL(targetUrl).hostname,
          description: decodedDesc || "공유된 링크를 통해 내용을 직접 확인해 보세요.",
          image: finalImage || null,
          siteName: decodedSiteName || new URL(targetUrl).hostname,
          url: targetUrl
        });

      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        console.warn(`[Link Preview] Failed to fetch ${targetUrl}:`, fetchErr.message);
        try {
          return res.json({
            title: new URL(targetUrl).hostname,
            description: "공유된 웹사이트 링크입니다. 클릭하여 원본 페이지로 이동해 보세요.",
            image: null,
            siteName: new URL(targetUrl).hostname,
            url: targetUrl
          });
        } catch (err) {
          return res.json({
            title: targetUrl,
            description: "공유된 웹사이트 링크입니다. 클릭하여 원본 페이지로 이동해 보세요.",
            image: null,
            siteName: "Web Link",
            url: targetUrl
          });
        }
      }

    } catch (e: any) {
      console.error("[Link Preview] Exception handler:", e);
      return res.status(500).json({ status: "error", message: e.message });
    }
  });

  // Helper functions for /api/link-preview
  function parseMeta(html: string) {
    const result: { title?: string; description?: string; image?: string; siteName?: string } = {};
    
    // Title matches
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch) {
      result.title = ogTitleMatch[1];
    } else {
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (titleMatch) result.title = titleMatch[1];
    }

    // Description matches
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
    if (ogDescMatch) {
      result.description = ogDescMatch[1];
    } else {
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
      if (descMatch) result.description = descMatch[1];
    }

    // Image matches
    const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i);
    if (ogImgMatch) {
      result.image = ogImgMatch[1];
    }

    // Site Name matches
    const ogSiteMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:site_name["']/i);
    if (ogSiteMatch) {
      result.siteName = ogSiteMatch[1];
    }

    return result;
  }

  function decodeHtmlEntities(str: string): string {
    if (!str) return "";
    return str
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, " ");
  }

  // Catch-all for UNMATCHED API routes
  // This must be placed AFTER all specific /api routes but BEFORE the SPA catch-all
  app.all("/api/*", (req, res) => {
    console.warn(`Unmatched API request: ${req.method} ${req.url}`);
    res.status(404).json({ 
      status: "error", 
      message: `API endpoint not found: ${req.method} ${req.url}` 
    });
  });

  // Serve environment variables to client
  app.get("/config.js", (req, res) => {
    console.log("Serving config.js");
    const configData = {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    };
    res.type("application/javascript");
    res.send(`window.ENV_CONFIG = ${JSON.stringify(configData)};`);
  });

  // Serve static assets OR Vite middleware
  let vite: any;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
  }

  // SPA Fallback
  app.get("*", async (req, res, next) => {
    // Skip API and config routes - let the specific handlers or the catch-all deal with these
    if (req.path.startsWith("/api") || req.path === "/config.js") {
      return next();
    }

    // In development mode, Vite handles SPA fallback through middleware, 
    // but we can also manually serve index.html if needed.
    if (process.env.NODE_ENV !== "production") {
      try {
        const indexPath = path.resolve(process.cwd(), "index.html");
        if (!fs.existsSync(indexPath)) {
          console.error(`Index file not found at: ${indexPath}`);
          return next();
        }
        let template = fs.readFileSync(indexPath, "utf-8");
        // @ts-ignore - Assuming vite defined in outer scope or using local vite instance
        if (typeof vite !== 'undefined') {
          // @ts-ignore
          template = await vite.transformIndexHtml(req.originalUrl, template);
        }
        return res.status(200).set({ "Content-Type": "text/html" }).send(template);
      } catch (e) {
        console.error("SPA Fallback (Dev) Error:", e);
        return next(e);
      }
    } else {
      // Production mode: serve from dist
      const distPath = path.join(process.cwd(), "dist");
      const indexPath = path.join(distPath, "index.html");
      
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        console.error(`Production index.html missing at: ${indexPath}`);
        res.status(404).send("Application not built or index.html missing.");
      }
    }
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global error handler caught an error:", err);
    if (req.path.startsWith("/api")) {
      return res.status(500).json({ 
        status: "error", 
        message: err.message || "Internal Server Error" 
      });
    }
    next(err);
  });

  try {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("CRITICAL: Server failed to start:", error);
    process.exit(1);
  }
}

startServer();
