import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Trash2, 
  Copy, 
  Play, 
  Check, 
  ShieldAlert, 
  Monitor, 
  Globe, 
  Clock, 
  RefreshCw,
  Terminal,
  Bug,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Layers,
  ArrowRightLeft,
  XCircle,
  Database,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { logger, ErrorLog } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

// Helper to pretti-print JSON details nicely
const PrettyJson = ({ data }: { data: any }) => {
  if (!data) return <span className="text-gray-400 font-mono text-[11px]">데이터 없음(Null)</span>;
  
  let parsed = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch (e) {
      return <pre className="text-[11px] font-mono text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-200 whitespace-pre-wrap">{data}</pre>;
    }
  }

  return (
    <pre className="text-[11px] font-mono text-indigo-900 bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto whitespace-pre leading-relaxed select-text">
      {JSON.stringify(parsed, null, 2)}
    </pre>
  );
};

export default function ErrorLogs() {
  const [activeTab, setActiveTab] = useState<'system' | 'payment'>('system');
  
  // 1. Client System Logs States
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 2. Payments API Logs Database States
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [apiLogsCount, setApiLogsCount] = useState<number>(0);
  const [isApiLogsLoading, setIsApiLogsLoading] = useState<boolean>(false);
  const [apiFilter, setApiFilter] = useState<string>('ALL');
  const [expandedApiLogId, setExpandedApiLogId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Load client logs
  const loadLogs = () => {
    setLogs(logger.getLogs());
  };

  // Fetch Payment API DB Logs
  const fetchApiLogs = async () => {
    setIsApiLogsLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        toast.error('세션 정보가 없어 결제 통신 로그를 가져올 수 없습니다.');
        return;
      }

      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'admin-get-payment-api-logs',
          limit: 200,
          offset: 0
        })
      });

      const result = await response.json();
      if (result.status === 'success') {
        setApiLogs(result.logs || []);
        setApiLogsCount(result.count || 0);
      } else {
        throw new Error(result.message || '알 수 없는 오류');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`결제 DB 로그 조회 실패: ${err.message}`);
    } finally {
      setIsApiLogsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();

    const handleNewLog = () => {
      loadLogs();
    };

    window.addEventListener('beone-new-error-log', handleNewLog);
    return () => {
      window.removeEventListener('beone-new-error-log', handleNewLog);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'payment') {
      fetchApiLogs();
    }
  }, [activeTab]);

  // Copy local log to AI Studio template
  const handleCopyToAIStudio = (log: ErrorLog) => {
    const ticks = "```";
    const tick = "`";
    const markdownTemplate = `---
[AI STUDIO DEBUGGING REPORT]
---
# 🐛 오류 디버깅 요청 (Error Debugging Request)

## 1. 에러 핵심 정보 (Core Summary)
- 🔴 **에러 메시지**: ${log.message}
- 📅 **발생 시간**: ${new Date(log.timestamp).toLocaleString('ko-KR')} (UTC/Local)
- 🔗 **발생 URL**: ${log.url}
- ⚙️ **로그 유형**: ${log.type.toUpperCase()} / Error Source

## 2. 브라우저 및 기기 환경 (Diagnostic Environment)
- 💻 **상세 정보 (User Agent)**: ${tick}${log.userAgent}${tick}

## 3. 에러 추적 스택트레이스 (Error Stack Trace)
${ticks}javascript
${log.stack || 'No Stack Trace Available'}
${ticks}

---
## 🤖 AI 수석 개발자에게 보내는 메모
- **문제 설명**: 위 오류 보고서 내용을 토대로 코드를 진단해 주세요.
- **해결 지침**: 발생한 오류의 원인을 설명하고, 해당 소스 파일을 찾아 안전하게 수정해 주세요.
`;

    const fallbackCopy = (text: string, logId: string) => {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          setCopiedId(logId);
          toast.success('구글 AI 스튜디오 맞춤형 오류 보고서가 복사되었습니다!', {
            description: '구글 AI 스튜디오에 바로 붙여넣기(Ctrl+V)하여 수정을 요청하세요.'
          });
          setTimeout(() => setCopiedId(null), 3000);
        } else {
          toast.error('오류 보고서 자동 복사에 실패했습니다. 직접 복사해 주세요.');
        }
      } catch (err) {
        console.error('Fallback copy failed', err);
        toast.error('오류 보고서 복사에 실패했습니다.');
      }
    };

    if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(markdownTemplate).then(() => {
        setCopiedId(log.id);
        toast.success('구글 AI 스튜디오 맞춤형 오류 보고서가 복사되었습니다!', {
          description: '구글 AI 스튜디오에 바로 붙여넣기(Ctrl+V)하여 수정을 요청하세요.'
        });
        setTimeout(() => setCopiedId(null), 3000);
      }).catch(() => {
        fallbackCopy(markdownTemplate, log.id);
      });
    } else {
      fallbackCopy(markdownTemplate, log.id);
    }
  };

  // Clear client logs
  const handleClearLogs = () => {
    if (window.confirm('정말 모든 브라우저 시스템 에러 로그를 삭제하시겠습니까?')) {
      logger.clearLogs();
      toast.success('에러 로그가 초기화되었습니다.');
      loadLogs();
    }
  };

  // Clear Payment API database logs
  const handleClearApiLogs = async () => {
    if (!window.confirm('🚨 [주의] 데이터베이스의 모든 결제/환불 통신 로깅 데이터를 영구적으로 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.')) {
      return;
    }
    
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        toast.error('세션이 만료되어 로그를 비울 수 없습니다.');
        return;
      }

      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'admin-clear-payment-api-logs'
        })
      });

      const result = await response.json();
      if (result.status === 'success') {
        toast.success('결제 및 환불 통신 데이터베이스 로그가 초기화되었습니다.');
        fetchApiLogs();
      } else {
        throw new Error(result.message || '삭제 실패');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`로그 초기화 중 오류: ${err.message}`);
    }
  };

  // Simulate local errors
  const triggerTestRuntimeError = () => {
    try {
      const fakeObj: any = null;
      console.log(fakeObj.nonExistentProperty);
    } catch (err: any) {
      logger.log(`[시뮬레이터] 테스트용 수동 런타임 에러 : ${err.message}`, err, 'runtime', '관리자가 수동으로 에러 기록을 테스트하기 위해 에러를 발생시켰습니다.');
      toast.info('테스트용 런타임 에러가 기록되었습니다!!');
      loadLogs();
    }
  };

  const triggerTestPromiseError = () => {
    const p = Promise.reject(new Error('K-Learn DB Connection Timeout (Simulated DB failure)'));
    p.catch(err => {
      logger.log(`[시뮬레이터] 테스트용 프로미스 거부 에러: ${err.message}`, err, 'promise', '관리자가 수동으로 비동기 프로미스 거부 로그 생성을 수행했습니다.');
      toast.info('테스트용 프로미스 에러가 기록되었습니다!!');
      loadLogs();
    });
  };

  // Counting logic for UI counters
  const countByType = (type: string) => Array.isArray(logs) ? logs.filter(l => l.type === type).length : 0;
  
  const getApiLogCountByType = (type: string) => {
    if (!apiLogs || apiLogs.length === 0) return 0;
    if (type === 'ALL') return apiLogs.length;
    if (type === 'INIT') return apiLogs.filter(l => l.type === 'INIT_PAY_REQ').length;
    if (type === 'S2S_REQ') return apiLogs.filter(l => l.type === 'S2S_APPROVAL_REQ').length;
    if (type === 'S2S_RES') return apiLogs.filter(l => l.type === 'S2S_APPROVAL_RES').length;
    if (type === 'REFUND') return apiLogs.filter(l => l.type === 'REFUND_REQ' || l.type === 'REFUND_RES').length;
    if (type === 'NET') return apiLogs.filter(l => l.type === 'NET_CANCEL_REQ' || l.type === 'NET_CANCEL_RES').length;
    if (type === 'ERROR') return apiLogs.filter(l => l.type === 'ERROR_LOG' || l.status === 'FAILED').length;
    return 0;
  };

  // Payment DB logs filter & search
  const filteredApiLogs = apiLogs.filter(log => {
    // 1. Tag Filter
    let passTag = true;
    if (apiFilter === 'INIT') passTag = log.type === 'INIT_PAY_REQ';
    else if (apiFilter === 'S2S_REQ') passTag = log.type === 'S2S_APPROVAL_REQ';
    else if (apiFilter === 'S2S_RES') passTag = log.type === 'S2S_APPROVAL_RES';
    else if (apiFilter === 'REFUND') passTag = log.type === 'REFUND_REQ' || log.type === 'REFUND_RES';
    else if (apiFilter === 'NET') passTag = log.type === 'NET_CANCEL_REQ' || log.type === 'NET_CANCEL_RES';
    else if (apiFilter === 'ERROR') passTag = log.type === 'ERROR_LOG' || log.status === 'FAILED';

    if (!passTag) return false;

    // 2. Keyword Search
    if (!searchKeyword.trim()) return true;
    const lowerKeyword = searchKeyword.toLowerCase();
    
    const oidMatch = log.merchant_uid && log.merchant_uid.toLowerCase().includes(lowerKeyword);
    const codeMatch = log.error_code && log.error_code.toLowerCase().includes(lowerKeyword);
    const msgMatch = log.error_message && log.error_message.toLowerCase().includes(lowerKeyword);
    const typeMatch = log.type && log.type.toLowerCase().includes(lowerKeyword);
    const urlMatch = log.api_url && log.api_url.toLowerCase().includes(lowerKeyword);
    const orderNameMatch = log.orders?.order_name && log.orders.order_name.toLowerCase().includes(lowerKeyword);
    const userEmailMatch = log.orders?.profiles?.email && log.orders.profiles.email.toLowerCase().includes(lowerKeyword);
    const userNameMatch = log.orders?.profiles?.name && log.orders.profiles.name.toLowerCase().includes(lowerKeyword);

    return !!(oidMatch || codeMatch || msgMatch || typeMatch || urlMatch || orderNameMatch || userEmailMatch || userNameMatch);
  });

  // Human-readable Korean labels for KG Inicis API action states
  const getLogTypeBadge = (type: string) => {
    switch (type) {
      case 'INIT_PAY_REQ':
        return { text: '시작인증서명', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
      case 'S2S_APPROVAL_REQ':
        return { text: 'S2S 승인요청', bg: 'bg-blue-50 text-blue-700 border-blue-100' };
      case 'S2S_APPROVAL_RES':
        return { text: 'S2S 승인완료', bg: 'bg-indigo-50 text-indigo-700 border-indigo-100' };
      case 'REFUND_REQ':
        return { text: '환불취소요청', bg: 'bg-orange-50 text-orange-700 border-orange-100' };
      case 'REFUND_RES':
        return { text: '환불취소완료', bg: 'bg-purple-50 text-purple-700 border-purple-100' };
      case 'NET_CANCEL_REQ':
        return { text: '망취소요청', bg: 'bg-pink-50 text-pink-700 border-pink-100 font-bold' };
      case 'NET_CANCEL_RES':
        return { text: '망취소승인', bg: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100 font-bold' };
      case 'ERROR_LOG':
        return { text: '시스템오류', bg: 'bg-red-50 text-red-700 border-red-100 font-black' };
      default:
        return { text: type || '일반통신', bg: 'bg-gray-50 text-gray-700 border-gray-100' };
    }
  };

  return (
    <div className="space-y-8 select-none">
      {/* ─────────────────── [HEADER SECTION] ─────────────────── */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2 text-indigo-600">
            <Bug className="w-5 h-5 animate-pulse text-indigo-600" />
            <span className="text-xs font-black uppercase tracking-widest text-indigo-600">Technical Diagnostics & Log Center</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">통합 성능 진단 및 통신 트래커</h1>
          <p className="text-sm text-gray-500 font-bold">
            클라이언트 런타임 예외와 함께 KG 이니시스 실시간 결제/환불 승인망의 요청-응답 전문 데이터를 실시간 DB 추적하여 기술 문제를 진단합니다.
          </p>
        </div>
        
        {/* Tab Selection */}
        <div className="flex bg-gray-150 p-1 rounded-2xl border border-gray-100 self-start xl:self-center">
          <button
            onClick={() => setActiveTab('system')}
            className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 ${
              activeTab === 'system'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
            시스템오류 로그 (클라이언트)
          </button>
          <button
            onClick={() => setActiveTab('payment')}
            className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 ${
              activeTab === 'payment'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            결제/환불 통신망 로그 (서버 DB)
          </button>
        </div>
      </div>

      {/* ─────────────────── [SYSTEM LOGS TAB CONTENT] ─────────────────── */}
      {activeTab === 'system' && (
        <div className="space-y-8">
          {/* Quick Actions Panel */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-purple-50/20 border border-purple-100 rounded-3xl gap-4">
            <div className="space-y-0.5">
              <h3 className="font-black text-gray-900 text-sm">로컬 예외 테스팅 & 유틸리티</h3>
              <p className="text-xs text-gray-500 font-bold">인위적인 에러를 일으켜 감지 추적 상태가 바르게 진행되는지 점검해 보십시오.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button 
                variant="outline" 
                onClick={triggerTestRuntimeError}
                className="rounded-2xl border-orange-200 hover:bg-orange-50 text-orange-700 font-black text-xs h-11"
              >
                <Terminal className="w-4 h-4 mr-2" />
                테스트 에러 (런타임)
              </Button>
              <Button 
                variant="outline" 
                onClick={triggerTestPromiseError}
                className="rounded-2xl border-amber-200 hover:bg-amber-50 text-amber-700 font-black text-xs h-11"
              >
                <Play className="w-4 h-4 mr-2" />
                테스트 에러 (프로미스)
              </Button>
              <Button 
                variant="outline"
                onClick={handleClearLogs}
                disabled={!Array.isArray(logs) || logs.length === 0}
                className="rounded-2xl border-red-200 hover:bg-red-50 text-red-600 disabled:opacity-50 font-black text-xs h-11"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                전체 삭제
              </Button>
            </div>
          </div>

          {/* Grid Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="p-6 bg-white border border-gray-100 rounded-3xl shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-gray-400 uppercase">전체 오류 로그</p>
                <p className="text-3xl font-black text-gray-900">{(Array.isArray(logs) ? logs.length : 0)} <span className="text-sm font-bold text-gray-400">건</span></p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </Card>

            <Card className="p-6 bg-white border border-gray-100 rounded-3xl shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-gray-400 uppercase">런타임 오류 (Runtime)</p>
                <p className="text-3xl font-black text-red-600">{countByType('runtime')} <span className="text-sm font-bold text-gray-400">건</span></p>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
                <Bug className="w-6 h-6" />
              </div>
            </Card>

            <Card className="p-6 bg-white border border-gray-100 rounded-3xl shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-gray-400 uppercase">비동기 프로미스 거부 (Promise)</p>
                <p className="text-3xl font-black text-amber-600">{countByType('promise')} <span className="text-sm font-bold text-gray-400">건</span></p>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                <Terminal className="w-6 h-6" />
              </div>
            </Card>

            <Card className="p-6 bg-white border border-gray-100 rounded-3xl shadow-sm flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-gray-400 uppercase">수동 호출 로그 (Manual)</p>
                <p className="text-3xl font-black text-blue-600">{countByType('manual')} <span className="text-sm font-bold text-gray-400">건</span></p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <RefreshCw className="w-6 h-6" />
              </div>
            </Card>
          </div>

          {/* Logs Table / List */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-gray-50">
              <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-gray-400" />
                예외 검출 히스토리
              </h2>
              <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                실시간 진단 중
              </span>
            </div>

            {!Array.isArray(logs) || logs.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-400">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-black text-gray-700">검출된 로컬 시스템 에러가 존재하지 않습니다.</p>
                  <p className="text-sm text-gray-400 font-bold">시스템이 매우 안정적으로 가동되고 있으며 기동 예외가 잡히지 않았습니다.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <div 
                      key={log.id} 
                      className={`border rounded-2xl transition-all overflow-hidden ${
                        isExpanded 
                          ? 'border-purple-200 bg-purple-50/10 shadow-sm' 
                          : 'border-gray-100 hover:border-gray-200 bg-white'
                      }`}
                    >
                      {/* Summary Row */}
                      <div 
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                      >
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`mt-1 p-2 rounded-xl shrink-0 ${
                            log.type === 'runtime' 
                              ? 'bg-red-50 text-red-600' 
                              : log.type === 'promise' 
                              ? 'bg-amber-50 text-amber-500' 
                              : 'bg-blue-50 text-blue-600'
                          }`}>
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                          <div className="space-y-1 overflow-hidden">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                log.type === 'runtime' 
                                  ? 'bg-red-100 text-red-700' 
                                  : log.type === 'promise' 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {log.type.toUpperCase()}
                              </span>
                              <span className="text-xs text-gray-400 font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(log.timestamp).toLocaleString('ko-KR')}
                              </span>
                            </div>
                            <h3 className="font-black text-gray-900 text-sm md:text-base leading-tight truncate max-w-2xl">
                              {log.message}
                            </h3>
                            <p className="text-xs text-gray-400 font-bold flex items-center gap-1.5 truncate">
                              <Globe className="w-3.5 h-3.5 text-gray-300" />
                              <span>URL: {log.url}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 ml-auto md:ml-0">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyToAIStudio(log);
                            }}
                            className="rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white shrink-0 shadow-lg shadow-purple-100"
                          >
                            {copiedId === log.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 mr-1" />
                                복사 완료!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 mr-1" />
                                AI 스튜디오 복사하기
                              </>
                            )}
                          </Button>

                          <div className="text-gray-400">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Detail Panel */}
                      {isExpanded && (
                        <div className="px-5 pb-5 border-t border-gray-100/50 bg-gray-50/50 pt-5 space-y-4">
                          {/* Technical metadata */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-gray-500">
                            <div className="p-3 bg-white rounded-xl border border-gray-100 space-y-1">
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider">Device / Browser Environment</p>
                              <p className="font-mono text-gray-700 truncate" title={log.userAgent}>
                                {log.userAgent}
                              </p>
                            </div>
                            <div className="p-3 bg-white rounded-xl border border-gray-100 space-y-1">
                              <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider">Exact Source Webpage</p>
                              <p className="font-mono text-gray-700 truncate" title={log.url}>
                                {log.url}
                              </p>
                            </div>
                          </div>

                          {log.additionalInfo && (
                            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                              <h4 className="text-xs font-black text-blue-900 mb-1">💡 추가 진단 메모</h4>
                              <p className="text-xs text-blue-800 font-bold leading-normal">{log.additionalInfo}</p>
                            </div>
                          )}

                          {/* Stacktrace wrapper */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-gray-400 uppercase tracking-wider">Call Stack Exception Trace</span>
                              <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-mono">DEBUG MODE</span>
                            </div>
                            <pre className="p-4 bg-gray-900 text-gray-100 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed max-h-72 shadow-inner select-text">
                              {log.stack || 'No Stacktrace recorded. Check the console or manual logs.'}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────── [PAYMENTS DB API LOGS TAB CONTENT] ─────────────────── */}
      {activeTab === 'payment' && (
        <div className="space-y-6">
          {/* Main Controls Header & Filters */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
            
            {/* Search & Actions block */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="주문번호(OID), 주문명, 에러코드, 유저 이메일, 트래킹 키워드를 검색해보세요..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-xs font-bold font-sans outline-none"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  onClick={fetchApiLogs}
                  disabled={isApiLogsLoading}
                  className="rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 h-11 px-4 text-xs font-black"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isApiLogsLoading ? 'animate-spin' : ''}`} />
                  실시간 동기화
                </Button>
                <Button
                  onClick={handleClearApiLogs}
                  className="rounded-2xl bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-700 h-11 px-4 text-xs font-black shadow-sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  DB 로그 완전 초기화
                </Button>
              </div>
            </div>

            {/* Quick Filter tabs */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-50">
              {[
                { key: 'ALL', label: '전체 로그' },
                { key: 'INIT', label: '인증 서명 시도' },
                { key: 'S2S_REQ', label: '승인 요청' },
                { key: 'S2S_RES', label: '승인 응답' },
                { key: 'REFUND', label: '거래 환불' },
                { key: 'NET', label: '자동 망취소' },
                { key: 'ERROR', label: '통신/에러 오류' }
              ].map((filterTab) => {
                const count = getApiLogCountByType(filterTab.key);
                const isActive = apiFilter === filterTab.key;
                
                return (
                  <button
                    key={filterTab.key}
                    onClick={() => setApiFilter(filterTab.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-black border transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span>{filterTab.label}</span>
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${
                      isActive ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List Section */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-gray-50">
              <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Database className="w-5 h-5 text-gray-400" />
                PG망 S2S API 통신 전문 기록
              </h2>
              <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                KG이니시스 연동 회선 정상 수집중
              </span>
            </div>

            {isApiLogsLoading ? (
              <div className="py-24 text-center space-y-4">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <p className="text-sm text-gray-500 font-bold">서버 데이터베이스로부터 통신 전문 이력을 갱신하고 있습니다...</p>
              </div>
            ) : filteredApiLogs.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-400">
                  <Check className="w-8 h-8 text-indigo-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-black text-gray-700">추적된 기기 통신 정보가 없습니다.</p>
                  <p className="text-sm text-gray-400 font-bold">지정하신 필터 또는 검색 조건에 부합하는 통신 데이터가 수집되지 않았습니다.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredApiLogs.map((log) => {
                  const isExpanded = expandedApiLogId === log.id;
                  const tagInfo = getLogTypeBadge(log.type);
                  const isFailed = log.status === 'FAILED' || log.type === 'ERROR_LOG';

                  return (
                    <div
                      key={log.id}
                      className={`border rounded-2xl transition-all overflow-hidden ${
                        isExpanded
                          ? 'border-indigo-200 bg-indigo-50/10 shadow-sm'
                          : 'border-gray-100 hover:border-gray-200 bg-white'
                      }`}
                    >
                      {/* Summary Item Row */}
                      <div
                        onClick={() => setExpandedApiLogId(isExpanded ? null : log.id)}
                        className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 cursor-pointer select-none"
                      >
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1 overflow-hidden">
                          {/* Fail/Success Indicator */}
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            isFailed 
                              ? 'bg-rose-50 text-rose-600' 
                              : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {isFailed ? <XCircle className="w-5 h-5" /> : <ArrowRightLeft className="w-5 h-5" />}
                          </div>

                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase ${tagInfo.bg}`}>
                                {tagInfo.text}
                              </span>
                              
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                isFailed ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {log.status}
                              </span>

                              <span className="text-xs text-gray-400 font-bold flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(log.created_at).toLocaleString('ko-KR')}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-sm">
                              <h4 className="font-extrabold text-gray-900">
                                {log.orders?.order_name || '결제 처리'}
                              </h4>
                              {log.merchant_uid && (
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                  주문번: {log.merchant_uid}
                                </span>
                              )}
                              {log.orders?.amount && (
                                <span className="text-xs font-black text-indigo-700">
                                  ￦{Number(log.orders.amount).toLocaleString()}원
                                </span>
                              )}
                            </div>

                            {/* User details and endpoints */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 font-medium">
                              {log.orders?.profiles && (
                                <span className="font-bold text-gray-500">
                                  주문자: {log.orders.profiles.name || '미기입'} ({log.orders.profiles.email})
                                </span>
                              )}
                              <span className="font-mono text-gray-400 truncate max-w-md" title={log.api_url}>
                                API: {log.api_url}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Expand status toggle */}
                        <div className="flex items-center gap-3 shrink-0 ml-auto xl:ml-0">
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </div>
                      </div>

                      {/* Expanded Section View */}
                      {isExpanded && (
                        <div className="px-5 pb-5 border-t border-gray-100/50 bg-slate-50/30 pt-5 space-y-4">
                          
                          {/* Alert block for Error-Statused logs */}
                          {(log.error_code || log.error_message) && (
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
                              <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                              <div className="space-y-1">
                                <h5 className="text-xs font-black text-rose-950">
                                  ⚠️ KG 이니시스 통신오류 및 거절 응답 감지 (Code: {log.error_code || 'N/A'})
                                </h5>
                                <p className="text-xs font-black text-rose-800 leading-normal">
                                  {log.error_message || '지정되지 않은 거절 전문 오류가 발생했거나 백엔드 결제 인증 가드가 개입했습니다.'}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Request / Response Tab panels */}
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            
                            {/* Request payload */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                                  → 송신 요청 전문 데이터 (Request Payload)
                                </span>
                              </div>
                              <PrettyJson data={log.request_data} />
                            </div>

                            {/* Response payload */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                                  ← 수신 응답 전문 데이터 (Response Payload)
                                </span>
                              </div>
                              <PrettyJson data={log.response_data} />
                            </div>

                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
