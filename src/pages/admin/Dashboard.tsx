import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  BookOpen, 
  CreditCard, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingDown,
  Activity,
  MessageSquare,
  Layout,
  Settings,
  ShieldCheck,
  ChevronRight,
  Loader2,
  DollarSign
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import { courseService } from '@/services/courseService';
import { purchaseService } from '@/services/purchaseService';
import { formatDistanceToNow, format, startOfToday, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ enrollmentsCount: 0, usersCount: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [allOrders, summary] = await Promise.all([
          purchaseService.getAllOrders(100),
          courseService.getTotalStats()
        ]);
        setOrders(allOrders || []);
        setStats(summary);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const totalCount = orders.length;
  
  // Calculate today's revenue
  const todayRevenue = orders
    .filter(o => isSameDay(new Date(o.created_at), startOfToday()))
    .reduce((sum, o) => sum + (o.amount || 0), 0);
    
  const arppu = totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0;

  // Prepare weekly chart data based on actual orders
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const chartData = days.map((day, index) => {
    const daySales = orders
      .filter(o => new Date(o.created_at).getDay() === index)
      .reduce((sum, o) => sum + (o.amount || 0), 0);
    return { day, sales: daySales / 10000 }; // Display in 10k units
  });

  const statsItems = [
    { 
      label: '오늘 매출', 
      value: `₩${todayRevenue.toLocaleString()}`, 
      change: 'Today', 
      isUp: true, 
      icon: <TrendingUp className="text-blue-500" /> 
    },
    { 
      label: '전체 가입자', 
      value: `${stats.usersCount.toLocaleString()}명`, 
      change: 'New', 
      isUp: true, 
      icon: <Users className="text-purple-500" /> 
    },
    { 
      label: '전체 결제 건수', 
      value: `${totalCount.toLocaleString()}건`, 
      change: 'Total', 
      isUp: true, 
      icon: <CreditCard className="text-orange-500" /> 
    },
    { 
      label: '평균 객단가 (ARPPU)', 
      value: `₩${arppu.toLocaleString()}`, 
      change: 'Avg', 
      isUp: true, 
      icon: <Activity className="text-green-500" /> 
    },
  ];

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between">
         <div className="space-y-1">
           <h1 className="text-3xl font-black tracking-tighter text-gray-900">시스템 대시보드</h1>
           <p className="text-gray-400 font-bold text-sm">실시간 결제 및 운영 지표입니다.</p>
         </div>
         <div className="flex gap-3">
            <Button variant="outline" className="rounded-2xl border-gray-100 bg-white font-black h-12 px-6" onClick={() => navigate('/admin/sales')}>매출 리스트</Button>
            <Button className="rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black h-12 px-6 shadow-xl shadow-purple-200" onClick={() => navigate('/admin/stats')}>상세 분석</Button>
         </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {statsItems.map((stat, i) => (
           <Card key={i} className="p-8 rounded-[40px] border-none shadow-sm space-y-6">
              <div className="flex justify-between items-start">
                 <div className="p-3 bg-gray-50 rounded-2xl">{stat.icon}</div>
                 <Badge className={`border-none font-black ${stat.isUp ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {stat.isUp ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                    {stat.change}
                 </Badge>
              </div>
              <div className="space-y-1">
                 <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                 <p className="text-3xl font-black text-gray-900 tracking-tighter">{stat.value}</p>
              </div>
           </Card>
         ))}
      </div>

      {/* Real-time Graph Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <Card className="lg:col-span-2 p-10 rounded-[48px] border-none shadow-sm space-y-8">
            <div className="flex items-center justify-between">
               <h3 className="text-2xl font-black tracking-tighter text-gray-900">요일별 매출 분포 (단위: 만원)</h3>
               <div className="flex gap-2">
                 <Button variant="ghost" size="sm" className="font-black text-purple-600 bg-purple-50">전체 데이터 기반</Button>
               </div>
            </div>
            <div className="h-[350px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                     <defs>
                       <linearGradient id="adminSales" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8', fontWeight: 700}} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8', fontWeight: 700}} />
                     <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }} />
                     <Area type="monotone" dataKey="sales" stroke="#8b5cf6" strokeWidth={5} fillOpacity={1} fill="url(#adminSales)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </Card>

         <Card className="p-10 rounded-[48px] border-none shadow-sm space-y-8 divide-y divide-gray-50">
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-2xl font-black tracking-tighter text-gray-900">최근 결제</h3>
              <Badge className="bg-purple-100 text-purple-600 border-none font-bold">New {Math.min(orders.length, 5)}</Badge>
            </div>
            <div className="space-y-6 pt-8">
               {isLoading ? (
                 <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                   <Loader2 className="w-8 h-8 animate-spin" />
                   <p className="text-xs font-bold">데이터를 불러오는 중...</p>
                 </div>
               ) : orders.length > 0 ? (
                 orders.slice(0, 5).map((order, idx) => (
                    <div key={order.id || idx} className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/admin/sales')}>
                       <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
                          <CreditCard className="w-5 h-5" />
                       </div>
                       <div className="flex-1 space-y-1">
                          <p className="text-sm font-black text-gray-900 leading-none truncate">{order.course?.title || '강의 정보 없음'}</p>
                          <p className="text-[10px] text-gray-400 font-bold italic">
                            수강생 {order.profile?.nickname || order.profile?.name || '익명'} | {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: ko })}
                          </p>
                          <div className="text-[10px] font-black text-purple-600 mt-1">₩{(order.amount || 0).toLocaleString()}</div>
                       </div>
                       <ChevronRight className="w-4 h-4 text-gray-200" />
                    </div>
                 ))
               ) : (
                 <div className="py-10 text-center space-y-2">
                    <p className="text-gray-400 font-bold text-sm">기록된 결제 내역이 없습니다.</p>
                 </div>
               )}
            </div>
            <Button variant="ghost" className="w-full text-purple-600 font-black pt-8 hover:bg-purple-50" onClick={() => navigate('/admin/sales')}>전체 매출 관리 바로가기</Button>
         </Card>
      </div>
    </div>
  );
}
