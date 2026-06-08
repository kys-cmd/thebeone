import { Handler } from "@netlify/functions";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey) 
  ? createClient(supabaseUrl, supabaseServiceRoleKey) 
  : null;

function parseUrlEncoded(bodyStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  const params = new URLSearchParams(bodyStr);
  for (const [key, val] of params.entries()) {
    result[key] = val;
  }
  return result;
}

export const handler: Handler = async (event) => {
  // Inicis sends post data as application/x-www-form-urlencoded
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 302, 
      headers: { Location: "/payment/callback?status=fail&message=Method+Not+Allowed" },
      body: "" 
    };
  }

  // Raw body parsing including Base64 decoding
  let decodedBody = "";
  if (event.body) {
    decodedBody = event.isBase64Encoded 
      ? Buffer.from(event.body, "base64").toString("utf-8")
      : event.body;
  }

  const inicisData = parseUrlEncoded(decodedBody);
  console.log("[PAYMENT-CALLBACK] Received certification response:", inicisData);

  const resultCode = inicisData.resultCode;
  const resultMsg = inicisData.resultMsg;
  const oid = inicisData.orderNumber || inicisData.oid;
  const authToken = inicisData.authToken;
  const authUrl = inicisData.authUrl;
  const netCancelUrl = inicisData.netCancelUrl || authUrl?.replace("/auth", "/netCancel") || "https://iniapi.inicis.com/api/v1/netcancel";

  const clientOrigin = process.env.APP_URL || process.env.VITE_APP_URL || "http://localhost:3000";

  // 1. Check early abort if 인증 실패
  if (resultCode !== "0000" || !authToken || !authUrl) {
    console.error(`[PAYMENT-CALLBACK] Auth Phase Error info: ${resultCode} - ${resultMsg}`);
    if (supabaseAdmin) {
      await writePaymentLog(supabaseAdmin, oid || null, "FAILED", {
        step: "인증단계(Certification Response)",
        resultCode,
        resultMsg,
        raw_payload: inicisData
      }, {
        error_message: resultMsg || "인증 실패",
        error_code: resultCode
      });
    }
    return {
      statusCode: 302,
      headers: {
        "Location": `/payment/callback?status=fail&message=${encodeURIComponent(resultMsg || "인증 실패")}&oid=${oid || ""}&resultCode=${resultCode || "UNKNOWN"}`
      },
      body: ""
    };
  }

  // Secure verification: Validate authUrl to prevent SSRF and mock server forgery
  if (!authUrl.startsWith("https://stdpay.inicis.com") && !authUrl.startsWith("https://iniapi.inicis.com")) {
    console.error("Unverified authUrl domain:", authUrl);
    return {
      statusCode: 302,
      headers: {
        "Location": `/payment/callback?status=fail&message=${encodeURIComponent("위변조가 의심되는 결제 게이트웨이 도메인입니다.")}&oid=${oid || ""}&resultCode=UNVERIFIED_GATEWAY`
      },
      body: ""
    };
  }

  // 2. Setup dynamic keys
  let mid = inicisData.mid || process.env.INICIS_MID || "";
  let signKey = process.env.INICIS_SIGNKEY || "";

  if (supabaseAdmin) {
    try {
      const { data: settings } = await supabaseAdmin
        .from("payment_settings")
        .select("pg_id, inicis_sign_key")
        .limit(1)
        .maybeSingle();

      if (settings) {
        if (settings.pg_id && !inicisData.mid) mid = settings.pg_id;
        if (settings.inicis_sign_key) signKey = settings.inicis_sign_key;
      }
    } catch (dbSettingsErr: any) {
      console.warn("[PAYMENT-CALLBACK] payment_settings table loading fallback default:", dbSettingsErr.message);
    }
  }

  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").substring(0, 14);
  const authHashTarget = `authToken=${authToken}&timestamp=${timestamp}`;
  const authSignature = crypto.createHash("sha256").update(authHashTarget).digest("hex");

  let authResponseData: any = null;

  try {
    // S2S Auth submission
    const formData = new URLSearchParams();
    formData.append("mid", mid);
    formData.append("authToken", authToken);
    formData.append("timestamp", timestamp);
    formData.append("signature", authSignature);
    formData.append("charset", "UTF-8");
    formData.append("format", "JSON");

    console.log(`[PAYMENT-CALLBACK] Fetching S2S Approval to: ${authUrl}`);
    const response = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString()
    });

    if (!response.ok) {
      throw new Error(`S2S endpoint is unreachable: HTTP status ${response.status}`);
    }

    const resJsonText = await response.text();
    console.log("[PAYMENT-CALLBACK] Raw Approval payload:", resJsonText);
    authResponseData = JSON.parse(resJsonText);

  } catch (apiErr: any) {
    console.error("[PAYMENT-CALLBACK] Error requesting S2S Approval -> Running NetCancel fallback:", apiErr);
    await triggerNetCancel(netCancelUrl, mid, authToken, timestamp, authSignature);
    if (supabaseAdmin) {
      await writePaymentLog(supabaseAdmin, oid || null, "FAILED", {
        step: "최종승인(S2S API Request)",
        error_name: apiErr.name,
        error_message: apiErr.message,
        stack: apiErr.stack,
        netCancelExecuted: true
      }, {
        error_message: "최종 승인 API 통신 중 장애가 발생했습니다.",
        error_code: "S2S_HTTP_ERROR"
      });
    }
    return {
      statusCode: 302,
      headers: {
        "Location": `/payment/callback?status=fail&message=${encodeURIComponent("최종 결제 완료 승인 과정 중 통신 오류가 발생하여 자동 복구 망취소가 수행되었습니다.")}&oid=${oid || ""}&resultCode=S2S_HTTP_ERROR`
      },
      body: ""
    };
  }

  const authResultCode = authResponseData?.resultCode;
  const authResultMsg = authResponseData?.resultMsg || "승인 실패";

  if (authResultCode !== "0000") {
    console.error(`[PAYMENT-CALLBACK] S2S Approval declined: [${authResultCode}] ${authResultMsg}`);
    if (supabaseAdmin) {
      await writePaymentLog(supabaseAdmin, oid || null, "FAILED", {
        step: "이니시스 승인거절(S2S Refusal)",
        resultCode: authResultCode,
        resultMsg: authResultMsg,
        raw_response: authResponseData
      }, {
        error_message: authResultMsg,
        error_code: authResultCode
      });
    }
    return {
      statusCode: 302,
      headers: {
        "Location": `/payment/callback?status=fail&message=${encodeURIComponent(authResultMsg)}&oid=${oid || ""}&resultCode=${authResultCode || "UNKNOWN"}`
      },
      body: ""
    };
  }

  // 3. Complete database transaction
  if (!supabaseAdmin) {
    console.error("[PAYMENT-CALLBACK] Supabase is not available -> NetCancel forced!");
    await triggerNetCancel(netCancelUrl, mid, authToken, timestamp, authSignature);
    return {
      statusCode: 302,
      headers: {
        "Location": `/payment/callback?status=fail&message=${encodeURIComponent("서버 데이터베이스 처리 지연으로 망취소가 실행되었습니다.")}&oid=${oid || ""}&resultCode=DATABASE_MAPPING_ERROR`
      },
      body: ""
    };
  }

  try {
    const { data: orderData, error: findError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("merchant_uid", oid)
      .maybeSingle();

    if (findError) throw findError;
    if (!orderData) {
      throw new Error(`주문 id [${oid}] 정보를 데이터베이스에서 찾을 수 없습니다.`);
    }

    // A. 중복 결제 처리 방지 (Idempotency)
    if (orderData.status === "COMPLETED") {
      console.log(`[PAYMENT-CALLBACK] OID ${oid} is already COMPLETED. Skipping duplicate transition (Idempotency).`);
      return {
        statusCode: 302,
        headers: {
          "Location": `/payment/callback?status=success&oid=${oid}&message=${encodeURIComponent("결제가 완료되었습니다!")}&resultCode=0000`
        },
        body: ""
      };
    }

    // B. 결제 금액 정밀 검증 (Amount Verification)
    const expectedAmount = Number(orderData.amount);
    const receivedAmount = Number(authResponseData?.TotPrice || 0);

    if (expectedAmount !== receivedAmount) {
      console.error(`[PAYMENT-CALLBACK] Amount mismatch! Expected: ${expectedAmount}, Received: ${receivedAmount} -> Running NetCancel fallback!`);
      await triggerNetCancel(netCancelUrl, mid, authToken, timestamp, authSignature);
      if (supabaseAdmin) {
        await writePaymentLog(supabaseAdmin, oid || null, "FAILED", {
          step: "결제금액검증(Amount Verification)",
          expected: expectedAmount,
          received: receivedAmount,
          netCancelExecuted: true
        }, {
          error_message: "위변조가 의심되는 결제 요청입니다 (금액 불일치).",
          error_code: "AMOUNT_MISMATCH"
        });
      }
      return {
        statusCode: 302,
        headers: {
          "Location": `/payment/callback?status=fail&message=${encodeURIComponent("위변조가 의심되는 결제 요청입니다 (금액 불일치).")}&oid=${oid || ""}&resultCode=AMOUNT_MISMATCH`
        },
        body: ""
      };
    }

    // C. Update Order Status
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "COMPLETED",
        updated_at: new Date().toISOString()
      })
      .eq("merchant_uid", oid);

    if (updateError) throw updateError;

    // D. Logs
    try {
      await supabaseAdmin.from("payment_logs").insert([{
        order_id: orderData.id,
        merchant_uid: oid,
        status: "SUCCESS",
        raw_response: JSON.stringify(authResponseData),
        payment_method: authResponseData.payMethod || "CARD",
        amount: Number(authResponseData.TotPrice || orderData.amount),
        created_at: new Date().toISOString()
      }]);
    } catch (logErr) {
      console.warn("[PAYMENT-CALLBACK] payment_logs log failed:", logErr);
      await writePaymentLog(supabaseAdmin, oid, "SUCCESS", authResponseData);
    }

    // E. Grant privileges
    const userId = orderData.user_id;
    const courseId = orderData.course_id;

    if (userId && courseId) {
      try {
        const { data: existingEnroll } = await supabaseAdmin
          .from("course_enrollments")
          .select("id")
          .eq("user_id", userId)
          .eq("course_id", courseId)
          .maybeSingle();

        if (!existingEnroll) {
          await supabaseAdmin.from("course_enrollments").insert([{
            user_id: userId,
            course_id: courseId,
            status: "active",
            enrolled_at: new Date().toISOString()
          }]);
        }
      } catch (enrollErr: any) {
        console.warn("[PAYMENT-CALLBACK] enroll warning:", enrollErr.message);
      }

      try {
        await supabaseAdmin.from("profiles").update({ role: "paid_member" }).eq("id", userId);
      } catch (pErr: any) {
        console.warn("[PAYMENT-CALLBACK] Profile upgrade warning:", pErr.message);
      }
    }

    console.log(`[PAYMENT-CALLBACK] Successfully cleared transaction for Order ID: ${oid}`);
    return {
      statusCode: 302,
      headers: {
        "Location": `/payment/callback?status=success&oid=${oid}&message=${encodeURIComponent("결제가 완료되었습니다!")}&resultCode=0000`
      },
      body: ""
    };

  } catch (dbErr: any) {
    console.error("[PAYMENT-CALLBACK] Error updating database state -> Running Critical NetCancel!", dbErr);
    await triggerNetCancel(netCancelUrl, mid, authToken, timestamp, authSignature);
    if (supabaseAdmin) {
      await writePaymentLog(supabaseAdmin, oid || null, "FAILED", {
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
    return {
      statusCode: 302,
      headers: {
        "Location": `/payment/callback?status=fail&message=${encodeURIComponent("최종 데이터베이스 무결성 마킹 실패로 자동 망취소 환불되었습니다: " + dbErr.message)}&oid=${oid || ""}&resultCode=DATABASE_MAPPING_ERROR`
      },
      body: ""
    };
  }
};

/**
 * NetCancel Netlify Wrapper
 */
async function triggerNetCancel(
  netCancelUrl: string, 
  mid: string, 
  authToken: string, 
  timestamp: string, 
  signature: string
) {
  try {
    const cancelData = new URLSearchParams();
    cancelData.append("mid", mid);
    cancelData.append("authToken", authToken);
    cancelData.append("timestamp", timestamp);
    cancelData.append("signature", signature);
    cancelData.append("charset", "UTF-8");
    cancelData.append("format", "JSON");

    console.warn(`[NETCANCEL-CALLBACK] Executing cancel on API URL: ${netCancelUrl}`);
    const cancelRes = await fetch(netCancelUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: cancelData.toString()
    });

    const responseContent = await cancelRes.text();
    console.warn("[NETCANCEL-CALLBACK] Result payload:", responseContent);
  } catch (err) {
    console.error("[NETCANCEL-CALLBACK] Double connection exception during Mang-Chwisog execution:", err);
  }
}

/**
 * Universal payment logging helper
 */
async function writePaymentLog(
  supabaseAdmin: any,
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
      console.warn("[writePaymentLog] Primary insert failed, executing standard fallback columns:", error.message);
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
    console.warn("[writePaymentLog] Skipped bypass:", err.message);
  }
}
