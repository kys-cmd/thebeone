import { Handler } from "@netlify/functions";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey) 
  ? createClient(supabaseUrl, supabaseServiceRoleKey) 
  : null;

/**
 * URL QueryString 이나 Form-URLEncoded 된 문자열을 Key-Value 오브젝트로 파싱합니다.
 */
function parseUrlEncoded(bodyStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  const params = new URLSearchParams(bodyStr);
  for (const [key, val] of params.entries()) {
    result[key] = val;
  }
  return result;
}

export const handler: Handler = async (event) => {
  // KG이니시스는 결과값을 POST 요청(Content-Type: application/x-www-form-urlencoded)으로 전달합니다.
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  // Raw body 파싱
  let decodedBody = "";
  if (event.body) {
    decodedBody = event.isBase64Encoded 
      ? Buffer.from(event.body, "base64").toString("utf-8")
      : event.body;
  }

  const inicisData = parseUrlEncoded(decodedBody);
  console.log("[INICIS-RETURN] 인증 시도 결과 수신 데이터:", inicisData);

  const resultCode = inicisData.resultCode; // '0000' 성공
  const resultMsg = inicisData.resultMsg;
  let mid = inicisData.mid || process.env.INICIS_MID || "INIpayTest";
  const oid = inicisData.orderNumber || inicisData.oid;
  const authToken = inicisData.authToken;
  const authUrl = inicisData.authUrl;
  const netCancelUrl = inicisData.netCancelUrl || authUrl?.replace("/auth", "/netCancel") || "https://iniapi.inicis.com/api/v1/netcancel";

  // 기본 리디렉션 주소 설정 (환경에 따라 구성)
  const clientOrigin = process.env.APP_URL || process.env.VITE_APP_URL || "http://localhost:3000";

  // 1. 인증 결과 에러 코드 핸들링
  if (resultCode !== "0000" || !authToken || !authUrl) {
    console.error(`[INICIS-RETURN] 결제 인증 오류: [${resultCode}] ${resultMsg}`);
    if (supabaseAdmin) {
      await writePaymentLog(supabaseAdmin, oid || null, "FAILED", {
        step: "인증단계(Certification Response)",
        resultCode,
        resultMsg,
        raw_payload: inicisData
      }, {
        error_message: resultMsg || "인증 단계 오류",
        error_code: resultCode
      });
    }
    return {
      statusCode: 302,
      headers: {
        "Location": `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(resultMsg || "인증 단계 오류")}&oid=${oid || ""}&resultCode=${resultCode || "UNKNOWN"}`
      },
      body: ""
    };
  }

  // 2. 최종 승인 요청 (Auth API) 준비
  let signKey = process.env.INICIS_SIGNKEY || "SU5JTElURV9URVNUX1NJR05LRVk=";

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
      console.warn("Netlify inicis-return: payment_settings 로드 실패 (기본값 설정):", dbSettingsErr.message);
    }
  }

  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").substring(0, 14); // YYYYMMDDHHmmss
  
  // 승인용 시그니처 공식: SHA256(authToken=VALUE&timestamp=VALUE)
  const authHashTarget = `authToken=${authToken}&timestamp=${timestamp}`;
  const authSignature = crypto.createHash("sha256").update(authHashTarget).digest("hex");

  let authResponseData: any = null;

  try {
    // 승인 API 호출 (Server to Server)
    const formData = new URLSearchParams();
    formData.append("mid", mid);
    formData.append("authToken", authToken);
    formData.append("timestamp", timestamp);
    formData.append("signature", authSignature);
    formData.append("charset", "UTF-8");
    formData.append("format", "JSON");

    console.log(`[INICIS-RETURN] 승인 서버투서버 호출 URL: ${authUrl}, Params:`, formData.toString());

    const response = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });

    if (!response.ok) {
      throw new Error(`이니시스 승인 HTTP 단절: 상태코드 ${response.status}`);
    }

    const resJsonText = await response.text();
    console.log("[INICIS-RETURN] 승인 응답 원본 텍스트:", resJsonText);
    authResponseData = JSON.parse(resJsonText);

  } catch (apiErr: any) {
    console.error("[INICIS-RETURN] 승인 API 호출 오류 발생 -> 즉시 망취소 수행:", apiErr);
    await triggerNetCancel(netCancelUrl, mid, authToken, timestamp, authSignature);
    if (supabaseAdmin) {
      await writePaymentLog(supabaseAdmin, oid || null, "FAILED", {
        step: "최종승인(S2S API Request)",
        error_name: apiErr.name,
        error_message: apiErr.message,
        stack: apiErr.stack,
        netCancelExecuted: true
      }, {
        error_message: "결제 승인 API 호출 중 오류 발생",
        error_code: "S2S_HTTP_ERROR"
      });
    }
    return {
      statusCode: 302,
      headers: {
        "Location": `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent("결제 승인 통신 도중 일시 오류가 발생하여 자동 취소(망취소) 처리되었습니다.")}&oid=${oid || ""}&resultCode=S2S_HTTP_ERROR`
      },
      body: ""
    };
  }

  // 3. 승인 응답 파싱 및 성공 검사
  // 공식 매뉴얼 상 승인 성공 여부도 상점아이디별 리턴값 체크 필요 (대개 resultCode === '0000')
  const authResultCode = authResponseData?.resultCode;
  const authResultMsg = authResponseData?.resultMsg || "승인 처리 일시 지연";

  if (authResultCode !== "0000") {
    console.error(`[INICIS-RETURN] 승인 실패 처리: [${authResultCode}] ${authResultMsg}`);
    if (supabaseAdmin) {
      await writePaymentLog(supabaseAdmin, oid || null, "FAILED", {
        step: "이니시스 거절(S2S Refusal)",
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
        "Location": `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(authResultMsg)}&oid=${oid || ""}&resultCode=${authResultCode || "UNKNOWN"}`
      },
      body: ""
    };
  }

  // 4. Supabase DB 결제 정보 기록 및 후속 처리 (강의수강 권한 업데이트 포함)
  if (!supabaseAdmin) {
    console.error("[INICIS-RETURN] Supabase 관리자 클라이언트가 초기화되지 않았습니다. 즉시 망취소 수행합니다.");
    await triggerNetCancel(netCancelUrl, mid, authToken, timestamp, authSignature);
    return {
      statusCode: 302,
      headers: {
        "Location": `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent("시스템 DB 점검 중으로 결제 망취소가 실행되었습니다. 관리자에게 문의 바랍니다.")}&oid=${oid || ""}&resultCode=DATABASE_MAPPING_ERROR`
      },
      body: ""
    };
  }

  try {
    // 먼저 오더 데이터 조회
    const { data: orderData, error: findError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("merchant_uid", oid)
      .maybeSingle();

    if (findError) throw findError;

    if (!orderData) {
      throw new Error(`주문 id [${oid}] 정보를 데이터베이스에서 찾을 수 없습니다.`);
    }

    // A. Orders 테이블 성공 업데이트
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "COMPLETED", // 또는 "SUCCESS"
        updated_at: new Date().toISOString()
      })
      .eq("merchant_uid", oid);

    if (updateError) throw updateError;

    // B. 유실 방지를 위한 결제 성공 로그(payment_logs) 추가 기록
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
    } catch (logErr: any) {
      console.warn("[INICIS-RETURN] payment_logs 로깅 실패 (치명적이진 않음):", logErr.message);
      // Fallback log write
      await writePaymentLog(supabaseAdmin, oid, "SUCCESS", authResponseData);
    }

    // C. 유료 회원 승인 및 강좌권한 추가 비즈니스 로직
    const userId = orderData.user_id;
    const courseId = orderData.course_id;

    if (userId && courseId) {
      // 1) 수강생 전용 권한 생성 및 삽입
      try {
        const { error: enrollError } = await supabaseAdmin
          .from("course_enrollments")
          .insert([{
            user_id: userId,
            course_id: courseId,
            status: "active",
            enrolled_at: new Date().toISOString()
          }]);
        if (enrollError) console.warn("[INICIS-RETURN] course_enrollments 등록 누락(이미 수강 중일 수 있음):", enrollError.message);
      } catch (enrollErr) {
        console.error("[INICIS-RETURN] enroll 처리 예외 발생:", enrollErr);
      }

      // 2) 유선 또는 관련 유료 등급(paid_member) 동기화
      try {
        await supabaseAdmin
          .from("profiles")
          .update({ role: "paid_member" })
          .eq("id", userId);
      } catch (profileErr) {
        console.warn("[INICIS-RETURN] profile 롤 변경 생략:", profileErr);
      }
    }

    console.log(`[INICIS-RETURN] 결제 및 처리 작업 100% 완료! 주문ID: ${oid}`);

    // 성공 완료시 성공 페이지 리디렉션
    return {
      statusCode: 302,
      headers: {
        "Location": `${clientOrigin}/payment/callback?status=success&oid=${oid}&message=${encodeURIComponent("결제가 완료되었습니다!")}&resultCode=0000`
      },
      body: ""
    };

  } catch (dbErr: any) {
    console.error("[INICIS-RETURN] Supabase DB 처리 중 결정적 오류 발생 -> 망취소 강력 수행!!", dbErr);
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
        "Location": `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent("데이터베이스 상태 업데이트에 실패하여 승인이 자동 망취소 환불 처리되었습니다: " + dbErr.message)}&oid=${oid || ""}&resultCode=DATABASE_MAPPING_ERROR`
      },
      body: ""
    };
  }
};

/**
 * 이니시스 자동 망취소(NetCancel) 함수
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

    console.log(`[NETCANCEL] 망취소 통신 요청 실행 주소: ${netCancelUrl}`);
    const cancelRes = await fetch(netCancelUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: cancelData.toString()
    });

    const bodyText = await cancelRes.text();
    console.log("[NETCANCEL] 망취소 처리 결과 응답:", bodyText);
  } catch (cancelErr: any) {
    console.error("[NETCANCEL] 크리티컬: 망취소 호출 중에도 네트워크 전송 에러 발생함!", cancelErr);
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

