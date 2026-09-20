import { supabase } from '@/lib/supabase';
import { safeResponseJson } from '@/lib/safeFetch';

export interface LiveSession {
  id: string; // DB primary key (support_contents id)
  session_id: string;
  title: string;
  embed_code: string;
  chat_enabled: boolean;
  is_active: boolean;
  started_at: string;
  start_time_custom?: string;
  ended_at?: string | null;
  admin_id: string;
  admin_name: string;
  admin_email: string;
  admin_nickname?: string;
  ended_by_id?: string | null;
  ended_by_name?: string | null;
  ended_by_email?: string | null;
  created_at?: string;
}

export interface LiveStatusResponse {
  isLive: boolean;
  activeSession: LiveSession | null;
  config: {
    live_is_active: boolean;
    live_title?: string;
    live_embed_code?: string;
    live_chat_enabled?: boolean;
    live_start_time?: string;
    admin_id?: string;
    admin_name?: string;
    admin_email?: string;
    admin_nickname?: string;
  };
}

export const liveService = {
  // Clear all client-side cached live state
  clearLiveCache(): void {
    try {
      localStorage.removeItem('beone_live_config');
      localStorage.setItem('beone_live_config', JSON.stringify({ live_is_active: false }));
      sessionStorage.removeItem('beone_live_config');
    } catch (e) {
      console.warn('[liveService] Error clearing live cache:', e);
    }
  },

  // Get current live status
  async getLiveStatus(): Promise<LiveStatusResponse> {
    try {
      const res = await fetch('/api/live/status');
      if (res.ok) {
        const data = await safeResponseJson<LiveStatusResponse | null>(res, null);
        if (data) {
          if (!data.isLive) {
            this.clearLiveCache();
          } else {
            try {
              localStorage.setItem('beone_live_config', JSON.stringify(data.config || { live_is_active: true }));
            } catch (e) {
              // ignore
            }
          }
          return data;
        }
      }
    } catch (apiErr) {
      console.warn('[liveService] Failed to fetch /api/live/status, using Supabase fallback:', apiErr);
    }

    // Supabase direct fallback
    try {
      const { data: activeSessions } = await supabase
        .from('support_contents')
        .select('*')
        .eq('type', 'live_session')
        .eq('active', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (activeSessions && activeSessions.length > 0) {
        const sessionRow = activeSessions[0];
        let parsedContent: any = {};
        try {
          parsedContent = JSON.parse(sessionRow.content);
        } catch (e) {
          parsedContent = {};
        }

        const session: LiveSession = {
          id: sessionRow.id,
          session_id: parsedContent.session_id || sessionRow.id,
          title: sessionRow.title || parsedContent.title || '비원아카데미 라이브',
          embed_code: parsedContent.embed_code || '',
          chat_enabled: parsedContent.chat_enabled !== false,
          is_active: true,
          started_at: parsedContent.started_at || sessionRow.created_at,
          start_time_custom: parsedContent.start_time_custom || '',
          admin_id: parsedContent.admin_id || '',
          admin_name: parsedContent.admin_name || '',
          admin_email: parsedContent.admin_email || '',
          admin_nickname: parsedContent.admin_nickname || '',
          created_at: sessionRow.created_at
        };

        return {
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
        };
      }

      // Check live_config singleton
      const { data: liveConfig } = await supabase
        .from('support_contents')
        .select('*')
        .eq('type', 'live_config')
        .maybeSingle();

      if (liveConfig && liveConfig.content) {
        try {
          const parsed = JSON.parse(liveConfig.content);
          if (parsed.live_is_active === true) {
            return {
              isLive: true,
              activeSession: null,
              config: parsed
            };
          }
        } catch (e) {
          // ignore
        }
      }

      this.clearLiveCache();
      return {
        isLive: false,
        activeSession: null,
        config: { live_is_active: false }
      };
    } catch (dbErr) {
      console.error('[liveService] Fallback DB query failed:', dbErr);
      return {
        isLive: false,
        activeSession: null,
        config: { live_is_active: false }
      };
    }
  },

  // Get active sessions and past history
  async getSessions(): Promise<{ activeSessions: LiveSession[]; historySessions: LiveSession[] }> {
    try {
      const res = await fetch('/api/live/sessions');
      if (res.ok) {
        const parsed = await safeResponseJson<{ activeSessions: LiveSession[]; historySessions: LiveSession[] } | null>(res, null);
        if (parsed) return parsed;
      }
    } catch (e) {
      console.warn('[liveService] /api/live/sessions failed, using Supabase fallback:', e);
    }

    try {
      const { data } = await supabase
        .from('support_contents')
        .select('*')
        .eq('type', 'live_session')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);

      const activeSessions: LiveSession[] = [];
      const historySessions: LiveSession[] = [];

      (data || []).forEach((row) => {
        let parsed: any = {};
        try {
          parsed = JSON.parse(row.content);
        } catch (err) {
          parsed = {};
        }

        const session: LiveSession = {
          id: row.id,
          session_id: parsed.session_id || row.id,
          title: row.title || parsed.title || '라이브 방송',
          embed_code: parsed.embed_code || '',
          chat_enabled: parsed.chat_enabled !== false,
          is_active: row.active && parsed.is_active !== false,
          started_at: parsed.started_at || row.created_at,
          start_time_custom: parsed.start_time_custom || '',
          ended_at: parsed.ended_at || null,
          admin_id: parsed.admin_id || '',
          admin_name: parsed.admin_name || '',
          admin_email: parsed.admin_email || '',
          admin_nickname: parsed.admin_nickname || '',
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

      return { activeSessions, historySessions };
    } catch (err) {
      console.error('[liveService] getSessions error:', err);
      return { activeSessions: [], historySessions: [] };
    }
  },

  // Start live stream with resilient API call and Supabase direct fallback
  async startLive(params: {
    title: string;
    embedCode: string;
    chatEnabled: boolean;
    startTime?: string;
    adminId: string;
    adminName: string;
    adminEmail: string;
    adminNickname?: string;
    forceTerminateExisting?: boolean;
  }): Promise<{ success: boolean; conflict?: boolean; activeSessions?: LiveSession[]; session?: LiveSession; config?: any; message?: string }> {
    // 1. Try API endpoint first
    try {
      const res = await fetch('/api/live/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        const json = await safeResponseJson(res, null);
        if (json && json.success) {
          try {
            if (json.config) {
              localStorage.setItem('beone_live_config', JSON.stringify(json.config));
            }
          } catch (e) {}
          return json;
        }
      } else if (res.status === 409) {
        const json = await safeResponseJson(res, null);
        if (json && json.conflict) {
          return json;
        }
      } else {
        console.warn(`[liveService] /api/live/start returned status ${res.status}. Falling back to Supabase direct write.`);
      }
    } catch (apiErr) {
      console.warn('[liveService] /api/live/start request failed, falling back to Supabase direct write:', apiErr);
    }

    // 2. Resilient Direct Supabase Fallback (handles Netlify, static SPA, or missing API backend)
    try {
      console.log('[liveService] Executing startLive via direct Supabase fallback...');
      // Check existing active sessions
      const { data: existingActive, error: fetchErr } = await supabase
        .from('support_contents')
        .select('*')
        .eq('type', 'live_session')
        .eq('active', true)
        .eq('is_deleted', false);

      if (fetchErr) {
        console.warn('[liveService] Error checking existing live sessions:', fetchErr);
      }

      const activeSessions: LiveSession[] = [];
      (existingActive || []).forEach((row) => {
        let parsed: any = {};
        try { parsed = JSON.parse(row.content); } catch { parsed = {}; }
        activeSessions.push({
          id: row.id,
          session_id: parsed.session_id || row.id,
          title: row.title || parsed.title || '진행 중인 라이브 방송',
          embed_code: parsed.embed_code || '',
          chat_enabled: parsed.chat_enabled !== false,
          is_active: true,
          started_at: parsed.started_at || row.created_at,
          start_time_custom: parsed.start_time_custom || '',
          admin_id: parsed.admin_id || '',
          admin_name: parsed.admin_name || '',
          admin_email: parsed.admin_email || '',
          admin_nickname: parsed.admin_nickname || ''
        });
      });

      // Conflict detection
      if (activeSessions.length > 0 && !params.forceTerminateExisting) {
        return {
          success: false,
          conflict: true,
          activeSessions,
          message: '현재 이미 진행 중인 라이브 방송이 있습니다. 기존 방송을 종료하고 새로 시작하시겠습니까?'
        };
      }

      const nowIso = new Date().toISOString();

      // Terminate previous if forceTerminateExisting
      if (activeSessions.length > 0) {
        for (const act of existingActive || []) {
          let prevContent: any = {};
          try { prevContent = JSON.parse(act.content); } catch { prevContent = {}; }
          prevContent.is_active = false;
          prevContent.ended_at = nowIso;
          prevContent.ended_by_id = params.adminId || 'system';
          prevContent.ended_by_name = params.adminName || '관리자';
          prevContent.ended_by_email = params.adminEmail || '';

          await supabase
            .from('support_contents')
            .update({
              content: JSON.stringify(prevContent),
              active: false,
              updated_at: nowIso
            })
            .eq('id', act.id);
        }
      }

      // Insert new session record
      const newSessionId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

      const newSessionData = {
        session_id: newSessionId,
        title: params.title || '비원아카데미 라이브',
        embed_code: params.embedCode,
        chat_enabled: params.chatEnabled !== false,
        is_active: true,
        started_at: nowIso,
        start_time_custom: params.startTime || '',
        admin_id: params.adminId || '',
        admin_name: params.adminName || '관리자',
        admin_email: params.adminEmail || '',
        admin_nickname: params.adminNickname || ''
      };

      const { data: insertedRows, error: insertErr } = await supabase
        .from('support_contents')
        .insert([{
          type: 'live_session',
          title: newSessionData.title,
          content: JSON.stringify(newSessionData),
          active: true,
          is_deleted: false
        }])
        .select();

      if (insertErr) {
        console.error('[liveService] Supabase insert error:', insertErr);
        return { success: false, message: insertErr.message || '라이브 세션 저장 중 오류가 발생했습니다.' };
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

      try {
        localStorage.setItem('beone_live_config', JSON.stringify(configPayload));
      } catch (e) {}

      const { data: existingCfg } = await supabase
        .from('support_contents')
        .select('id')
        .eq('type', 'live_config')
        .maybeSingle();

      if (existingCfg?.id) {
        await supabase
          .from('support_contents')
          .update({
            title: configPayload.live_title,
            content: JSON.stringify(configPayload),
            active: true,
            updated_at: nowIso
          })
          .eq('id', existingCfg.id);
      } else {
        await supabase
          .from('support_contents')
          .insert([{
            type: 'live_config',
            title: configPayload.live_title,
            content: JSON.stringify(configPayload),
            active: true,
            is_deleted: false
          }]);
      }

      return {
        success: true,
        session: {
          id: insertedRows?.[0]?.id || newSessionId,
          ...newSessionData
        },
        config: configPayload
      };
    } catch (fallbackErr: any) {
      console.error('[liveService] startLive direct Supabase error:', fallbackErr);
      return { success: false, message: fallbackErr.message || '라이브 시작 중 오류가 발생했습니다.' };
    }
  },

  // Stop specific live session with API call & Supabase fallback
  async stopLive(params: {
    sessionId: string;
    adminId?: string;
    adminName?: string;
    adminEmail?: string;
  }): Promise<{ success: boolean; message?: string }> {
    this.clearLiveCache();
    
    // 1. Try API endpoint
    try {
      const res = await fetch('/api/live/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        const json = await safeResponseJson(res, null);
        if (json && json.success) {
          this.clearLiveCache();
          return json;
        }
      }
    } catch (apiErr) {
      console.warn('[liveService] /api/live/stop request failed, using Supabase fallback:', apiErr);
    }

    // 2. Direct Supabase Fallback
    try {
      const nowIso = new Date().toISOString();
      if (params.sessionId) {
        const { data: targetRows } = await supabase
          .from('support_contents')
          .select('*')
          .eq('type', 'live_session')
          .eq('id', params.sessionId);

        if (targetRows && targetRows.length > 0) {
          const row = targetRows[0];
          let parsed: any = {};
          try { parsed = JSON.parse(row.content); } catch { parsed = {}; }
          parsed.is_active = false;
          parsed.ended_at = nowIso;
          parsed.ended_by_id = params.adminId || '';
          parsed.ended_by_name = params.adminName || '관리자';
          parsed.ended_by_email = params.adminEmail || '';

          await supabase
            .from('support_contents')
            .update({
              content: JSON.stringify(parsed),
              active: false,
              updated_at: nowIso
            })
            .eq('id', row.id);
        }
      } else {
        const { data: allActive } = await supabase
          .from('support_contents')
          .select('*')
          .eq('type', 'live_session')
          .eq('active', true);

        for (const row of allActive || []) {
          let parsed: any = {};
          try { parsed = JSON.parse(row.content); } catch { parsed = {}; }
          parsed.is_active = false;
          parsed.ended_at = nowIso;
          parsed.ended_by_id = params.adminId || '';
          parsed.ended_by_name = params.adminName || '관리자';
          parsed.ended_by_email = params.adminEmail || '';

          await supabase
            .from('support_contents')
            .update({
              content: JSON.stringify(parsed),
              active: false,
              updated_at: nowIso
            })
            .eq('id', row.id);
        }
      }

      // Check if other active sessions remain
      const { data: remainingActive } = await supabase
        .from('support_contents')
        .select('id')
        .eq('type', 'live_session')
        .eq('active', true)
        .eq('is_deleted', false);

      if (!remainingActive || remainingActive.length === 0) {
        this.clearLiveCache();
        const { data: existingCfg } = await supabase
          .from('support_contents')
          .select('id')
          .eq('type', 'live_config')
          .maybeSingle();

        if (existingCfg?.id) {
          await supabase
            .from('support_contents')
            .update({
              content: JSON.stringify({ live_is_active: false, updated_at: nowIso }),
              active: false,
              updated_at: nowIso
            })
            .eq('id', existingCfg.id);
        }
      }

      this.clearLiveCache();
      return { success: true, message: '라이브 방송이 종료되었습니다.' };
    } catch (fallbackErr: any) {
      console.error('[liveService] stopLive fallback error:', fallbackErr);
      this.clearLiveCache();
      return { success: false, message: fallbackErr.message || '라이브 종료 중 오류가 발생했습니다.' };
    }
  },

  // Stop ALL running live sessions with API call & Supabase fallback
  async stopAllLive(params?: {
    adminId?: string;
    adminName?: string;
    adminEmail?: string;
  }): Promise<{ success: boolean; count?: number; message?: string }> {
    this.clearLiveCache();
    
    // 1. Try API endpoint
    try {
      const res = await fetch('/api/live/stop-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params || {})
      });
      if (res.ok) {
        const json = await safeResponseJson(res, null);
        if (json && json.success) {
          this.clearLiveCache();
          return json;
        }
      }
    } catch (apiErr) {
      console.warn('[liveService] /api/live/stop-all request failed, using Supabase fallback:', apiErr);
    }

    // 2. Direct Supabase Fallback
    try {
      const nowIso = new Date().toISOString();
      const { data: allActive } = await supabase
        .from('support_contents')
        .select('*')
        .eq('type', 'live_session')
        .eq('active', true);

      let count = 0;
      for (const row of allActive || []) {
        let parsed: any = {};
        try { parsed = JSON.parse(row.content); } catch { parsed = {}; }
        parsed.is_active = false;
        parsed.ended_at = nowIso;
        parsed.ended_by_id = params?.adminId || '';
        parsed.ended_by_name = params?.adminName || '관리자';
        parsed.ended_by_email = params?.adminEmail || '';

        await supabase
          .from('support_contents')
          .update({
            content: JSON.stringify(parsed),
            active: false,
            updated_at: nowIso
          })
          .eq('id', row.id);
        count++;
      }

      this.clearLiveCache();
      const { data: existingCfg } = await supabase
        .from('support_contents')
        .select('id')
        .eq('type', 'live_config')
        .maybeSingle();

      if (existingCfg?.id) {
        await supabase
          .from('support_contents')
          .update({
            content: JSON.stringify({ live_is_active: false, updated_at: nowIso }),
            active: false,
            updated_at: nowIso
          })
          .eq('id', existingCfg.id);
      }

      return { success: true, count, message: '모든 라이브 방송이 성공적으로 종료되었습니다.' };
    } catch (fallbackErr: any) {
      console.error('[liveService] stopAllLive fallback error:', fallbackErr);
      return { success: false, message: fallbackErr.message || '전체 라이브 종료 중 오류가 발생했습니다.' };
    }
  }
};
