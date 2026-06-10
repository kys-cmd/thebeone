import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface InicisPayParams {
  price: number;
  courseId: string;
  courseName: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
}

export function useInicisPay() {
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Load KG Inicis Standard Pay JavaScript SDK at mount time
  useEffect(() => {
    const existingScript = document.getElementById("inicis-stdpay-script");
    if (existingScript) {
      setIsSdkLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.id = "inicis-stdpay-script";
    script.src = "https://stdpay.inicis.com/stdjs/INIStdPay.js";
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => {
      console.log("[INICIS-SDK] Standard Pay Web Library successfully loaded.");
      setIsSdkLoaded(true);
    };
    script.onerror = () => {
      console.error("[INICIS-SDK] Standard Pay Web Library load failure.");
      setErrorMsg("PG 결제 모듈 불러오기에 실패했습니다. 네트워크를 확인하세요.");
    };

    document.head.appendChild(script);

    return () => {
      // Clean up form container components if any left on body
      const leftoverForm = document.getElementById("inicis-temp-form-container");
      if (leftoverForm) {
        leftoverForm.remove();
      }
    };
  }, []);

  /**
   * INICIS 결제를 실행하는 메인 트리거 함수
   */
  const requestPayment = async (params: InicisPayParams) => {
    if (!isSdkLoaded) {
      alert("결제 모듈이 아직 완전히 불려오지 않았습니다. 2~3초 후 다시 시도해 주세요.");
      return;
    }

    setIsInitializing(true);
    setErrorMsg(null);

    try {
      // 1) 고유한 갱신용 상점 주문번호(OID) 생성 (시스템 및 디바이스 오리진 타임존 100% 흡수 방지식 KST 생성)
      const d = new Date();
      const kstMs = d.getTime() + (d.getTimezoneOffset() * 60000) + (9 * 60 * 60 * 1000);
      const kstDate = new Date(kstMs);
      
      const yyyy = kstDate.getFullYear();
      const MM = String(kstDate.getMonth() + 1).padStart(2, '0');
      const dd = String(kstDate.getDate()).padStart(2, '0');
      const hh = String(kstDate.getHours()).padStart(2, '0');
      const mm = String(kstDate.getMinutes()).padStart(2, '0');
      const ss = String(kstDate.getSeconds()).padStart(2, '0');
      
      const timestamp = `${yyyy}${MM}${dd}${hh}${mm}${ss}`;
      const oid = `OID_${params.courseId.substring(0, 8).toUpperCase()}_${timestamp.substring(5)}`;

      // 2) 서버에 결제 서명 및 파라미터 초기화 생성 요청 
      // 로컬 개발서버(/api/init-pay) 또는 Netlify Function API 중 현재 서빙 환경에 맞춤
      const response = await fetch("/api/init-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: params.price,
          oid,
          timestamp,
          userId: params.userId,
          courseId: params.courseId,
          orderName: params.courseName
        })
      });

      if (!response.ok) {
        throw new Error("결제 승인 서명 생성 API 통신 중 연결에 실패했습니다.");
      }

      const initResult = await response.json();
      if (initResult.status !== "success") {
        throw new Error(initResult.message || "결제 초기화에 실패했습니다.");
      }

      const { signature, mKey, mid } = initResult;

      // 3) 도메인 Host 정보 획득 및 리턴 URL 조합
      const hostOrigin = window.location.origin;
      const returnUrl = `${hostOrigin}/api/inicis-return`; // Netlify 및 Express 통합 처리용 리턴 URL

      // 4) 기존 임시 폼 컨테이너가 있으면 DOM에서 제거
      const oldContainer = document.getElementById("inicis-temp-form-container");
      if (oldContainer) oldContainer.remove();

      // 5) Hidden Form elements 생성 및 Append
      const formContainer = document.createElement("div");
      formContainer.id = "inicis-temp-form-container";
      formContainer.style.display = "none";

      const formId = "inicis_payment_form";
      const form = document.createElement("form");
      form.id = formId;
      form.method = "POST";
      form.acceptCharset = "UTF-8";

      // 결제창 노출 방식 파라미터 구성
      const formFields: Record<string, string> = {
        version: "1.0",
        gopaymethod: "Card", // Card, DirectBank 등 기본창 선택 (대문자 구분)
        mid,
        oid,
        price: params.price.toString(),
        timestamp,
        use_chkfake: "N", // Disable frontend price fraud pre-check (reduces V203 verification key omission issues) as we perform 100% secure S2S backend price verification
        signature,
        mKey,
        currency: "WON",
        merchantData: hostOrigin, // Robustly preserve the actual browser origin domain for S2S callback redirect matching
        
        // 구매 정보 전송
        goodname: params.courseName,
        buyername: params.userName || "구매자",
        buyertel: params.userPhone || "010-0000-0000",
        buyeremail: params.userEmail || "user@example.com",
        
        // 리턴 URL과 결과 파라미터
        returnUrl,
        closeUrl: `${hostOrigin}/payment/close`, // 모달창 닫기 폴백
        popupUrl: `${hostOrigin}/payment/popup`, // 모바일 팝업용 폴백

        // UI 설정 옵션 (PC는 iframe 레이어 팝업 형태로 부릅니다)
        payViewType: "overlay", // 최신 브라우저 오버레이 인터페이스
        acceptmethod: "HPP(1):below1000:center:va_receipt" // 이니시스 고급 필드 설정
      };

      // Form Element 필드들 주입
      Object.entries(formFields).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });

      formContainer.appendChild(form);
      document.body.appendChild(formContainer);

      // 6) 최종 PC 웹표준 결제창 호출 함수 작동
      if ((window as any).INIStdPay && typeof (window as any).INIStdPay.pay === "function") {
        console.log("[useInicisPay] Executing INIStdPay.pay Trigger for form:", formId);
        (window as any).INIStdPay.pay(formId);
      } else {
        throw new Error("INIStdPay.pay 모듈을 호출할 수 없습니다. SDK 전역 함수 유실");
      }

    } catch (err: any) {
      console.error("[useInicisPay] Request Payment 실패:", err);
      setErrorMsg(err.message || "결제 진행 도중 치명적인 로직 오류가 발생했습니다.");
    } finally {
      setIsInitializing(false);
    }
  };

  return {
    isSdkLoaded,
    isInitializing,
    errorMsg,
    requestPayment,
  };
}
