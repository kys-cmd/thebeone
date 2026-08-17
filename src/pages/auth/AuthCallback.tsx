import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/useAuthStore';
import { PROFILE_COMPLETION_PATH, isProfileIncomplete } from '@/lib/profile';
import { toast } from 'sonner';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // Check for error parameters in the URL first
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error') || params.get('error_code');
    const errorDescription = params.get('error_description');

    if (error || errorDescription) {
      const decodedDescription = errorDescription 
        ? decodeURIComponent(errorDescription) 
        : '소셜 로그인 중 서버 오류가 발생했습니다.';

      if (window.opener) {
        window.opener.postMessage({ 
          type: 'SUPABASE_OAUTH_ERROR', 
          message: decodedDescription 
        }, window.location.origin);
        window.close();
        return;
      }

      toast.error(decodedDescription);
      navigate('/auth/login');
      return;
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        setLoading(true);
        
        const profile = await authService.getCurrentProfile();
        const provider = session?.user?.app_metadata?.provider || null;
        setUser(profile, provider);
        
        // If loaded in a popup (for OAuth), notify parent and close
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'SUPABASE_OAUTH_SUCCESS',
            session: {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            }
          }, window.location.origin);
          window.close();
          return;
        }

        toast.success('로그인되었습니다.');
        // 구글 간편가입 회원은 기본정보를 모두 저장해야 가입이 최종 완료된다.
        if (isProfileIncomplete(profile, provider)) {
          toast.info('가입을 완료하려면 내 정보에서 기본정보를 입력해 주세요.');
          navigate(PROFILE_COMPLETION_PATH);
        } else if (profile?.role === 'admin' || profile?.role === 'super_admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
        setLoading(false);
      }
    });
  }, [navigate, setUser, setLoading]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="text-muted-foreground">로그인 처리 중입니다...</p>
      </div>
    </div>
  );
}
