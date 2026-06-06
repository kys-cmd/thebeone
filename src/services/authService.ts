import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';

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
      const isMasterEmail = session.user.email === 'kys@k-learn.co.kr';

      // If profile doesn't exist, try to create it (Self-Healing)
      if (!data && !error) {
        try {
          const newProfile = {
            id: session.user.id,
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            nickname: session.user.user_metadata?.nickname || null,
            email: session.user.email || '',
            avatar_url: session.user.user_metadata?.avatar_url || '',
            role: isMasterEmail ? 'super_admin' : (metadataRole || 'user'),
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
        let finalRole = (metadataRole === 'super_admin' || metadataRole === 'admin')
          ? metadataRole
          : (data.role || 'user');
        
        if (isMasterEmail) finalRole = 'super_admin';

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
        role: isMasterEmail ? 'super_admin' : (metadataRole || 'user'),
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

  async signUp(email: string, password: string, fullName: string, nickname?: string, phone?: string, gender?: string, birthdate?: string) {
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
      }
    }
    
    return data;
  },

  async initializeAdminAccounts() {
    // This is for development/initial setup
    const accounts = [
      { email: 'admin@beone.internal', password: '123456', role: 'super_admin', name: '슈퍼어드민' },
      { email: 'beone@beone.internal', password: '123456', role: 'admin', name: '어드민' }
    ];

    const results = [];
    for (const acc of accounts) {
      const res = await supabase.auth.signUp({
        email: acc.email,
        password: acc.password,
        options: { data: { full_name: acc.name, role: acc.role } }
      });
      
      if (res.data.user) {
        await supabase.from('profiles').upsert({
          id: res.data.user.id,
          name: acc.name,
          email: acc.email,
          role: acc.role as any,
          is_deleted: false
        });
      }
      results.push(res);
    }
    return results;
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

    if (error) throw error;
    return updatedProfile;
  }
};
