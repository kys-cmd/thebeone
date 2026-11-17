import { supabase } from '@/lib/supabase';
import { safeResponseJson } from '@/lib/safeFetch';

export interface ReconciliationSummary {
  recoveredOrdersCount: number;
  backfilledEnrollmentsCount: number;
}

export const purchaseService = {
  async getMyOrders(userId: string) {
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;
    if (!orders || orders.length === 0) return [];

    const courseIds = [...new Set(orders.map(o => o.course_id).filter(Boolean))];
    const { data: coursesData } = courseIds.length > 0
      ? await supabase
          .from('courses')
          .select('id, title, thumbnail')
          .in('id', courseIds)
      : { data: [] };

    const coursesMap = new Map<string, any>(
      (coursesData || []).map((c: any) => [c.id, c] as [string, any])
    );

    return orders.map(order => ({
      ...order,
      courses: coursesMap.get(order.course_id)
    }));
  },

  async syncMyPaidEnrollments(): Promise<{
    recoveredOrdersCount: number;
    backfilledEnrollmentsCount: number;
    orders?: any[];
    enrolledCourses?: any[];
  } | null> {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) return null;

      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'sync-my-paid-enrollments'
        })
      });

      if (!response.ok) return null;
      const result = await safeResponseJson(response, null);
      if (result && result.status === 'success') {
        return {
          recoveredOrdersCount: Number(result.recoveredOrdersCount || 0),
          backfilledEnrollmentsCount: Number(result.backfilledEnrollmentsCount || 0),
          orders: Array.isArray(result.orders) ? result.orders : undefined,
          enrolledCourses: Array.isArray(result.enrolledCourses) ? result.enrolledCourses : undefined,
        };
      }
      return null;
    } catch (err) {
      console.warn('[purchaseService.syncMyPaidEnrollments] Skipped:', err);
      return null;
    }
  },

  async getAllOrders(limit: number = 300, forceReconcile: boolean = false) {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          action: 'admin-get-orders',
          limit,
          forceReconcile
        })
      });

      if (response.ok) {
        const result = await safeResponseJson(response);
        if (result && result.status === 'success' && Array.isArray(result.orders)) {
          const ordersArr: any[] & { reconciliation?: ReconciliationSummary } = result.orders;
          if (result.reconciliation) {
            ordersArr.reconciliation = result.reconciliation;
          }
          return ordersArr;
        }
      }
    } catch (apiErr) {
      console.warn('Backend admin-get-orders fallback to direct query:', apiErr);
    }

    // Schema-resilient fallback: use .select('*') so missing optional columns (like payment_method) never crash PostgREST!
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (ordersError) throw ordersError;
    if (!orders || orders.length === 0) return [];

    const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
    const courseIds = [...new Set(orders.map(o => o.course_id).filter(Boolean))];
    const orderIds = orders.map(o => o.id);

    const [profilesRes, coursesRes, logsRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from('profiles').select('id, name, nickname, email').in('id', userIds)
        : Promise.resolve({ data: [] as any[] }),
      courseIds.length > 0
        ? supabase.from('courses').select('id, title, thumbnail').in('id', courseIds)
        : Promise.resolve({ data: [] as any[] }),
      orderIds.length > 0
        ? supabase.from('payment_logs').select('*').in('order_id', orderIds)
        : Promise.resolve({ data: [] as any[] })
    ]);

    const profilesMap = new Map<string, any>(
      (profilesRes.data || []).map((p: any) => [p.id, p] as [string, any])
    );
    const coursesMap = new Map<string, any>(
      (coursesRes.data || []).map((c: any) => [c.id, c] as [string, any])
    );

    const logsMap = new Map<string, any[]>();
    if (logsRes.data) {
      for (const log of logsRes.data) {
        const normalizedLog = {
          ...log,
          raw_response: log.raw_response ?? (log.raw_data ? JSON.stringify(log.raw_data) : null)
        };
        if (!logsMap.has(log.order_id)) {
          logsMap.set(log.order_id, []);
        }
        logsMap.get(log.order_id)?.push(normalizedLog);
      }
    }

    return orders.map(order => ({
      ...order,
      payment_method: (order as any).payment_method || 'CARD',
      profile: profilesMap.get(order.user_id),
      course: coursesMap.get(order.course_id),
      logs: logsMap.get(order.id) || []
    }));
  },

  async reconcilePayments(): Promise<{
    reconciliation: ReconciliationSummary;
    message: string;
  }> {
    const session = (await supabase.auth.getSession()).data.session;
    const response = await fetch('/api/core-api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({
        action: 'admin-reconcile-payments'
      })
    });

    const result = await safeResponseJson(response);
    if (result && result.status === 'success') {
      return {
        reconciliation: result.reconciliation || { recoveredOrdersCount: 0, backfilledEnrollmentsCount: 0 },
        message: result.message || '결제 및 수강 내역 동기화가 완료되었습니다.'
      };
    }
    throw new Error(result?.message || '결제 및 수강 누락 복구 동기화에 실패했습니다.');
  },

  async getAdminEnrollments(): Promise<any[] | null> {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) return null;

      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'admin-get-enrollments'
        })
      });

      if (!response.ok) return null;
      const result = await safeResponseJson(response, null);
      if (result && result.status === 'success' && Array.isArray(result.enrollments)) {
        return result.enrollments;
      }
      return null;
    } catch (err) {
      console.warn('[purchaseService.getAdminEnrollments] Fallback to direct query:', err);
      return null;
    }
  },

  async getPaymentSettings() {
    const { data, error } = await supabase.from('payment_settings').select('*').limit(1).maybeSingle();
    if (error) throw error;
    return data;
  },

  async deleteOrder(orderId: string) {
    const session = (await supabase.auth.getSession()).data.session;
    const response = await fetch('/api/core-api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({
        action: 'admin-delete-order',
        orderId
      })
    });

    const result = await safeResponseJson(response);
    if (result.status === 'success') {
      return true;
    } else {
      throw new Error(result.message || '주문 삭제 도중 오류가 발생했습니다.');
    }
  }
};
