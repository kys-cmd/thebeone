import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/authService';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Listen to Auth State Changes, especially PASSWORD_RECOVERY or SIGNED_IN
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      console.log('ResetPassword auth event:', event);
      if (session) {
        setCheckingSession(false);
      }
    });

    // Fallback Session Check
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (mounted) setCheckingSession(false);
        } else {
          // Give some additional time for hash hydration to finish if it hasn't already
          setTimeout(async () => {
            if (!mounted) return;
            const { data: { session: secondCheck } } = await supabase.auth.getSession();
            if (!secondCheck) {
              toast.error('유효하지 않거나 만료된 재설정 링크입니다. 다시 진행해주세요.');
              navigate('/auth/login');
            } else {
              setCheckingSession(false);
            }
          }, 2000);
        }
      } catch (err) {
        console.error('Error verifying reset session:', err);
        if (mounted) {
          toast.error('오류 발생: 로그인 화면으로 이동합니다.');
          navigate('/auth/login');
        }
      }
    };
    
    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      return toast.error('모든 정보를 입력해주세요.');
    }
    if (password.length < 6) {
      return toast.error('비밀번호는 최소 6자리 이상이어야 합니다.');
    }
    if (password !== confirmPassword) {
      return toast.error('비밀번호가 일치하지 않습니다.');
    }

    setLoading(true);
    try {
      await authService.updatePassword(password);
      toast.success('비밀번호가 성공적으로 변경되었습니다! 새로운 비밀번호로 로그인해주세요.');
      // After changing, sign out to clear the recovery session
      await authService.signOut();
      navigate('/auth/login');
    } catch (error: any) {
      toast.error(error.message || '비밀번호 변경에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-500 font-bold text-sm">보안 세션을 확인하는 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-32">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[450px] bg-white rounded-[40px] shadow-2xl border border-gray-100 p-10 space-y-10"
      >
        {/* Header */}
        <div className="text-center space-y-6">
          <div className="inline-flex flex-col items-center gap-4">
             <div className="w-16 h-16 bg-purple-600 rounded-[22px] flex items-center justify-center shadow-2xl shadow-purple-200">
               <span className="text-white text-3xl font-black">BE</span>
             </div>
             <h1 className="text-3xl font-black tracking-tighter text-gray-900">새 비밀번호 설정</h1>
          </div>
          <p className="text-gray-400 font-medium whitespace-pre-line leading-relaxed">
            새로 사용할 비밀번호를 입력해 주세요.
          </p>
        </div>

        {/* Change Password Form */}
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">New Password</Label>
            <Input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="새 비밀번호 (6자 이상)" 
              className="h-14 bg-gray-50 border-gray-50 rounded-2xl focus-visible:ring-purple-600 font-bold" 
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Confirm Password</Label>
            <Input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="새 비밀번호 확인" 
              className="h-14 bg-gray-50 border-gray-50 rounded-2xl focus-visible:ring-purple-600 font-bold" 
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full h-16 bg-purple-600 hover:bg-purple-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-purple-200 mt-4">
            {loading ? '변경 중...' : '비밀번호 변경하기'}
          </Button>
        </form>

        <p className="text-center text-[10px] text-gray-300 font-bold uppercase tracking-widest">
          Premium Knowledge Platform BE ONE Academy
        </p>
      </motion.div>
    </div>
  );
}
