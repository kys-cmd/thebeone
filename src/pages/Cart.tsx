import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Trash2, ChevronRight, CreditCard, ShieldCheck, ArrowLeft, Ticket, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';

export default function Cart() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);

  // 1. Load KG Inicis Standard Web Javascript SDK
  useEffect(() => {
    const existingScript = document.getElementById('inicis-stdpay-script');
    if (existingScript) {
      setIsSdkLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'inicis-stdpay-script';
    script.src = 'https://stdpay.inicis.com/stdjs/INIStdPay.js';
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => {
      console.log('[INICIS] Standard Pay SDK loaded securely.');
      setIsSdkLoaded(true);
    };
    script.onerror = () => {
      console.error('[INICIS] Failed to load Inicis payment script.');
    };
    document.head.appendChild(script);

    return () => {
      const leftover = document.getElementById('inicis-temp-form-container');
      if (leftover) leftover.remove();
    };
  }, []);

  // 2. Fetch User's Pending Orders from Supabase
  useEffect(() => {
    async function fetchCartItems() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, courses(*)')
          .eq('user_id', user.id)
          .eq('status', 'PENDING');

        if (error) throw error;
        setItems(data || []);
      } catch (err) {
        console.error('Error fetching cart items:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCartItems();
  }, [user?.id]);

  // 3. Remove Item strictly from Supabase DB & update State
  const handleDeleteItem = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
      setItems((prev) => prev.filter((item) => item.id !== orderId));
    } catch (err: any) {
      alert(`항목 삭제에 실패했습니다: ${err.message || '인증/네트워크 오류'}`);
    }
  };

  // 4. Pay Handler: POST /api/init-pay & Dynamic Form trigger
  const handlePayment = async (item: any) => {
    if (!user) {
      alert('로그인이 필요한 서비스입니다.');
      return;
    }
    if (!isSdkLoaded) {
      alert('결제 연동 스크립트가 아직 로딩 중입니다. 잠시 후 편하게 다시 시도해 주세요.');
      return;
    }

    setIsPaying(true);

    try {
      // Create high-precision Unique OID
      const timestamp = Date.now().toString();
      const oid = `OID_${item.course_id.substring(0, 8).toUpperCase()}_${timestamp.substring(5)}`;

      // Post payload to Backend dynamic init-pay
      const response = await fetch('/api/init-pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price: item.amount,
          oid,
          timestamp,
          userId: user.id,
          courseId: item.course_id,
          orderName: item.courses?.title || '온라인 교육 강좌 수강권',
        }),
      });

      if (!response.ok) {
        throw new Error('결제 서명 생성 API 통신 실패');
      }

      const initResult = await response.json();
      if (initResult.status !== 'success') {
        throw new Error(initResult.message || '결제 승인 서명 생성 중 오류');
      }

      const { signature, mKey, mid } = initResult;
      const clientOrigin = window.location.origin;
      const appUrl = import.meta.env.VITE_APP_URL || clientOrigin;

      // Ensure fresh template form container to prevent collision
      const oldContainer = document.getElementById('inicis-temp-form-container');
      if (oldContainer) oldContainer.remove();

      const formContainer = document.createElement('div');
      formContainer.id = 'inicis-temp-form-container';
      formContainer.style.display = 'none';

      const formId = 'inicis_payment_form';
      const form = document.createElement('form');
      form.id = formId;
      form.method = 'POST';
      form.acceptCharset = 'UTF-8';

      // 5. Consolidate specified fields and PC Overlay fields for complete compatibility
      const fields: Record<string, string> = {
        // Specified client fields
        P_INI_PAYMENT: 'Card',
        P_MID: mid,
        P_OID: oid,
        P_AMT: item.amount.toString(),
        P_UNAME: user.name || '구매자',
        P_TIMESTAMP: timestamp,
        P_SIGNATURE: signature,
        P_NEXT_URL: `${appUrl}/api/inicis-return`,
        P_NOTI_URL: `${appUrl}/api/payment/inicis/notify`,
        P_RETURN_URL: `${appUrl}/payment/callback`,
        P_CHARSET: 'UTF-8',
        P_RESERVED: 'twoseq=Y&block_isp=Y',

        // PC StdPay structural requirements
        version: '1.0',
        gopaymethod: 'Card',
        mid: mid,
        oid: oid,
        price: item.amount.toString(),
        timestamp: timestamp,
        signature: signature,
        mKey: mKey,
        use_chkfake: 'Y',
        currency: 'WON',
        goodname: item.courses?.title || '온라인 강좌 수강권',
        buyername: user.name || '구매자',
        buyertel: user.mobile_phone || '010-0000-0000',
        buyeremail: user.email || 'user@example.com',
        returnUrl: `${appUrl}/api/inicis-return`,
        closeUrl: `${clientOrigin}/payment/close`,
        popupUrl: `${clientOrigin}/payment/popup`,
        payViewType: 'overlay',
        acceptmethod: 'HPP(1):below1000:center:va_receipt',
      };

      Object.entries(fields).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });

      formContainer.appendChild(form);
      document.body.appendChild(formContainer);

      // Delete the current pending DB order row just before launching payment 
      // (This prevents double draft database clutter upon success)
      await supabase.from('orders').delete().eq('id', item.id);

      // Fire Inicis standard overlay payment overlay box
      if ((window as any).INIStdPay && typeof (window as any).INIStdPay.pay === 'function') {
        console.log('[Cart] Launching INIStdPay SDK overlay payment form instance ID:', formId);
        (window as any).INIStdPay.pay(formId);
      } else {
        console.warn('[Cart] INIStdPay module is unavailable. Attempting standard form submission.');
        form.submit();
      }
    } catch (err: any) {
      alert(`결제 초기화 실패: ${err.message || '인증 오류'}`);
    } finally {
      setIsPaying(false);
    }
  };

  const subtotal = items.reduce((acc, item) => acc + (item.amount || item.price || 0), 0);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-32 pb-20">
        <Card className="p-12 max-w-md w-full text-center space-y-6 rounded-[32px] shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 leading-tight">로그인이 필요합니다</h2>
          <p className="text-gray-500 font-bold text-sm">장바구니는 로그인 후 편리하게 수강 등록과 연계하여 관리할 수 있습니다.</p>
          <div className="flex gap-4 justify-center">
            <Link to="/auth/login" className="w-full">
              <Button className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black">
                로그인하러 가기
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-32 pb-20">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-12">
          <h1 className="text-4xl font-black tracking-tighter text-gray-900">수강 바구니</h1>
          <Badge className="bg-purple-600 text-white font-black px-4 py-1 border-none text-sm">
            {items.length}개의 강의
          </Badge>
        </div>

        {isLoading ? (
          <div className="py-40 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
            <p className="text-gray-400 font-bold text-sm">수강 바구니 항목 정보를 조회 중입니다...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
            {/* Left: Items List */}
            <div className="lg:col-span-2 space-y-6">
              <AnimatePresence mode="popLayout">
                {items.length > 0 ? (
                  items.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 items-center relative overflow-hidden"
                    >
                      <div className="w-full md:w-48 aspect-[16/10] bg-gray-100 rounded-3xl overflow-hidden shrink-0 border border-gray-50">
                        <img
                          src={item.courses?.thumbnail || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          alt={item.courses?.title}
                        />
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="space-y-1">
                          <p className="text-xs font-black text-purple-600">
                            {item.courses?.instructor || '전문 강사진'}
                          </p>
                          <h3 className="text-xl font-black text-gray-900 leading-tight">
                            {item.courses?.title || '수강 중인 미결제 교육 코스'}
                          </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-400">
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-500" /> 평생 소장 수강권
                          </span>
                          <span className="flex items-center gap-1">
                            <ChevronRight className="w-3.5 h-3.5 text-purple-500" /> 즉시 수강 진행 가능
                          </span>
                        </div>
                      </div>

                      <div className="text-right space-y-4 w-full md:w-auto shrink-0 flex flex-col items-end">
                        <p className="text-2xl font-black text-gray-900">
                          {(item.amount || item.price || 0).toLocaleString()}원
                        </p>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                            title="바구니에서 제거"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          <Button
                            onClick={() => handlePayment(item)}
                            disabled={isPaying}
                            className="px-6 h-11 bg-purple-600 hover:bg-purple-700 text-white font-black text-sm rounded-2xl shadow-sm"
                          >
                            개별 결제
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-40 bg-white rounded-[48px] border border-dashed text-center space-y-6">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-200">
                      <ShoppingCart className="w-10 h-10" />
                    </div>
                    <p className="text-gray-400 font-bold">바구니에 담긴 강의가 없습니다.</p>
                    <Link to="/courses">
                      <Button variant="outline" className="h-12 px-8 rounded-2xl font-black">
                        강의 구경하러 가기
                      </Button>
                    </Link>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: Summary & Order */}
            <aside className="space-y-6 sticky top-32">
              <Card className="rounded-[48px] shadow-xl border-none overflow-hidden">
                <div className="p-10 space-y-8">
                  <h3 className="text-2xl font-black tracking-tighter text-gray-900">결제 정보</h3>

                  <div className="space-y-4">
                    <div className="flex justify-between font-bold text-gray-500">
                      <span>상품 금액</span>
                      <span>{subtotal.toLocaleString()}원</span>
                    </div>
                    <div className="flex justify-between font-bold text-red-500">
                      <span>할인 금액</span>
                      <span>-0원</span>
                    </div>
                    <div className="pt-4 border-t flex justify-between items-end">
                      <span className="font-black text-gray-900">최종 결제 금액</span>
                      <span className="text-3xl font-black text-purple-600 tracking-tighter">
                        {subtotal.toLocaleString()}원
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="쿠폰 번호를 입력하세요"
                        className="h-12 pl-12 bg-gray-50 border-gray-100 rounded-2xl font-bold"
                      />
                    </div>
                    
                    {items.length > 0 ? (
                      <Button
                        onClick={() => handlePayment(items[0])}
                        disabled={isPaying}
                        className="w-full h-16 bg-purple-600 hover:bg-purple-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-purple-200 flex items-center justify-center gap-2"
                      >
                        {isPaying ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <CreditCard className="w-5 h-5" />
                            {items.length > 1 ? `${items[0].courses?.title?.substring(0, 8)}... 외 결제` : '결제하기'}
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        disabled
                        className="w-full h-16 bg-gray-200 text-gray-400 font-black text-xl rounded-2xl cursor-not-allowed"
                      >
                        강의를 담아주세요
                      </Button>
                    )}
                  </div>
                </div>

                <div className="bg-gray-900 p-8 text-white space-y-4">
                  <div className="flex items-center gap-3 text-sm font-black">
                    <CreditCard className="w-5 h-5 text-purple-400" /> 간편 결제 지원
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                    카카오페이, 네이버페이, 토스페이 등으로 3초 만에 안전하고 스마트하게 결제하실 수 있습니다. PC 웹표준 PG 보안 결제 시스템이 작동 중입니다.
                  </p>
                </div>
              </Card>

              <Link
                to="/courses"
                className="flex items-center justify-center gap-2 text-gray-400 font-bold hover:text-purple-600 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> 쇼핑 계속하기
              </Link>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
