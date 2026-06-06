
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface InicisParams {
  price: number;
  orderName: string;
  userName: string;
  userEmail: string;
  userTel: string;
  userId: string;
  courseId: string;
}

export const useInicis = () => {
  const [loading, setLoading] = useState(false);

  const requestInicisPay = useCallback(async (params: InicisParams) => {
    setLoading(true);
    try {
      const timestamp = new Date().getTime().toString();
      const oid = `ORD-${timestamp}-${Math.floor(Math.random() * 1000)}`;
      
      const apiUrl = '/api/payment/inicis/sign';
      console.log('Fetching signature from:', apiUrl, 'Full URL:', window.location.origin + apiUrl);
      
      // 1. Get Signature and Create Order on Backend (to bypass RLS)
      const signRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: params.price,
          oid: oid,
          timestamp: timestamp,
          userId: params.userId,
          courseId: params.courseId,
          orderName: params.orderName
        })
      });
      
      const responseText = await signRes.text();
      console.log('Raw response from sign API:', responseText.substring(0, 100));
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse JSON response:', responseText);
        // If it looks like HTML, it's likely a 404 or 500 error page from server
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
          throw new Error('서버 오류가 발생했습니다. (API 경로를 찾을 수 없거나 서버가 중단되었습니다)');
        }
        throw new Error('서버로부터 올바르지 않은 응답을 받았습니다. (Not JSON)');
      }

      if (!signRes.ok) {
        throw new Error(responseData.message || '결제 서명 생성 및 주문 생성에 실패했습니다.');
      }
      
      const { mid, signature, mKey } = responseData;

      // 2. Create Hidden Form
      const form = document.createElement('form');
      form.id = 'SendPayForm';
      form.name = 'SendPayForm'; // Adding name attribute for compatibility
      form.method = 'POST';
      form.style.display = 'none';

      const fields: Record<string, string> = {
        version: '1.0',
        gopaymethod: 'Card',
        mid: mid,
        oid: oid,
        price: params.price.toString(),
        timestamp: timestamp,
        signature: signature,
        mKey: mKey,
        currency: 'WON',
        buyername: params.userName,
        buyertel: params.userTel,
        buyeremail: params.userEmail,
        goodname: params.orderName,
        returnUrl: `${window.location.origin}/api/payment/inicis/callback`,
        notifyUrl: `${window.location.origin}/api/payment/inicis/notify`,
        use_chkfake: 'Y',
        closeUrl: `${window.location.origin}/payment/close`,
        payViewType: 'overlay',
        acceptmethod: 'HPP(1):below1000:centerView(Y):popview(Y)',
      };

      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      console.log('Form appended, triggering INIStdPay...');

      // 4. Run Inicis StandPay
      // Use a small delay to ensure DOM is updated
      setTimeout(() => {
        const inicis = (window as any).INIStdPay;
        if (inicis) {
          try {
            inicis.pay('SendPayForm');
          } catch (e) {
            console.error('INIStdPay.pay error:', e);
            toast.error('결제창을 여는 중 오류가 발생했습니다.');
            setLoading(false);
          }
        } else {
          toast.error('이니시스 결제 모듈이 아직 로드되지 않았습니다.');
          setLoading(false);
        }
      }, 300);

    } catch (error: any) {
      console.error('Inicis payment error:', error);
      toast.error(error.message || '결제 요청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { requestInicisPay, loading };
};
