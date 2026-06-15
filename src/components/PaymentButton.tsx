
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button'; 
import { ShoppingCart, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

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
  } | null;
}

export const PaymentButton: React.FC<PaymentButtonProps> = ({ lecture, user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
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
    window.addEventListener('storage', handleSettingsChange);

    return () => {
      window.removeEventListener('beone-payment-settings-changed', handleSettingsChange);
      window.removeEventListener('storage', handleSettingsChange);
    };
  }, []);

  const handleAddToCart = async () => {
    if (!user || !user.id) {
      toast.error('로그인이 필요합니다. 로그인 페이지로 이동합니다.');
      navigate('/auth/login');
      return;
    }

    setLoading(true);

    try {
      // 1. Check if the course is already in the Cart (PENDING status)
      const { data: existingOrder, error: fetchErr } = await supabase
        .from('orders')
        .select('id, merchant_uid')
        .eq('user_id', user.id)
        .eq('course_id', lecture.id)
        .eq('status', 'PENDING')
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      let oid = '';
      if (existingOrder) {
        oid = existingOrder.merchant_uid;
        toast.info('이미 수강 바구니에 담겨있는 강의입니다. 장바구니로 안전하게 안내합니다.', {
          position: 'top-center'
        });
      } else {
        // 2. Generate precision Merchant UID (OID)
        const timestamp = Date.now().toString();
        oid = `OID_${lecture.id.substring(0, 8).toUpperCase()}_${timestamp.substring(5)}`;

        // 3. Insert PENDING order row representatively
        const { error: insertErr } = await supabase
          .from('orders')
          .insert([{
            user_id: user.id,
            course_id: lecture.id,
            amount: Number(lecture.price),
            status: 'PENDING',
            order_name: lecture.title,
            merchant_uid: oid,
            created_at: new Date().toISOString()
          }]);

        if (insertErr) throw insertErr;
        
        window.dispatchEvent(new Event('cart-updated'));
        
        toast.success('수강 바구니에 성공적으로 담겼습니다! 결제선택 단계로 안내합니다. 🎉', {
          position: 'top-center'
        });
      }

      // 4. Navigate smoothly to Cart
      setTimeout(() => {
        navigate('/cart');
      }, 500);

    } catch (err: any) {
      console.error('Cart Insertion Error:', err);
      toast.error(`수강 바구니 이동 중 에러: ${err.message || '인증/데이터베이스 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 w-full">
      <Button 
        onClick={handleAddToCart} 
        disabled={loading}
        className="w-full h-14 text-lg font-black bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-xl shadow-purple-100 transition-all active:scale-95 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            수강 정보 담는 중...
          </>
        ) : (
          <>
            <ShoppingCart className="h-5 w-5" />
            수강 신청하고 장바구니 가기
          </>
        )}
      </Button>
      <p className="text-[11px] text-gray-400 text-center font-bold">
        버튼 클릭 시 수강 바구니에 담긴 후, 해당 페이지로 즉시 이동합니다.
      </p>
    </div>
  );
};
