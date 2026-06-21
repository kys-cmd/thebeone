import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  CreditCard, 
  ArrowUpRight,
  Download,
  Calendar,
  Loader2,
  Activity
} from 'lucide-react';
import { purchaseService } from '@/services/purchaseService';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function AdminStatistics() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await purchaseService.getAllOrders(500);
        setOrders(data || []);
      } catch (error) {
        console.error('Error fetching statistics data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const completedOrders = orders.filter(o => {
    const s = (o.status || '').toUpperCase();
    return s === 'PAID' || s === 'COMPLETED';
  });

  const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.amount || 0), 0);
  const totalCount = completedOrders.length;
  
  // Calculate monthly revenue trend (last 6 months)
  const last6Months = eachMonthOfInterval({
    start: subMonths(new Date(), 5),
    end: new Date()
  });

  const revenueData = last6Months.map(month => {
    const monthStr = format(month, 'M월');
    const monthlyTotal = completedOrders
      .filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate.getMonth() === month.getMonth() && orderDate.getFullYear() === month.getFullYear();
      })
      .reduce((sum, o) => sum + (o.amount || 0), 0);
    return { name: monthStr, value: monthlyTotal };
  });

  // Calculate weekly sales distribution
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dailySales = days.map((day, index) => {
    const dayCount = completedOrders.filter(o => new Date(o.created_at).getDay() === index).length;
    return { name: day, sales: dayCount };
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">통계 및 매출 분석</h1>
          <p className="text-gray-400 font-bold text-sm mt-1">플랫폼의 실제 결제 데이터를 기반으로 한 재무 지표입니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 rounded-xl border-gray-100 font-bold h-12 px-6">
            <Calendar className="w-4 h-4" />
            기간 설정
          </Button>
          <Button className="gap-2 bg-purple-600 hover:bg-purple-700 rounded-xl h-12 px-8 font-black shadow-lg shadow-purple-200">
            <Download className="w-4 h-4" />
            보고서 다운로드
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-[32px] border-none shadow-sm p-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black text-gray-400 uppercase tracking-widest">총 매출 (누적)</CardTitle>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><DollarSign className="w-4 h-4" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-gray-900 tracking-tighter">₩{totalRevenue.toLocaleString()}</div>
            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1 font-bold">
              <TrendingUp className="w-3 h-3 text-green-500" />
              데이터 기반 실시간 집계
            </p>
          </CardContent>
        </Card>
        
        <Card className="rounded-[32px] border-none shadow-sm p-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black text-gray-400 uppercase tracking-widest">총 결제 건수</CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><CreditCard className="w-4 h-4" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-gray-900 tracking-tighter">{totalCount.toLocaleString()}건</div>
            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1 font-bold">
              <TrendingUp className="w-3 h-3 text-green-500" />
              전체 성공 주문 기준
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-none shadow-sm p-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black text-gray-400 uppercase tracking-widest">활성 수강생</CardTitle>
            <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Users className="w-4 h-4" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-gray-900 tracking-tighter">{Array.from(new Set(completedOrders.map(o => o.user_id))).length}명</div>
            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1 font-bold">
              <Activity className="w-3 h-3 text-orange-500" />
              중복 제외 구매자 수
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-none shadow-sm p-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black text-gray-400 uppercase tracking-widest">평균 객단가</CardTitle>
            <div className="p-2 bg-green-50 rounded-lg text-green-600"><ArrowUpRight className="w-4 h-4" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-gray-900 tracking-tighter">₩{totalCount > 0 ? Math.round(totalRevenue / totalCount).toLocaleString() : '0'}</div>
            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1 font-bold">
              <TrendingUp className="w-3 h-3 text-green-500" />
              건당 평균 결제 금액
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="rounded-[40px] border-none shadow-sm overflow-hidden p-6 md:p-10">
          <CardHeader className="px-0 pt-0 pb-10">
            <CardTitle className="text-xl font-black tracking-tight text-gray-900">월별 매출 추이</CardTitle>
            <CardDescription className="text-xs font-bold text-gray-400 mt-1 italic">최근 6개월간의 실제 매출 데이터 흐름입니다.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] px-0">
            {isLoading ? (
               <div className="h-full flex items-center justify-center text-gray-300 font-bold italic">데이터 동기화 중...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9333ea" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8', fontWeight: 700}} dy={10} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₩${val / 10000}만`} tick={{fill: '#94a3b8', fontWeight: 700}} />
                  <RechartsTooltip 
                    formatter={(value: number) => [`₩${value.toLocaleString()}`, '매출']}
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', fontSize: '11px', fontWeight: '900' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#9333ea" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[40px] border-none shadow-sm overflow-hidden p-6 md:p-10">
          <CardHeader className="px-0 pt-0 pb-10">
            <CardTitle className="text-xl font-black tracking-tight text-gray-900">요일별 결제 분포</CardTitle>
            <CardDescription className="text-xs font-bold text-gray-400 mt-1 italic">플랫폼의 요일별 결제 트래픽을 분석합니다.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] px-0">
            {isLoading ? (
               <div className="h-full flex items-center justify-center text-gray-300 font-bold italic">데이터 동기화 중...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySales}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8', fontWeight: 700}} dy={10} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8', fontWeight: 700}} />
                  <RechartsTooltip 
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', fontSize: '11px', fontWeight: '900' }}
                  />
                  <Bar dataKey="sales" fill="#9333ea" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
