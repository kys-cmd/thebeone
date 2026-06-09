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
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { logger, ErrorLog } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function ErrorLogs() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load logs on mount and listen to storage synchronization events
  const loadLogs = () => {
    setLogs(logger.getLogs());
  };

  useEffect(() => {
    loadLogs();

    // Listen for real-time error logging events on the client
    const handleNewLog = () => {
      loadLogs();
    };

    window.addEventListener('beone-new-error-log', handleNewLog);
    return () => {
      window.removeEventListener('beone-new-error-log', handleNewLog);
    };
  }, []);

  // Utility to copy logs transformed specifically for Google AI Studio
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

  // Clear all localStorage based error logs
  const handleClearLogs = () => {
    if (window.confirm('정말 모든 에러 로그를 삭제하시겠습니까?')) {
      logger.clearLogs();
      toast.success('에러 로그가 초기화되었습니다.');
    }
  };

  // Simulate error for testing
  const triggerTestRuntimeError = () => {
    try {
      // Intentionally cause an error by referencing an undefined variable inside a try-catch to log it
      const fakeObj: any = null;
      console.log(fakeObj.nonExistentProperty);
    } catch (err: any) {
      logger.log(`[시뮬레이터] 테스트용 수동 런타임 에러 : ${err.message}`, err, 'runtime', '관리자가 수동으로 에러 기록을 테스트하기 위해 에러를 발생시켰습니다.');
      toast.info('테스트용 런타임 에러가 기록되었습니다!!');
    }
  };

  const triggerTestPromiseError = () => {
    // Generate a rejected promise and log it through our logger manually
    const p = Promise.reject(new Error('K-Learn DB Connection Timeout (Simulated DB failure)'));
    p.catch(err => {
      logger.log(`[시뮬레이터] 테스트용 프로미스 거부 에러: ${err.message}`, err, 'promise', '관리자가 수동으로 비동기 프로미스 거부 로그 생성을 수행했습니다.');
      toast.info('테스트용 프로미스 에러가 기록되었습니다!!');
    });
  };

  // Type count helpers
  const countByType = (type: string) => Array.isArray(logs) ? logs.filter(l => l.type === type).length : 0;

  return (
    <div className="space-y-8">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-purple-600">
            <Bug className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest">System Diagnostics</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">오류 로그 분석기</h1>
          <p className="text-sm text-gray-500 font-bold">
            사이트 이용 시 발생하는 모든 런타임 및 네트워크 예외 상황을 모니터링합니다. 수집된 오류는 즉석에서 구글 AI 스튜디오 규격에 맞게 복사할 수 있습니다.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline" 
            onClick={triggerTestRuntimeError}
            className="rounded-2xl border-orange-200 hover:bg-orange-50 text-orange-700 font-black text-xs h-12"
          >
            <Terminal className="w-4 h-4 mr-2" />
            테스트 에러 (런타임)
          </Button>
          <Button 
            variant="outline" 
            onClick={triggerTestPromiseError}
            className="rounded-2xl border-amber-200 hover:bg-amber-50 text-amber-700 font-black text-xs h-12"
          >
            <Play className="w-4 h-4 mr-2" />
            테스트 에러 (프로미스)
          </Button>
          <Button 
            variant="outline"
            onClick={handleClearLogs}
            disabled={!Array.isArray(logs) || logs.length === 0}
            className="rounded-2xl border-red-200 hover:bg-red-50 text-red-600 disabled:opacity-50 font-black text-xs h-12"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            로그 완전 격리(전체삭제)
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
              <p className="text-base font-black text-gray-700">검출된 오류가 존재하지 않습니다.</p>
              <p className="text-sm text-gray-400 font-bold">시스템이 매우 안정적으로 가동되고 있으며 예외가 잡히지 않았습니다.</p>
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
                        <pre className="p-4 bg-gray-900 text-gray-100 rounded-2xl overflow-x-auto text-[11px] font-mono leading-relaxed max-h-72 shadow-inner">
                          {log.stack || 'No Stacktrace recorded. Check the console or manual logs.'}
                        </pre>
                      </div>

                      <div className="flex justify-end pt-1">
                        <p className="text-[10px] text-gray-400 font-bold">
                          * 위 로그 내용을 구글 AI 스튜디오 프롬프트 창에 고스란히 복사 붙여넣기 하시면 AI가 해결책과 소스 수정 방향을 완벽하게 수립해 드립니다.
                        </p>
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
  );
}
