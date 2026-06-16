import { Handler } from "@netlify/functions";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import iconv from "iconv-lite";

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey) 
  ? createClient(supabaseUrl, supabaseServiceRoleKey) 
  : null;

function decodePercentBytes(str: string): string {
  const normalized = str.replace(/\+/g, " ");
  const bytes: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i] === "%" && i + 2 < normalized.length) {
      const hex = normalized.substring(i + 1, i + 3);
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(normalized.charCodeAt(i));
    }
  }
  const buffer = Buffer.from(bytes);
  
  const utf8Decoded = iconv.decode(buffer, "utf-8");
  if (!utf8Decoded.includes("\uFFFD") && !utf8Decoded.includes("??") && !utf8Decoded.includes("")) {
    return utf8Decoded;
  }
  
  try {
    return iconv.decode(buffer, "euc-kr");
  } catch (e) {
    return utf8Decoded;
  }
}

function decodeBuffer(buf: Buffer): Record<string, string> {
  const result: Record<string, string> = {};
  const bodyStr = buf.toString("ascii");
  const pairs = bodyStr.split("&");
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const keyRaw = pair.substring(0, eqIdx);
    const valRaw = pair.substring(eqIdx + 1);
    result[decodePercentBytes(keyRaw)] = decodePercentBytes(valRaw);
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

  // Raw body parsing including safe Base64 decoding and robust dual-charset url-decoding
  let inicisData: Record<string, string> = {};
  if (event.body) {
    const bodyBuffer = event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : Buffer.from(event.body, "utf-8");
    inicisData = decodeBuffer(bodyBuffer);
  }
  console.log("[INICIS-RETURN] 인증 시도 결과 수신 데이터:", inicisData);

  const isMobileFlow = !!(inicisData.P_TID && inicisData.P_REQ_URL);

  let oid = inicisData.orderNumber || inicisData.oid;
  let mid = inicisData.mid || process.env.INICIS_MID || "";
  let authToken = inicisData.authToken;
  let authUrl = inicisData.authUrl;
  let netCancelUrl = inicisData.netCancelUrl || authUrl?.replace("/auth", "/netCancel") || "https://iniapi.inicis.com/api/v1/netcancel";
  let clientOrigin = "";
  let authResponseData: any = null;
  let timestamp = "";
  let authSignature = "";

  // 기본 리디렉션 주소 설정 (환경에 따라 구성 및 localhost 우회)
  const getSecurePublicUrl = (md: string | null | undefined) => {
    const DEV_URL = "https://ais-dev-qbvit3fpjqe4xthteyekz2-553123300253.asia-northeast1.run.app";
    const PRE_URL = "https://ais-pre-qbvit3fpjqe4xthteyekz2-553123300253.asia-northeast1.run.app";

    const candidates: string[] = [];
    if (md) candidates.push(md);
    
    const fUrl = process.env.APP_URL || process.env.VITE_APP_URL;
    if (fUrl) candidates.push(fUrl);

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "string") continue;
      let clean = candidate.trim();
      if (clean.endsWith("/")) {
        clean = clean.slice(0, -1);
      }
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        continue;
      }
      try {
        const parsed = new URL(clean);
        const hostname = parsed.hostname;
        if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname.includes("localhost")) {
          continue;
        }
        if (hostname.includes("MY_APP_URL") || hostname.includes("your-project") || hostname.includes("inicis.com") || hostname.includes("toss")) {
          continue;
        }
        return clean;
      } catch (e) {
        // ignore
      }
    }

    if (md && md.includes("ais-pre")) {
      return PRE_URL;
    }
    return DEV_URL;
  };

  if (supabaseAdmin) {
    try {
      const { data: settings } = await supabaseAdmin
        .from("payment_settings")
        .select("pg_id, inicis_sign_key")
        .limit(1)
        .maybeSingle();

      if (settings) {
        if (settings.pg_id && !inicisData.mid) mid = settings.pg_id;
      }
    } catch (dbSettingsErr: any) {
      console.warn("Netlify inicis-return: payment_settings 로드 실패 (기본값 설정):", dbSettingsErr.message);
    }
  }

  if (isMobileFlow) {
    // --- MOBILE FLOW ---
    const { P_STATUS, P_RMESG1, P_TID, P_REQ_URL, P_NOTI, P_OID } = inicisData;
    oid = P_OID;
    clientOrigin = P_NOTI || getSecurePublicUrl(P_NOTI);

    if (P_STATUS !== "00") {
      console.error(`[INICIS-RETURN] Mobile Auth failed. Status: ${P_STATUS}, Msg: ${P_RMESG1}`);
      if (supabaseAdmin) {
        await writePaymentLog(supabaseAdmin, oid || null, "FAILED", {
          step: "모바일인증단계(Mobile Certification)",
          P_STATUS,
          P_RMESG1,
          raw_payload: inicisData
        }, {
          error_message: P_RMESG1 || "모바일 인증 실패",
          error_code: P_STATUS
        });
      }
      return {
        statusCode: 302,
        headers: {
          "Location": `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(P_RMESG1 || "모바일 인증 과정 오류")}&oid=${oid || ""}&resultCode=${P_STATUS || "UNKNOWN"}`
        },
        body: ""
      };
    }

    try {
      const approvalForm = new URLSearchParams();
      approvalForm.append("P_MID", mid);
      approvalForm.append("P_TID", P_TID);

      console.log(`[INICIS-RETURN] Requesting Mobile S2S Approval to URL: ${P_REQ_URL}`);
      const response = await fetch(P_REQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: approvalForm.toString()
      });

      if (!response.ok) {
        throw new Error(`이니시스 모바일 승인 HTTP 단절: 상태코드 ${response.status}`);
      }

      const resBuffer = Buffer.from(await response.arrayBuffer());
      const appRes = decodeBuffer(resBuffer);
      console.log("[INICIS-RETURN] Mobile Approval Decoded response:", appRes);

      const finalStatus = appRes.P_STATUS;
      const finalMsg = appRes.P_RMESG1 || "승인 실패";
      const finalAmt = appRes.P_AMT;
      const finalApprovedOid = appRes.P_OID || oid;

      if (finalStatus !== "00") {
        if (supabaseAdmin) {
          await writePaymentLog(supabaseAdmin, finalApprovedOid || null, "FAILED", {
            step: "모바일최종승인(Mobile S2S Refusal)",
            resultCode: finalStatus,
            resultMsg: finalMsg,
            raw_response: appRes
          }, {
            error_message: finalMsg,
            error_code: finalStatus
          });
        }
        return {
          statusCode: 302,
          headers: {
            "Location": `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(finalMsg)}&oid=${finalApprovedOid || ""}&resultCode=${finalStatus || "UNKNOWN"}`
          },
          body: ""
        };
      }

      authResponseData = {
        resultCode: "0000",
        resultMsg: finalMsg,
        TotPrice: finalAmt,
        payMethod: appRes.P_TYPE || "CARD",
        TID: appRes.P_TID || P_TID,
        mid: mid,
        MOID: finalApprovedOid
      };
      oid = finalApprovedOid;

    } catch (apiErr: any) {
      console.error("[INICIS-RETURN] Mobile 승인 API 호출 오류 발생:", apiErr);
      if (supabaseAdmin) {
        await writePaymentLog(supabaseAdmin, oid || null, "FAILED", {
          step: "모바일최종승인(Mobile S2S API Request)",
          error_name: apiErr.name,
          error_message: apiErr.message,
          stack: apiErr.stack
        }, {
          error_message: "모바일 결제 승인 API 호출 중 오류 발생",
          error_code: "MOBILE_S2S_HTTP_ERROR"
        });
      }
      return {
        statusCode: 302,
        headers: {
          "Location": `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent("모바일 결제 승인 통신 도중 일시 오류가 발생했습니다.")}&oid=${oid || ""}&resultCode=MOBILE_S2S_HTTP_ERROR`
        },
        body: ""
      };
    }

  } else {
    // --- PC FLOW ---
    clientOrigin = getSecurePublicUrl(inicisData.merchantData);

    // 1. 인증 결과 에러 코드 핸들링
    const resultCodeTemp = inicisData.resultCode;
    const resultMsgTemp = inicisData.resultMsg;
    if (resultCodeTemp !== "0000" || !authToken || !authUrl) {
      console.error(`[INICIS-RETURN] 결제 인증 오류: [${resultCodeTemp}] ${resultMsgTemp}`);
      if (supabaseAdmin) {
        await writePaymentLog(supabaseAdmin, oid || null, "FAILED", {
          step: "인증단계(Certification Response)",
          resultCode: resultCodeTemp,
          resultMsg: resultMsgTemp,
          raw_payload: inicisData
        }, {
          error_message: resultMsgTemp || "인증 단계 오류",
          error_code: resultCodeTemp
        });
      }
      return {
        statusCode: 302,
        headers: {
          "Location": `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(resultMsgTemp || "인증 단계 오류")}&oid=${oid || ""}&resultCode=${resultCodeTemp || "UNKNOWN"}`
        },
        body: ""
      };
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
      console.error("Unverified authUrl domain:", authUrl);
      return {
        statusCode: 302,
        headers: {
          "Location": `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent("위변조가 의심되는 결제 게이트웨이 도메인입니다.")}&oid=${oid || ""}&resultCode=UNVERIFIED_GATEWAY`
        },
        body: ""
      };
    }

    // 2. 최종 승인 요청 (Auth API) 준비
    let signKey = process.env.INICIS_SIGNKEY || "";

    if (supabaseAdmin) {
      try {
        const { data: settings } = await supabaseAdmin
          .from("payment_settings")
          .select("pg_id, inicis_sign_key")
          .limit(1)
          .maybeSingle();

        if (settings) {
          if (settings.inicis_sign_key) signKey = settings.inicis_sign_key;
        }
      } catch (dbSettingsErr: any) {
        console.warn("Netlify inicis-return: payment_settings 로드 실패 (기본값 설정):", dbSettingsErr.message);
      }
    }

    timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").substring(0, 14); // YYYYMMDDHHmmss
    
    // 승인용 시그니처 공식: SHA256(authToken=VALUE&timestamp=VALUE)
    const authHashTarget = `authToken=${authToken}&timestamp=${timestamp}`;
    authSignature = crypto.createHash("sha256").update(authHashTarget).digest("hex");

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
  }

  // 4. Supabase DB 결제 정보 기록 및 후속 처리 (강의수강 권한 업데이트 포함)
  const timestampForCancel = new Date().toISOString().replace(/[-T:.Z]/g, "").substring(0, 14); // YYYYMMDDHHmmss
  const authHashTargetForCancel = `authToken=${authToken || ""}&timestamp=${timestampForCancel}`;
  const authSignatureForCancel = crypto.createHash("sha256").update(authHashTargetForCancel).digest("hex");

  if (!supabaseAdmin) {
    console.error("[INICIS-RETURN] Supabase 관리자 클라이언트가 초기화되지 않았습니다. 즉시 망취소 수행합니다.");
    if (!isMobileFlow) {
      await triggerNetCancel(netCancelUrl, mid, authToken || "", timestampForCancel, authSignatureForCancel);
    }
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

    // A. 중복 결제 처리 방지 (Idempotency)
    if (orderData.status === "COMPLETED") {
      console.log(`[INICIS-RETURN] OID ${oid} is already COMPLETED. Skipping duplicate transition (Idempotency).`);
      return {
        statusCode: 302,
        headers: {
          "Location": `${clientOrigin}/payment/callback?status=success&oid=${oid}&message=${encodeURIComponent("결제가 완료되었습니다!")}&resultCode=0000`
        },
        body: ""
      };
    }

    // B. 결제 금액 정밀 검증 (Amount Verification)
    const expectedAmount = Number(orderData.amount);
    const receivedAmount = Number(authResponseData?.TotPrice || 0);

    if (expectedAmount !== receivedAmount) {
      console.error(`[INICIS-RETURN] Amount mismatch! Expected: ${expectedAmount}, Received: ${receivedAmount} -> Running NetCancel fallback!`);
      if (!isMobileFlow) {
        await triggerNetCancel(netCancelUrl, mid, authToken || "", timestamp, authSignature);
      }
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
          "Location": `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent("위변조가 의심되는 결제 요청입니다 (금액 불일치).")}&oid=${oid || ""}&resultCode=AMOUNT_MISMATCH`
        },
        body: ""
      };
    }

    // C. Orders 테이블 성공 업데이트
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "COMPLETED", // 또는 "SUCCESS"
        updated_at: new Date().toISOString()
      })
      .eq("merchant_uid", oid);

    if (updateError) throw updateError;

    // D. 유실 방지를 위한 결제 성공 로그(payment_logs) 추가 기록
    try {
      const mergedResponse = {
        ...authResponseData,
        merchant_uid: oid
      };
      await supabaseAdmin.from("payment_logs").insert([{
        order_id: orderData.id,
        status: "SUCCESS",
        raw_response: JSON.stringify(mergedResponse),
        payment_method: authResponseData.payMethod || "CARD",
        amount: Number(authResponseData.TotPrice || orderData.amount),
        created_at: new Date().toISOString()
      }]);
    } catch (logErr: any) {
      console.warn("[INICIS-RETURN] payment_logs 로깅 실패 (치명적이진 않음):", logErr.message);
      // Fallback log write
      await writePaymentLog(supabaseAdmin, oid, "SUCCESS", authResponseData);
    }

    // E. 유료 회원 승인 및 강좌권한 추가 비즈니스 로직
    const userId = orderData.user_id;
    const courseId = orderData.course_id;

    if (userId && courseId) {
      // 1) 수강생 전용 권한 생성 및 삽입 (course_enrollments & enrollments 양쪽 모두 처리)
      try {
        const { data: existingEnroll } = await supabaseAdmin
          .from("course_enrollments")
          .select("id")
          .eq("user_id", userId)
          .eq("course_id", courseId)
          .maybeSingle();

        if (!existingEnroll) {
          const { error: enrollError } = await supabaseAdmin
            .from("course_enrollments")
            .insert([{
              user_id: userId,
              course_id: courseId,
              status: "active",
              enrolled_at: new Date().toISOString()
            }]);
          if (enrollError) console.warn("[INICIS-RETURN] course_enrollments 등록 누락:", enrollError.message);
        }
      } catch (enrollErr) {
        console.error("[INICIS-RETURN] enroll 처리 예외 발생:", enrollErr);
      }

      // Calculate expires_at dynamically read from courses table
      let expiresAt: string | null = null;
      try {
        const { data: courseInfo } = await supabaseAdmin
          .from("courses")
          .select("is_duration_based, duration_days")
          .eq("id", courseId)
          .single();
        
        if (courseInfo && courseInfo.is_duration_based && courseInfo.duration_days) {
          const expDate = new Date();
          expDate.setDate(expDate.getDate() + Number(courseInfo.duration_days));
          expiresAt = expDate.toISOString();
        }
      } catch (courseErr) {
        console.warn("[INICIS-RETURN] Failed to calculate course duration, default to infinite:", courseErr);
      }

      try {
        const { error: enrollmentsError } = await supabaseAdmin
          .from("enrollments")
          .upsert({
            user_id: userId,
            course_id: courseId,
            status: "active",
            is_deleted: false,
            expires_at: expiresAt,
            created_at: new Date().toISOString()
          }, { onConflict: "user_id, course_id" });
        if (enrollmentsError) console.warn("[INICIS-RETURN] enrollments 등록 누락:", enrollmentsError.message);
      } catch (enrollmentsErr) {
        console.error("[INICIS-RETURN] enrollments 처리 예외 발생:", enrollmentsErr);
      }

      // 2) 유선 또는 관련 유료 등급(paid_member) 동기화
      try {
        const { data: currentProfile } = await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        const currentRole = currentProfile?.role || "user";
        const isBeOneOrHigher = currentRole === "beone_member" || 
                                currentRole === "bione_member" || 
                                currentRole === "admin" || 
                                currentRole === "super_admin";

        if (!isBeOneOrHigher) {
          await supabaseAdmin
            .from("profiles")
            .update({ role: "paid_member" })
            .eq("id", userId);
          console.log(`[INICIS-RETURN] Upgraded user ${userId} to paid_member`);
        } else {
          console.log(`[INICIS-RETURN] User ${userId} is already ${currentRole}. Retaining role.`);
        }
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
    if (!isMobileFlow) {
      await triggerNetCancel(netCancelUrl, mid, authToken || "", timestamp, authSignature);
    }
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
    let orderAmount = 0;
    let payMethod = "CARD";

    if (oid) {
      const { data: orderData } = await supabaseAdmin
        .from("orders")
        .select("id, amount, payment_method")
        .eq("merchant_uid", oid)
        .maybeSingle();
      if (orderData) {
        orderId = orderData.id;
        orderAmount = Number(orderData.amount) || 0;
        if (orderData.payment_method) {
          payMethod = orderData.payment_method;
        }
      }
    }

    const unifiedResponse = {
      details: errorOrResponse,
      api_additionals: additionals,
      logged_at: new Date().toISOString(),
      merchant_uid: oid
    };

    if (errorOrResponse && typeof errorOrResponse === "object") {
      if (errorOrResponse.TotPrice) {
        orderAmount = Number(errorOrResponse.TotPrice);
      } else if (errorOrResponse.amount) {
        orderAmount = Number(errorOrResponse.amount);
      }
      if (errorOrResponse.payMethod) {
        payMethod = errorOrResponse.payMethod;
      } else if (errorOrResponse.payment_method) {
        payMethod = errorOrResponse.payment_method;
      }
    }

    const payload: any = {
      order_id: orderId,
      status: status,
      raw_response: JSON.stringify(unifiedResponse),
      payment_method: payMethod,
      amount: orderAmount,
      created_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin.from("payment_logs").insert([payload]);
    if (error) {
      console.warn("[writePaymentLog] Unified insert failed:", error.message);
    }
  } catch (err: any) {
    console.warn("[writePaymentLog] Skipped bypass:", err.message);
  }
}

