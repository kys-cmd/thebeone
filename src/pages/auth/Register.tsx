import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ChevronRight, Info } from 'lucide-react';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [oauthErrorDetail, setOauthErrorDetail] = useState<string | null>(null);
  
  const inviteParam = new URLSearchParams(window.location.search).get('invite');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    nickname: '',
    phone: '',
    gender: 'male',
    birthday: '',
  });

  React.useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'SUPABASE_OAUTH_SUCCESS') {
        setLoading(true);
        toast.success('반갑습니다! 소셜 로그인 및 가입에 성공했습니다.');
        try {
          const session = event.data.session;
          if (session) {
            await authService.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });
          }
          const profile = await authService.getCurrentProfile();
          if (profile) {
            setUser(profile);
            if (inviteParam) {
              navigate(`/community?invite=${inviteParam}`);
            } else if (profile.role === 'admin' || profile.role === 'super_admin') {
              navigate('/admin');
            } else {
              navigate('/');
            }
          } else {
            toast.error('프로필 데이터를 가져올 수 없습니다.');
          }
        } catch (error: any) {
          console.error('SSO profile fetch failed:', error);
          toast.error('소셜 간편가입 처리 중 오류가 발생했습니다.');
        } finally {
          setLoading(false);
        }
      } else if (event.data?.type === 'SUPABASE_OAUTH_ERROR') {
        setLoading(false);
        const errMsg = event.data.message || '';
        setOauthErrorDetail(errMsg);
        if (errMsg.includes('Unable to exchange external code')) {
          toast.error('구글 연동 키(Client Secret) 오류: Supabase Dashboard 설정 혹은 구글 Client Secret이 일치하는지 확인해 주세요.', {
            duration: 7000,
          });
        } else {
          toast.error(errMsg || '소셜 간편 가입 도중 오류가 발생했습니다.');
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [navigate, setUser]);

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    try {
      setOauthErrorDetail(null);
      setLoading(true);
      const data = await authService.signInWithOAuth(provider);
      if (!data?.url) {
        throw new Error('OAuth Redirect URL를 가져오지 못했습니다.');
      }
      
      const width = 520;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        data.url,
        `beone_oauth_${provider}`,
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );
      
      if (!popup) {
        toast.error('팝업 차단기가 활성화되어 있습니다. 팝업을 허용해주세요.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`${provider === 'google' ? '구글' : '카카오'} 간편 가입 중 오류가 발생했습니다.`);
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // 필수 입력값 검증
    if (!formData.email.trim()) {
      return toast.error('이메일(ID)은 필수 입력 항목입니다.');
    }
    if (!formData.fullName.trim()) {
      return toast.error('실명은 필수 입력 항목입니다.');
    }
    if (!formData.password) {
      return toast.error('비밀번호는 필수 입력 항목입니다.');
    }
    if (formData.password.length < 8) {
      return toast.error('비밀번호는 최소 8자 이상이어야 합니다.');
    }
    if (!formData.confirmPassword) {
      return toast.error('비밀번호 확인은 필수 입력 항목입니다.');
    }
    if (!formData.nickname.trim()) {
      return toast.error('닉네임은 필수 입력 항목입니다.');
    }
    if (!formData.phone.trim()) {
      return toast.error('핸드폰 번호는 필수 입력 항목입니다.');
    }
    if (!formData.birthday) {
      return toast.error('생년월일은 필수 입력 항목입니다.');
    }

    // 핸드폰 번호 형식 및 패턴 매칭 (010-0000-0000 또는 010-000-0000)
    const phoneRegex = /^010-\d{3,4}-\d{4}$/;
    if (!phoneRegex.test(formData.phone)) {
      return toast.error('핸드폰 번호는 010-0000-0000 형식이어야 합니다.');
    }

    if (formData.password !== formData.confirmPassword) {
      return toast.error('비밀번호가 일치하지 않습니다.');
    }
    setLoading(true);
    try {
      await authService.signUp(
        formData.email, 
        formData.password, 
        formData.fullName, 
        formData.nickname, 
        formData.phone,
        formData.gender,
        formData.birthday
      );
      toast.success('회원가입이 완료되었습니다! 로그인 해주세요.');
      navigate(inviteParam ? `/auth/login?invite=${inviteParam}` : '/auth/login');
    } catch (error: any) {
      toast.error('회원가입에 실패했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-32">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[600px] bg-white rounded-[40px] shadow-2xl border border-gray-100 p-10 md:p-14 space-y-12"
      >
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black tracking-tighter text-gray-900">새로운 여정의 시작</h1>
          <p className="text-gray-400 font-medium">단 1분이면 비원아카데미의 모든 혜택을 누릴 수 있습니다.</p>
        </div>

        {/* Social SSO Action */}
        <div className="space-y-4">
          <div>
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              disabled={loading}
              className="w-full h-14 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-extrabold text-xs rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-1.14 2.78-2.4 3.63v3.02h3.88c2.27-2.08 3.57-5.15 3.57-8.5z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.02c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.11-6.68-4.96H1.21v3.11C3.18 21.88 7.31 24 12 24z"/>
                <path fill="#FBBC05" d="M5.32 14.27a7.06 7.06 0 010-4.54V6.62H1.21a11.97 11.97 0 000 10.76l4.11-3.11z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.93 1.19 15.24 0 12 0 7.31 0 3.18 2.12 1.21 5.07l4.11 3.11c.94-2.85 3.57-4.96 6.68-4.96z"/>
              </svg>
              구글로 간편가입
            </button>
          </div>

          {oauthErrorDetail && (
            <div className="mt-4 p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60 text-amber-900 space-y-3 block text-left">
              <div className="flex items-start gap-2.5">
                <span className="text-xl shrink-0">⚠️</span>
                <div>
                  <h4 className="font-extrabold text-sm text-amber-950 leading-none">소셜 인증 오류 가이드</h4>
                  <p className="text-[11px] text-amber-800 font-semibold leading-normal mt-1">
                    {oauthErrorDetail.includes('Unable to exchange external code') 
                      ? '구글 API 인증키(Client Secret)가 일치하지 않아 발생한 인증 오류입니다.' 
                      : `${oauthErrorDetail}`}
                  </p>
                </div>
              </div>

              {oauthErrorDetail.includes('Unable to exchange external code') && (
                <div className="text-[11px] bg-white/80 border border-amber-100 p-3 rounded-xl space-y-2 text-gray-700 font-semibold leading-relaxed">
                  <p className="font-black text-amber-950 pb-1 border-b border-amber-100">💡 30초 만에 구글 로그인 정상화하기</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
                    <li>
                      <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-purple-600 font-black underline hover:text-purple-700">구글 클라우드 콘솔</a> 로그인
                    </li>
                    <li>
                      <span className="font-extrabold text-gray-800">API 및 서비스</span> &gt; <span className="font-extrabold text-gray-800">사용자 인증 정보</span>로 이동
                    </li>
                    <li>
                      OAuth 2.0 클라이언트 ID 목록의 웹 애플리케이션 우측 <span className="font-extrabold text-gray-800">연필 아이콘(수정)</span> 클릭
                    </li>
                    <li>
                      보이는 <span className="font-extrabold text-purple-600">클라이언트 보안 비밀번호(Client Secret)</span> 값을 클릭하여 복사
                    </li>
                    <li>
                      <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-purple-600 font-black underline hover:text-purple-700">수파베이스 대시보드</a> 접속
                    </li>
                    <li>
                      <span className="font-extrabold text-gray-800">Authentication</span> &gt; <span className="font-extrabold text-gray-800">Providers</span> &gt; <span className="font-extrabold text-gray-800">Google</span> 클릭
                    </li>
                    <li>
                      <span className="font-extrabold text-purple-600">Client Secret (for OAuth)</span> 항목에 변경된 키롤 붙여넣어 업데이트 후 <span className="font-extrabold text-gray-800">Save</span> 클릭!
                    </li>
                  </ol>
                  <p className="text-[10px] text-purple-600 font-black pt-1 block">✔️ 일반 이메일 회원가입은 정상적으로 사용 가능합니다.</p>
                </div>
              )}
            </div>
          )}

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="flex-shrink mx-4 text-gray-300 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">또는 일반 회원가입 정보입력</span>
            <div className="flex-grow border-t border-gray-100"></div>
          </div>
        </div>

        {/* Detailed Form */}
        <form onSubmit={handleRegister} className="space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
              <div className="space-y-2">
                 <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Email (ID)</Label>
                 <Input 
                   required
                   type="email"
                   value={formData.email || ''}
                   onChange={(e) => setFormData({...formData, email: e.target.value})}
                   placeholder="example@email.com" 
                   className="h-14 bg-gray-50 border-gray-50 rounded-2xl focus-visible:ring-purple-600 font-bold" 
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Full Name</Label>
                 <Input 
                  required
                  value={formData.fullName || ''}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  placeholder="실명을 입력하세요" 
                  className="h-14 bg-gray-50 border-gray-50 rounded-2xl focus-visible:ring-purple-600 font-bold" 
                />
              </div>
              <div className="space-y-2">
                 <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Password</Label>
                 <Input 
                  required
                  type="password"
                  value={formData.password || ''}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="8자 이상 입력" 
                  className="h-14 bg-gray-50 border-gray-50 rounded-2xl focus-visible:ring-purple-600 font-bold" 
                />
              </div>
              <div className="space-y-2">
                 <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Confirm Password</Label>
                 <Input 
                  required
                  type="password"
                  value={formData.confirmPassword || ''}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  placeholder="비밀번호 재입력" 
                  className="h-14 bg-gray-50 border-gray-50 rounded-2xl focus-visible:ring-purple-600 font-bold" 
                />
              </div>
              <div className="space-y-2">
                 <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Nickname</Label>
                 <Input 
                  required
                  value={formData.nickname || ''}
                  onChange={(e) => setFormData({...formData, nickname: e.target.value})}
                  placeholder="커뮤니티 활동명" 
                  className="h-14 bg-gray-50 border-gray-50 rounded-2xl focus-visible:ring-purple-600 font-bold" 
                />
              </div>
              <div className="space-y-2">
                 <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Phone</Label>
                 <Input 
                  required
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({...formData, phone: formatPhoneNumber(e.target.value)})}
                  placeholder="010-0000-0000" 
                  maxLength={13}
                  className="h-14 bg-gray-50 border-gray-50 rounded-2xl focus-visible:ring-purple-600 font-bold" 
                />
              </div>
              <div className="space-y-4">
                 <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Gender</Label>
                 <RadioGroup 
                   value={formData.gender} 
                   onValueChange={(val) => setFormData({...formData, gender: val})}
                   className="flex gap-4"
                 >
                   <div className="flex items-center space-x-2 bg-gray-50 px-6 py-4 rounded-xl flex-1 justify-center">
                     <RadioGroupItem value="male" id="male" />
                     <Label htmlFor="male" className="font-bold cursor-pointer">남성</Label>
                   </div>
                   <div className="flex items-center space-x-2 bg-gray-50 px-6 py-4 rounded-xl flex-1 justify-center">
                     <RadioGroupItem value="female" id="female" />
                     <Label htmlFor="female" className="font-bold cursor-pointer">여성</Label>
                   </div>
                 </RadioGroup>
              </div>
              <div className="space-y-2">
                 <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Birthday</Label>
                 <Input 
                  required
                  type="date"
                  value={formData.birthday || ''}
                  onChange={(e) => setFormData({...formData, birthday: e.target.value})}
                  className="h-14 bg-gray-50 border-gray-50 rounded-2xl focus-visible:ring-purple-600 font-bold" 
                />
              </div>
           </div>

           <div className="bg-purple-50 p-6 rounded-3xl space-y-3">
              <div className="flex items-center gap-2 text-purple-600 font-black text-sm">
                <Info className="w-4 h-4" /> 이용약관 고지
              </div>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                가입 시 비원아카데미의 서비스 이용약관 및 개인정보 처리방침에 동의하는 것으로 간주합니다. 입력하신 정보는 본인 확인 및 서비스 제공을 위해 안전하게 보호됩니다.
              </p>
           </div>

           <Button type="submit" disabled={loading} className="w-full h-18 bg-purple-600 hover:bg-purple-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-purple-200 py-6">
             {loading ? '처리 중...' : '회원가입 완료하기'}
           </Button>

           <div className="text-center">
             <Link to={inviteParam ? `/auth/login?invite=${inviteParam}` : "/auth/login"} className="text-sm font-bold text-gray-400 hover:text-purple-600">이미 계정이 있으신가요? 로그인</Link>
           </div>
        </form>
      </motion.div>
    </div>
  );
}
