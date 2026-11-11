import { supabase } from '@/lib/supabase';
import { safeResponseJson } from '@/lib/safeFetch';

export const purchaseService = {
  async getMyOrders(userId: string) {
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*, course_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;
    if (!orders || orders.length === 0) return [];

    const courseIds = [...new Set(orders.map(o => o.course_id).filter(Boolean))];
    const { data: coursesData } = await supabase
      .from('courses')
      .select('id, title, thumbnail')
      .in('id', courseIds);

    const coursesMap = new Map(coursesData?.map(c => [c.id, c]));

    return orders.map(order => ({
      ...order,
      courses: coursesMap.get(order.course_id)
    }));
  },

  async getAllOrders(limit: number = 200) {
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
          limit
        })
      });

      if (response.ok) {
        const result = await safeResponseJson(response);
        if (result && result.status === 'success' && Array.isArray(result.orders)) {
          return result.orders;
        }
      }
    } catch (apiErr) {
      console.warn('Backend admin-get-orders fallback to direct query:', apiErr);
    }

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, amount, status, created_at, user_id, course_id, merchant_uid, payment_method')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (ordersError) throw ordersError;
    if (!orders || orders.length === 0) return [];

    const userIds = [...new Set(orders.map(o => o.user_id).filter(Boolean))];
    const courseIds = [...new Set(orders.map(o => o.course_id).filter(Boolean))];
    const orderIds = orders.map(o => o.id);

    const [profilesRes, coursesRes, logsRes] = await Promise.all([
      supabase.from('profiles').select('id, name, nickname, email').in('id', userIds),
      supabase.from('courses').select('id, title, thumbnail').in('id', courseIds),
      supabase.from('payment_logs').select('order_id, status, raw_response, payment_method, amount, created_at').in('order_id', orderIds)
    ]);

    const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p]));
    const coursesMap = new Map(coursesRes.data?.map(c => [c.id, c]));

    const logsMap = new Map<string, any[]>();
    if (logsRes.data) {
      for (const log of logsRes.data) {
        if (!logsMap.has(log.order_id)) {
          logsMap.set(log.order_id, []);
        }
        logsMap.get(log.order_id)?.push(log);
      }
    }

    return orders.map(order => ({
      ...order,
      profile: profilesMap.get(order.user_id),
      course: coursesMap.get(order.course_id),
      logs: logsMap.get(order.id) || []
    }));
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
