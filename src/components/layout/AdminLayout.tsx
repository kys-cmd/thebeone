import React from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { 
  Users, 
  BookOpen, 
  CreditCard, 
  Activity, 
  MessageSquare, 
  Layout, 
  Settings, 
  ShieldCheck,
  ChevronRight,
  LogOut,
  Bell,
  Search,
  Command,
  Star,
  BarChart,
  AlertTriangle,
  Type
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

const ADMIN_MENUS = [
  { icon: <Activity className="w-5 h-5" />, label: '대시보드', path: '/admin' },
  { icon: <BookOpen className="w-5 h-5" />, label: '강의 관리', path: '/admin/courses' },
  { icon: <Users className="w-5 h-5" />, label: '강사 관리', path: '/admin/instructors' },
  { icon: <Users className="w-5 h-5" />, label: '회원 관리', path: '/admin/users' },
  { icon: <Star className="w-5 h-5" />, label: '수강 후기 관리', path: '/admin/reviews' },
  { icon: <CreditCard className="w-5 h-5" />, label: '매출 관리', path: '/admin/sales' },
  { icon: <BarChart className="w-5 h-5" />, label: '매출 분석', path: '/admin/stats' },
  { icon: <MessageSquare className="w-5 h-5" />, label: '커뮤니티 관리', path: '/admin/community' },
  { icon: <Layout className="w-5 h-5" />, label: '페이지 디자인', path: '/admin/cms' },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-[#f8fafc] font-sans antialiased text-rendering-optimizeLegibility">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-gray-100 flex flex-col fixed h-full z-30">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
           <Link to="/" className="flex items-center gap-3 group">
             <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:scale-105 transition-transform">B</div>
             <div className="font-black text-gray-900 tracking-tighter">BE ONE CMS</div>
           </Link>
        </div>
        
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto no-scrollbar">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 px-2">메인 관리</p>
           {ADMIN_MENUS.map((item) => (
             <Link 
              key={item.path} 
              to={item.path}
              className={`w-full flex items-center gap-3 p-3.5 rounded-2xl font-black text-sm transition-all group ${
                location.pathname === item.path 
                  ? 'bg-purple-600 text-white shadow-xl shadow-purple-200' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-purple-600'
              }`}
             >
               <span className={`${location.pathname === item.path ? 'text-white' : 'text-gray-400 group-hover:text-purple-600'}`}>
                {item.icon}
               </span>
               <span>{item.label}</span>
               {location.pathname === item.path && <ChevronRight className="w-4 h-4 ml-auto" />}
             </Link>
           ))}

           <div className="pt-8 space-y-2">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 px-2">시스템 도구</p>
             <Link to="/admin/support" className={`w-full flex items-center gap-3 p-3.5 rounded-2xl font-black text-sm transition-all ${location.pathname === '/admin/support' ? 'bg-purple-600 text-white shadow-xl shadow-purple-200' : 'text-gray-500 hover:bg-gray-50 hover:text-purple-600'}`}>
               <MessageSquare className="w-5 h-5 text-gray-400" />
               <span>게시판 및 내역 관리</span>
             </Link>
             <Link to="/admin/settings" className={`w-full flex items-center gap-3 p-3.5 rounded-2xl font-black text-sm transition-all ${location.pathname === '/admin/settings' ? 'bg-purple-600 text-white shadow-xl shadow-purple-200' : 'text-gray-500 hover:bg-gray-50 hover:text-purple-600'}`}>
               <Settings className="w-5 h-5 text-gray-400" />
               <span>사이트 설정</span>
             </Link>
             <Link to="/admin/errors" className={`w-full flex items-center gap-3 p-3.5 rounded-2xl font-black text-sm transition-all ${location.pathname === '/admin/errors' ? 'bg-purple-600 text-white shadow-xl shadow-purple-200' : 'text-gray-500 hover:bg-gray-50 hover:text-purple-600'}`}>
               <AlertTriangle className="w-5 h-5 text-gray-400" />
               <span>오류 로그 수집기</span>
             </Link>
             <Link to="/admin/font-demo" className={`w-full flex items-center gap-3 p-3.5 rounded-2xl font-black text-sm transition-all ${location.pathname === '/admin/font-demo' ? 'bg-purple-600 text-white shadow-xl shadow-purple-200' : 'text-gray-500 hover:bg-gray-50 hover:text-purple-600'}`}>
               <Type className="w-5 h-5 text-gray-400" />
               <span>글꼴 타이포 검증</span>
             </Link>
           </div>
        </nav>

        <div className="p-6 border-t border-gray-50">
           <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3">
             <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
               <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" />
               <AvatarFallback>AD</AvatarFallback>
             </Avatar>
             <div className="flex-1 overflow-hidden">
               <p className="text-xs font-black text-gray-900 leading-none truncate">관리자(수석아키텍트)</p>
               <p className="text-[10px] text-gray-400 font-bold mt-1">Super Admin</p>
             </div>
           </div>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 ml-72">
        {/* Top Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-10 sticky top-0 z-20">
          <div className="relative w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-purple-600 transition-colors" />
            <Input 
              placeholder="메뉴, 회원, 강의 통합 검색..." 
              className="pl-12 h-11 bg-gray-50 border-none rounded-2xl font-bold text-sm focus-visible:ring-2 focus-visible:ring-purple-600 transition-all"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 bg-white border border-gray-200 rounded-md text-[10px] font-black text-gray-400">
              <Command className="w-2.5 h-2.5" /> K
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden xl:flex flex-col items-end">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Server Status</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-black text-gray-900">Operational</span>
              </div>
            </div>

            <Button variant="ghost" size="icon" className="relative text-gray-400 hover:text-purple-600 bg-gray-50 hover:bg-purple-50 rounded-xl transition-all">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </Button>
            
            <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
               <div className="text-right">
                 <p className="text-sm font-black text-gray-900">2026.04.26</p>
                 <p className="text-[10px] text-purple-600 font-black italic">Sunday Morning</p>
               </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="p-10 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
