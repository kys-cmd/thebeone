
import React, { useState, useEffect } from 'react';
import { useInicis } from '../hooks/useInicis';
import { Button } from './ui/button'; 
import { CreditCard, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentButtonProps {
  lecture: {
    id: string;
    title: string;
    price: number;
  };
  user: {
    id: string;
    email: string;
    name: string;
    phone?: string;
  };
}

export const PaymentButton: React.FC<PaymentButtonProps> = ({ lecture, user }) => {
  const { requestInicisPay, loading } = useInicis();
  const [isPaymentEnabled, setIsPaymentEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('beone_payment_enabled');
      return stored !== 'false';
    }
    return true;
  });

  useEffect(() => {
    const handleSettingsChange = (e: any) => {
      if (e.detail !== undefined) {
        setIsPaymentEnabled(e.detail !== false);
      } else {
        const stored = localStorage.getItem('beone_payment_enabled');
        setIsPaymentEnabled(stored !== 'false');
      }
    };

    window.addEventListener('beone-payment-settings-changed', handleSettingsChange);
    // Listen to native storage events from other tabs/frames
    window.addEventListener('storage', handleSettingsChange);

    return () => {
      window.removeEventListener('beone-payment-settings-changed', handleSettingsChange);
      window.removeEventListener('storage', handleSettingsChange);
    };
  }, []);

  const handlePayment = async () => {
    if (!isPaymentEnabled) {
      toast.error('현재 결제 기능 개발 중으로 관리자가 승인 후 강의를 청취하실 수 있습니다', {
        duration: 8000,
        position: 'top-center'
      });
      alert('현재 결제 기능 개발 중으로 관리자가 승인 후 강의를 청취하실 수 있습니다');
      return;
    }

    try {
      await requestInicisPay({
        price: lecture.price,
        orderName: lecture.title,
        userName: user.name || 'GUEST',
        userEmail: user.email || '',
        userTel: user.phone || '010-0000-0000',
        userId: user.id,
        courseId: lecture.id
      });
      // Note: Inicis StdPay redirect happens via form submission in useInicis
    } catch (err: any) {
      console.error('Payment Error:', err);
      toast.error('결제 요청 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="space-y-2 w-full">
      <Button 
        onClick={handlePayment} 
        disabled={loading}
        className={`w-full h-14 text-lg font-black rounded-2xl shadow-xl transition-all active:scale-95 ${
          !isPaymentEnabled 
            ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-100' 
            : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            결제 준비 중...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-5 w-5" />
            {!isPaymentEnabled ? "수강 신청 문의하기" : `${lecture.price.toLocaleString()}원 결제하기`}
          </>
        )}
      </Button>
      {!isPaymentEnabled && (
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center flex items-center justify-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-[11px] text-amber-800 font-bold leading-normal">
            현재 사이트 결제 시스템 개발/점검 중입니다. 버튼 클릭 시 수강 승인 안내가 노출됩니다.
          </p>
        </div>
      )}
    </div>
  );
};
