import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin (requires service role key in Netlify Env Vars)
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

export const handler: Handler = async (event) => {
  // Inicis notifies via POST with form-urlencoded data
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // Parse form-urlencoded body
    const params = new URLSearchParams(event.body || "");
    const resCode = params.get("resCode");
    const resMsg = params.get("resMsg");
    const oid = params.get("orderNumber"); // or oid depending on Inicis param name
    const tid = params.get("tid");

    console.log("Inicis Notification received:", { resCode, resMsg, oid, tid });

    if (resCode === "0000" && supabase && oid) {
      // Update order status in Supabase
      const { error } = await supabase
        .from("orders")
        .update({ 
          status: "paid", 
          payment_tid: tid,
          payment_method: "inicis",
          updated_at: new Date().toISOString()
        })
        .eq("id", oid);

      if (error) {
        console.error("Error updating order status in Supabase:", error);
      } else {
        console.log(`Order ${oid} successfully updated to paid`);
      }
    }

    // Inicis expects an "OK" response
    return {
      statusCode: 200,
      body: "OK",
    };
  } catch (error) {
    console.error("Notify function error:", error);
    return {
      statusCode: 200, // Still return 200 to Inicis to stop retries, but log error
      body: "ERROR",
    };
  }
};
