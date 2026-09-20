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

  // Start live stream
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
  }): Promise<{ success: boolean; conflict?: boolean; activeSessions?: LiveSession[]; session?: LiveSession; message?: string }> {
    try {
      const res = await fetch('/api/live/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const json = await safeResponseJson(res);
      return json;
    } catch (err: any) {
      console.error('[liveService] startLive error:', err);
      return { success: false, message: err.message || '라이브 시작 중 통신 오류가 발생했습니다.' };
    }
  },

  // Stop specific live session
  async stopLive(params: {
    sessionId: string;
    adminId?: string;
    adminName?: string;
    adminEmail?: string;
  }): Promise<{ success: boolean; message?: string }> {
    this.clearLiveCache();
    try {
      const res = await fetch('/api/live/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const json = await safeResponseJson(res);
      this.clearLiveCache();
      return json;
    } catch (err: any) {
      console.error('[liveService] stopLive error:', err);
      this.clearLiveCache();
      return { success: false, message: err.message || '라이브 종료 중 오류가 발생했습니다.' };
    }
  },

  // Stop ALL running live sessions
  async stopAllLive(params?: {
    adminId?: string;
    adminName?: string;
    adminEmail?: string;
  }): Promise<{ success: boolean; count?: number; message?: string }> {
    this.clearLiveCache();
    try {
      const res = await fetch('/api/live/stop-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params || {})
      });
      const json = await safeResponseJson(res);
      this.clearLiveCache();
      return json;
    } catch (err: any) {
      console.error('[liveService] stopAllLive error:', err);
      this.clearLiveCache();
      return { success: false, message: err.message || '전체 라이브 종료 중 오류가 발생했습니다.' };
    }
  }
};
