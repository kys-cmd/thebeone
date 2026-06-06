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

  // --- Sandbox 시뮬레이터 전용 상태 ---
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [testAmount, setTestAmount] = useState<string>('');
  const [selectedOrderForSim, setSelectedOrderForSim] = useState<any | null>(null);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // 로드 시점에 모의 결제용 수강생 리스트와 강좌 목록을 가져옴
  useEffect(() => {
    const loadSandboxResources = async () => {
      try {
        const { data: profiles, error: pErr } = await supabase
          .from('profiles')
          .select('id, name, nickname, email')
          .order('created_at', { ascending: false });

        const { data: courses, error: cErr } = await supabase
          .from('courses')
          .select('id, title, price')
          .order('created_at', { ascending: false });

        if (pErr) throw pErr;
        if (cErr) throw cErr;

        setAllProfiles(profiles || []);
        setAllCourses(courses || []);
      } catch (err: any) {
        console.error('Failed to load sandbox resources:', err);
      }
    };
    loadSandboxResources();
  }, []);

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

  // --- Sandbox 시뮬레이터 인터랙션 액션 함수 ---

  // 1. 모의 결제대기(PENDING) 주문 즉시 신규 발행
  const handleCreateTestOrder = async () => {
    if (!selectedUser || !selectedCourse) {
      toast.error('모의 결제 대상을 위해 수강생 회원과 상품 강의를 각각 지정해 주세요.');
      return;
    }

    setIsSimulating(true);
    const logValue = `[Sandbox Console] Creating custom pending order record for user (${selectedUser}) and course (${selectedCourse})...`;
    setSimulationLogs(prev => [...prev, logValue]);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        toast.error('세션 토큰이 유효하지 않습니다. 다시 로그인해 주세요.');
        return;
      }

      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'admin-create-test-order',
          userId: selectedUser,
          courseId: selectedCourse,
          amount: testAmount || '30000'
        })
      });

      const result = await response.json();
      if (result.status === 'success') {
        toast.success(result.message);
        
        // 데이터 리프레시 후, 방금 등록된 모의 주문을 시뮬레이터 제어판에 로드
        const userProf = allProfiles.find(p => p.id === selectedUser);
        const courseObj = allCourses.find(c => c.id === selectedCourse);
        
        const reconstructedOrder = {
          ...result.order,
          profile: userProf,
          course: courseObj
        };

        setSimulationLogs(prev => [...prev, `[Gate Agent] Webhook registered: 1 PENDING order created. [ID: ${result.order.id.split('-')[0]}, OID: ${result.order.merchant_uid}]`]);
        setSelectedOrderForSim(reconstructedOrder);
        fetchOrders();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error(error);
      setSimulationLogs(prev => [...prev, `[Exception] Failed to publish mock order: ${error.message}`]);
      toast.error(`모의 주문 생성 오류: ${error.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  // 2. 외부 결제 대행사(이니시스) 완결 웹훅 콜백 수신 모의 테스트 실행
  const handleSimulatePayment = async (orderId: string, success: boolean) => {
    setIsSimulating(true);
    const targetStatusText = success ? 'SUCCESS (PAID)' : 'FAILURE (FAILED)';
    setSimulationLogs(prev => [...prev, `[Webhook Dispatcher] Simulating PG callback ${targetStatusText} for order: ${orderId}...`]);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        toast.error('보안 권한 세션이 유효하지 않습니다.');
        return;
      }

      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'admin-simulate-payment',
          orderId,
          success
        })
      });

      const result = await response.json();
      if (result.status === 'success') {
        toast.success(result.message);
        setSimulationLogs(prev => [...prev, `[System Dispatch] Webhook feedback successfully handled. [Transaction logged, Double entry recorded, Enrollment enabled]`]);
        
        // 현재 제어패널에 선택된 주문 상태도 실시간 피드백 갱신
        if (selectedOrderForSim && selectedOrderForSim.id === orderId) {
          setSelectedOrderForSim(prev => prev ? { ...prev, status: success ? 'PAID' : 'FAILED' } : null);
        }

        fetchOrders();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error(error);
      setSimulationLogs(prev => [...prev, `[Gateway ERROR] Webhook apply aborted: ${error.message}`]);
      toast.error(`콜백 모의 오류: ${error.message}`);
    } finally {
      setIsSimulating(false);
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
      <Card className="rounded-[32px] border-none shadow-md overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-950 text-white transition-all duration-350">
        <CardHeader className="p-6 md:p-8 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-500/20 text-purple-300 font-extrabold px-2.5 py-1 text-xs border border-purple-500/30">SANDBOX</Badge>
                <CardTitle className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-400" />
                  모의 결제 콜백 가상 테스트 샌드박스
                </CardTitle>
              </div>
              <CardDescription className="text-slate-300 font-bold italic mt-1.5 text-xs">
                실제 원화 이체나 복잡한 계약 연동 없이도, 결제 완결/실패 콜백 및 계정 수강 가입 복식부기 처리를 완벽하게 모의 구동합니다.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300 font-black bg-slate-950/40 px-4 py-2 rounded-xl border border-white/5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              테스트 시스템 활성화
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 md:p-8 pt-0 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 하위 제어판 좌측: 가상 pending 생성 */}
          <div className="lg:col-span-5 bg-slate-950/40 rounded-2xl p-5 border border-white/5 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
              <Badge className="bg-purple-600/30 text-purple-200 text-[10px] font-bold h-5">STEP 1</Badge>
              <h3 className="text-xs font-black text-purple-300 tracking-wider">가상 결제 대기(PENDING) 주문 발행</h3>
            </div>
            
            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">모의 대상 수강 회원 선택</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-900 border border-slate-700/60 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-purple-400 appearance-none cursor-pointer"
                >
                  <option value="">-- 테스트 타겟 학생 --</option>
                  {allProfiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nickname || p.name || '알 수 없음'} ({p.email || '이메일 정보 미기입'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">가상 구매 상품(강의)</label>
                <select
                  value={selectedCourse}
                  onChange={(e) => {
                    const cId = e.target.value;
                    setSelectedCourse(cId);
                    const course = allCourses.find(c => c.id === cId);
                    if (course) {
                      setTestAmount(course.price?.toString() || '30000');
                    }
                  }}
                  className="w-full h-10 px-3 bg-slate-900 border border-slate-700/60 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-purple-400 appearance-none cursor-pointer"
                >
                  <option value="">-- 모의 테스트 강좌 --</option>
                  {allCourses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title} (₩{(c.price || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">결제 금액 설정 (₩)</label>
                <Input
                  type="number"
                  placeholder="금액 설정"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  className="h-10 bg-slate-900 border-slate-700/60 rounded-xl text-xs text-white placeholder:text-slate-500 font-bold focus-visible:ring-purple-400"
                />
              </div>

              <Button
                onClick={handleCreateTestOrder}
                disabled={isSimulating || !selectedUser || !selectedCourse}
                className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                {isSimulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                테스트 주문 발행 완료
              </Button>
            </div>
          </div>

          {/* 하위 제어판 우측: 선택 및 콜백 전송 */}
          <div className="lg:col-span-7 bg-slate-950/40 rounded-2xl p-5 border border-white/5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-600/30 text-purple-200 text-[10px] font-bold h-5">STEP 2</Badge>
                  <h3 className="text-xs font-black text-purple-300 tracking-wider">이니시스 콜백 상태 웹훅 모의 실행</h3>
                </div>
                {selectedOrderForSim && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedOrderForSim(null)}
                    className="h-6 px-2.5 text-[10px] text-rose-300 hover:text-white hover:bg-rose-950/50 font-bold rounded-lg border border-rose-500/10"
                  >
                    초기화
                  </Button>
                )}
              </div>

              {selectedOrderForSim ? (
                <div className="bg-slate-950/60 p-4 rounded-xl border border-purple-500/20 text-slate-200 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-purple-300">시뮬레이션 할 대상 주문:</span>
                    <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black">{selectedOrderForSim.status}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-[11px] font-semibold">
                    <div className="truncate"><span className="text-slate-400 font-medium">주문 고유번호:</span> {selectedOrderForSim.merchant_uid}</div>
                    <div className="truncate"><span className="text-slate-400 font-medium">가상 수강생:</span> {selectedOrderForSim.profile?.nickname || selectedOrderForSim.profile?.name || '테스트 학생'}</div>
                    <div className="truncate"><span className="text-slate-400 font-medium">강좌 상품:</span> {selectedOrderForSim.course?.title || '선택 강의'}</div>
                    <div className="truncate"><span className="text-slate-400 font-medium">모의 금액:</span> ₩{(selectedOrderForSim.amount || 0).toLocaleString()}</div>
                  </div>
                  
                  <div className="flex gap-2.5 pt-2.5">
                    <Button
                      onClick={() => handleSimulatePayment(selectedOrderForSim.id, true)}
                      disabled={isSimulating}
                      className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1"
                    >
                      {isSimulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      결제 성공 처리 (PAID)
                    </Button>
                    <Button
                      onClick={() => handleSimulatePayment(selectedOrderForSim.id, false)}
                      disabled={isSimulating}
                      className="flex-1 h-10 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1"
                    >
                      {isSimulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      결제 실패 처리 (FAILED)
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-700/60 rounded-xl p-5 text-center text-slate-400 py-8 bg-slate-900/30">
                  <CreditCard className="w-7 h-7 text-slate-600 mb-2" />
                  <p className="text-xs font-black text-slate-300">위 STEP 1에서 신규 가상 주문을 생성하시거나,</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">하단의 테이블 명단에서 검증하려는 계정의 <Badge className="bg-purple-950 text-purple-300 text-[8px] h-4">모의 대상을 로드</Badge> 클릭하세요.</p>
                </div>
              )}
            </div>

            {/* 시리얼 터미널 로그 스트림 */}
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-black text-purple-400 tracking-wider flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-purple-400 animate-pulse shrink-0" />
                정합성 및 수강권 자동 바인딩 웹훅 원격 터미널 출력
              </div>
              <div className="h-24 bg-slate-950/80 rounded-xl border border-white/5 p-3 font-mono text-[10px] text-emerald-400 overflow-y-auto space-y-1 scrollbar-thin">
                {simulationLogs.length > 0 ? (
                  simulationLogs.map((log, lidx) => (
                    <div key={lidx} className="leading-tight">
                      <span className="text-slate-500 font-bold">[{format(new Date(), 'HH:mm:ss')}]</span> {log}
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 italic flex items-center h-full justify-center text-[10px]">
                    샌드박스 로그 리스너 대기 중... 모의 결과를 트리거하면 실시간 데이터 정합 상태가 감지됩니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                          
                          {/* 결제대기 주문에 대해 즉시 샌드박스 테스팅 도구로 바로 로드할 수 있게 함 */}
                          <Button
                            onClick={() => {
                              setSelectedOrderForSim(order);
                              toast.info(`주문 ${order.merchant_uid} 정보가 샌드박스 콜백 테스팅기에 로드되었습니다.`);
                            }}
                            variant="outline"
                            className="h-8 px-3 text-[10px] font-black rounded-lg text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100 shrink-0 gap-1 shadow-xs"
                          >
                            <CreditCard className="w-3 h-3 text-purple-600" />
                            모의 대상을 로드
                          </Button>

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
