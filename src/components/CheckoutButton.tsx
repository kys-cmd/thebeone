import { useState, useEffect } from "react";
import { useInicisPay } from "@/hooks/useInicisPay";
import { CreditCard, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { toast } from "sonner";

interface CheckoutButtonProps {
  price: number;
  courseId: string;
  courseName: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
  className?: string;
}

export function CheckoutButton({
  price,
  courseId,
  courseName,
  userId,
  userEmail,
  userName,
  userPhone = "010-0000-0000",
  className = ""
}: CheckoutButtonProps) {
  const { isSdkLoaded, isInitializing, errorMsg, requestPayment } = useInicisPay();
  const [internalLoading, setInternalLoading] = useState(false);
  const [isPaymentEnabled, setIsPaymentEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('beone_payment_enabled');
      return stored !== 'false';
    }
    return true;
  });

  useEffect(() => {
    const handleSettingsChange = (e: any) => {
      if (e.detail !== undefined) {
        setIsPaymentEnabled(e.detail !== false);
      } else {
        const stored = localStorage.getItem('beone_payment_enabled');
        setIsPaymentEnabled(stored !== 'false');
      }
    };

    window.addEventListener('beone-payment-settings-changed', handleSettingsChange);
    window.addEventListener('storage', handleSettingsChange);

    return () => {
      window.removeEventListener('beone-payment-settings-changed', handleSettingsChange);
      window.removeEventListener('storage', handleSettingsChange);
    };
  }, []);

  const handlePayment = async () => {
    if (!isPaymentEnabled) {
      toast.error('현재 결제 기능 개발 중으로 관리자가 승인 후 강의를 청취하실 수 있습니다', {
        duration: 8000,
        position: 'top-center'
      });
      alert('현재 결제 기능 개발 중으로 관리자가 승인 후 강의를 청취하실 수 있습니다');
      return;
    }

    if (!userId) {
      alert("로그인이 완료된 회원만 결제 진행이 가능합니다.");
      return;
    }

    setInternalLoading(true);
    try {
      await requestPayment({
        price,
        courseId,
        courseName,
        userId,
        userEmail,
        userName,
        userPhone
      });
    } catch (err) {
      console.error(err);
    } finally {
      setInternalLoading(false);
    }
  };

  const isLoading = isInitializing || internalLoading;

  return (
    <div className="flex flex-col gap-2 w-full">
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full"
      >
        <Button
          id="checkout_trigger_button"
          onClick={handlePayment}
          disabled={isLoading || (!isPaymentEnabled ? false : !isSdkLoaded)}
          className={`w-full py-6 md:py-7 text-white font-black text-base md:text-lg rounded-2xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 ${
            !isPaymentEnabled 
              ? 'bg-amber-600 hover:bg-amber-700' 
              : `bg-purple-600 hover:bg-purple-700 ${className}`
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
          ) : (
            <CreditCard className="w-5 h-5 md:w-6 md:h-6" />
          )}
          {isLoading ? "안전 결제 보안 설정 중..." : !isPaymentEnabled ? "수강 신청 문의하기" : `${price.toLocaleString()}원 결제하기`}
        </Button>
      </motion.div>

      {!isPaymentEnabled && (
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center flex items-center justify-center gap-1.5 mt-1">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-[11px] text-amber-800 font-bold leading-normal text-left">
            현재 사이트 결제 시스템 개발/점검 중입니다. 버튼 클릭 시 수강 승인 안내가 노출됩니다.
          </p>
        </div>
      )}

      {isPaymentEnabled && !isSdkLoaded && (
        <p className="text-[11px] text-gray-500 font-bold text-center mt-1">
          KG 이니시스 통신 보안 모듈을 활성화하고 있습니다... 잠시만 기다려주세요.
        </p>
      )}

      {errorMsg && (
        <span className="text-xs text-rose-500 font-bold text-center mt-1 block">
          ⚠️ {errorMsg}
        </span>
      )}
    </div>
  );
}
export default CheckoutButton;
