import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';
import { DUPLICATE_PHONE_MESSAGE, normalizePhone } from '@/lib/profile';

/** DB의 휴대폰 번호 고유 인덱스 위반(중복 가입)인지 판별한다. */
export const isDuplicatePhoneError = (error: any) => {
  if (!error) return false;
  if (error.code === '23505') {
    const target = `${error.message || ''} ${error.details || ''}`;
    return target.includes('phone');
  }
  return false;
};

export const authService = {
  async getCurrentProfile(): Promise<Profile | null> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error in getCurrentProfile:', sessionError);
        // If the session is invalid or refresh token is missing, force a sign out to clear stale data
        if (sessionError.message?.includes('Refresh Token Not Found') || 
            sessionError.message?.includes('Invalid Refresh Token')) {
          console.warn('Invalid refresh token detected, signing out...');
          await supabase.auth.signOut().catch(() => {});
        }
        return null;
      }

      if (!session?.user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      const metadataRole = session.user.user_metadata?.role;

      // If profile doesn't exist, try to create it (Self-Healing)
      if (!data && !error) {
        try {
          const newProfile = {
            id: session.user.id,
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            nickname: session.user.user_metadata?.nickname || null,
            email: session.user.email || '',
            avatar_url: session.user.user_metadata?.avatar_url || '',
            role: metadataRole || 'user',
            gender: session.user.user_metadata?.gender || null,
            birthdate: session.user.user_metadata?.birthdate || null,
            phone: session.user.user_metadata?.phone || null,
            mobile_phone: session.user.user_metadata?.phone || null,
            is_deleted: false,
            created_at: new Date().toISOString(),
          };
          
          const { data: created, error: createError } = await supabase
            .from('profiles')
            .insert([newProfile])
            .select()
            .single();
          
          if (!createError && created) {
            return created as Profile;
          }
          
          if (createError) {
            console.warn('Profile creation during session restoration failed:', createError);
          }
        } catch (err) {
          console.error('Unexpected error during profile self-healing:', err);
        }
      }

      if (data && !error) {
        const finalRole = (metadataRole === 'super_admin' || metadataRole === 'admin')
          ? metadataRole
          : (data.role || 'user');

        // Self-Healing / Syncing metadata to database if missing in profiles table
        const metadata = session.user.user_metadata;
        const needsUpdate = 
          (!data.nickname && metadata?.nickname) ||
          (!data.gender && metadata?.gender) ||
          (!data.birthdate && metadata?.birthdate) ||
          (!data.phone && metadata?.phone) ||
          (!data.mobile_phone && metadata?.phone);

        if (needsUpdate) {
          try {
            const updatedData = {
              name: data.name || metadata?.full_name || 'User',
              nickname: data.nickname || metadata?.nickname || null,
              gender: data.gender || metadata?.gender || null,
              birthdate: data.birthdate || metadata?.birthdate || null,
              phone: data.phone || metadata?.phone || null,
              mobile_phone: data.mobile_phone || metadata?.phone || null,
            };
            const { data: updatedProfile, error: updateError } = await supabase
              .from('profiles')
              .update(updatedData)
              .eq('id', session.user.id)
              .select()
              .single();
            if (!updateError && updatedProfile) {
              return { ...updatedProfile, role: finalRole };
            }
          } catch (err) {
            console.error('Error auto-syncing profile metadata to DB:', err);
          }
        }
        
        return { ...data, role: finalRole };
      }

      // Fallback if profile not found but session exists
      return {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
        nickname: session.user.user_metadata?.nickname || null,
        avatar_url: session.user.user_metadata?.avatar_url || '',
        role: metadataRole || 'user',
        gender: session.user.user_metadata?.gender || null,
        birthdate: session.user.user_metadata?.birthdate || null,
        mobile_phone: session.user.user_metadata?.phone || null,
        phone: session.user.user_metadata?.phone || null,
        address: session.user.user_metadata?.address || null,
        created_at: new Date().toISOString(),
        is_deleted: false,
      };
    } catch (error) {
      console.error('Error in getCurrentProfile:', error);
      return null;
    }
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  },

  async signInWithOAuth(provider: 'google' | 'kakao') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: true,
      }
    });
    if (error) throw error;
    return data;
  },

  /** 현재 세션의 로그인 수단(google, email 등)을 돌려준다. */
  async getSessionProvider(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.app_metadata?.provider || null;
  },

  async setSession(session: { access_token: string; refresh_token: string }) {
    const { data, error } = await supabase.auth.setSession(session);
    if (error) throw error;
    return data;
  },

  async sendPasswordResetEmail(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
    return data;
  },

  async requestPasswordReset(email: string): Promise<void> {
    const response = await fetch('/api/auth/reset-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const result = await response.json();
    if (result.status !== 'success' || response.status !== 200) {
      throw new Error(result.message || '비밀번호 초기화 요청에 실패했습니다.');
    }
  },

  async updatePassword(password: string) {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    return data;
  },

  /**
   * 휴대폰 번호가 이미 가입에 사용됐는지 확인한다.
   * profiles 조회는 RLS로 로그인 사용자만 가능하므로 서버(서비스 롤) API를 경유한다.
   * @param excludeUserId 본인 정보 수정 시 자기 자신은 중복에서 제외하기 위한 사용자 ID
   */
  async isPhoneTaken(phone: string, excludeUserId?: string): Promise<boolean> {
    const normalized = normalizePhone(phone);
    if (!normalized) return false;

    const response = await fetch('/api/auth/check-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalized, excludeUserId })
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || result?.status !== 'success') {
      throw new Error(result?.message || '휴대폰 번호 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }

    return !!result.duplicated;
  },

  async signUp(email: string, password: string, fullName: string, nickname?: string, phone?: string, gender?: string, birthdate?: string) {
    // 휴대폰 번호가 회원 식별 Key이므로 계정을 만들기 전에 중복 여부부터 확인한다.
    if (phone && await this.isPhoneTaken(phone)) {
      throw new Error(DUPLICATE_PHONE_MESSAGE);
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          nickname: nickname,
          gender: gender,
          birthdate: birthdate,
          phone: phone,
        }
      }
    });
    
    if (error) throw error;
    
    if (data.user) {
      // Create or update profile record to satisfy foreign key constraints and save full user details
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([{
          id: data.user.id,
          name: fullName,
          nickname: nickname || null,
          email: email,
          role: 'user',
          gender: gender || null,
          birthdate: birthdate || null,
          phone: phone || null,
          mobile_phone: phone || null,
          is_deleted: false
        }]);
      
      if (profileError) {
        console.error('Error creating or updating profile:', profileError);

        // 사전 확인과 프로필 생성 사이에 다른 요청이 먼저 등록한 경우(경합).
        // DB 고유 인덱스가 막아주므로 로그인 상태를 정리하고 동일한 안내를 보여준다.
        if (isDuplicatePhoneError(profileError)) {
          await supabase.auth.signOut().catch(() => {});
          throw new Error(DUPLICATE_PHONE_MESSAGE);
        }
      }
    }

    return data;
  },

  async initializeAdminAccounts() {
    console.warn('initializeAdminAccounts: Hardcoded test accounts have been removed for security reasons.');
    return [];
  },

  async updateAdditionalInfo(id: string, data: { name: string, nickname: string, phone: string, gender: string, birthdate: string }) {
    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update({
        name: data.name,
        nickname: data.nickname,
        phone: data.phone,
        mobile_phone: data.phone,
        gender: data.gender,
        birthdate: data.birthdate,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (isDuplicatePhoneError(error)) {
        throw new Error(DUPLICATE_PHONE_MESSAGE);
      }
      throw error;
    }
    return updatedProfile;
  }
};
