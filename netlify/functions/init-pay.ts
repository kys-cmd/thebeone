import { Handler } from "@netlify/functions";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Supabase Connection
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey) 
  ? createClient(supabaseUrl, supabaseServiceRoleKey) 
  : null;

export const handler: Handler = async (event) => {
  const allowedOrigin = process.env.APP_URL || process.env.VITE_APP_URL || "*";

  // CORS Preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: "Method Not Allowed" 
    };
  }

  try {
    const { price, oid, timestamp, userId, courseId, orderName } = JSON.parse(event.body || "{}");

    if (!price || !oid || !timestamp) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": allowedOrigin },
        body: JSON.stringify({ status: "error", message: "필수 입력값(price, oid, timestamp)이 누락되었습니다." }),
      };
    }

    // 1. 혹시 orders 데이터베이스에 매칭되는 결제 대기가 없을 시 선제 생성 (상태: PENDING)
    if (supabaseAdmin && userId && courseId) {
      try {
        // 기존 동일 oid(merchant_uid)가 있는지 확인하고 없으면 신규 생성
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
        }
      } catch (dbErr: any) {
        console.error("초기 주문 테이블 생성(PENDING) 에러:", dbErr.message);
      }
    }

    // 2. KG 이니시스 환경변수 로딩 및 기본 테스트 설정 매핑 (데이터베이스 값 우선 적용)
    let mid = process.env.INICIS_MID || process.env.VITE_INICIS_MID || "";
    let signKey = process.env.INICIS_SIGNKEY || "";

    if (supabaseAdmin) {
      try {
        const { data: settings } = await supabaseAdmin
          .from("payment_settings")
          .select("pg_id, inicis_sign_key")
          .limit(1)
          .maybeSingle();

        if (settings) {
          if (settings.pg_id) mid = settings.pg_id;
          if (settings.inicis_sign_key) signKey = settings.inicis_sign_key;
        }
      } catch (dbSettingsErr: any) {
        console.warn("Netlify init-pay: payment_settings 로드 실패 (기본값 설정):", dbSettingsErr.message);
      }
    }

    // 3. 서명 알고리즘 구현 (SHA-256)
    // 공식 매뉴얼: oid=주문번호&price=금액&timestamp=시간값
    const hashTarget = `oid=${oid}&price=${price}&timestamp=${timestamp}`;
    const signature = crypto.createHash("sha256").update(hashTarget).digest("hex");
    const mKey = crypto.createHash("sha256").update(signKey).digest("hex");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify({
        status: "success",
        signature,
        mKey,
        mid,
        oid,
        price,
        timestamp,
      }),
    };
  } catch (error: any) {
    console.error("Signature Initializer Serverless 에러:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ status: "error", message: error.message || "서버 내부 오류가 발생했습니다." }),
    };
  }
};
