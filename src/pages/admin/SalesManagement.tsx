import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Search,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Power,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { purchaseService } from '@/services/purchaseService';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { safeResponseJson } from '@/lib/safeFetch';

interface OrderPaymentDetails {
  tid: string;
  applNum: string;
  payDevice: 'PC' | 'MOBILE' | '';
  payDeviceLabel: string;
  payMethodLabel: string;
  cardName: string;
  applDateTime: string;
  isInicisLinked: boolean;
}

function formatInicisPayMethodName(rawMethod?: string): string {
  const upper = String(rawMethod || '').trim().toUpperCase();
  if (!upper) return '신용카드';
  if (upper.includes('VBANK') || upper.includes('VACCT') || upper.includes('가상계좌')) return '가상계좌';
  if (upper.includes('BANK') || upper.includes('ACCT') || upper.includes('계좌이체') || upper.includes('DIRECTBANK')) return '계좌이체';
  if (upper.includes('HPP') || upper.includes('MOBILE') || upper.includes('PHONE') || upper.includes('휴대폰')) return '휴대폰';
  if (upper.includes('CARD') || upper.includes('WCARD') || upper.includes('카드') || upper.includes('신용')) return '신용카드';
  return rawMethod || '신용카드';
}

function isOrderCompletedStatus(status?: string): boolean {
  const s = String(status || '').toUpperCase();
  return s === 'PAID' || s === 'COMPLETED';
}

function isOrderRefundedStatus(status?: string): boolean {
  const s = String(status || '').toUpperCase();
  return s === 'CANCELLED' || s === 'REFUNDED';
}

export default function AdminSalesManagement() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'refunded'>('all');
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'PC' | 'MOBILE'>('all');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // 상세보기 모달 상태
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 환불 확인 모달 상태
  const [refundTargetOrder, setRefundTargetOrder] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState('고객 요청 환불');

  // 전체 결제 기능 상태 제어
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
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'sync-all-communities',
        }),
      });
      const result = await safeResponseJson(response);
      if (result.status === 'success') {
        toast.success(
          `전체 동기화 성공: 만료 권한 ${result.expiredCount || 0}건 자동 수거, 신규 커뮤니티 권한 ${result.createdMembershipsCount || 0}건 가입 동기화 완료`
        );
        fetchOrders(true);
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

  const handleReconcilePayments = async () => {
    try {
      setIsProcessing('reconcile');
      const res = await purchaseService.reconcilePayments();
      toast.success(res.message);
      await fetchOrders(true);
    } catch (error: any) {
      console.error(error);
      toast.error(`결제·수강 복구 실패: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const openRefundModal = (order: any) => {
    setRefundTargetOrder(order);
    setRefundReason('고객 요청 환불');
  };

  const handleConfirmRefund = async () => {
    if (!refundTargetOrder) return;
    const orderId = refundTargetOrder.id;

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
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'refund-order',
          orderId,
          reason: refundReason.trim() || '고객 요청 환불',
        }),
      });

      const result = await safeResponseJson(response);
      if (result.status === 'success') {
        toast.success(result.message || '이니시스 실시간 연계 승인 취소 및 환불 처리가 완료되었습니다.');
        setRefundTargetOrder(null);
        if (detailOrder?.id === orderId) {
          setDetailOrder(null);
        }
        await fetchOrders(true);
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

  const fetchOrders = async (skipAutoToast: boolean = false) => {
    setIsLoading(true);
    try {
      const data: any = await purchaseService.getAllOrders(300);
      const recon = data?.reconciliation;
      if (
        !skipAutoToast &&
        recon &&
        (Number(recon.recoveredOrdersCount) > 0 || Number(recon.backfilledEnrollmentsCount) > 0)
      ) {
        toast.success(
          `KG이니시스 승인 누락 건 자동 복구 완료 (결제 ${recon.recoveredOrdersCount}건 / 수강권 ${recon.backfilledEnrollmentsCount}건)`
        );
      }

      // 결제완료(PAID/COMPLETED) 및 환불완료(CANCELLED/REFUNDED) 거래만 표시 (결제 전 이탈 PENDING/FAILED 제외)
      const salesOrders = (data || []).filter((o: any) => {
        const s = String(o.status || '').toUpperCase();
        return s === 'PAID' || s === 'COMPLETED' || s === 'CANCELLED' || s === 'REFUNDED';
      });
      setOrders(salesOrders);
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

  const extractOrderPaymentDetails = (order: any): OrderPaymentDetails => {
    let tid = order.tid && order.tid !== '-' ? String(order.tid) : '-';
    let applNum = order.applNum && order.applNum !== '-' ? String(order.applNum) : '-';
    let payDeviceRaw = String(order.payDevice || '').toUpperCase();
    let cardName = String(order.cardName || '');
    let applDate = String(order.applDate || '');
    let applTime = String(order.applTime || '');
    let rawMethod = String(order.payment_method || '');

    if ((tid === '-' || applNum === '-' || !payDeviceRaw) && order.logs && order.logs.length > 0) {
      const successLog = order.logs.find((l: any) => l.status === 'SUCCESS') || order.logs[0];
      const rawPayload = successLog?.raw_response ?? successLog?.raw_data;
      if (rawPayload) {
        try {
          const parsed = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
          const rawObj = parsed?.details && typeof parsed.details === 'object' ? parsed.details : parsed || {};

          if (tid === '-') {
            tid = String(rawObj.tid || rawObj.TID || rawObj.P_TID || rawObj.AuthTID || rawObj.payment_tid || '-');
          }
          if (applNum === '-') {
            applNum = String(
              rawObj.applNum ||
                rawObj.CARD_ApplNum ||
                rawObj.applNo ||
                rawObj.P_AUTH_NO ||
                rawObj.P_AUTH_NUM ||
                rawObj.AuthCode ||
                rawObj.applCode ||
                rawObj.appl_num ||
                '-'
            );
          }
          if (!payDeviceRaw) {
            if (rawObj.payDevice) payDeviceRaw = String(rawObj.payDevice).toUpperCase();
            else if (rawObj.P_TID || String(tid).startsWith('INIMX_')) payDeviceRaw = 'MOBILE';
            else if (String(tid).startsWith('Stdpay')) payDeviceRaw = 'PC';
          }
          if (!cardName) {
            cardName = String(rawObj.P_FN_NM || rawObj.CARD_PurchaseName || rawObj.cardName || '');
          }
          if (!applDate && (rawObj.applDate || rawObj.P_AUTH_DT)) {
            applDate = String(rawObj.applDate || String(rawObj.P_AUTH_DT).substring(0, 8));
          }
          if (!applTime && (rawObj.applTime || rawObj.P_AUTH_DT)) {
            applTime = String(rawObj.applTime || String(rawObj.P_AUTH_DT).substring(8, 14));
          }
          if (!rawMethod && (rawObj.payMethod || rawObj.P_TYPE || successLog.payment_method)) {
            rawMethod = String(rawObj.payMethod || rawObj.P_TYPE || successLog.payment_method);
          }
        } catch {
          // ignore invalid json
        }
      }
    }

    if (!payDeviceRaw) {
      if (tid.startsWith('INIMX_')) payDeviceRaw = 'MOBILE';
      else if (tid.startsWith('Stdpay')) payDeviceRaw = 'PC';
    }

    const payDevice: 'PC' | 'MOBILE' | '' =
      payDeviceRaw === 'MOBILE' ? 'MOBILE' : payDeviceRaw === 'PC' ? 'PC' : '';

    const isInicisLinked = Boolean(
      order.isInicisLinked ||
        (tid !== '-' &&
          !tid.startsWith('TID-MOCK') &&
          (tid.startsWith('Stdpay') || tid.startsWith('INIMX_') || tid.startsWith('INI') || tid.length >= 20)) ||
        (applNum !== '-' && tid !== '-' && !tid.startsWith('direct_'))
    );

    const payDeviceLabel = payDevice === 'MOBILE' ? '모바일' : payDevice === 'PC' ? 'PC' : isInicisLinked ? 'PC' : '기타';
    const payMethodLabel = formatInicisPayMethodName(rawMethod);

    let applDateTime = '-';
    if (applDate && applDate.length === 8) {
      const y = applDate.slice(0, 4);
      const m = applDate.slice(4, 6);
      const d = applDate.slice(6, 8);
      if (applTime && applTime.length >= 6) {
        applDateTime = `${y}-${m}-${d} ${applTime.slice(0, 2)}:${applTime.slice(2, 4)}:${applTime.slice(4, 6)}`;
      } else {
        applDateTime = `${y}-${m}-${d}`;
      }
    } else if (order.created_at) {
      applDateTime = format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: ko });
    }

    return {
      tid,
      applNum,
      payDevice,
      payDeviceLabel,
      payMethodLabel,
      cardName,
      applDateTime,
      isInicisLinked,
    };
  };

  const filteredOrders = orders.filter((order) => {
    const q = searchTerm.trim().toLowerCase();
    const details = extractOrderPaymentDetails(order);

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'completed'
          ? isOrderCompletedStatus(order.status)
          : isOrderRefundedStatus(order.status);

    if (!matchesStatus) return false;

    const matchesDevice =
      deviceFilter === 'all'
        ? true
        : deviceFilter === 'PC'
          ? details.payDeviceLabel === 'PC'
          : details.payDeviceLabel === '모바일';

    if (!matchesDevice) return false;

    if (!q) return true;

    return Boolean(
      order.profile?.name?.toLowerCase().includes(q) ||
        order.profile?.nickname?.toLowerCase().includes(q) ||
        order.profile?.email?.toLowerCase().includes(q) ||
        order.course?.title?.toLowerCase().includes(q) ||
        order.order_name?.toLowerCase().includes(q) ||
        order.merchant_uid?.toLowerCase().includes(q) ||
        details.tid.toLowerCase().includes(q) ||
        details.applNum.toLowerCase().includes(q)
    );
  });

  const completedCount = orders.filter((o) => isOrderCompletedStatus(o.status)).length;
  const refundedCount = orders.filter((o) => isOrderRefundedStatus(o.status)).length;

  const handleCopyText = async (label: string, value: string) => {
    if (!value || value === '-') return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      toast.success(`${label}가 클립보드에 복사되었습니다.`);
      setTimeout(() => setCopiedField((prev) => (prev === label ? null : prev)), 1800);
    } catch {
      toast.error('클립보드 복사에 실패했습니다.');
    }
  };

  const handleExportExcel = () => {
    if (filteredOrders.length === 0) {
      toast.error('내보낼 결제 내역이 없습니다.');
      return;
    }

    try {
      const excelData = filteredOrders.map((order, index) => {
        const details = extractOrderPaymentDetails(order);
        const formattedDate = order.created_at
          ? format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: ko })
          : '-';

        const statusText = isOrderRefundedStatus(order.status)
          ? '환불완료'
          : isOrderCompletedStatus(order.status)
            ? '결제완료'
            : '결제대기';

        return {
          No: index + 1,
          결제일자: formattedDate,
          주문번호: order.merchant_uid || order.id?.split('-')[0] || '-',
          '승인 거래번호(TID)': details.tid,
          승인번호: details.applNum,
          구매자명: order.profile?.name || order.profile?.nickname || '익명',
          '구매자 이메일': order.profile?.email || '-',
          '상품 내용': order.course?.title || order.order_name || '삭제된 강의 정보',
          결제금액: order.amount || 0,
          '결제방법(환경)': details.payDeviceLabel,
          결제수단: details.cardName ? `${details.payMethodLabel} (${details.cardName})` : details.payMethodLabel,
          '결제 상태': statusText,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 20 },
        { wch: 24 },
        { wch: 28 },
        { wch: 14 },
        { wch: 14 },
        { wch: 24 },
        { wch: 32 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 12 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '매출 내역');
      XLSX.writeFile(workbook, `매출내역_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('엑셀 파일이 성공적으로 생성되었습니다.');
    } catch (err: any) {
      console.error('Excel export error:', err);
      toast.error('엑셀 생성 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const renderStatusText = (status: string) => {
    if (isOrderRefundedStatus(status)) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 whitespace-nowrap">
          환불완료
        </span>
      );
    }
    if (isOrderCompletedStatus(status)) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          결제완료
        </span>
      );
    }
    if (String(status || '').toUpperCase() === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 whitespace-nowrap">
          결제실패
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 whitespace-nowrap">
        결제대기
      </span>
    );
  };

  const detailPaymentInfo = detailOrder ? extractOrderPaymentDetails(detailOrder) : null;
  const refundTargetInfo = refundTargetOrder ? extractOrderPaymentDetails(refundTargetOrder) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">매출 및 결제 관리</h1>
          <p className="text-sm text-slate-500 mt-1">
            결제 내역을 한눈에 확인하고, 거래별 상세 정보 조회 및 환불 처리를 진행합니다.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleReconcilePayments}
            disabled={isProcessing !== null}
            className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-1.5 whitespace-nowrap shrink-0"
          >
            {isProcessing === 'reconcile' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            결제·수강 누락 복구
          </Button>
          <Button
            onClick={handleGlobalSync}
            disabled={isProcessing !== null}
            variant="outline"
            className="h-10 px-4 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-1.5 whitespace-nowrap shrink-0"
          >
            {isProcessing === 'global' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            커뮤니티 동기화
          </Button>
          <Button
            onClick={handleExportExcel}
            variant="outline"
            className="h-10 px-4 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            엑셀 다운로드
          </Button>
        </div>
      </header>

      {/* 전체 결제 시스템 제어 패널 */}
      <Card className="rounded-xl border border-slate-200/80 shadow-none bg-white">
        <CardContent className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex gap-3.5 items-start">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                isPaymentEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              {isPaymentEnabled ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <h2 className="font-bold text-slate-900">전체 결제 가능 제어 설정</h2>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className={`text-xs font-semibold ${isPaymentEnabled ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {isPaymentEnabled ? '실시간 PG 결제 활성' : '수강 문의/승인 우회 모드'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                결제 기능을 비활성화하면 이니시스 실시간 결제 대신 관리자 확인 후 승인 안내가 노출됩니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0 self-start xl:self-center">
            <button
              type="button"
              onClick={() => handleTogglePayment(true)}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                isPaymentEnabled ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Power className="w-3.5 h-3.5 shrink-0" />
              결제 활성화
            </button>
            <button
              type="button"
              onClick={() => handleTogglePayment(false)}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                !isPaymentEnabled ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              결제 비활성화
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 검색 및 상태/결제환경 필터 */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-white border border-slate-200/80 rounded-xl p-4">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="구매자명, 상품명, 승인번호, 주문번호, 거래번호 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10 rounded-lg border-slate-200 bg-slate-50/70 focus:bg-white text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 결제 상태 필터 */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전체 ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === 'completed'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              결제완료 ({completedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('refunded')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === 'refunded'
                  ? 'bg-white text-rose-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              환불완료 ({refundedCount})
            </button>
          </div>

          {/* 결제방법(PC / 모바일) 필터 */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setDeviceFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                deviceFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전체 환경
            </button>
            <button
              type="button"
              onClick={() => setDeviceFilter('PC')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                deviceFilter === 'PC' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PC
            </button>
            <button
              type="button"
              onClick={() => setDeviceFilter('MOBILE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                deviceFilter === 'MOBILE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              모바일
            </button>
          </div>
        </div>
      </div>

      {/* 매출 내역 테이블 */}
      <Card className="rounded-xl border border-slate-200/80 shadow-none overflow-hidden bg-white">
        <div className="w-full overflow-x-auto lg:overflow-x-visible">
          <table className="w-full min-w-[780px] lg:min-w-0 lg:table-fixed text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-3 pl-3.5 pr-2 w-[92px] whitespace-nowrap">결제일자</th>
                <th className="py-3 px-2 w-[88px] whitespace-nowrap">승인번호</th>
                <th className="py-3 px-2 w-[96px] whitespace-nowrap">구매자명</th>
                <th className="py-3 px-2">상품 내용</th>
                <th className="py-3 px-2 w-[88px] text-right whitespace-nowrap">결제금액</th>
                <th className="py-3 px-2 w-[78px] whitespace-nowrap">결제방법</th>
                <th className="py-3 px-2 w-[68px] text-center whitespace-nowrap">결제 상태</th>
                <th className="py-3 pl-2 pr-3.5 w-[138px] text-right whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                      <span className="text-sm font-medium text-slate-500">결제 내역을 불러오는 중입니다...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length > 0 ? (
                filteredOrders.map((order, idx) => {
                  const details = extractOrderPaymentDetails(order);
                  const realName = String(order.profile?.name || '').trim();
                  const nickName = String(order.profile?.nickname || '').trim();
                  const primaryName = realName || nickName || '익명';
                  const secondaryNick = nickName && nickName !== primaryName ? nickName : '';
                  const purchaserFullTitle = secondaryNick
                    ? `${primaryName} / ${secondaryNick}`
                    : primaryName;
                  const courseTitle = order.course?.title || order.order_name || '삭제된 강의 정보';
                  const canRefund = isOrderCompletedStatus(order.status);

                  return (
                    <tr key={order.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      {/* 1. 결제일자 */}
                      <td className="py-3 pl-3.5 pr-2 whitespace-nowrap tabular-nums">
                        <div className="text-xs font-medium text-slate-900">
                          {order.created_at ? format(new Date(order.created_at), 'yyyy-MM-dd', { locale: ko }) : '-'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {order.created_at ? format(new Date(order.created_at), 'HH:mm:ss', { locale: ko }) : ''}
                        </div>
                      </td>

                      {/* 2. 승인번호 */}
                      <td className="py-3 px-2 whitespace-nowrap font-mono tabular-nums text-xs text-slate-700">
                        <div className="truncate" title={details.applNum}>
                          {details.applNum !== '-' ? (
                            <span className="font-semibold text-slate-900">{details.applNum}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </td>

                      {/* 3. 구매자명 (이름 / 닉네임 함께 표시) */}
                      <td className="py-3 px-2">
                        <div className="min-w-0" title={purchaserFullTitle}>
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {primaryName}
                          </div>
                          {secondaryNick && (
                            <div className="text-[11px] text-slate-500 truncate">
                              {secondaryNick}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 4. 상품 내용 */}
                      <td className="py-3 px-2 min-w-0">
                        <div className="text-xs font-medium text-slate-800 line-clamp-2 leading-snug break-keep" title={courseTitle}>
                          {courseTitle}
                        </div>
                      </td>

                      {/* 5. 결제금액 */}
                      <td className="py-3 px-2 text-right whitespace-nowrap font-mono tabular-nums text-xs font-semibold text-slate-900">
                        ₩{Number(order.amount || 0).toLocaleString()}
                      </td>

                      {/* 6. 결제방법 (PC 또는 모바일) */}
                      <td className="py-3 px-2 whitespace-nowrap text-xs text-slate-700">
                        <div className="font-semibold text-slate-900">{details.payDeviceLabel}</div>
                        <div className="text-[11px] text-slate-500 truncate">{details.payMethodLabel}</div>
                      </td>

                      {/* 7. 결제 상태 */}
                      <td className="py-3 px-2 text-center whitespace-nowrap">
                        {renderStatusText(order.status)}
                      </td>

                      {/* 8. 메뉴: 상세보기 & 환불 */}
                      <td className="py-3 pl-2 pr-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            onClick={() => setDetailOrder(order)}
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 rounded-lg text-[11px] font-semibold text-slate-700 border-slate-200 hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            상세보기
                          </Button>

                          {canRefund && (
                            <Button
                              type="button"
                              onClick={() => openRefundModal(order)}
                              disabled={isProcessing !== null}
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 rounded-lg text-[11px] font-semibold text-rose-600 border-rose-200 bg-rose-50/70 hover:bg-rose-100 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {isProcessing === order.id + '_refund' ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                '환불'
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CreditCard className="w-10 h-10 text-slate-200 mb-1" />
                      <p className="text-sm font-semibold text-slate-500">조회된 결제 내역이 없습니다.</p>
                      <p className="text-xs text-slate-400">검색어나 필터 조건을 조정해 보세요.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span className="tabular-nums">총 {filteredOrders.length}건</span>
          <span className="tabular-nums">
            결제완료 {completedCount}건 · 환불완료 {refundedCount}건
          </span>
        </div>
      </Card>

      {/* 거래 상세보기 모달 */}
      <Dialog open={Boolean(detailOrder)} onOpenChange={(open) => !open && setDetailOrder(null)}>
        <DialogContent className="sm:max-w-lg bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">거래 상세 내역</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              해당 거래의 주문번호, 승인 거래번호(TID), 승인번호 및 결제 상세 정보입니다.
            </DialogDescription>
          </DialogHeader>

          {detailOrder && detailPaymentInfo && (
            <div className="space-y-4 py-1">
              {/* PG 식별 정보 */}
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 bg-slate-50/40">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-xs font-medium text-slate-500 shrink-0">주문번호 (Merchant UID)</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-mono font-semibold text-slate-900 truncate">
                      {detailOrder.merchant_uid || detailOrder.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText('주문번호', detailOrder.merchant_uid || detailOrder.id)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer shrink-0"
                      title="주문번호 복사"
                    >
                      {copiedField === '주문번호' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-xs font-medium text-slate-500 shrink-0">승인 거래번호 (TID)</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-mono font-semibold text-slate-900 truncate">
                      {detailPaymentInfo.tid}
                    </span>
                    {detailPaymentInfo.tid !== '-' && (
                      <button
                        type="button"
                        onClick={() => handleCopyText('승인 거래번호', detailPaymentInfo.tid)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer shrink-0"
                        title="TID 복사"
                      >
                        {copiedField === '승인 거래번호' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-xs font-medium text-slate-500 shrink-0">승인번호</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-mono font-bold text-indigo-700">
                      {detailPaymentInfo.applNum}
                    </span>
                    {detailPaymentInfo.applNum !== '-' && (
                      <button
                        type="button"
                        onClick={() => handleCopyText('승인번호', detailPaymentInfo.applNum)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer shrink-0"
                        title="승인번호 복사"
                      >
                        {copiedField === '승인번호' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 일반 거래 정보 */}
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs">
                  <span className="text-slate-500 shrink-0">결제 상태</span>
                  <div>{renderStatusText(detailOrder.status)}</div>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs">
                  <span className="text-slate-500 shrink-0">결제일시 (승인일시)</span>
                  <span className="font-mono tabular-nums text-slate-900">{detailPaymentInfo.applDateTime}</span>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs">
                  <span className="text-slate-500 shrink-0">구매자</span>
                  <span className="text-slate-900 font-medium text-right">
                    {detailOrder.profile?.name || detailOrder.profile?.nickname || '익명'}
                    {detailOrder.profile?.email ? ` · ${detailOrder.profile.email}` : ''}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-xs">
                  <span className="text-slate-500 shrink-0">상품 내용</span>
                  <div className="text-right">
                    <div className="text-slate-900 font-medium">
                      {detailOrder.course?.title || detailOrder.order_name || '삭제된 강의 정보'}
                    </div>
                    {detailOrder.course_id && (
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        코스 ID: {detailOrder.course_id}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs">
                  <span className="text-slate-500 shrink-0">결제방법</span>
                  <span className="text-slate-900 font-medium">
                    {detailPaymentInfo.payDeviceLabel} · {detailPaymentInfo.payMethodLabel}
                    {detailPaymentInfo.cardName ? ` (${detailPaymentInfo.cardName})` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs">
                  <span className="text-slate-500 shrink-0">PG 연동</span>
                  <span className="text-slate-900">
                    {detailPaymentInfo.isInicisLinked ? 'KG이니시스 실시간 승인' : '수동/기타 처리'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm bg-slate-50/70">
                  <span className="font-semibold text-slate-700">결제금액</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900">
                    ₩{Number(detailOrder.amount || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-2 bg-slate-50 -mx-6 -mb-6 px-6 py-4 rounded-b-xl border-t border-slate-100 flex flex-row justify-end gap-2">
            {detailOrder && isOrderCompletedStatus(detailOrder.status) && (
              <Button
                type="button"
                onClick={() => openRefundModal(detailOrder)}
                disabled={isProcessing !== null}
                variant="outline"
                className="h-9 px-4 rounded-lg text-xs font-semibold text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100 whitespace-nowrap shrink-0 gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                환불 처리
              </Button>
            )}
            <Button
              type="button"
              onClick={() => setDetailOrder(null)}
              className="h-9 px-4 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 환불 처리 확인 모달 */}
      <Dialog
        open={Boolean(refundTargetOrder)}
        onOpenChange={(open) => {
          if (!open && !isProcessing) setRefundTargetOrder(null);
        }}
      >
        <DialogContent className="sm:max-w-md bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">결제 환불 처리</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              KG이니시스 승인 취소 및 수강 권한 회수가 즉시 실행됩니다.
            </DialogDescription>
          </DialogHeader>

          {refundTargetOrder && refundTargetInfo && (
            <div className="space-y-4 py-1">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">주문번호</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {refundTargetOrder.merchant_uid || refundTargetOrder.id}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">구매자</span>
                  <span className="font-semibold text-slate-900">
                    {refundTargetOrder.profile?.name || refundTargetOrder.profile?.nickname || '익명'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">상품 내용</span>
                  <span className="font-medium text-slate-800 truncate max-w-[220px]">
                    {refundTargetOrder.course?.title || refundTargetOrder.order_name || '-'}
                  </span>
                </div>
                <div className="flex justify-between gap-2 pt-1 border-t border-slate-200/70">
                  <span className="text-slate-600 font-semibold">환불 금액</span>
                  <span className="font-mono tabular-nums font-bold text-rose-600">
                    ₩{Number(refundTargetOrder.amount || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">환불 사유</label>
                <Input
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="환불 사유를 입력하세요 (예: 고객 요청 환불)"
                  className="h-10 rounded-lg border-slate-200 text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="mt-2 bg-slate-50 -mx-6 -mb-6 px-6 py-4 rounded-b-xl border-t border-slate-100 flex flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isProcessing !== null}
              onClick={() => setRefundTargetOrder(null)}
              className="h-9 px-4 rounded-lg text-xs font-semibold border-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={isProcessing !== null}
              onClick={handleConfirmRefund}
              className="h-9 px-4 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white whitespace-nowrap shrink-0 gap-1.5 cursor-pointer"
            >
              {isProcessing === refundTargetOrder?.id + '_refund' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              환불 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
