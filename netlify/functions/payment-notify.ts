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
      // 1. Get the actual order data securely
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("*")
        .or(`id.eq.${oid},merchant_uid.eq.${oid}`)
        .maybeSingle();

      if (orderErr) {
        console.error("Error fetching order via webhook:", orderErr);
      }

      if (order) {
        // 이미 완료된 주문이면 다시 처리하지 않음 (Idempotency)
        const currentStatus = (order.status || "").toUpperCase();
        if (currentStatus === "COMPLETED" || currentStatus === "PAID") {
          console.log(`[Webhook] Order ${oid} is already ${currentStatus}. Skipping.`);
        } else {
          // 2. Update order status in Supabase securely
          const { error: updateErr } = await supabase
            .from("orders")
            .update({ 
              status: "COMPLETED", 
              payment_tid: tid || order.payment_tid,
              payment_method: "inicis",
              updated_at: new Date().toISOString()
            })
            .eq("id", order.id);

          if (updateErr) {
            console.error("Error updating order status in Supabase:", updateErr);
          } else {
            console.log(`Order ${order.id} successfully updated to COMPLETED via webhook notify`);
          }

          // 3. Grant Course Enrollment (자동 수강생 리스트 반영)
          try {
            const { error: enrollmentsError } = await supabase
              .from("enrollments")
              .upsert({
                user_id: order.user_id,
                course_id: order.course_id,
                status: "active",
                created_at: new Date().toISOString()
              }, { onConflict: "user_id, course_id" });

            if (enrollmentsError) {
              console.warn("[Webhook Notify] enrollments upsert missed:", enrollmentsError.message);
            } else {
              console.log("[Webhook Notify] enrollments successfully registered.");
            }
          } catch (enrollmentsErr: any) {
            console.error("[Webhook Notify] enrollments upsert exception:", enrollmentsErr);
          }

          // 4. Grant Duplicate Course Enrollment in course_enrollments table
          try {
            await supabase
              .from("course_enrollments")
              .insert([{
                user_id: order.user_id,
                course_id: order.course_id,
                status: "active",
                enrolled_at: new Date().toISOString()
              }]);
            console.log("[Webhook Notify] course_enrollments registered successfully.");
          } catch (courseEnrollErr: any) {
            console.warn("[Webhook Notify] course_enrollments warning or duplication:", courseEnrollErr.message);
          }

          // 5. Grant Community Membership for any communities linked to this course
          try {
            const { data: linkedCommunities, error: commQueryErr } = await supabase
              .from("communities")
              .select("id")
              .eq("course_id", order.course_id)
              .eq("is_deleted", false);

            if (!commQueryErr && linkedCommunities && linkedCommunities.length > 0) {
              for (const community of linkedCommunities) {
                const { data: existingMember } = await supabase
                  .from("community_members")
                  .select("id")
                  .eq("community_id", community.id)
                  .eq("user_id", order.user_id)
                  .maybeSingle();

                if (!existingMember) {
                  await supabase
                    .from("community_members")
                    .insert([{
                      community_id: community.id,
                      user_id: order.user_id,
                      joined_at: new Date().toISOString(),
                      is_deleted: false
                    }]);
                  console.log(`[Webhook Notify] Added user to community: ${community.id}`);
                }
              }
            }
          } catch (commErr: any) {
            console.error("[Webhook Notify] community allocation error:", commErr);
          }
        }
      } else {
        console.warn(`[Webhook Notify] No equivalent order found for ID/Merchant UID: ${oid}`);
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
