import React, { useEffect, useState } from 'react';
import { 
  CreditCard, 
  Search, 
  Filter, 
  Download, 
  MoreHorizontal, 
  Loader2,
  Calendar,
  User,
  Mail,
  BookOpen,
  ArrowUpDown,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Activity,
  Award,
  AlertTriangle,
  CheckCircle2,
  Power
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { purchaseService } from '@/services/purchaseService';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AdminSalesManagement() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  // --- 전체 결제 기능 상태 제어 ---
  const [isPaymentEnabled, setIsPaymentEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('beone_payment_enabled');
      return stored !== 'false';
    }
    return true;
  });

  const handleTogglePayment = (enabled: boolean) => {
    localStorage.setItem('beone_payment_enabled', String(enabled));
    setIsPaymentEnabled(enabled);
    window.dispatchEvent(new CustomEvent('beone-payment-settings-changed', { detail: enabled }));
    if (enabled) {
      toast.success('전체 실시간 결제 기능(PG 호출)이 활성화되었습니다.');
    } else {
      toast.warning('결제 기능이 비활성화되었습니다. 전체 사이트에 안내 알림 및 수강 신청 우회 모드가 작용합니다.');
    }
  };

  // --- Sandbox states are removed ---

  const handleGlobalSync = async () => {
    try {
      setIsProcessing('global');
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        toast.error('세션 정보가 없어 동기화할 수 없습니다.');
        return;
      }

      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'sync-all-communities'
        })
      });
      const result = await response.json();
      if (result.status === 'success') {
        toast.success(`전체 동기화 성공: 만료 권한 ${result.expiredCount || 0}건 자동 수거, 신규 커뮤니티 권한 ${result.createdMembershipsCount || 0}건 가입 동기화 완료!`);
        fetchOrders();
      } else {
        throw new Error(result.message || '알 수 없는 오류');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(`동기화 실패: ${error.message}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReprocessOrder = async (orderId: string) => {
    try {
      setIsProcessing(orderId);
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        toast.error('세션 정보가 유효하지 않습니다.');
        return;
      }

      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'reprocess-order',
          orderId
        })
      });
      const result = await response.json();
      if (result.status === 'success') {
        toast.success('주문 정보가 PAID 로 자동 갱신되었으며, 복식부기 및 수강/커뮤니티 연동 권한이 재처리되었습니다!');
        fetchOrders();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(`주문 재처리 실패: ${error.message}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRegrantPermission = async (userId: string, courseId: string, orderId: string) => {
    try {
      setIsProcessing(orderId + '_regrant');
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        toast.error('세션 정보가 유효하지 않습니다.');
        return;
      }

      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'grant-enrollment',
          userId,
          courseId
        })
      });
      const result = await response.json();
      if (result.status === 'success') {
        toast.success(result.message || '권한 및 커뮤니티 가입이 정상 동기화되었습니다.');
        fetchOrders();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(`권한 강제 부여 오류: ${error.message}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('정말로 이 결제 대기 데이터를 영구 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.')) {
      return;
    }

    try {
      setIsProcessing(orderId + '_delete');
      await purchaseService.deleteOrder(orderId);
      toast.success('결제 대기 데이터가 성공적으로 삭제되었습니다.');
      fetchOrders();
    } catch (error: any) {
      console.error('Failed to delete order:', error);
      toast.error(`삭제 실패: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsProcessing(null);
    }
  };

  // --- 이니시스 실시간 거래 환불 연계 처리 ---
  const handleRefundOrder = async (orderId: string) => {
    const reason = prompt('환불 처리 사유를 입력해주세요 (공란 가능):', '고객 요청 환불');
    if (reason === null) return; // 취소 버튼 누른 경우

    try {
      setIsProcessing(orderId + '_refund');
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        toast.error('로그인 세션 정보가 만료되었습니다.');
        return;
      }

      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'refund-order',
          orderId,
          reason
        })
      });

      const result = await response.json();
      if (result.status === 'success') {
        toast.success(result.message || '이니시스 실시간 연계 승인 취소 및 환불 처리가 완료되었습니다.');
        fetchOrders();
      } else {
        throw new Error(result.message || '환불 승인 거절 또는 통신 오류');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(`환불 처리 실패: ${error.message}`);
    } finally {
      setIsProcessing(null);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const data = await purchaseService.getAllOrders(200);
      setOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      const isMissingTable = error.message?.includes('relation') && error.message?.includes('does not exist');
      if (isMissingTable) {
        toast.error('데이터베이스 테이블(orders)이 존재하지 않습니다. 사이트 전반의 DB 스키마 업데이트가 필요합니다.');
      } else {
        toast.error(`매출 내역을 불러오는데 실패했습니다: ${error.message || '알 수 없는 오류'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.profile?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.profile?.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.course?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 이니시스 PAID / COMPLETED 와 FAILED에 맞도록 정밀화 필터 매핑
    const statusVal = (order.status || '').toUpperCase();
    let matchesStatus = true;
    if (statusFilter === 'completed') {
      matchesStatus = statusVal === 'PAID' || statusVal === 'COMPLETED';
    } else if (statusFilter === 'pending') {
      matchesStatus = statusVal === 'PENDING' || statusVal === '' || statusVal === 'DEFAULT';
    } else if (statusFilter === 'failed') {
      matchesStatus = statusVal === 'FAILED' || statusVal === 'CANCELLED';
    }
    
    return matchesSearch && matchesStatus;
  });

  const getOrderStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'PAID') {
      return (
        <Badge className="bg-green-100 text-green-600 hover:bg-green-100/80 border-none text-[10px] font-black h-7 px-3 rounded-full tracking-tighter">
          결제완료
        </Badge>
      );
    } else if (s === 'FAILED' || s === 'CANCELLED') {
      return (
        <Badge className="bg-rose-100 text-rose-600 hover:bg-rose-100/80 border-none text-[10px] font-black h-7 px-3 rounded-full tracking-tighter">
          결제실패
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-amber-100 text-amber-600 hover:bg-amber-100/80 border-none text-[10px] font-black h-7 px-3 rounded-full tracking-tighter">
          결제대기
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-gray-900">매출 및 결제 관리</h1>
          <p className="text-sm text-gray-500 font-bold mt-1 italic">사이트의 모든 결제 데이터와 매출 회원 내역을 상세히 관리합니다.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={handleGlobalSync}
            disabled={isProcessing === 'global'}
            className="h-12 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black shadow-lg shadow-amber-200 transition-all active:scale-95 gap-2"
          >
            {isProcessing === 'global' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            커뮤니티 수동 동기화 & 만료 수거
          </Button>
          <Button variant="outline" className="h-12 px-6 rounded-2xl gap-2 font-black border-gray-100 shadow-sm hover:bg-gray-50">
            <Download className="w-4 h-4" />
            엑셀 다운로드
          </Button>
          <Button className="h-12 px-8 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-lg shadow-purple-200 transition-all active:scale-95">
            전체 통계 보기
          </Button>
        </div>
      </header>

      {/* 💳 전체 결제 시스템 제어 및 활성화 통제 패널 */}
      <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
        <CardContent className="p-6 md:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex gap-4 items-start">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
              isPaymentEnabled 
                ? 'bg-green-50 text-green-600 shadow-green-100' 
                : 'bg-amber-50 text-amber-600 shadow-amber-100'
            }`}>
              {isPaymentEnabled ? <CheckCircle2 className="w-6 h-6 text-green-600 animate-pulse" /> : <AlertTriangle className="w-6 h-6 text-amber-600" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-gray-900">전체 결제 가능 제어 설정</h2>
                <Badge className={`border-none text-[10px] font-black h-5 px-2.5 rounded-full ${
                  isPaymentEnabled 
                    ? 'bg-green-100 text-green-700 hover:bg-green-100/80' 
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-100/80'
                }`}>
                  {isPaymentEnabled ? '실시간 PG 결제 활성' : '수강 문의/승인 우회 모드'}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 font-bold mt-2 leading-relaxed italic pr-2">
                현재 사이트 결제 연동은 테스트 진행 중입니다. 전체 결제 기능을 <span className="text-amber-600 font-black">비활성화</span> 할 경우 전체 사이트에서 이니시스 실시간 카드/계좌 결제 대신 
                <span className="text-purple-600 font-black ml-1 bg-purple-50 px-1 py-0.5 rounded">"현재 결제 기능 개발 중으로 관리자가 승인 후 강의를 청취하실 수 있습니다"</span>
                라는 메시지를 띄우며, 학생들의 결제 시도를 수동 후반 승인으로 보장해 줍니다!
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 shrink-0 bg-gray-50 p-2 rounded-2xl border border-gray-100">
            <button
              onClick={() => handleTogglePayment(true)}
              className={`px-5 py-3 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${
                isPaymentEnabled
                  ? 'bg-green-600 text-white shadow-md shadow-green-100'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Power className="w-3.5 h-3.5 shrink-0" />
              전체 결제 활성화 (정상 운영)
            </button>
            <button
              onClick={() => handleTogglePayment(false)}
              className={`px-5 py-3 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${
                !isPaymentEnabled
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-100'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              결제 비활성화 (테스트/점검 중)
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 🔮 모의 결제 콜백 Sandbox 테스팅 도구 */}


      {/* Filter Bar */}
      <Card className="rounded-[32px] border-none shadow-sm overflow-hidden">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input 
                placeholder="회원 이름, 이메일, 또는 강의 제목으로 조회..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-14 pl-12 rounded-2xl border-gray-100 bg-gray-50 focus:bg-white font-bold transition-all"
              />
            </div>
            <div className="flex gap-2">
              <select 
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="h-14 px-6 rounded-2xl bg-gray-50 border-gray-100 font-black text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all appearance-none min-w-[140px] text-center"
              >
                <option value="all">전체 상태</option>
                <option value="completed">결제완료</option>
                <option value="pending">결제대기</option>
                <option value="failed">결제실패</option>
              </select>
              <Button variant="outline" className="h-14 px-6 rounded-2xl border-gray-100 font-black gap-2">
                 <Filter className="w-4 h-4" />
                 상세 필터
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="rounded-[40px] border-none shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">주문 정보</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">구매자</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">상품(강의)</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">결제 금액</th>
                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 text-center">상태</th>
                <th className="p-6 text-right border-b border-gray-50">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
                      <span className="text-sm font-black text-gray-400 italic">결제 데이터를 안전하게 동기화 중입니다...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((order, idx) => (
                  <tr key={order.id || idx} className="hover:bg-purple-50/20 transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                           <Calendar className="w-4 h-4" />
                         </div>
                         <div>
                            <div className="text-xs font-black text-gray-900">{format(new Date(order.created_at), 'yyyy-MM-dd', { locale: ko })}</div>
                            <div className="text-[10px] text-gray-400 font-bold italic mt-0.5">{format(new Date(order.created_at), 'HH:mm:ss', { locale: ko })}</div>
                         </div>
                      </div>
                    </td>
                     <td className="p-6">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 font-black text-xs shadow-sm">
                           {(order.profile?.nickname || order.profile?.name || '익').substring(0, 1)}
                         </div>
                         <div>
                            <div className="text-xs font-black text-gray-900 group-hover:text-purple-600 transition-colors">{order.profile?.nickname || order.profile?.name || '익명'}</div>
                            <div className="text-[10px] text-gray-400 font-bold flex items-center gap-1 text-gray-400">
                              <Mail className="w-2.5 h-2.5" />
                              {order.profile?.email || '-'}
                            </div>
                         </div>
                      </div>
                    </td>
                    <td className="p-6">
                       <div className="flex items-center gap-4">
                          <div className="w-14 h-10 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex-shrink-0">
                            {order.course?.thumbnail ? (
                              <img src={order.course.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-200">
                                <BookOpen className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="max-w-[240px]">
                             <p className="text-xs font-black text-gray-900 truncate leading-tight mb-1">{order.course?.title || '삭제된 강의 정보'}</p>
                             <p className="text-[10px] text-gray-400 font-bold">Course ID: {order.id.split('-')[0]}</p>
                          </div>
                       </div>
                    </td>
                    <td className="p-6">
                       <div className="text-right">
                          <span className="text-sm font-black text-gray-900 tracking-tighter">₩{(order.amount || 0).toLocaleString()}</span>
                          <p className="text-[10px] text-gray-400 font-bold italic mt-0.5">VAT 포함</p>
                       </div>
                    </td>
                    <td className="p-6">
                       <div className="flex justify-center">
                          {getOrderStatusBadge(order.status)}
                       </div>
                    </td>
                    <td className="p-6 text-right">
                       <div className="flex gap-1.5 justify-end flex-wrap max-w-[280px] ml-auto">
                          
                          {/* 이니시스 실시간 거래 환불 연계 버튼 */}
                          {(order.status === 'PAID' || order.status === 'COMPLETED') && (
                            <Button 
                              onClick={() => handleRefundOrder(order.id)}
                              disabled={isProcessing !== null}
                              variant="outline"
                              className="h-8 px-3 text-[10px] font-black rounded-lg text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100 shrink-0 gap-1 shadow-sm cursor-pointer"
                            >
                              {isProcessing === order.id + '_refund' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              환불
                            </Button>
                          )}
                          <Button 
                            onClick={() => handleReprocessOrder(order.id)}
                            disabled={isProcessing !== null}
                            variant="outline"
                            className="h-8 px-3 text-[10px] font-black rounded-lg text-gray-600 border-gray-100 hover:bg-gray-50 shrink-0 gap-1 shadow-sm"
                          >
                            {isProcessing === order.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            주문 재처리
                          </Button>
                          
                          <Button 
                            onClick={() => handleRegrantPermission(order.user_id, order.course_id, order.id)}
                            disabled={isProcessing !== null}
                            variant="outline"
                            className="h-8 px-3 text-[10px] font-black rounded-lg text-amber-600 border-amber-100 hover:bg-amber-50 shrink-0 gap-1 shadow-sm"
                          >
                            {isProcessing === order.id + '_regrant' ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <ShieldCheck className="w-3 h-3" />
                            )}
                            권한부여
                          </Button>
                          <Button 
                            onClick={() => handleDeleteOrder(order.id)}
                            disabled={isProcessing !== null}
                            variant="outline"
                            className="h-8 px-3 text-[10px] font-black rounded-lg text-rose-600 border-rose-100 hover:bg-rose-50 shrink-0 gap-1 shadow-sm"
                          >
                            {isProcessing === order.id + '_delete' ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            삭제
                          </Button>
                       </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <CreditCard className="w-12 h-12 text-gray-100 mb-2" />
                       <p className="text-sm font-black text-gray-400">조회된 결제 내역이 없습니다.</p>
                       <p className="text-xs font-bold text-gray-300">검색어나 필터를 조정해보세요.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Placeholder */}
        <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
           <p className="text-xs font-bold text-gray-400 italic">Total {filteredOrders.length} records found.</p>
           <div className="flex gap-2">
              <Button disabled variant="outline" className="h-10 px-4 rounded-xl font-bold text-xs">이전</Button>
              <Button disabled variant="outline" className="h-10 px-4 rounded-xl font-bold text-xs bg-white">1</Button>
              <Button disabled variant="outline" className="h-10 px-4 rounded-xl font-bold text-xs">다음</Button>
           </div>
        </div>
      </Card>
    </div>
  );
}
