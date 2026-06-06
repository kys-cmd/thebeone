import { Handler } from "@netlify/functions";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey) 
  ? createClient(supabaseUrl, supabaseServiceRoleKey) 
  : null;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { price, oid, timestamp, userId, courseId, orderName } = JSON.parse(event.body || "{}");

    if (!price || !oid || !timestamp) {
      return {
        statusCode: 400,
        body: JSON.stringify({ status: "error", message: "Missing required fields" }),
      };
    }

    // 1. Create order in Supabase (Optional but recommended for state tracking)
    if (supabaseAdmin && userId && courseId) {
      try {
        await supabaseAdmin.from("orders").insert([{
          user_id: userId,
          course_id: courseId,
          amount: price,
          status: "PENDING",
          order_name: orderName,
          merchant_uid: oid
        }]);
      } catch (err) {
        console.error("Order creation in Supabase failed:", err);
        // We continue anyway, as payment signature generation is the primary goal
      }
    }

    let mid = process.env.INICIS_MID || process.env.VITE_INICIS_MID || "INIpayTest";
    let signKey = process.env.INICIS_SIGNKEY || process.env.VITE_INICIS_SIGNKEY || "SU5JTElURV9URVNUX1NJR05LRVk=";

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
        console.warn("Netlify payment-sign: payment_settings 로드 실패 (기본값 설정):", dbSettingsErr.message);
      }
    }

    const hashTarget = `oid=${oid}&price=${price}&timestamp=${timestamp}`;
    const signature = crypto.createHash("sha256").update(hashTarget).digest("hex");
    const mKey = crypto.createHash("sha256").update(signKey).digest("hex");

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify({
        status: "success",
        signature,
        mKey,
        mid,
      }),
    };
  } catch (error) {
    console.error("Sign function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ status: "error", message: "Internal Server Error" }),
    };
  }
};
