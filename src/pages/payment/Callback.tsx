import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, Loader2, Mail, ShieldAlert, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

// KG Inicis resultCode - Korean clear description helper
function analyzeInicisCode(code: string | null | undefined): { title: string; desc: string; solution: string } {
  if (!code) {
    return {
      title: "결제 데이터 누락",
      desc: "결제사(PG)로부터 유효한 결과 코드가 반환되지 않았습니다.",
      solution: "일시적인 세션 유실일 수 있으니 장바구니에서 결제를 다시 시도해 주세요."
    };
  }

  const cleanCode = code.toUpperCase().trim();

  // Common Inicis codes
  switch (cleanCode) {
    case "0101":
    case "0201":
      return {
        title: "신용카드 한도 초과",
        desc: "결제에 이용하신 신용/체크카드의 월간 또는 일회 한도를 초과했습니다.",
        solution: "다른 카드사 카드를 사용하시거나 한도 조정 후 다시 결제해주세요."
      };
    case "0301":
      return {
        title: "카드 정보 오입력",
        desc: "카드 번호, 유효기간(Month/Year) 또는 CVC 번호가 잘못 입력되었습니다.",
        solution: "정보를 다시 올바르게 입력하시거나 간편결제(페이코/네이버페이 등)를 이용해주세요."
      };
    case "0401":
      return {
        title: "인증 비밀번호 불일치",
        desc: "카드 결제 비밀번호 앞 2자리 또는 공인인증 오류가 발생했습니다.",
        solution: "전자서명 비밀번호 확인 후 재신청 후 시도해 주시기 바랍니다."
      };
    case "0501":
      return {
        title: "제한된 카드사 및 일시불 제한",
        desc: "지정하신 카드가 일시적으로 가맹점 계약 제한 또는 해외 발행 카드 제한에 해당합니다.",
        solution: "국내 정식 가공 발행 카드를 선택하거나 할부 개월 수를 조정하십시오."
      };
    case "1001":
      return {
        title: "원천사 미승인 (잔액 부족)",
        desc: "체크카드 연결 계좌의 인출 잔액 부족이거나 해당 카드가 비밀번호 입력 횟수 초과 상태입니다.",
        solution: "계좌에 잔액을 충전하시거나 해당 카드사 고객센터에서 카드 잠금 해제 후 시도해주세요."
      };
    case "1111":
      return {
        title: "사용자 결제 중단 (취소)",
        desc: "결제 창이 활성화된 상태에서 뒤로가기, 창 닫기 버튼을 누르거나 서명 과정을 취소했습니다.",
        solution: "구매 프로세스 승인 단계를 끝까지 대기해 주십시오."
      };
    case "2222":
      return {
        title: "통신 시간 지연 (S2S 타임아웃)",
        desc: "결제사(Inicis)망과 고객 사이의 최종 승인 전문을 송수신하는 과정에서 타임아웃 지연이 발생했습니다.",
        solution: "이미 승인이 일어났을 수 있으니 중복 결제 방지를 위해 '마이페이지'에서 수강 내역을 먼저 체크해 보십시오."
      };
    case "V805":
      return {
        title: "가맹점 보안키(signKey) 불일치",
        desc: "가맹점 상점(MID)과 위변조 방지용 SignKey 서명값이 결제 모듈 사양서와 매칭되지 않습니다. (관리자 세팅 오류)",
        solution: "관리자 환경변수 설정(INICIS_SIGNKEY)을 다시 한번 점검해주세요. (테스트 시 INIpayTest 정보 매칭 필수)"
      };
    case "V811":
    case "V812":
      return {
        title: "주문 정보 및 거래금액 상이",
        desc: "인증을 시작할 당시의 제품 금액이 최종 카드사 승인 전문을 실행하는 전송 수치와 불일치합니다.",
        solution: "장바구니 세션을 초기화하고 1회 단건 결제로 주문을 재생성해보십시오."
      };
    case "V015":
      return {
        title: "미인증 상점 ID (MID)",
        desc: "결제 가맹점 상점아이디(MID)의 계약 상태가 정지되어 있거나 허가되지 않은 도메인입니다.",
        solution: "배포된 호스트 도메인이 이니시스 가맹점 관리자에 WhiteLabel 도메인으로 등록되었는지 관리자 환경을 확인해 보세요."
      };
    case "DATABASE_MAPPING_ERROR":
      return {
        title: "시스템 무결성 매킹 오류 (DB 오류)",
        desc: "이니시스 최종 승인은 성공했으나 수강 생성을 위한 데이터베이스 처리 중 오류가 일어나 자동 망취소 환불 진행되었습니다.",
        solution: "사용자 계정 상태에 문제가 없을지 고객센터 및 데이터 마이그레이션 모듈의 유효성을 체크하십시오."
      };
    default:
      return {
        title: "결제 실패 (코드: " + cleanCode + ")",
        desc: "카드사 또는 단말기 연동 시스템 구간에서 예외 및 한도/심의 거절이 발생했습니다.",
        solution: "정확한 사유는 해당 카드사의 승인거부 상세 내역을 통해 확인 가능합니다."
      };
  }
}

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('결제 결과를 확인하고 있습니다...');
  const [debugInfo, setDebugInfo] = useState<{
    resultCode?: string | null;
    oid?: string | null;
    paramStatus?: string | null;
    userEmail?: string;
    courseTitle?: string;
  }>({});

  // Error Dispatch State for Administrative Warning System
  const [alertStatus, setAlertStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [alertMessage, setAlertMessage] = useState<string>('');

  useEffect(() => {
    async function processCallback() {
      let resultCode = searchParams.get('resultCode') || searchParams.get('authResultCode');
      const resultMsg = searchParams.get('resultMsg');
      const statusParam = searchParams.get('status');
      const messageParam = searchParams.get('message');
      const oidParam = searchParams.get('oid') || searchParams.get('orderNumber');

      // Auto-detect resultCode from the error message as a safe fallback
      if (!resultCode && (statusParam === 'fail' || searchParams.get('success') === 'false')) {
        const fullMsg = (messageParam || resultMsg || '').toLowerCase();
        if (fullMsg.includes('취소') || fullMsg.includes('중단') || fullMsg.includes('사용자') || fullMsg.includes('cancel')) {
          resultCode = '1111';
        } else if (fullMsg.includes('한도')) {
          resultCode = '0101';
        } else if (fullMsg.includes('비밀번호') || fullMsg.includes('오류 앞 2자리')) {
          resultCode = '0401';
        } else if (fullMsg.includes('키') || fullMsg.includes('key') || fullMsg.includes('signkey') || fullMsg.includes('서명')) {
          resultCode = 'V805';
        } else if (fullMsg.includes('금액') || fullMsg.includes('가격') || fullMsg.includes('상이')) {
          resultCode = 'V811';
        } else if (fullMsg.includes('가맹점') || fullMsg.includes('mid') || fullMsg.includes('상점')) {
          resultCode = 'V015';
        } else if (fullMsg.includes('데이터베이스') || fullMsg.includes('db') || fullMsg.includes('무결성') || fullMsg.includes('마킹') || fullMsg.includes('세션')) {
          resultCode = 'DATABASE_MAPPING_ERROR';
        } else if (fullMsg.includes('통신') || fullMsg.includes('타임아웃') || fullMsg.includes('api') || fullMsg.includes('http')) {
          resultCode = '2222';
        }
      }

      let userEmail = 'unknown@guest.com';
      let courseTitle = '온라인 전문 교육 강좌';

      // Attempt to load metadata to contextify the troubleshooting log
      if (oidParam) {
        try {
          const { data: orderData } = await supabase
            .from('orders')
            .select('user_id, amount, courses(title)')
            .eq('merchant_uid', oidParam)
            .maybeSingle();

          if (orderData) {
            if (orderData.courses && (orderData.courses as any).title) {
              courseTitle = (orderData.courses as any).title;
            }
            if (orderData.user_id) {
              const { data: pData } = await supabase
                .from('profiles')
                .select('email')
                .eq('id', orderData.user_id)
                .maybeSingle();
              if (pData?.email) {
                userEmail = pData.email;
              }
            }
          }
        } catch (dbErr) {
          console.warn("[Callback.tsx] Metadata contextual loading skipped:", dbErr);
        }
      }

      setDebugInfo({
        resultCode,
        oid: oidParam,
        paramStatus: statusParam,
        userEmail,
        courseTitle
      });

      const isSuccess = statusParam === 'success' || resultCode === '0000' || searchParams.get('success') === 'true';

      if (isSuccess) {
        setStatus('success');
        setMessage(messageParam || '결제가 성공적으로 완료되었습니다.');
      } else {
        setStatus('error');
        const finalErrorMsg = messageParam || resultMsg || '결제 처리가 거절되었습니다.';
        setMessage(finalErrorMsg);

        // Auto trigger the prioritized defect administrative alert dispatch
        triggerAdminFailureAlert(
          oidParam || "N/A",
          resultCode || "UNKNOWN",
          finalErrorMsg,
          userEmail,
          courseTitle
        );
      }
    }

    processCallback();
  }, [searchParams]);

  // Dispatch Administrative alert notifier
  const triggerAdminFailureAlert = async (
    oid: string,
    resultCode: string,
    resultMsg: string,
    userEmail: string,
    courseTitle: string
  ) => {
    setAlertStatus('sending');
    setAlertMessage('관리자 비상 이메일 및 채널로 정밀 결제 실패 분석을 준비하고 있습니다...');

    const diag = analyzeInicisCode(resultCode);
    const diagnosisText = `[진단: ${diag.title}] ${diag.desc} (조치방법: ${diag.solution})`;

    try {
      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'send-payment-failure-alert',
          oid,
          resultCode,
          resultMsg,
          analysis: diagnosisText,
          userEmail,
          courseTitle
        })
      });

      const resData = await response.json();
      if (response.ok && resData.status === 'success') {
        setAlertStatus('success');
        setAlertMessage(resData.message || '결제 실패 경보가 관리자(kys@k-learn.co.kr) 채널로 즉시 발송되었습니다.');
      } else {
        throw new Error(resData.message || '통신 응답 규격이 실재하지 않습니다.');
      }

    } catch (alertErr: any) {
      console.error("[Callback-Page] Alert Dispatch Failure:", alertErr);
      setAlertStatus('error');
      setAlertMessage(`기본 통신 전송 지연으로 실시간 알림 로깅 대기 중: ${alertErr.message}`);
    }
  };

  const codeDiagnosis = analyzeInicisCode(debugInfo.resultCode);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 md:p-12 rounded-[40px] shadow-2xl text-center max-w-lg w-full space-y-6"
      >
        {status === 'loading' && (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-16 h-16 text-purple-600 animate-spin" />
            <h2 className="text-2xl font-black text-gray-900">결제 처리 중</h2>
            <p className="text-gray-500 font-bold">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">결제 완료!</h2>
            <p className="text-green-600 font-bold bg-green-50/50 px-4 py-2 rounded-xl text-sm">{message}</p>
            
            {debugInfo.oid && (
              <div className="text-left w-full bg-gray-50 p-4 rounded-2xl text-xs space-y-1 border border-gray-100 font-mono">
                <div className="flex justify-between text-gray-400">
                  <span>거래 주문번호 (OID)</span>
                  <span className="text-gray-700 font-bold">{debugInfo.oid}</span>
                </div>
              </div>
            )}

            <Button 
              className="w-full h-14 bg-purple-600 hover:bg-purple-700 rounded-2xl text-lg font-black mt-2"
              onClick={() => navigate('/mypage')}
            >
              내 학습 정보 확인하기
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center space-y-5">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
              <XCircle className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-900">결제 실패</h2>
            <p className="text-rose-600 font-extrabold px-4 py-2 bg-rose-50 rounded-2xl text-sm break-keep leading-relaxed">
              {message}
            </p>
            
            {/* PG Result Code Precision Diagnostics Dashboard */}
            <div className="text-left w-full bg-slate-900 text-slate-100 p-6 rounded-3xl text-xs space-y-3.5 border border-slate-800 font-mono relative overflow-hidden">
              <div className="absolute right-3 top-3 opacity-10">
                <ShieldAlert className="w-16 h-16 text-red-500" />
              </div>
              
              <p className="text-[11px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                🛡️ KG 이니시스 가맹점 정밀 분석 보고서
              </p>
              
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">결제 구분</span>
                  <span className="text-slate-200 font-semibold">Web StdPay (가맹점 채널)</span>
                </div>
                
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">결제 에러 코드 (resultCode)</span>
                  <span className="text-yellow-400 font-bold">{debugInfo.resultCode || "N/A (가맹점 조기 취소)"}</span>
                </div>

                <div className="border-b border-slate-800 pb-2">
                  <span className="text-slate-400 block mb-1">인증 실패 정밀 진단</span>
                  <span className="text-amber-300 font-black tracking-tight text-xs block bg-slate-850 p-2 rounded-lg border border-slate-800">
                    {codeDiagnosis.title}
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed pt-1.5 pl-0.5 whitespace-pre-line">
                    {codeDiagnosis.desc}
                  </p>
                </div>

                <div className="pb-1 bg-[#28351e]/30 border border-[#3f6212]/30 p-2.5 rounded-xl">
                  <span className="text-green-400 font-black block mb-1">🔑 추천 긴급 대안법</span>
                  <p className="text-slate-200 text-[10.5px] leading-relaxed break-keep">
                    {codeDiagnosis.solution}
                  </p>
                </div>
              </div>
            </div>

            {/* REAL-TIME ADMIN ALERT DISPATCH MONITORING BAR */}
            <div className="w-full bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 text-left text-[11px] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="font-bold text-gray-700">관리자 비상 알림국 (kys@k-learn.co.kr)</span>
                </div>
                {alertStatus === 'sending' && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> 연동 통보 중
                  </span>
                )}
                {alertStatus === 'success' && (
                  <span className="text-[10px] bg-emerald-150 text-emerald-800 px-2 py-0.5 rounded-full font-black flex items-center gap-0.5 border border-emerald-200">
                    <Check className="w-2.5 h-2.5 text-emerald-600" /> 통보완료
                  </span>
                )}
                {alertStatus === 'error' && (
                  <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">
                    재전송 대기
                  </span>
                )}
              </div>
              <p className="text-gray-500 leading-normal text-[10.5px] font-medium break-keep">
                {alertMessage || "결제 실패 정밀 로그를 구성하여 관리팀으로 전송 프로세스를 대기 중입니다."}
              </p>
            </div>

            <div className="flex gap-2.5 w-full mt-2">
              <Button 
                variant="outline"
                className="flex-1 h-14 rounded-2xl text-base font-bold border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                onClick={() => navigate('/courses')}
              >
                교과 리스트로 이동
              </Button>
              <Button 
                className="flex-1 h-14 bg-slate-900 hover:bg-slate-800 text-white text-base font-bold rounded-2xl"
                onClick={() => {
                  window.location.reload();
                }}
              >
                결제 다시 시도
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
