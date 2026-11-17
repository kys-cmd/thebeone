import { Handler } from "@netlify/functions";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import iconv from "iconv-lite";
import {
  completeApprovedOrdersAndEnroll,
  findOrdersForInicisReturn,
  parseInicisMerchantMeta,
  safeInsertPaymentLog,
  safeWritePaymentApiLog,
} from "../../src/server/paymentSyncHelper";

// Initialize Supabase Admin Client (supports both SUPABASE_URL and VITE_SUPABASE_URL)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
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
  if (!utf8Decoded.includes("\uFFFD") && !utf8Decoded.includes("??")) {
    return utf8Decoded;
  }

  try {
    return iconv.decode(buffer, "euc-kr");
  } catch {
    return utf8Decoded;
  }
}

function decodeBuffer(buf: Buffer): Record<string, string> {
  const result: Record<string, string> = {};
  const bodyStr = buf.toString("latin1");
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

function getKstTimestamp14(): string {
  const d = new Date();
  const kstMs = d.getTime() + d.getTimezoneOffset() * 60000 + 9 * 60 * 60 * 1000;
  const kstDate = new Date(kstMs);
  const yyyy = kstDate.getFullYear();
  const MM = String(kstDate.getMonth() + 1).padStart(2, "0");
  const dd = String(kstDate.getDate()).padStart(2, "0");
  const hh = String(kstDate.getHours()).padStart(2, "0");
  const mm = String(kstDate.getMinutes()).padStart(2, "0");
  const ss = String(kstDate.getSeconds()).padStart(2, "0");
  return `${yyyy}${MM}${dd}${hh}${mm}${ss}`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  let inicisData: Record<string, string> = {};
  if (event.body) {
    const bodyBuffer = event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : Buffer.from(event.body, "utf-8");
    inicisData = decodeBuffer(bodyBuffer);
  }
  console.log("[INICIS-RETURN] 인증 시도 결과 수신 데이터:", inicisData);

  const isMobileFlow = !!(inicisData.P_TID && inicisData.P_REQ_URL);

  let oid = inicisData.orderNumber || inicisData.oid || inicisData.P_OID || "";
  let mid = inicisData.mid || process.env.INICIS_MID || "";
  const authToken = inicisData.authToken;
  const authUrl = inicisData.authUrl;
  const netCancelUrl =
    inicisData.netCancelUrl ||
    authUrl?.replace("/auth", "/netCancel") ||
    "https://iniapi.inicis.com/api/v1/netcancel";
  let clientOrigin = "";
  let authResponseData: any = null;
  let timestamp = "";
  let authSignature = "";

  const merchantMeta = parseInicisMerchantMeta(isMobileFlow ? inicisData.P_NOTI : inicisData.merchantData);

  const getSecurePublicUrl = (md: string | null | undefined) => {
    const candidates: string[] = [];
    if (merchantMeta.originUrl) candidates.push(merchantMeta.originUrl);
    if (md) candidates.push(md);

    const fUrl =
      process.env.APP_URL ||
      process.env.VITE_APP_URL ||
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL;
    if (fUrl) candidates.push(fUrl);

    if (event.headers) {
      const forwardedHost = event.headers["x-forwarded-host"] || event.headers["host"];
      const forwardedProto = event.headers["x-forwarded-proto"] || "https";
      if (forwardedHost) {
        candidates.push(`${forwardedProto}://${forwardedHost}`);
      }
      if (event.headers["origin"]) {
        candidates.push(event.headers["origin"]);
      }
      if (event.headers["referer"]) {
        candidates.push(event.headers["referer"]);
      }
    }

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "string") continue;
      const clean = candidate.trim().replace(/\/+$/, "");
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        continue;
      }
      try {
        const parsed = new URL(clean);
        const hostname = parsed.hostname;
        if (
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "0.0.0.0" ||
          hostname.includes("localhost")
        ) {
          continue;
        }
        if (
          hostname.includes("MY_APP_URL") ||
          hostname.includes("your-project") ||
          hostname.includes("inicis.com") ||
          hostname.includes("toss")
        ) {
          continue;
        }
        return `${parsed.protocol}//${parsed.host}`;
      } catch {
        // ignore
      }
    }

    return "";
  };

  if (supabaseAdmin) {
    try {
      const { data: settings } = await supabaseAdmin
        .from("payment_settings")
        .select("pg_id, inicis_sign_key")
        .limit(1)
        .maybeSingle();

      if (settings?.pg_id && !inicisData.mid) {
        mid = settings.pg_id;
      }
    } catch (dbSettingsErr: any) {
      console.warn("Netlify inicis-return: payment_settings 로드 실패 (기본값 설정):", dbSettingsErr.message);
    }
  }

  if (isMobileFlow) {
    // --- MOBILE FLOW ---
    const { P_STATUS, P_RMESG1, P_TID, P_REQ_URL, P_NOTI, P_OID } = inicisData;
    oid = P_OID || oid;
    clientOrigin = getSecurePublicUrl(P_NOTI);

    if (P_STATUS !== "00") {
      console.error(`[INICIS-RETURN] Mobile Auth failed. Status: ${P_STATUS}, Msg: ${P_RMESG1}`);
      await safeWritePaymentApiLog(supabaseAdmin, {
        merchant_uid: oid || null,
        type: "ERROR_LOG",
        api_url: "/api/inicis-return (Mobile Cert)",
        request_data: inicisData,
        status: "FAILED",
        error_code: P_STATUS || "MOBILE_CERT_FAIL",
        error_message: P_RMESG1 || "모바일 인증 실패",
      });
      await safeInsertPaymentLog(supabaseAdmin, {
        merchantUid: oid || null,
        status: "FAILED",
        paymentMethod: "INICIS_MOBILE",
        payloadObj: {
          step: "모바일인증단계(Mobile Certification)",
          P_STATUS,
          P_RMESG1,
          raw_payload: inicisData,
        },
      });
      return {
        statusCode: 302,
        headers: {
          Location: `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(
            P_RMESG1 || "모바일 인증 단계 오류"
          )}&oid=${oid || ""}&resultCode=${P_STATUS || "UNKNOWN"}`,
        },
        body: "",
      };
    }

    // Verify P_REQ_URL domain
    let isVerifiedMobileDomain = false;
    try {
      const parsedReqUrl = new URL(P_REQ_URL);
      if (parsedReqUrl.protocol === "http:" || parsedReqUrl.protocol === "https:") {
        isVerifiedMobileDomain =
          parsedReqUrl.hostname === "inicis.com" || parsedReqUrl.hostname.endsWith(".inicis.com");
      }
    } catch {
      isVerifiedMobileDomain = false;
    }

    if (!isVerifiedMobileDomain) {
      console.error("Unverified Mobile P_REQ_URL domain:", P_REQ_URL);
      return {
        statusCode: 302,
        headers: {
          Location: `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(
            "위변조가 의심되는 모바일 결제 게이트웨이 도메인입니다."
          )}&oid=${oid || ""}&resultCode=UNVERIFIED_GATEWAY`,
        },
        body: "",
      };
    }

    try {
      const approvalForm = new URLSearchParams();
      approvalForm.append("P_MID", mid);
      approvalForm.append("P_TID", P_TID);

      await safeWritePaymentApiLog(supabaseAdmin, {
        merchant_uid: oid || null,
        type: "S2S_APPROVAL_REQ",
        api_url: P_REQ_URL,
        request_data: { P_MID: mid, P_TID },
        status: "SUCCESS",
      });

      const response = await fetch(P_REQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: approvalForm.toString(),
      });

      if (!response.ok) {
        throw new Error(`모바일 이니시스 승인 HTTP 단절: 상태코드 ${response.status}`);
      }

      const resBuffer = Buffer.from(await response.arrayBuffer());
      const appRes = decodeBuffer(resBuffer);
      console.log("[INICIS-RETURN] 모바일 승인 응답 결과:", appRes);

      const finalStatus = appRes.P_STATUS;
      const finalMsg = appRes.P_RMESG1 || "모바일 승인 거절";
      const finalAmt = appRes.P_AMT;
      const finalApprovedOid = appRes.P_OID || oid;

      await safeWritePaymentApiLog(supabaseAdmin, {
        merchant_uid: finalApprovedOid || null,
        type: "S2S_APPROVAL_RES",
        api_url: P_REQ_URL,
        request_data: { P_MID: mid, P_TID },
        response_data: appRes,
        status: finalStatus === "00" ? "SUCCESS" : "FAILED",
        error_code: finalStatus || null,
        error_message: finalMsg || null,
      });

      if (finalStatus !== "00") {
        await safeInsertPaymentLog(supabaseAdmin, {
          merchantUid: finalApprovedOid || null,
          status: "FAILED",
          paymentMethod: "INICIS_MOBILE",
          payloadObj: {
            step: "모바일최종승인(Mobile S2S Refusal)",
            resultCode: finalStatus,
            resultMsg: finalMsg,
            raw_response: appRes,
          },
        });
        return {
          statusCode: 302,
          headers: {
            Location: `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(
              finalMsg
            )}&oid=${finalApprovedOid || ""}&resultCode=${finalStatus || "UNKNOWN"}`,
          },
          body: "",
        };
      }

      const mobileAuthNo = (
        appRes.P_AUTH_NO ||
        appRes.P_AUTH_NUM ||
        appRes.applNum ||
        appRes.AuthCode ||
        ""
      ).trim();

      authResponseData = {
        resultCode: "0000",
        resultMsg: finalMsg,
        TotPrice: finalAmt,
        payMethod: appRes.P_TYPE || "CARD",
        TID: appRes.P_TID || P_TID,
        tid: appRes.P_TID || P_TID,
        mid: mid,
        MOID: finalApprovedOid,
        applNum: mobileAuthNo,
        applNo: mobileAuthNo,
        P_AUTH_NO: mobileAuthNo,
        P_FN_NM: appRes.P_FN_NM || "",
        P_CARD_NUM: appRes.P_CARD_NUM || "",
        P_AUTH_DT: appRes.P_AUTH_DT || "",
        P_EMAIL: appRes.P_EMAIL || inicisData.P_EMAIL || "",
        P_UNAME: appRes.P_UNAME || inicisData.P_UNAME || "",
        P_GOODS: appRes.P_GOODS || inicisData.P_GOODS || "",
        payDevice: "MOBILE",
      };
      oid = finalApprovedOid;
    } catch (apiErr: any) {
      console.error("[INICIS-RETURN] Mobile 승인 API 호출 오류 발생:", apiErr);
      await safeWritePaymentApiLog(supabaseAdmin, {
        merchant_uid: oid || null,
        type: "ERROR_LOG",
        api_url: P_REQ_URL,
        request_data: { P_MID: mid, P_TID },
        status: "FAILED",
        error_code: "MOBILE_S2S_HTTP_ERROR",
        error_message: apiErr?.message || "모바일 S2S 승인 오류",
      });
      await safeInsertPaymentLog(supabaseAdmin, {
        merchantUid: oid || null,
        status: "FAILED",
        paymentMethod: "INICIS_MOBILE",
        payloadObj: {
          step: "모바일최종승인(Mobile S2S API Request)",
          error_name: apiErr.name,
          error_message: apiErr.message,
        },
      });
      return {
        statusCode: 302,
        headers: {
          Location: `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(
            "모바일 결제 승인 통신 도중 일시 오류가 발생했습니다."
          )}&oid=${oid || ""}&resultCode=MOBILE_S2S_HTTP_ERROR`,
        },
        body: "",
      };
    }
  } else {
    // --- PC FLOW ---
    clientOrigin = getSecurePublicUrl(inicisData.merchantData);

    const resultCodeTemp = inicisData.resultCode;
    const resultMsgTemp = inicisData.resultMsg;
    if (resultCodeTemp !== "0000" || !authToken || !authUrl) {
      console.error(`[INICIS-RETURN] 결제 인증 오류: [${resultCodeTemp}] ${resultMsgTemp}`);
      await safeWritePaymentApiLog(supabaseAdmin, {
        merchant_uid: oid || null,
        type: "ERROR_LOG",
        api_url: "/api/inicis-return (PC Cert)",
        request_data: inicisData,
        status: "FAILED",
        error_code: resultCodeTemp || "PC_CERT_FAIL",
        error_message: resultMsgTemp || "인증 단계 오류",
      });
      await safeInsertPaymentLog(supabaseAdmin, {
        merchantUid: oid || null,
        status: "FAILED",
        paymentMethod: "CARD",
        payloadObj: {
          step: "인증단계(Certification Response)",
          resultCode: resultCodeTemp,
          resultMsg: resultMsgTemp,
          raw_payload: inicisData,
        },
      });
      return {
        statusCode: 302,
        headers: {
          Location: `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(
            resultMsgTemp || "인증 단계 오류"
          )}&oid=${oid || ""}&resultCode=${resultCodeTemp || "UNKNOWN"}`,
        },
        body: "",
      };
    }

    let isVerifiedDomain = false;
    try {
      const parsedAuthUrl = new URL(authUrl);
      if (parsedAuthUrl.protocol === "http:" || parsedAuthUrl.protocol === "https:") {
        isVerifiedDomain =
          parsedAuthUrl.hostname === "inicis.com" || parsedAuthUrl.hostname.endsWith(".inicis.com");
      }
    } catch {
      isVerifiedDomain = false;
    }

    if (!isVerifiedDomain) {
      console.error("Unverified authUrl domain:", authUrl);
      return {
        statusCode: 302,
        headers: {
          Location: `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(
            "위변조가 의심되는 결제 게이트웨이 도메인입니다."
          )}&oid=${oid || ""}&resultCode=UNVERIFIED_GATEWAY`,
        },
        body: "",
      };
    }

    timestamp = getKstTimestamp14();
    const authHashTarget = `authToken=${authToken}&timestamp=${timestamp}`;
    authSignature = crypto.createHash("sha256").update(authHashTarget).digest("hex");

    try {
      const formData = new URLSearchParams();
      formData.append("mid", mid);
      formData.append("authToken", authToken);
      formData.append("timestamp", timestamp);
      formData.append("signature", authSignature);
      formData.append("charset", "UTF-8");
      formData.append("format", "JSON");

      await safeWritePaymentApiLog(supabaseAdmin, {
        merchant_uid: oid || null,
        type: "S2S_APPROVAL_REQ",
        api_url: authUrl,
        request_data: { mid, timestamp },
        status: "SUCCESS",
      });

      const response = await fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      if (!response.ok) {
        throw new Error(`이니시스 승인 HTTP 단절: 상태코드 ${response.status}`);
      }

      const resJsonText = await response.text();
      console.log("[INICIS-RETURN] 승인 응답 원본 텍스트:", resJsonText);
      authResponseData = JSON.parse(resJsonText);
      if (authResponseData && typeof authResponseData === "object") {
        const pcApplNum = (
          authResponseData.applNum ||
          authResponseData.CARD_ApplNum ||
          authResponseData.applNo ||
          authResponseData.P_AUTH_NO ||
          authResponseData.AuthCode ||
          ""
        )
          .toString()
          .trim();
        authResponseData.applNum = pcApplNum;
        authResponseData.TID = authResponseData.tid || authResponseData.TID || "";
        authResponseData.tid = authResponseData.tid || authResponseData.TID || "";
        authResponseData.payDevice = "PC";
        if (authResponseData.MOID && !oid) {
          oid = authResponseData.MOID;
        }
      }

      await safeWritePaymentApiLog(supabaseAdmin, {
        merchant_uid: oid || null,
        type: "S2S_APPROVAL_RES",
        api_url: authUrl,
        request_data: { mid, timestamp },
        response_data: authResponseData,
        status: authResponseData?.resultCode === "0000" ? "SUCCESS" : "FAILED",
        error_code: authResponseData?.resultCode || null,
        error_message: authResponseData?.resultMsg || null,
      });
    } catch (apiErr: any) {
      console.error("[INICIS-RETURN] 승인 API 호출 오류 발생 -> 즉시 망취소 수행:", apiErr);
      await triggerNetCancel(supabaseAdmin, oid, netCancelUrl, mid, authToken, timestamp, authSignature);
      await safeInsertPaymentLog(supabaseAdmin, {
        merchantUid: oid || null,
        status: "FAILED",
        paymentMethod: "CARD",
        payloadObj: {
          step: "최종승인(S2S API Request)",
          error_name: apiErr.name,
          error_message: apiErr.message,
          netCancelExecuted: true,
        },
      });
      return {
        statusCode: 302,
        headers: {
          Location: `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(
            "결제 승인 통신 도중 일시 오류가 발생하여 자동 취소(망취소) 처리되었습니다."
          )}&oid=${oid || ""}&resultCode=S2S_HTTP_ERROR`,
        },
        body: "",
      };
    }

    const authResultCode = authResponseData?.resultCode;
    const authResultMsg = authResponseData?.resultMsg || "승인 처리 일시 지연";

    if (authResultCode !== "0000") {
      console.error(`[INICIS-RETURN] 승인 실패 처리: [${authResultCode}] ${authResultMsg}`);
      await safeInsertPaymentLog(supabaseAdmin, {
        merchantUid: oid || null,
        status: "FAILED",
        paymentMethod: authResponseData?.payMethod || "CARD",
        payloadObj: {
          step: "이니시스 거절(S2S Refusal)",
          resultCode: authResultCode,
          resultMsg: authResultMsg,
          raw_response: authResponseData,
        },
      });
      return {
        statusCode: 302,
        headers: {
          Location: `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(
            authResultMsg
          )}&oid=${oid || ""}&resultCode=${authResultCode || "UNKNOWN"}`,
        },
        body: "",
      };
    }
  }

  // 4. Supabase DB 결제 완료 반영 및 수강 권한(enrollments) 발급
  const timestampForCancel = getKstTimestamp14();
  const authHashTargetForCancel = `authToken=${authToken || ""}&timestamp=${timestampForCancel}`;
  const authSignatureForCancel = crypto.createHash("sha256").update(authHashTargetForCancel).digest("hex");

  if (!supabaseAdmin) {
    console.error("[INICIS-RETURN] Supabase 관리자 클라이언트가 초기화되지 않았습니다. 즉시 망취소 수행합니다.");
    if (!isMobileFlow && authToken) {
      await triggerNetCancel(
        null,
        oid,
        netCancelUrl,
        mid,
        authToken,
        timestampForCancel,
        authSignatureForCancel
      );
    }
    return {
      statusCode: 302,
      headers: {
        Location: `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(
          "시스템 DB 연결 설정 누락으로 결제가 취소되었습니다. 관리자에게 문의 바랍니다."
        )}&oid=${oid || ""}&resultCode=DATABASE_MAPPING_ERROR`,
      },
      body: "",
    };
  }

  try {
    const receivedAmount = Number(authResponseData?.TotPrice || 0);

    const matchedOrders = await findOrdersForInicisReturn(supabaseAdmin, {
      oid,
      approvedAmount: receivedAmount,
      authResponseData,
      merchantMeta,
    });

    if (!matchedOrders || matchedOrders.length === 0) {
      throw new Error(`주문 번호 [${oid}] 정보를 데이터베이스에서 찾을 수 없습니다.`);
    }

    // 결제 금액 검증 (다중 장바구니 결제 시 하위 주문 합산 금액 비교)
    const expectedAmount = matchedOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
    if (expectedAmount !== receivedAmount) {
      console.error(
        `[INICIS-RETURN] Amount mismatch! Expected: ${expectedAmount}, Received: ${receivedAmount} -> Running NetCancel!`
      );
      if (!isMobileFlow && authToken) {
        await triggerNetCancel(
          supabaseAdmin,
          oid,
          netCancelUrl,
          mid,
          authToken,
          timestampForCancel,
          authSignatureForCancel
        );
      }
      await safeInsertPaymentLog(supabaseAdmin, {
        orderId: matchedOrders[0]?.id || null,
        merchantUid: oid || null,
        status: "FAILED",
        amount: receivedAmount,
        paymentMethod: authResponseData?.payMethod || "CARD",
        payloadObj: {
          step: "결제금액검증(Amount Verification)",
          expected: expectedAmount,
          received: receivedAmount,
          netCancelExecuted: !isMobileFlow,
        },
      });
      return {
        statusCode: 302,
        headers: {
          Location: `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(
            "위변조가 의심되는 결제 요청입니다 (금액 불일치)."
          )}&oid=${oid || ""}&resultCode=AMOUNT_MISMATCH`,
        },
        body: "",
      };
    }

    await completeApprovedOrdersAndEnroll(supabaseAdmin, {
      oid,
      orders: matchedOrders,
      approvedAmount: receivedAmount,
      authResponseData,
      isMobileFlow,
    });

    console.log(`[INICIS-RETURN] 결제 및 수강 등록 100% 완료! 주문ID: ${oid}`);

    return {
      statusCode: 302,
      headers: {
        Location: `${clientOrigin}/payment/callback?status=success&oid=${oid}&message=${encodeURIComponent(
          "결제가 완료되었습니다!"
        )}&resultCode=0000`,
      },
      body: "",
    };
  } catch (dbErr: any) {
    console.error("[INICIS-RETURN] Supabase DB 처리 중 결정적 오류 발생:", dbErr);
    if (!isMobileFlow && authToken) {
      await triggerNetCancel(
        supabaseAdmin,
        oid,
        netCancelUrl,
        mid,
        authToken,
        timestampForCancel,
        authSignatureForCancel
      );
    }
    await safeWritePaymentApiLog(supabaseAdmin, {
      merchant_uid: oid || null,
      type: "ERROR_LOG",
      api_url: "/api/inicis-return (DB Transition)",
      request_data: { oid, isMobileFlow },
      response_data: authResponseData,
      status: "FAILED",
      error_code: "DATABASE_MAPPING_ERROR",
      error_message: dbErr?.message || "DB 업데이트 실패",
    });
    await safeInsertPaymentLog(supabaseAdmin, {
      merchantUid: oid || null,
      status: "FAILED",
      paymentMethod: isMobileFlow ? "INICIS_MOBILE" : "CARD",
      payloadObj: {
        step: "DB업데이트(Database Update)",
        error_name: dbErr?.name,
        error_message: dbErr?.message,
        netCancelExecuted: !isMobileFlow,
        authResponseData,
      },
    });
    return {
      statusCode: 302,
      headers: {
        Location: `${clientOrigin}/payment/callback?status=fail&message=${encodeURIComponent(
          "데이터베이스 상태 업데이트에 실패했습니다: " + (dbErr?.message || "오류")
        )}&oid=${oid || ""}&resultCode=DATABASE_MAPPING_ERROR`,
      },
      body: "",
    };
  }
};

async function triggerNetCancel(
  sb: any,
  oid: string,
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

    await safeWritePaymentApiLog(sb, {
      merchant_uid: oid || null,
      type: "NET_CANCEL_REQ",
      api_url: netCancelUrl,
      request_data: { mid, timestamp },
      status: "SUCCESS",
    });

    const cancelRes = await fetch(netCancelUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: cancelData.toString(),
    });

    const cancelText = await cancelRes.text();
    console.warn("[NET-CANCEL] 망취소 성공 응답:", cancelText);

    let parsed: any = cancelText;
    try {
      parsed = JSON.parse(cancelText);
    } catch {
      // keep string
    }

    await safeWritePaymentApiLog(sb, {
      merchant_uid: oid || null,
      type: "NET_CANCEL_RES",
      api_url: netCancelUrl,
      response_data: parsed,
      status: "SUCCESS",
    });
  } catch (cancelErr: any) {
    console.error("[NET-CANCEL] 망취소 처리 중 통신 실패:", cancelErr);
    await safeWritePaymentApiLog(sb, {
      merchant_uid: oid || null,
      type: "NET_CANCEL_RES",
      api_url: netCancelUrl,
      status: "FAILED",
      error_message: cancelErr?.message || "망취소 통신 실패",
    });
  }
}
