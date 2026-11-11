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
    const { price, oid, timestamp, userId, courseId, orderName, mileageUsed } = JSON.parse(event.body || "{}");

    if (price === undefined || price === null || !oid || !timestamp) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": allowedOrigin },
        body: JSON.stringify({ status: "error", message: "필수 입력값(price, oid, timestamp)이 누락되었습니다." }),
      };
    }

    let verifiedPrice = Number(price);
    let safeMileageUsed = Math.max(0, Number(mileageUsed) || 0);

    // 1. 강의 실제 가격 및 사용자 보유 마일리지 검증 + PENDING 주문 연동
    if (supabaseAdmin && userId && courseId) {
      try {
        const [{ data: courseData }, { data: profileData }] = await Promise.all([
          supabaseAdmin.from("courses").select("id, price, title").eq("id", courseId).maybeSingle(),
          supabaseAdmin.from("profiles").select("mileage").eq("id", userId).maybeSingle()
        ]);

        if (courseData && Number(courseData.price) > 0) {
          const coursePrice = Number(courseData.price);
          const availableMileage = Math.max(0, Number(profileData?.mileage) || 0);
          if (safeMileageUsed > availableMileage) {
            return {
              statusCode: 400,
              headers: { "Access-Control-Allow-Origin": allowedOrigin },
              body: JSON.stringify({ status: "error", message: "보유한 마일리지를 초과하여 사용할 수 없습니다." }),
            };
          }
          safeMileageUsed = Math.min(safeMileageUsed, coursePrice);
          const expectedPrice = Math.max(0, coursePrice - safeMileageUsed);
          if (verifiedPrice !== expectedPrice) {
            return {
              statusCode: 400,
              headers: { "Access-Control-Allow-Origin": allowedOrigin },
              body: JSON.stringify({ status: "error", message: "결제 요청 금액이 실제 강의 금액과 일치하지 않습니다." }),
            };
          }
          verifiedPrice = expectedPrice;
        }

        const { data: existingByOid } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("merchant_uid", oid)
          .maybeSingle();

        if (existingByOid) {
          await supabaseAdmin
            .from("orders")
            .update({
              amount: verifiedPrice,
              mileage_used: safeMileageUsed,
              updated_at: new Date().toISOString()
            })
            .eq("id", existingByOid.id);
        } else {
          const { data: existingPending } = await supabaseAdmin
            .from("orders")
            .select("id")
            .eq("user_id", userId)
            .eq("course_id", courseId)
            .eq("status", "PENDING")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingPending) {
            await supabaseAdmin
              .from("orders")
              .update({
                merchant_uid: oid,
                amount: verifiedPrice,
                mileage_used: safeMileageUsed,
                order_name: orderName || courseData?.title || "온라인 강좌 수강권 구매",
                updated_at: new Date().toISOString()
              })
              .eq("id", existingPending.id);
          } else {
            await supabaseAdmin.from("orders").insert([{
              user_id: userId,
              course_id: courseId,
              amount: verifiedPrice,
              status: "PENDING",
              order_name: orderName || courseData?.title || "온라인 강좌 수강권 구매",
              merchant_uid: oid,
              mileage_used: safeMileageUsed,
              created_at: new Date().toISOString()
            }]);
          }
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
