import { useState, useEffect } from "react";
import { toast } from "sonner";

export interface InicisPayOrderItem {
  orderId?: string;
  courseId: string;
}

interface InicisPayParams {
  price: number;
  courseId: string;
  items?: InicisPayOrderItem[];
  courseName: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
  mileageUsed?: number;
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
    script.charset = "UTF-8";
    script.setAttribute("charset", "UTF-8");
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
    if (!isSdkLoaded && params.price > 0) {
      toast.error("결제 모듈이 아직 완전히 불려오지 않았습니다. 2~3초 후 다시 시도해 주세요.");
      return;
    }

    setIsInitializing(true);
    setErrorMsg(null);

    try {
      // 1) 고유한 갱신용 상점 주문번호(OID) 생성 (KST 생성 + 밀리초 접미어로 동시 결제 충돌 완벽 방지)
      const d = new Date();
      const kstMs = d.getTime() + d.getTimezoneOffset() * 60000 + 9 * 60 * 60 * 1000;
      const kstDate = new Date(kstMs);

      const yyyy = kstDate.getFullYear();
      const MM = String(kstDate.getMonth() + 1).padStart(2, "0");
      const dd = String(kstDate.getDate()).padStart(2, "0");
      const hh = String(kstDate.getHours()).padStart(2, "0");
      const mm = String(kstDate.getMinutes()).padStart(2, "0");
      const ss = String(kstDate.getSeconds()).padStart(2, "0");
      const randSuffix = String(d.getMilliseconds()).padStart(3, "0");

      const timestamp = `${yyyy}${MM}${dd}${hh}${mm}${ss}`;
      const oid = `OID_${params.courseId.substring(0, 8).toUpperCase()}_${timestamp.substring(4)}${randSuffix}`;

      // 2) 서버에 결제 서명 및 PENDING 주문 파라미터 초기화 요청
      const response = await fetch("/api/init-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: params.price,
          oid,
          timestamp,
          userId: params.userId,
          courseId: params.courseId,
          items: params.items,
          orderName: params.courseName,
          mileageUsed: params.mileageUsed || 0,
        }),
      });

      if (!response.ok) {
        let errMessage = "결제 승인 서명 생성 API 통신 중 연결에 실패했습니다.";
        try {
          const errJson = await response.json();
          if (errJson?.message) errMessage = errJson.message;
        } catch {
          // ignore
        }
        throw new Error(errMessage);
      }

      const initResult = await response.json();
      if (initResult.status !== "success") {
        throw new Error(initResult.message || "결제 초기화에 실패했습니다.");
      }

      // 마일리지 전액 사용 등 결제금액 0원 즉시 승인 처리
      if (initResult.zeroPriceCompleted) {
        window.dispatchEvent(new Event("cart-updated"));
        window.location.href = `/payment/callback?status=success&resultCode=0000&oid=${encodeURIComponent(
          oid
        )}&message=${encodeURIComponent("마일리지 결제가 성공적으로 완료되었습니다.")}`;
        return;
      }

      const { signature, mKey, mid } = initResult;
      const finalPrice =
        typeof initResult.price === "number" ? initResult.price : params.price;
      const returnedOrderIds: string[] = Array.isArray(initResult.orderIds)
        ? initResult.orderIds
        : [];

      // 3) 도메인 Host 정보 획득 및 리턴 URL 조합
      const getFrontendRootUrl = () => {
        const originUrl = window.location.origin;
        const envAppUrl =
          (typeof process !== "undefined" && process?.env?.APP_URL) ||
          import.meta.env?.VITE_APP_URL;

        const candidates = [originUrl, envAppUrl, document.referrer];
        for (const candidate of candidates) {
          if (!candidate || typeof candidate !== "string") continue;
          const cleanUrl = candidate.trim().replace(/\/+$/, "");
          if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
            continue;
          }
          try {
            const parsed = new URL(cleanUrl);
            const hostname = parsed.hostname;
            if (
              hostname === "localhost" ||
              hostname === "127.0.0.1" ||
              hostname.includes("localhost") ||
              hostname.includes("MY_APP_URL")
            ) {
              continue;
            }
            return `${parsed.protocol}//${parsed.host}`;
          } catch {
            // ignore
          }
        }

        return originUrl;
      };

      const hostOrigin = getFrontendRootUrl();
      const returnUrl = `${hostOrigin}/api/inicis-return`;

      // Self-healing metadata URL (parsed cleanly by parseInicisMerchantMeta on server)
      const orderIdsParam =
        returnedOrderIds.length > 0
          ? `&oids=${encodeURIComponent(returnedOrderIds.join(","))}`
          : "";
      const merchantPayloadUrl = `${hostOrigin}?uid=${encodeURIComponent(
        params.userId
      )}&cid=${encodeURIComponent(params.courseId)}${orderIdsParam}`;

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
      form.name = formId;
      form.method = "POST";

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      if (isMobile) {
        form.acceptCharset = "euc-kr";
        form.setAttribute("accept-charset", "euc-kr");
        form.action = "https://mobile.inicis.com/smart/payment/";
        form.target = "_top";

        const cleanPhone = (params.userPhone || "010-0000-0000").replace(/[^0-9]/g, "");
        const mobileFields: Record<string, string> = {
          P_INI_PAYMENT: "CARD",
          P_MID: mid,
          P_OID: oid,
          P_AMT: finalPrice.toString(),
          P_GOODS: params.courseName,
          P_UNAME: params.userName || "구매자",
          P_MOBILE: cleanPhone,
          P_EMAIL: params.userEmail || "user@example.com",
          P_NEXT_URL: returnUrl,
          P_NOTI: merchantPayloadUrl,
          P_CHARSET: "utf8",
          P_RESERVED: "twotrs_isp=Y&block_isp=Y&twotrs_isp_noti=N",
        };

        Object.entries(mobileFields).forEach(([key, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = value;
          form.appendChild(input);
        });

        formContainer.appendChild(form);
        document.body.appendChild(formContainer);

        try {
          (document as any).charset = "euc-kr";
        } catch {
          // ignore on browsers where document.charset is read-only
        }

        console.log(
          "[useInicisPay] Submitting Mobile payment form (accept-charset=euc-kr), redirecting to: https://mobile.inicis.com/smart/payment/"
        );
        form.submit();
        return;
      }

      // PC 웹표준 결제(INIStdPay)는 UTF-8 인코딩을 사용
      form.acceptCharset = "UTF-8";
      form.setAttribute("accept-charset", "UTF-8");

      const formFields: Record<string, string> = {
        version: "1.0",
        gopaymethod: "Card",
        mid,
        oid,
        price: finalPrice.toString(),
        timestamp,
        use_chkfake: "N",
        signature,
        mKey,
        currency: "WON",
        merchantData: merchantPayloadUrl,

        charset: "UTF-8",
        g_charset: "utf-8",

        goodname: params.courseName,
        buyername: params.userName || "구매자",
        buyertel: params.userPhone || "010-0000-0000",
        buyeremail: params.userEmail || "user@example.com",

        returnUrl,
        closeUrl: `${hostOrigin}/payment/close`,
        popupUrl: `${hostOrigin}/payment/popup`,

        payViewType: "overlay",
        acceptmethod: "HPP(1):below1000:center:va_receipt:g_charset(utf-8)",
      };

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
      const msg = err.message || "결제 진행 도중 오류가 발생했습니다.";
      setErrorMsg(msg);
      toast.error(msg);
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
