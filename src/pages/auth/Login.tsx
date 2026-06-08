import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LogIn, UserPlus, ArrowRight, Mail, Key, ShieldCheck, ArrowLeft } from 'lucide-react';
import { authService } from '@/services/authService';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthErrorDetail, setOauthErrorDetail] = useState<string | null>(null);

  // Verification Code (OTP) States for password find recovery
  const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'password'>('email');
  const [verificationCode, setVerificationCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [demoOtpNotice, setDemoOtpNotice] = useState<string | null>(null);

  const inviteParam = new URLSearchParams(window.location.search).get('invite');

  React.useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'SUPABASE_OAUTH_SUCCESS') {
        setLoading(true);
        toast.success('반갑습니다! 소셜 로그인에 성공했습니다.');
        try {
          const session = event.data.session;
          if (session) {
            await authService.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });
          }
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          const provider = currentSession?.user?.app_metadata?.provider || null;
          const profile = await authService.getCurrentProfile();
          if (profile) {
            setUser(profile, provider);
            const isGoogleUser = provider === 'google';
            const isIncomplete = isGoogleUser && (!profile.name || !profile.nickname || !(profile.mobile_phone || profile.phone) || !profile.gender || !profile.birthdate);
            if (isIncomplete) {
              navigate('/mypage');
            } else if (inviteParam) {
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
          toast.error('소셜 로그인 처리 중 오류가 발생했습니다.');
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
          toast.error(errMsg || '소셜 로그인 도중 오류가 발생했습니다.');
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
      toast.error(`${provider === 'google' ? '구글' : '카카오'} 간편 로그인 중 오류가 발생했습니다.`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('모든 정보를 입력해주세요.');
    setLoading(true);
    try {
      await authService.signIn(email, password);
      const profile = await authService.getCurrentProfile();
      if (profile) {
        setUser(profile, 'email');
        if (inviteParam) {
          navigate(`/community?invite=${inviteParam}`);
        } else if (profile.role === 'admin' || profile.role === 'super_admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      } else {
        navigate('/');
      }
      toast.success('반갑습니다! 비원아카데미에 오신 것을 환영합니다.');
    } catch (error: any) {
      toast.error('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return toast.error('가입하신 이메일 주소를 입력해주세요.');
    setLoading(true);
    setDemoOtpNotice(null);
    try {
      const response = await fetch('/api/auth/send-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const result = await response.json();
      if (response.ok && result.status === 'success') {
        toast.success(result.message);
        setForgotStep('code');
      } else {
        toast.error(result.message || '인증번호 발송에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('[OTP Debug] Send OTP failed:', error);
      toast.error(`인증번호 요청 중 통신 오류가 발생했습니다: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) return toast.error('발송된 인증번호 6자리를 입력해주세요.');
    if (verificationCode.length !== 6) return toast.error('인증번호는 숫자 6자리로 구성되어 있습니다.');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, code: verificationCode })
      });
      const result = await response.json();
      if (response.ok && result.status === 'success') {
        toast.success(result.message);
        setTempToken(result.tempToken);
        setForgotStep('password');
        setDemoOtpNotice(null);
      } else {
        toast.error(result.message || '인증번호 확인에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('[OTP Debug] Verify OTP failed:', error);
      toast.error(`인증 처리 중 네트워크 오류가 발생했습니다: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmNewPassword) return toast.error('새로운 비밀번호를 정확하게 입력해주세요.');
    if (newPassword.length < 6) return toast.error('비밀번호는 최소 6자 이상이어야 합니다.');
    if (newPassword !== confirmNewPassword) return toast.error('비밀번호가 일치하지 않습니다. 다시 확인해주세요.');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/confirm-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          tempToken,
          password: newPassword
        })
      });
      const result = await response.json();
      if (response.ok && result.status === 'success') {
        toast.success(result.message);
        // Clear all states
        setForgotStep('email');
        setForgotEmail('');
        setVerificationCode('');
        setTempToken('');
        setNewPassword('');
        setConfirmNewPassword('');
        setDemoOtpNotice(null);
        // Back to login mode
        setMode('login');
      } else {
        toast.error(result.message || '비밀번호 변경 처리에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('[OTP Debug] Confirm password reset failed:', error);
      toast.error(`비밀번호 변경 처리 중 통신 오류가 발생했습니다: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-32">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[450px] bg-white rounded-[40px] shadow-2xl border border-gray-100 p-10 space-y-10"
      >
        {mode === 'login' ? (
          <>
            {/* Header */}
            <div className="text-center space-y-6">
              <Link to="/" className="inline-flex flex-col items-center gap-4">
                 <div className="w-16 h-16 bg-purple-600 rounded-[22px] flex items-center justify-center shadow-2xl shadow-purple-200">
                   <span className="text-white text-3xl font-black">BE</span>
                 </div>
                 <h1 className="text-3xl font-black tracking-tighter text-gray-900">당신의 성장이{'\n'}시작되는 곳</h1>
              </Link>
              <p className="text-gray-400 font-medium whitespace-pre-line">
                비원아카데미와 함께{'\n'}자본주의의 지도를 그려보세요.
              </p>
            </div>

            {/* Form area */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Email</Label>
                <Input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일을 입력하세요" 
                  className="h-14 bg-gray-50 border-gray-50 rounded-2xl focus-visible:ring-purple-600 font-bold" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Password</Label>
                <Input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요" 
                  className="h-14 bg-gray-50 border-gray-50 rounded-2xl focus-visible:ring-purple-600 font-bold" 
                />
              </div>
              
              <div className="flex items-center justify-between px-1">
                 <button 
                   type="button" 
                   onClick={() => {
                     setForgotEmail(email);
                     setMode('forgot');
                   }}
                   className="text-xs font-bold text-gray-400 hover:text-purple-600"
                 >
                   비밀번호 찾기
                 </button>
                 <Link to={inviteParam ? `/auth/register?invite=${inviteParam}` : "/auth/register"} className="text-xs font-black text-purple-600">회원가입 하기</Link>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-16 bg-purple-600 hover:bg-purple-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-purple-200 mt-4">
                {loading ? '로그인 중...' : '매뉴얼 로그인'}
              </Button>

              <div className="relative flex py-4 items-center">
                <div className="flex-grow border-t border-gray-100"></div>
                <span className="flex-shrink mx-4 text-gray-300 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">또는 구글 간편 로그인</span>
                <div className="flex-grow border-t border-gray-100"></div>
              </div>

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
                  구글 간편 로그인
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
                      <p className="text-[10px] text-purple-600 font-black pt-1 block">✔️ 일반 이메일 로그인은 즉시 이용 가능합니다.</p>
                    </div>
                  )}
                </div>
              )}
            </form>
          </>
        ) : (
          <>
            {/* Multi-step forgot password wizard */}
            {forgotStep === 'email' && (
              <>
                {/* Step 1: Email Input */}
                <div className="text-center space-y-6">
                  <div className="inline-flex flex-col items-center gap-4">
                     <div className="w-16 h-16 bg-purple-100 rounded-[22px] flex items-center justify-center text-purple-600 shadow-xl border border-purple-200">
                       <Mail className="w-8 h-8" />
                     </div>
                     <h1 className="text-3xl font-black tracking-tighter text-gray-900">비밀번호 찾기</h1>
                  </div>
                  <p className="text-gray-400 font-medium whitespace-pre-line leading-relaxed">
                    가입하신 이메일 주소를 입력하시면,{'\n'}본인 인증을 위한 6자리 인증번호를 전송해 드립니다.
                  </p>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">이메일 주소</Label>
                    <Input 
                      type="email" 
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="가입한 이메일을 입력하세요" 
                      className="h-14 bg-gray-50 border-gray-100 rounded-2xl focus-visible:ring-purple-600 font-bold" 
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full h-16 bg-purple-600 hover:bg-purple-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-purple-200 mt-4 cursor-pointer transition-all">
                    {loading ? '인증 코드 발송 중...' : '인증번호 발송'}
                  </Button>

                  <button 
                    type="button" 
                    onClick={() => {
                      setForgotStep('email');
                      setMode('login');
                    }}
                    className="w-full text-center text-xs font-black text-gray-400 hover:text-purple-600 hover:underline pt-2 block transition-all"
                  >
                    로그인화면으로 돌아가기
                  </button>
                </form>
              </>
            )}

            {forgotStep === 'code' && (
              <>
                {/* Step 2: Verification Code Input */}
                <div className="text-center space-y-6">
                  <div className="inline-flex flex-col items-center gap-4">
                     <div className="w-16 h-16 bg-amber-100 rounded-[22px] flex items-center justify-center text-amber-600 shadow-xl border border-amber-200">
                       <Key className="w-8 h-8 animate-pulse" />
                     </div>
                     <h1 className="text-3xl font-black tracking-tighter text-gray-900">인증번호 입력</h1>
                  </div>
                  <p className="text-gray-400 font-medium whitespace-pre-line leading-relaxed">
                    <span className="text-purple-600 font-black">{forgotEmail}</span> 이메일로 발송된{'\n'}인증코드 6자리를 타이핑해 주세요.
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">인증번호 6자리</Label>
                      <button 
                        type="button" 
                        onClick={handleSendOtp} 
                        className="text-xs font-extrabold text-purple-600 hover:underline"
                        disabled={loading}
                      >
                        재발송 요청
                      </button>
                    </div>
                    <Input 
                      type="text" 
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="인증번호 6자리 입력" 
                      className="h-14 bg-gray-50 border-gray-100 rounded-2xl focus-visible:ring-purple-600 font-black text-center text-2xl tracking-[0.5em] text-purple-700" 
                    />
                  </div>

                  {demoOtpNotice && (
                    <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/80 text-left text-xs text-purple-950 font-semibold space-y-1 block leading-relaxed my-2">
                      <span className="font-extrabold text-purple-800 flex items-center gap-1">💡 Sandbox 디버그 지원 가이드</span>
                      메일 전송 환경이 아닐 경우, 아래 인증값을 사용하여 성공적으로 비밀번호를 검증 및 변경할 수 있습니다.<br/>
                      <span className="bg-white px-2.5 py-1 rounded-md text-purple-700 font-black text-lg block text-center border border-purple-200 tracking-widest mt-2">{demoOtpNotice}</span>
                    </div>
                  )}

                  <Button type="submit" disabled={loading} className="w-full h-16 bg-purple-600 hover:bg-purple-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-purple-200 mt-4 cursor-pointer transition-all">
                    {loading ? '인증 확인 중...' : '인증번호 확인'}
                  </Button>

                  <div className="flex items-center justify-between pt-2">
                    <button 
                      type="button" 
                      onClick={() => setForgotStep('email')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-purple-600 transition-all"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> 이메일 재입력
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setForgotStep('email');
                        setMode('login');
                      }}
                      className="text-xs font-bold text-gray-400 hover:text-purple-600 transition-all"
                    >
                      로그인화면으로
                    </button>
                  </div>
                </form>
              </>
            )}

            {forgotStep === 'password' && (
              <>
                {/* Step 3: Password Update Form */}
                <div className="text-center space-y-6">
                  <div className="inline-flex flex-col items-center gap-4">
                     <div className="w-16 h-16 bg-green-100 rounded-[22px] flex items-center justify-center text-green-600 shadow-xl border border-green-200">
                       <ShieldCheck className="w-8 h-8" />
                     </div>
                     <h1 className="text-3xl font-black tracking-tighter text-gray-900 font-sans">새 비밀번호 설정</h1>
                  </div>
                  <p className="text-gray-400 font-medium whitespace-pre-line leading-relaxed">
                    이메일 본인인증이 정상 승인되었습니다.{'\n'}새롭게 사용할 비밀번호를 입력해 주세요.
                  </p>
                </div>

                <form onSubmit={handleConfirmNewPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">새 비밀번호</Label>
                    <Input 
                      type="password" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="새 비밀번호 (6자 이상)" 
                      className="h-14 bg-gray-50 border-gray-100 rounded-2xl focus-visible:ring-purple-600 font-bold" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">새 비밀번호 확인</Label>
                    <Input 
                      type="password" 
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="새 비밀번호 다시 입력" 
                      className="h-14 bg-gray-50 border-gray-50 rounded-2xl focus-visible:ring-purple-600 font-bold" 
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full h-16 bg-green-600 hover:bg-green-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-green-200 mt-4 cursor-pointer transition-all">
                    {loading ? '비밀번호 재설정 중...' : '새 비밀번호 설정 완료'}
                  </Button>
                </form>
              </>
            )}
          </>
        )}

        <p className="text-center text-[10px] text-gray-300 font-bold uppercase tracking-widest">
          Premium Knowledge Platform BE ONE Academy
        </p>
      </motion.div>
    </div>
  );
}
