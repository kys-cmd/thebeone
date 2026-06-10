import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Trash2, ChevronRight, CreditCard, ShieldCheck, ArrowLeft, Ticket, Loader2, Sparkles, Check, Square, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useInicisPay } from '@/hooks/useInicisPay';

export default function Cart() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Integrated PG hook interface to guarantee unified parameters & time-zone stability
  const { isSdkLoaded, isInitializing: isPaying, requestPayment } = useInicisPay();
  const [isBulkPaying, setIsBulkPaying] = useState(false);

  // Mileage States
  const [userMileage, setUserMileage] = useState(0);
  const [useMileageInput, setUseMileageInput] = useState<number | ''>('');

  // 2. Fetch User's Pending Orders and Mileage from Supabase
  const fetchUserMileage = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('mileage')
        .eq('id', user.id)
        .single();
      if (!error && data) {
        setUserMileage((data as any).mileage || 0);
      }
    } catch (err) {
      console.error('[Cart Fetch Mileage Error]:', err);
    }
  };

  const fetchCartItems = async () => {
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
      const loadedItems = data || [];
      setItems(loadedItems);
      // Auto-select all items by default on load
      setSelectedIds(loadedItems.map(item => item.id));
    } catch (err) {
      console.error('Error fetching cart items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCartItems();
    fetchUserMileage();
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
      setSelectedIds((prev) => prev.filter((id) => id !== orderId));
      window.dispatchEvent(new Event('cart-updated'));
      toast.success('수강 항목이 바구니에서 제외되었습니다.');
    } catch (err: any) {
      alert(`항목 삭제에 실패했습니다: ${err.message || '인증/네트워크 오류'}`);
    }
  };

  // 4. Batch Delete Selected Items
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      toast.error('선택된 항목이 없습니다.');
      return;
    }
    if (!confirm(`선택한 ${selectedIds.length}개의 강의를 장바구니에서 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;
      setItems((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);
      window.dispatchEvent(new Event('cart-updated'));
      toast.success('선택한 항목들이 삭제되었습니다.');
    } catch (err: any) {
      toast.error(`선택 삭제 실패: ${err.message || '인증 오류'}`);
    }
  };

  // 5. Individual Item Regular Payment Trigger (Inicis Unified Hook)
  const handlePayment = async (item: any) => {
    if (!user) {
      alert('로그인이 필요한 서비스입니다.');
      return;
    }
    if (!isSdkLoaded) {
      alert('결제 연동 스크립트가 로딩 중입니다. 잠시 후 편하게 다시 시도해 주세요.');
      return;
    }

    try {
      await requestPayment({
        price: item.amount,
        courseId: item.course_id,
        courseName: item.courses?.title || '온라인 교육 강좌 수강권',
        userId: user.id,
        userEmail: user.email || '',
        userName: user.name || '구매자',
        userPhone: user.mobile_phone || '010-0000-0000'
      });
    } catch (err: any) {
      toast.error(`결제 오류: ${err.message || '결제 승인 프로세스를 불러오지 못했습니다.'}`);
    }
  };

  // 6. Bulk Test Payment - Loops through all selected items for an instant checkout experience
  const handleBulkTestPayment = async () => {
    const selectedItems = items.filter(item => selectedIds.includes(item.id));
    if (selectedItems.length === 0) {
      toast.error('결제할 수강 항목을 선택해주세요.');
      return;
    }

    setIsBulkPaying(true);
    const loadToast = toast.loading(`${selectedItems.length}개 강좌의 가상 라이선스 승인 프로세스를 수행 중...`);

    try {
      const sessionData = await supabase.auth.getSession();
      const token = sessionData.data.session?.access_token || '';

      // A. Deduct mileage from profile
      if (appliedMileage > 0 && user?.id) {
        const nextMileage = Math.max(0, userMileage - appliedMileage);
        const { error: profileDiscountErr } = await supabase
          .from('profiles')
          .update({ mileage: nextMileage })
          .eq('id', user.id);
        
        if (profileDiscountErr) {
          console.error('[Profiles Mileage Update Error]:', profileDiscountErr);
          throw new Error(`마일리지 차감 오류: ${profileDiscountErr.message}`);
        } else {
          setUserMileage(nextMileage);
        }
      }

      let successCount = 0;
      let remainingMileageToDeduct = appliedMileage;

      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        let itemMileageUsed = 0;

        if (appliedMileage > 0) {
          if (i === selectedItems.length - 1) {
            itemMileageUsed = remainingMileageToDeduct;
          } else {
            itemMileageUsed = Math.round((Number(item.amount || 0) / selectedSubtotal) * appliedMileage);
            remainingMileageToDeduct -= itemMileageUsed;
          }
        }

        try {
          const response = await fetch('/api/core-api', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              action: 'process-payment',
              merchant_uid: item.merchant_uid,
              amount: Number(item.amount || item.price || 0),
              courseId: item.course_id,
              userId: user?.id,
              payment_method: 'Test_Instant_Auth',
              payment_tid: `TID_MOCK_${crypto.randomUUID().substring(0, 8).toUpperCase()}`,
              mileage_used: itemMileageUsed
            })
          });

          const result = await response.json();
          if (response.ok && result.status === 'success') {
            successCount++;
          }
        } catch (e) {
          console.error('[Bulk item fail]:', item.id, e);
        }
      }

      toast.dismiss(loadToast);
      window.dispatchEvent(new Event('cart-updated'));

      if (successCount > 0) {
        toast.success(`🎉 선택하신 ${successCount}개의 강의가 승인되어 즉시 수강 권한이 정식으로 부여되었습니다!`);
        setTimeout(() => {
          navigate(`/payment/callback?status=success&message=${encodeURIComponent(`선택된 ${successCount}개의 강의가 즉시 자동 일괄 활성화되었습니다!`)}`);
        }, 800);
      } else {
        throw new Error('선택한 강의 승인에 실패하였습니다.');
      }
    } catch (err: any) {
      toast.dismiss(loadToast);
      alert(`테스트 결제 승인 오류: ${err.message || '인증/네트워크 세션 세팅 유실'}`);
    } finally {
      setIsBulkPaying(false);
    }
  };

  // Selection Checkbox Toggle Handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(item => item.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(x => x !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  // Pricing calculations
  const selectedItems = items.filter(item => selectedIds.includes(item.id));
  const selectedSubtotal = selectedItems.reduce((acc, item) => acc + (item.amount || item.price || 0), 0);
  
  // Calculate applicable mileage discount
  const appliedMileage = typeof useMileageInput === 'number' ? Math.min(useMileageInput, userMileage, selectedSubtotal) : 0;
  const finalTotal = Math.max(0, selectedSubtotal - appliedMileage);

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
    <div className="min-h-screen bg-gray-50 pt-32 pb-20 font-sans">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Title */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-gray-900 flex items-center gap-2">
              수강 바구니 <ShoppingCart className="w-6 h-6 text-purple-600 inline" />
            </h1>
            <p className="text-xs text-slate-400 font-medium">원하는 최상의 프리미엄 교육 강좌들을 담아 일괄 또는 선택 결제할 수 있습니다.</p>
          </div>
          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 font-black px-4 py-1.5 border-none text-xs rounded-full">
            {items.length}개 담김
          </Badge>
        </div>

        {isLoading ? (
          <div className="py-40 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
            <p className="text-gray-400 font-extrabold text-sm animate-pulse">수강 신청 바구니 내역을 동기화 중입니다...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Column: Board - list style with select option */}
            <div className="lg:col-span-2 space-y-4">
              
              {items.length > 0 ? (
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                  
                  {/* Board Controls */}
                  <div className="p-4 px-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={handleToggleSelectAll}
                        className="flex items-center gap-2 text-slate-700 hover:text-purple-600 transition-colors"
                      >
                        {selectedIds.length === items.length ? (
                          <CheckSquare className="w-4.5 h-4.5 text-purple-600 fill-purple-50" />
                        ) : (
                          <Square className="w-4.5 h-4.5 text-slate-300" />
                        )}
                        전체 선택 ({selectedIds.length}/{items.length})
                      </button>
                    </div>

                    {selectedIds.length > 0 && (
                      <button
                        onClick={handleDeleteSelected}
                        className="flex items-center gap-1.5 text-rose-500 hover:text-rose-700 transition-colors py-1 px-3 bg-white border border-rose-100 rounded-full shadow-2sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        선택 삭제
                      </button>
                    )}
                  </div>

                  {/* Board List (Table / Row Board Layout) */}
                  <div className="divide-y divide-slate-100">
                    <AnimatePresence mode="popLayout">
                      {items.map((item) => {
                        const isItemSelected = selectedIds.includes(item.id);
                        return (
                          <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className={`p-6 flex items-center gap-4 transition-colors ${
                              isItemSelected ? 'bg-purple-50/20' : 'hover:bg-slate-50/50'
                            }`}
                          >
                            {/* Checkbox */}
                            <button
                              onClick={() => handleToggleSelect(item.id)}
                              className="shrink-0 transition-all p-1"
                            >
                              {isItemSelected ? (
                                <CheckSquare className="w-5 h-5 text-purple-600 fill-purple-100/30" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                              )}
                            </button>

                            {/* Minimal Board Visual Thumbnail */}
                            <div className="w-20 aspect-video rounded-lg overflow-hidden border border-slate-100 shrink-0 hidden sm:block bg-slate-100">
                              <img
                                src={item.courses?.thumbnail || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=300'}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                                alt=""
                              />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md shrink-0">
                                  {item.courses?.instructor || '아카데미 전문'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                  {item.courses?.category === 'beone_exclusive_online' ? '비원 프리미엄' : '정식 코스'}
                                </span>
                              </div>
                              <h3 className="font-extrabold text-slate-800 text-sm sm:text-base leading-snug truncate">
                                {item.courses?.title || '수강 예정 교육 과정'}
                              </h3>
                            </div>

                            {/* Right: Price & Row Delete */}
                            <div className="text-right shrink-0 flex items-center gap-4">
                              <span className="font-black text-slate-900 text-sm sm:text-base">
                                {(item.amount || item.price || 0).toLocaleString()}원
                              </span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                  title="강좌 삭제"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <div className="py-24 bg-white rounded-[32px] border border-dashed border-slate-200 text-center space-y-5">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <ShoppingCart className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-500 font-extrabold text-sm">수강 바구니가 비어 있습니다.</p>
                    <p className="text-xs text-slate-400">다양하고 심도 깊은 정규 학습 코스를 둘러보세요!</p>
                  </div>
                  <Link to="/courses" className="inline-block">
                    <Button className="h-10 px-6 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs">
                      교육 과정 구경하기
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Right Column: Checkout Summary Panel */}
            <aside className="space-y-4 sticky top-32">
              <Card className="rounded-[32px] border border-slate-100 shadow-md overflow-hidden bg-white">
                <div className="p-8 space-y-6">
                  <h3 className="text-lg font-black text-slate-800 tracking-tight border-b pb-4">수강료 결제 청약</h3>

                  <div className="space-y-4 text-xs font-bold text-slate-600">
                    <div className="flex justify-between items-center">
                      <span>선택한 항목 개수</span>
                      <span className="text-slate-800 text-sm font-black">{selectedItems.length}개 / 전체 {items.length}개</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span>총 수강 강의 금액</span>
                      <span className="text-slate-800 text-sm font-black">{selectedSubtotal.toLocaleString()}원</span>
                    </div>

                    {/* Mileage point input field */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                        <span className="flex items-center gap-1.5 text-purple-600">
                          <Ticket className="w-4 h-4" /> 마일리지 할인 적용
                        </span>
                        <span className="text-slate-400 font-bold">보유: <b className="text-slate-700">{userMileage.toLocaleString()} P</b></span>
                      </div>
                      
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type="number"
                            placeholder="사용할 마일리지 입력"
                            value={useMileageInput === '' ? '' : useMileageInput}
                            onChange={(e) => {
                              const valStr = e.target.value;
                              if (valStr === '') {
                                setUseMileageInput('');
                                return;
                              }
                              const val = Math.max(0, parseInt(valStr, 10) || 0);
                              setUseMileageInput(Math.min(val, userMileage, selectedSubtotal));
                            }}
                            className="h-11 pr-12 font-bold text-xs rounded-xl text-purple-700 border-purple-200 focus:ring-purple-500 focus:border-purple-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">P</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setUseMileageInput(Math.min(userMileage, selectedSubtotal));
                          }}
                          className="h-11 px-4 text-xs font-black border-purple-200 text-purple-600 hover:bg-purple-50 rounded-xl shrink-0"
                        >
                          전체 사용
                        </Button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-rose-500 pt-2">
                      <span>마일리지 할인 적용</span>
                      <span>-{appliedMileage.toLocaleString()}원</span>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                      <span className="font-extrabold text-slate-800 text-sm">최종 결제 금액</span>
                      <span className="text-2xl font-black text-purple-600 tracking-tight">{finalTotal.toLocaleString()}원</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3 pt-2">
                    {selectedItems.length > 0 ? (
                      <div className="space-y-2.5">
                        
                        {/* Instant mock payment for instant enrollment */}
                        <Button
                          onClick={handleBulkTestPayment}
                          disabled={isPaying || isBulkPaying}
                          className="w-full h-13 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm rounded-2xl shadow-md shadow-emerald-50 flex items-center justify-center gap-1.5"
                        >
                          {isBulkPaying ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 animate-pulse" />
                              선택 {selectedItems.length}건 간편 테스트 승인
                            </>
                          )}
                        </Button>

                        {/* Standard PG payment for the first selected item to avoid layout or complex SDK payload mismatch */}
                        <Button
                          onClick={() => handlePayment(selectedItems[0])}
                          disabled={isPaying || isBulkPaying}
                          variant="outline"
                          className="w-full h-11 border-purple-200 hover:bg-purple-50 hover:text-purple-700 text-purple-700 font-extrabold text-xs rounded-2xl flex items-center justify-center gap-1.5"
                        >
                          {isPaying ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4" />
                              상점 신용카드 실결제 ({selectedItems[0].courses?.title?.substring(0, 6)}...)
                            </>
                          )}
                        </Button>

                      </div>
                    ) : (
                      <Button
                        disabled
                        className="w-full h-12 bg-slate-100 text-slate-400 font-bold text-xs rounded-2xl cursor-not-allowed"
                      >
                        결제할 강의를 체크박스에 담아주세요
                      </Button>
                    )}
                  </div>
                </div>

                {/* Footer instructions */}
                <div className="bg-slate-900 p-6 text-white space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-purple-400">
                    <ShieldCheck className="w-4.5 h-4.5 shrink-0" /> 수강 자격 자동 보장
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                    선택하신 수강 신청 완료 시, 즉시 계정에 강좌에 대한 12개월 수강 권한이 자동 부여됩니다. PG 표준 암호화 결제가 적용 중입니다.
                  </p>
                </div>
              </Card>

              <Link
                to="/courses"
                className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-purple-600 transition-colors pt-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> 계속 쇼핑하며 어카이브 구경
              </Link>
            </aside>

          </div>
        )}
      </div>
    </div>
  );
}
