import { Handler } from "@netlify/functions";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  completeApprovedOrdersAndEnroll,
  safePrepareOrdersForInitPay,
  safeWritePaymentApiLog,
} from "../../src/server/paymentSyncHelper";

// Supabase Connection (supports both SUPABASE_URL and VITE_SUPABASE_URL)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export const handler: Handler = async (event) => {
  const allowedOrigin = process.env.APP_URL || process.env.VITE_APP_URL || "*";
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // CORS Preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ status: "error", message: "Method Not Allowed" }),
    };
  }

  let parsedBody: any = {};
  try {
    parsedBody = JSON.parse(event.body || "{}");
    const { price, oid, timestamp, userId, courseId, items, orderName, mileageUsed } = parsedBody;

    if (price === undefined || price === null || !oid || !timestamp) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          status: "error",
          message: "필수 입력값(price, oid, timestamp)이 누락되었습니다.",
        }),
      };
    }

    await safeWritePaymentApiLog(supabaseAdmin, {
      merchant_uid: oid,
      type: "INIT_PAY_REQ",
      api_url: "/api/init-pay",
      request_data: parsedBody,
      status: "SUCCESS",
    });

    let verifiedPrice = Math.max(0, Math.round(Number(price) || 0));
    let verifiedMileage = Math.max(0, Math.round(Number(mileageUsed) || 0));
    let orderIds: string[] = [];
    let courseIds: string[] = [];

    // 1. 강의 실제 가격 및 사용자 보유 마일리지 검증 + PENDING 주문 영속화
    if (supabaseAdmin && userId && (courseId || (Array.isArray(items) && items.length > 0))) {
      try {
        const prep = await safePrepareOrdersForInitPay(supabaseAdmin, {
          oid,
          price: verifiedPrice,
          userId,
          courseId,
          items,
          orderName,
          mileageUsed: verifiedMileage,
        });
        verifiedPrice = prep.verifiedPrice;
        verifiedMileage = prep.verifiedMileage;
        orderIds = prep.orderIds;
        courseIds = prep.courseIds;
      } catch (prepErr: any) {
        const msg = prepErr?.message || "주문 초기화 중 오류가 발생했습니다.";
        await safeWritePaymentApiLog(supabaseAdmin, {
          merchant_uid: oid,
          type: "ERROR_LOG",
          api_url: "/api/init-pay (Order Prep)",
          request_data: parsedBody,
          status: "FAILED",
          error_code: "ORDER_PREP_ERROR",
          error_message: msg,
        });

        if (msg.includes("마일리지")) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ status: "error", message: msg }),
          };
        }
        console.error("[Netlify init-pay] Order prep error:", msg);
      }

      if (verifiedPrice === 0 && orderIds.length > 0) {
        const { data: preparedOrders } = await supabaseAdmin
          .from("orders")
          .select("*")
          .in("id", orderIds);

        if (preparedOrders && preparedOrders.length > 0) {
          await completeApprovedOrdersAndEnroll(supabaseAdmin, {
            oid,
            orders: preparedOrders,
            approvedAmount: 0,
            authResponseData: {
              resultCode: "0000",
              payMethod: verifiedMileage > 0 ? "MILEAGE" : "FREE",
              tid: `direct_mileage_${oid}`,
              TotPrice: 0,
            },
            isMobileFlow: false,
          });
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              status: "success",
              zeroPriceCompleted: true,
              oid,
              price: 0,
              mileageUsed: verifiedMileage,
              orderIds,
              courseIds,
            }),
          };
        }
      }
    }

    // 2. KG 이니시스 환경변수 로딩 및 DB 설정 우선 적용
    let mid = process.env.INICIS_MID || process.env.VITE_INICIS_MID || "INIpayTest";
    let signKey = process.env.INICIS_SIGNKEY || "SU5JTElURV9UUklQTEVERVNfS0VZU1RS";
    let isSandbox = true;

    if (supabaseAdmin) {
      try {
        const { data: settings } = await supabaseAdmin
          .from("payment_settings")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (settings) {
          if (settings.pg_id) mid = settings.pg_id;
          if (settings.inicis_sign_key) signKey = settings.inicis_sign_key;
          isSandbox = settings.pg_mode ? settings.pg_mode !== "live" : settings.is_sandbox !== false;
        }
      } catch (dbSettingsErr: any) {
        console.warn("Netlify init-pay: payment_settings 로드 실패 (기본값 설정):", dbSettingsErr.message);
      }
    }

    // 3. 서명 알고리즘 구현 (SHA-256): oid=주문번호&price=검증된금액&timestamp=시간값
    const hashTarget = `oid=${oid}&price=${verifiedPrice}&timestamp=${timestamp}`;
    const signature = crypto.createHash("sha256").update(hashTarget).digest("hex");
    const mKey = crypto.createHash("sha256").update(signKey).digest("hex");

    const responsePayload = {
      status: "success",
      signature,
      mKey,
      mid,
      oid,
      price: verifiedPrice,
      mileageUsed: verifiedMileage,
      orderIds,
      courseIds,
      timestamp,
      isSandbox,
    };

    await safeWritePaymentApiLog(supabaseAdmin, {
      orderId: orderIds[0] || null,
      merchant_uid: oid,
      type: "INIT_PAY_RES",
      api_url: "/api/init-pay",
      request_data: parsedBody,
      response_data: responsePayload,
      status: "SUCCESS",
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(responsePayload),
    };
  } catch (error: any) {
    console.error("Signature Initializer Serverless 에러:", error);
    await safeWritePaymentApiLog(supabaseAdmin, {
      merchant_uid: parsedBody?.oid || null,
      type: "ERROR_LOG",
      api_url: "/api/init-pay",
      request_data: parsedBody,
      status: "FAILED",
      error_code: "INIT_PAY_EXCEPTION",
      error_message: error?.message || "서버 내부 오류",
    });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        status: "error",
        message: error.message || "서버 내부 오류가 발생했습니다.",
      }),
    };
  }
};
