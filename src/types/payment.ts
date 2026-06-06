
export interface PortOneResponse {
  success: boolean;
  error_msg?: string;
  imp_uid?: string;
  merchant_uid: string;
  pay_method?: string;
  paid_amount?: number;
  status?: string;
  name?: string;
  pg_provider?: string;
  pg_tid?: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_tel?: string;
  buyer_addr?: string;
  buyer_postcode?: string;
  custom_data?: string;
  paid_at?: number;
  receipt_url?: string;
}

export interface PaymentRequestParams {
  pg: string;
  pay_method: string;
  merchant_uid: string;
  name: string;
  amount: number;
  buyer_email?: string;
  buyer_name?: string;
  buyer_tel?: string;
  buyer_addr?: string;
  buyer_postcode?: string;
}

declare global {
  interface Window {
    IMP: any;
  }
}
