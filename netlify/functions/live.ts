import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Initialize Supabase Admin using service role key if available, else anon key
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const supabaseAdmin = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export const handler: Handler = async (event) => {
  const allowedOrigin = process.env.APP_URL || process.env.VITE_APP_URL || "*";

  // CORS support
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      },
      body: ""
    };
  }

  const responseHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin
  };

  if (!supabaseAdmin) {
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({ success: false, message: "DB 연결 설정이 올바르지 않습니다." })
    };
  }

  // Determine action from query parameters or path
  const path = (event.path || "").toLowerCase();
  const queryAction = event.queryStringParameters?.action?.toLowerCase();
  let action = queryAction || "";

  if (!action) {
    if (path.includes("/status")) action = "status";
    else if (path.includes("/sessions")) action = "sessions";
    else if (path.includes("/start")) action = "start";
    else if (path.includes("/stop-all")) action = "stop-all";
    else if (path.includes("/stop")) action = "stop";
  }

  const nowIso = new Date().toISOString();

  try {
    // 1. GET STATUS
    if (action === "status" || (event.httpMethod === "GET" && path.endsWith("/status"))) {
      const { data: activeSessions } = await supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("type", "live_session")
        .eq("active", true)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (activeSessions && activeSessions.length > 0) {
        const row = activeSessions[0];
        let parsed: any = {};
        try { parsed = JSON.parse(row.content); } catch { parsed = {}; }

        const session = {
          id: row.id,
          session_id: parsed.session_id || row.id,
          title: row.title || parsed.title || "비원아카데미 라이브",
          embed_code: parsed.embed_code || "",
          chat_enabled: parsed.chat_enabled !== false,
          is_active: true,
          started_at: parsed.started_at || row.created_at,
          start_time_custom: parsed.start_time_custom || "",
          admin_id: parsed.admin_id || "",
          admin_name: parsed.admin_name || "",
          admin_email: parsed.admin_email || "",
          admin_nickname: parsed.admin_nickname || "",
          created_at: row.created_at
        };

        return {
          statusCode: 200,
          headers: responseHeaders,
          body: JSON.stringify({
            isLive: true,
            activeSession: session,
            config: {
              live_is_active: true,
              live_title: session.title,
              live_embed_code: session.embed_code,
              live_chat_enabled: session.chat_enabled,
              live_start_time: session.started_at,
              admin_id: session.admin_id,
              admin_name: session.admin_name,
              admin_email: session.admin_email,
              admin_nickname: session.admin_nickname
            }
          })
        };
      }

      // Check live_config singleton
      const { data: liveConfig } = await supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("type", "live_config")
        .maybeSingle();

      if (liveConfig && liveConfig.content) {
        try {
          const parsed = JSON.parse(liveConfig.content);
          if (parsed.live_is_active === true) {
            return {
              statusCode: 200,
              headers: responseHeaders,
              body: JSON.stringify({
                isLive: true,
                activeSession: null,
                config: parsed
              })
            };
          }
        } catch {}
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          isLive: false,
          activeSession: null,
          config: { live_is_active: false }
        })
      };
    }

    // 2. GET SESSIONS
    if (action === "sessions" || (event.httpMethod === "GET" && path.endsWith("/sessions"))) {
      const { data } = await supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("type", "live_session")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(50);

      const activeSessions: any[] = [];
      const historySessions: any[] = [];

      (data || []).forEach((row) => {
        let parsed: any = {};
        try { parsed = JSON.parse(row.content); } catch { parsed = {}; }

        const session = {
          id: row.id,
          session_id: parsed.session_id || row.id,
          title: row.title || parsed.title || "라이브 방송",
          embed_code: parsed.embed_code || "",
          chat_enabled: parsed.chat_enabled !== false,
          is_active: row.active && parsed.is_active !== false,
          started_at: parsed.started_at || row.created_at,
          start_time_custom: parsed.start_time_custom || "",
          ended_at: parsed.ended_at || null,
          admin_id: parsed.admin_id || "",
          admin_name: parsed.admin_name || "",
          admin_email: parsed.admin_email || "",
          admin_nickname: parsed.admin_nickname || "",
          ended_by_id: parsed.ended_by_id || null,
          ended_by_name: parsed.ended_by_name || null,
          ended_by_email: parsed.ended_by_email || null,
          created_at: row.created_at
        };

        if (session.is_active) {
          activeSessions.push(session);
        } else {
          historySessions.push(session);
        }
      });

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ activeSessions, historySessions })
      };
    }

    // Parse POST body
    let body: any = {};
    if (event.body) {
      try { body = JSON.parse(event.body); } catch {}
    }

    // 3. START LIVE
    if (action === "start") {
      const {
        title,
        embedCode,
        chatEnabled,
        startTime,
        adminId,
        adminName,
        adminEmail,
        adminNickname,
        forceTerminateExisting
      } = body;

      // Check if another live session is already active
      const { data: existingActive } = await supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("type", "live_session")
        .eq("active", true)
        .eq("is_deleted", false);

      const activeSessions: any[] = [];
      (existingActive || []).forEach((row) => {
        let parsed: any = {};
        try { parsed = JSON.parse(row.content); } catch { parsed = {}; }
        activeSessions.push({
          id: row.id,
          session_id: parsed.session_id || row.id,
          title: row.title || parsed.title || "진행 중인 라이브 방송",
          embed_code: parsed.embed_code || "",
          chat_enabled: parsed.chat_enabled !== false,
          is_active: true,
          started_at: parsed.started_at || row.created_at,
          admin_id: parsed.admin_id || "",
          admin_name: parsed.admin_name || "",
          admin_email: parsed.admin_email || "",
          admin_nickname: parsed.admin_nickname || ""
        });
      });

      if (activeSessions.length > 0 && !forceTerminateExisting) {
        return {
          statusCode: 409,
          headers: responseHeaders,
          body: JSON.stringify({
            success: false,
            conflict: true,
            activeSessions,
            message: "현재 이미 진행 중인 라이브 방송이 있습니다. 기존 방송을 종료하고 새로 시작하시겠습니까?"
          })
        };
      }

      // Force terminate previous active sessions
      if (activeSessions.length > 0) {
        for (const act of existingActive || []) {
          let prevContent: any = {};
          try { prevContent = JSON.parse(act.content); } catch { prevContent = {}; }
          prevContent.is_active = false;
          prevContent.ended_at = nowIso;
          prevContent.ended_by_id = adminId || "system";
          prevContent.ended_by_name = adminName || "관리자";
          prevContent.ended_by_email = adminEmail || "";

          await supabaseAdmin
            .from("support_contents")
            .update({
              content: JSON.stringify(prevContent),
              active: false,
              updated_at: nowIso
            })
            .eq("id", act.id);
        }
      }

      // Create new live session record
      const newSessionId = crypto.randomUUID();
      const newSessionData = {
        session_id: newSessionId,
        title: title || "비원아카데미 라이브",
        embed_code: embedCode,
        chat_enabled: chatEnabled !== false,
        is_active: true,
        started_at: nowIso,
        start_time_custom: startTime || "",
        admin_id: adminId || "",
        admin_name: adminName || "관리자",
        admin_email: adminEmail || "",
        admin_nickname: adminNickname || ""
      };

      const { data: insertedRows, error: insertErr } = await supabaseAdmin
        .from("support_contents")
        .insert([{
          type: "live_session",
          title: newSessionData.title,
          content: JSON.stringify(newSessionData),
          active: true,
          is_deleted: false
        }])
        .select();

      if (insertErr) {
        return {
          statusCode: 500,
          headers: responseHeaders,
          body: JSON.stringify({ success: false, message: insertErr.message })
        };
      }

      // Update singleton live_config
      const configPayload = {
        live_is_active: true,
        active_session_id: newSessionId,
        live_title: newSessionData.title,
        live_embed_code: newSessionData.embed_code,
        live_chat_enabled: newSessionData.chat_enabled,
        live_start_time: newSessionData.started_at,
        admin_id: newSessionData.admin_id,
        admin_name: newSessionData.admin_name,
        admin_email: newSessionData.admin_email,
        admin_nickname: newSessionData.admin_nickname,
        updated_at: nowIso
      };

      const { data: existingCfg } = await supabaseAdmin
        .from("support_contents")
        .select("id")
        .eq("type", "live_config")
        .maybeSingle();

      if (existingCfg?.id) {
        await supabaseAdmin
          .from("support_contents")
          .update({
            title: configPayload.live_title,
            content: JSON.stringify(configPayload),
            active: true,
            updated_at: nowIso
          })
          .eq("id", existingCfg.id);
      } else {
        await supabaseAdmin
          .from("support_contents")
          .insert([{
            type: "live_config",
            title: configPayload.live_title,
            content: JSON.stringify(configPayload),
            active: true,
            is_deleted: false
          }]);
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          success: true,
          session: {
            id: insertedRows?.[0]?.id,
            ...newSessionData
          },
          config: configPayload
        })
      };
    }

    // 4. STOP SINGLE LIVE
    if (action === "stop") {
      const { sessionId, adminId, adminName, adminEmail } = body;

      if (sessionId) {
        const { data: targetRows } = await supabaseAdmin
          .from("support_contents")
          .select("*")
          .eq("type", "live_session")
          .eq("id", sessionId);

        if (targetRows && targetRows.length > 0) {
          const row = targetRows[0];
          let parsed: any = {};
          try { parsed = JSON.parse(row.content); } catch { parsed = {}; }
          parsed.is_active = false;
          parsed.ended_at = nowIso;
          parsed.ended_by_id = adminId || "";
          parsed.ended_by_name = adminName || "관리자";
          parsed.ended_by_email = adminEmail || "";

          await supabaseAdmin
            .from("support_contents")
            .update({
              content: JSON.stringify(parsed),
              active: false,
              updated_at: nowIso
            })
            .eq("id", row.id);
        }
      } else {
        // Stop all active
        const { data: allActive } = await supabaseAdmin
          .from("support_contents")
          .select("*")
          .eq("type", "live_session")
          .eq("active", true);

        for (const row of allActive || []) {
          let parsed: any = {};
          try { parsed = JSON.parse(row.content); } catch { parsed = {}; }
          parsed.is_active = false;
          parsed.ended_at = nowIso;
          parsed.ended_by_id = adminId || "";
          parsed.ended_by_name = adminName || "관리자";
          parsed.ended_by_email = adminEmail || "";

          await supabaseAdmin
            .from("support_contents")
            .update({
              content: JSON.stringify(parsed),
              active: false,
              updated_at: nowIso
            })
            .eq("id", row.id);
        }
      }

      // Check remaining
      const { data: remainingActive } = await supabaseAdmin
        .from("support_contents")
        .select("id")
        .eq("type", "live_session")
        .eq("active", true)
        .eq("is_deleted", false);

      const hasRemaining = remainingActive && remainingActive.length > 0;
      if (!hasRemaining) {
        const { data: existingCfg } = await supabaseAdmin
          .from("support_contents")
          .select("id")
          .eq("type", "live_config")
          .maybeSingle();

        if (existingCfg?.id) {
          await supabaseAdmin
            .from("support_contents")
            .update({
              content: JSON.stringify({ live_is_active: false, updated_at: nowIso }),
              active: false,
              updated_at: nowIso
            })
            .eq("id", existingCfg.id);
        }
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          success: true,
          message: "라이브 방송이 성공적으로 종료되었습니다.",
          hasRemaining
        })
      };
    }

    // 5. STOP ALL LIVE
    if (action === "stop-all") {
      const { adminId, adminName, adminEmail } = body;

      const { data: allActive } = await supabaseAdmin
        .from("support_contents")
        .select("*")
        .eq("type", "live_session")
        .eq("active", true);

      let count = 0;
      for (const row of allActive || []) {
        let parsed: any = {};
        try { parsed = JSON.parse(row.content); } catch { parsed = {}; }
        parsed.is_active = false;
        parsed.ended_at = nowIso;
        parsed.ended_by_id = adminId || "";
        parsed.ended_by_name = adminName || "관리자";
        parsed.ended_by_email = adminEmail || "";

        await supabaseAdmin
          .from("support_contents")
          .update({
            content: JSON.stringify(parsed),
            active: false,
            updated_at: nowIso
          })
          .eq("id", row.id);
        count++;
      }

      const { data: existingCfg } = await supabaseAdmin
        .from("support_contents")
        .select("id")
        .eq("type", "live_config")
        .maybeSingle();

      if (existingCfg?.id) {
        await supabaseAdmin
          .from("support_contents")
          .update({
            content: JSON.stringify({ live_is_active: false, updated_at: nowIso }),
            active: false,
            updated_at: nowIso
          })
          .eq("id", existingCfg.id);
      }

      return {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({
          success: true,
          count,
          message: "모든 라이브 방송이 성공적으로 종료되었습니다."
        })
      };
    }

    return {
      statusCode: 404,
      headers: responseHeaders,
      body: JSON.stringify({ success: false, message: `지원되지 않는 라이브 액션입니다: ${action}` })
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({ success: false, message: err.message || "서버 처리 중 오류가 발생했습니다." })
    };
  }
};
