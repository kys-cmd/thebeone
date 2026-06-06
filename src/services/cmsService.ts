import { supabase } from '@/lib/supabase';

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  html_content?: string;
  image?: string;
  bg_color?: string;
  video_url?: string;
  active: boolean;
  link: string;
  order: number;
  type: 'main' | 'course' | 'special' | 'beone_exclusive';
}

export interface SiteConfig {
  id?: string;
  logo_url?: string;
  favicon_url?: string;
  primary_color?: string;
  site_name?: string;
  footer_info?: string;
  live_is_active?: boolean;
  live_embed_code?: string;
  live_title?: string;
  live_chat_enabled?: boolean;
  live_start_time?: string;
  // Event Banner
  event_banner_show?: boolean;
  event_banner_text?: string;
  event_banner_link?: string;
  event_banner_bg_color?: string;
  event_banner_text_color?: string;
  banner_interval?: number;
}

export interface PaymentSettings {
  id?: string;
  pg_id: string; // MID
  portone_store_id?: string; // IMP_ID
  pg_company: 'html5_inicis' | 'kcp' | 'uplus' | 'mobilians' | string;
  pg_mode: 'live' | 'test';
  inicis_key_url?: string;
  inicis_sign_key?: string;
  payment_methods_pg: string[];
  installment_months: string[];
  payment_methods_direct: string[];
  updated_at?: string;
}

export interface CommunityCategory {
  id: string;
  name: string;
  description: string;
  active: boolean;
  members?: number;
  activeUsers?: number;
  icon?: string;
  color?: string;
  banner?: string;
  features: {
    board: boolean;
    chat: boolean;
    gallery: boolean;
  };
}

export interface SupportContent {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt?: string;
  active: boolean;
}

export const cmsService = {
  // Banners
  async getBanners(type?: 'main' | 'course' | 'special' | 'beone_exclusive'): Promise<Banner[]> {
    let query = supabase.from('banners').select('*').eq('is_deleted', false).eq('active', true).order('order', { ascending: true });
    if (type) {
      query = query.eq('type', type);
    }
    const { data, error } = await query;
    if (error) console.error('Error fetching banners:', error);
    return data || [];
  },

  async getAllBanners(): Promise<Banner[]> {
    const { data, error } = await supabase.from('banners').select('*').eq('is_deleted', false).order('order', { ascending: true });
    if (error) console.error('Error fetching banners:', error);
    return data || [];
  },

  async deleteBanner(id: string): Promise<void> {
    if (id && !id.startsWith('new')) {
      await supabase.from('banners').update({ is_deleted: true }).eq('id', id);
    }
  },

  async deleteCommunityCategory(id: string): Promise<void> {
    if (id && !id.startsWith('c')) {
      await supabase.from('communities').update({ is_deleted: true }).eq('id', id);
    }
  },

  async saveBanners(banners: Banner[]): Promise<void> {
    try {
      for (const banner of banners) {
        // Updated_at field added automatically if we wanted, but let's be explicit
        const bannerData = {
          title: banner.title,
          subtitle: banner.subtitle,
          html_content: banner.html_content,
          image: banner.image || null,
          bg_color: banner.bg_color || '#000000',
          video_url: banner.video_url,
          active: banner.active,
          link: banner.link,
          order: banner.order,
          type: banner.type,
          updated_at: new Date().toISOString()
        };

        if (banner.id && !banner.id.toString().startsWith('new')) {
          const { error } = await supabase
            .from('banners')
            .update(bannerData)
            .eq('id', banner.id);
          
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('banners')
            .insert([bannerData]);
          
          if (error) throw error;
        }
      }
    } catch (error: any) {
      console.error('[CMS] saveBanners Error:', error);
      throw new Error(`배너 저장 실패: ${error.message}`);
    }
  },

  // Community
  async getCommunityCategories(): Promise<CommunityCategory[]> {
    const { data, error } = await supabase.from('communities').select('*').eq('is_deleted', false);
    if (error) console.error('Error fetching communities:', error);
    return (data || []).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      active: c.is_active,
      icon: c.icon,
      color: c.color,
      banner: c.banner_url,
      features: { board: c.feature_board, chat: c.feature_chat, gallery: c.feature_gallery }
    }));
  },

  async saveCommunityCategories(categories: CommunityCategory[]): Promise<void> {
    for (const cat of categories) {
      const payload = {
        name: cat.name,
        description: cat.description,
        is_active: cat.active,
        icon: cat.icon,
        color: cat.color,
        banner_url: cat.banner,
        feature_board: cat.features.board,
        feature_chat: cat.features.chat,
        feature_gallery: cat.features.gallery
      };
      if (cat.id && !cat.id.toString().startsWith('c')) {
        await supabase.from('communities').update(payload).eq('id', cat.id);
      } else {
        await supabase.from('communities').insert([payload]);
      }
    }
  },

  // Support / Support Pages content
  async getSupportContent(type?: string): Promise<SupportContent[]> {
    let query = supabase.from('support_contents').select('*').eq('is_deleted', false).order('created_at', { ascending: false });
    if (type) {
      query = query.eq('type', type);
    }
    const { data, error } = await query;
    if (error) console.error('Error fetching support content:', error);
    return data || [];
  },

  async deleteSupportContent(id: string): Promise<void> {
    if (id && !id.startsWith('new')) {
      await supabase.from('support_contents').update({ is_deleted: true }).eq('id', id);
    }
  },

  async saveSupportContent(content: SupportContent[]): Promise<void> {
    for (const item of content) {
      if (item.id && !item.id.toString().startsWith('new')) {
        await supabase.from('support_contents').update(item).eq('id', item.id);
      } else {
        const { id, createdAt, ...newItem } = item;
        await supabase.from('support_contents').insert([newItem]);
      }
    }
  },

  // Config
  async getSiteConfig(): Promise<SiteConfig> {
    const defaultConfig: SiteConfig = {
      site_name: '비원아카데미',
      primary_color: '#9333ea',
      footer_info: '(주)비원아카데미 | 대표자: 김*수 | 사업자등록번호: 123-45-67890\n서울특별시 강남구 테헤란로 123, 4층\nCopyright © 2026 BE ONE. All Rights Reserved.',
      event_banner_show: true,
      event_banner_text: '비원아카데미 오픈 기념! 모든 정규강의 최대 50% 페이백 챌린지 참여하기 ➔',
      event_banner_bg_color: '#9333ea',
      event_banner_text_color: '#ffffff',
      banner_interval: 5000
    };

    try {
      // Get the first record (usually only one)
      const { data, error } = await supabase.from('site_config').select('*').limit(1).maybeSingle();
      
      if (error) {
        console.warn('Error fetching site config:', error);
        return defaultConfig;
      }
      
      if (!data) return defaultConfig;
      
      return { ...defaultConfig, ...data };
    } catch (e) {
      console.error('Unexpected error in getSiteConfig:', e);
      return defaultConfig;
    }
  },

  async saveSiteConfig(config: SiteConfig): Promise<void> {
    try {
      // 1. Get the latest record ID
      const { data: existing, error: fetchError } = await supabase.from('site_config').select('id').limit(1).maybeSingle();
      
      if (fetchError) throw fetchError;

      // 2. Prepare the payload
      // DB에 실제 존재하지 않는 컬럼으로 인한 오류를 방지하기 위해 필수 필드 위주로 구성
      const payload: any = {
        site_name: config.site_name,
        logo_url: config.logo_url,
        primary_color: config.primary_color,
        footer_info: config.footer_info,
        event_banner_show: config.event_banner_show,
        event_banner_text: config.event_banner_text,
        event_banner_link: config.event_banner_link,
        event_banner_bg_color: config.event_banner_bg_color,
        event_banner_text_color: config.event_banner_text_color,
        banner_interval: config.banner_interval,
        updated_at: new Date().toISOString()
      };
      
      // 3. Perform Update or Insert
      if (existing?.id) {
        const { error: updateError } = await supabase
          .from('site_config')
          .update(payload)
          .eq('id', existing.id);
          
        if (updateError) {
          console.error('[CMS] Update Error:', updateError);
          if (updateError.message.includes('column') || updateError.message.includes('schema cache')) {
            throw new Error('데이터베이스 컬럼이 누락되었습니다. 제공해드린 SQL 스크립트를 Supabase SQL 에디터에서 먼저 실행해 주세요.');
          }
          throw new Error(`업데이트 중 오류가 발생했습니다: ${updateError.message}`);
        }
      } else {
        const { error: insertError } = await supabase
          .from('site_config')
          .insert([payload]);
          
        if (insertError) {
          console.error('[CMS] Insert Error:', insertError);
          throw new Error(`신규 저장 중 오류가 발생했습니다: ${insertError.message}`);
        }
      }
    } catch (error: any) {
      console.error('[CMS] Save Error:', error);
      throw error;
    }
  },

  subscribeToSiteConfig(onUpdate: (config: SiteConfig) => void) {
    const channelName = `site-config-changes-${Math.random().toString(36).substring(2, 7)}`;
    return supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'site_config' 
      }, (payload) => {
        if (payload.new) {
          onUpdate(payload.new as SiteConfig);
        }
      })
      .subscribe();
  },

  subscribeToBanners(onUpdate: () => void) {
    const channelName = `banners-changes-${Math.random().toString(36).substring(2, 7)}`;
    return supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'banners' 
      }, () => {
        onUpdate();
      })
      .subscribe();
  },

  // Payment Settings
  async getPaymentSettings(): Promise<PaymentSettings> {
    const defaultSettings: PaymentSettings = {
      pg_id: '',
      pg_company: 'html5_inicis',
      pg_mode: 'test',
      inicis_sign_key: '',
      payment_methods_pg: ['card'],
      installment_months: ['0'],
      payment_methods_direct: ['bank_transfer']
    };

    try {
      const { data, error } = await supabase.from('payment_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      if (!data) return defaultSettings;
      return { ...defaultSettings, ...data };
    } catch (e) {
      console.error('Error fetching payment settings:', e);
      return defaultSettings;
    }
  },

  async savePaymentSettings(settings: PaymentSettings): Promise<void> {
    try {
      const { id, updated_at, ...payload } = settings;
      if (id) {
        const { error } = await supabase
          .from('payment_settings')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('payment_settings')
          .insert([payload]);
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error saving payment settings:', error);
      throw new Error(`결제 설정 저장 실패: ${error.message}`);
    }
  }
};
