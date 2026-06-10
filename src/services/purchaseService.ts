import { supabase } from '@/lib/supabase';

export const purchaseService = {
  /**
   * [복식부기 원칙]
   * 강의 구매 시 사용자의 결제 기록과 플랫폼의 수익 기록을 동시에 처리합니다.
   * 실제로는 토스페이먼츠/아임포트 등의 외부 결제가 완료된 후 호출되어야 합니다.
   */
  async purchaseCourse(userId: string, courseId: string, amount: number) {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const merchant_uid = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // First create a pending order using supabase client and then process with back-end helper
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          user_id: userId,
          course_id: courseId,
          amount: amount,
          status: 'PENDING',
          merchant_uid: merchant_uid,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      const response = await fetch('/api/core-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          action: 'process-payment',
          merchant_uid,
          amount,
          courseId,
          userId,
          payment_method: 'direct'
        })
      });

      const result = await response.json();
      if (result.status === 'success') {
        return result.order;
      } else {
        throw new Error(result.message || '결제 승인 처리 중 권한동기화 오류가 발생했습니다.');
      }
    } catch (err: any) {
      console.error('Purchase course error:', err);
      throw err;
    }
  },

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

  async getAllOrders(limit: number = 50) {
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

    const result = await response.json();
    if (result.status === 'success') {
      return true;
    } else {
      throw new Error(result.message || '주문 삭제 도중 오류가 발생했습니다.');
    }
  }
};
