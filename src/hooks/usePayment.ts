
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { PortOneResponse, PaymentRequestParams } from '../types/payment';
import { toast } from 'sonner';
import { cmsService } from '../services/cmsService';

export const usePayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const requestPay = useCallback(async (params: {
    lectureId: string;
    lectureTitle: string;
    amount: number;
    userId: string;
    userEmail?: string;
    userName?: string;
  }) => {
    const { IMP } = window;
    
    // Fetch settings from DB
    const settings = await cmsService.getPaymentSettings();
    const storeId = settings.portone_store_id || import.meta.env.VITE_PORTONE_STORE_ID;
    const mid = settings.pg_id;

    if (!IMP) {
      toast.error('결제 모듈을 불러올 수 없습니다. 페이지를 새로고침 해주세요.');
      return;
    }

    if (!storeId) {
      toast.error('가맹점 식별코드(IMP_ID)가 설정되지 않았습니다. 관리자 설정에서 확인해 주세요.');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. 초기화
      IMP.init(storeId);

      // 2. merchant_uid 생성 (고유 주문번호: 날짜 + 랜덤값)
      const merchant_uid = `ORD-${new Date().getTime()}-${Math.floor(Math.random() * 10000)}`;

      // 3. 결제 시도 전 Supabase에 임시 결제 내역 저장
      const { error: dbError } = await supabase.from('payments').insert([{
        merchant_uid,
        amount: params.amount,
        status: 'pending',
        user_id: params.userId,
        lecture_id: params.lectureId,
        created_at: new Date().toISOString()
      }]);

      if (dbError) throw new Error('결제 정보 생성에 실패했습니다: ' + dbError.message);

      // 4. 결제창 호출
      const pgProvider = mid ? `${settings.pg_company}.${mid}` : settings.pg_company;
      
      const paymentData: PaymentRequestParams = {
        pg: pgProvider, // 예: 'html5_inicis.INIpayTest'
        pay_method: 'card',
        merchant_uid,
        name: params.lectureTitle,
        amount: params.amount,
        buyer_email: params.userEmail,
        buyer_name: params.userName,
      };

      return new Promise<PortOneResponse>((resolve, reject) => {
        IMP.request_pay(paymentData, async (rsp: PortOneResponse) => {
          if (rsp.success) {
            try {
              // 5. 결제 성공 시 DB 업데이트 (임시 저장 단계)
              // 실제 검증은 서버(Edge Functions)에서 수행해야 함
              const { error: updateError } = await supabase
                .from('payments')
                .update({
                  imp_uid: rsp.imp_uid,
                  status: 'paid',
                })
                .eq('merchant_uid', merchant_uid);

              if (updateError) console.error('Payment update error:', updateError);
              
              toast.success('결제가 완료되었습니다. 검증 중입니다...');
              resolve(rsp);
            } catch (err) {
              reject(err);
            }
          } else {
            // 결제 실패 처리
            await supabase
              .from('payments')
              .update({ status: 'failed' })
              .eq('merchant_uid', merchant_uid);
              
            toast.error(`결제 실패: ${rsp.error_msg}`);
            reject(new Error(rsp.error_msg));
          }
          setIsProcessing(false);
        });
      });
    } catch (error: any) {
      setIsProcessing(false);
      toast.error(error.message || '결제 진행 중 오류가 발생했습니다.');
      throw error;
    }
  }, []);

  return { requestPay, isProcessing };
};
