import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  BookOpen, 
  CheckCircle, 
  Clock, 
  CreditCard, 
  Settings, 
  ChevronRight, 
  Trophy,
  PieChart as PieIcon,
  TrendingUp,
  Mail,
  Smartphone,
  Star,
  ArrowRight,
  MessageSquare,
  X,
  LayoutGrid,
  List,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip,
  CartesianGrid
} from 'recharts';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { courseService } from '@/services/courseService';
import { reviewService } from '@/services/reviewService';
import { profileService } from '@/services/profileService';
import { authService } from '@/services/authService';
import { Course } from '@/types';
import {
  DUPLICATE_PHONE_MESSAGE,
  formatPhoneNumber,
  isProfileIncomplete,
  isValidMobilePhone,
} from '@/lib/profile';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';

const isExpiredCourse = (course: Course) => {
  const now = new Date();
  if (course.enrollment_expires_at) {
    return new Date(course.enrollment_expires_at) <= now;
  }
  if (!course.is_duration_based && course.end_date) {
    return new Date(course.end_date) <= now;
  }
  return false;
};

type CourseViewType = 'card' | 'list';
type CourseStatusFilter = 'all' | 'active';

const VIEW_TYPE_STORAGE_KEY = 'mypage:courseViewType';
const STATUS_FILTER_STORAGE_KEY = 'mypage:courseStatusFilter';

// 헤더의 '내 강의실' 링크는 /mypage?tab=classroom 으로 들어온다.
const QUERY_TO_MENU: Record<string, string> = {
  classroom: 'courses',
  courses: 'courses',
  dashboard: 'dashboard',
  payments: 'payments',
  settings: 'settings',
};

const MENU_TO_QUERY: Record<string, string> = {
  courses: 'classroom',
  dashboard: 'dashboard',
  payments: 'payments',
  settings: 'settings',
};

const readStoredValue = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(key) as T | null;
    return stored && allowed.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
};

const writeStoredValue = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 저장 공간이 막혀 있어도 화면 동작에는 영향을 주지 않는다.
  }
};

const BEONE_CATEGORIES = ['beone_exclusive', 'beone_exclusive_online', 'beone_exclusive_offline'];

const isBeOneCourse = (course: Course) => BEONE_CATEGORIES.includes(course.category);

const CATEGORY_LABELS: Record<string, string> = {
  regular: '정규강의',
  special_online: '온라인 특강',
  special_offline: '오프라인 특강',
  special: '특강',
  beone_exclusive_online: '온라인 비원커뮤니티회원전용',
  beone_exclusive_offline: '오프라인 비원커뮤니티회원전용',
  beone_exclusive: '비원커뮤니티회원전용',
};

const getCategoryLabel = (category: string) => CATEGORY_LABELS[category] || '비원아카데미 Live';

// 강의 업로드일(created_at) 기준 최신순 정렬
const getUploadedTime = (course: Course) => {
  if (!course.created_at) return 0;
  const time = new Date(course.created_at).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const sortByNewest = (courses: Course[]) =>
  [...courses].sort((a, b) => getUploadedTime(b) - getUploadedTime(a));

const renderStudyPeriod = (course: Course) => {
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (course.enrollment_expires_at) {
    const enrollCreatedAt = course.enrollment_created_at ? new Date(course.enrollment_created_at) : null;
    const courseStartDate = course.start_date ? new Date(course.start_date) : null;
    if (
      course.is_duration_based &&
      courseStartDate &&
      !isNaN(courseStartDate.getTime()) &&
      enrollCreatedAt &&
      !isNaN(enrollCreatedAt.getTime()) &&
      enrollCreatedAt.getTime() < courseStartDate.getTime()
    ) {
      startDate = courseStartDate;
    } else {
      startDate = enrollCreatedAt || courseStartDate;
    }
    endDate = new Date(course.enrollment_expires_at);
  } else {
    startDate = course.start_date ? new Date(course.start_date) : null;
    endDate = course.end_date ? new Date(course.end_date) : null;
  }

  if (!startDate && !endDate) {
    return <span className="text-gray-400">수강 기간 제한 없음</span>;
  }

  const formatDateStr = (d: Date | null) => {
    if (!d) return '상시';
    const yy = d.getFullYear();
    const mm = d.getMonth() + 1;
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yy}. ${mm}. ${dd}. ${hh}:${min}`;
  };

  const startStr = formatDateStr(startDate);
  const endStr = formatDateStr(endDate);

  let dDayStr = '';
  if (isExpiredCourse(course)) {
    dDayStr = '수강일 만료';
  } else if (endDate) {
    const today = new Date();
    const tDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const eDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const diffTime = eDate.getTime() - tDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      dDayStr = `D-${diffDays}`;
    } else if (diffDays === 0) {
      dDayStr = 'D-Day';
    } else {
      dDayStr = '수강일 만료';
    }
  }

  return (
    <div className="flex flex-col gap-1 w-full text-xs font-bold font-sans text-slate-600">
      <div className="flex items-center justify-between w-full">
        <span>- 시작일: {startStr}</span>
        {dDayStr && (
          <Badge className={cn(
            "text-[10px] px-1.5 py-0.5 font-bold border-none",
            dDayStr.includes('만료') ? 'bg-red-50 text-red-600 hover:bg-red-50' : 'bg-purple-50 text-purple-600 hover:bg-purple-50'
          )}>
            {dDayStr}
          </Badge>
        )}
      </div>
      <div>- 종료일: {endStr}</div>
    </div>
  );
};

const MOCK_STATS = [
  { name: 'Mon', hours: 0 },
  { name: 'Tue', hours: 0 },
  { name: 'Wed', hours: 0 },
  { name: 'Thu', hours: 0 },
  { name: 'Fri', hours: 0 },
  { name: 'Sat', hours: 0 },
  { name: 'Sun', hours: 0 },
];

export default function MyPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, provider, setUser } = useAuthStore();
  const [activeMenu, setActiveMenu] = useState(() => QUERY_TO_MENU[searchParams.get('tab') || ''] || 'dashboard');
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [viewType, setViewType] = useState<CourseViewType>(() =>
    readStoredValue(VIEW_TYPE_STORAGE_KEY, ['card', 'list'] as const, 'card')
  );
  const [statusFilter, setStatusFilter] = useState<CourseStatusFilter>(() =>
    readStoredValue(STATUS_FILTER_STORAGE_KEY, ['all', 'active'] as const, 'all')
  );

  const handleViewTypeChange = (next: CourseViewType) => {
    setViewType(next);
    writeStoredValue(VIEW_TYPE_STORAGE_KEY, next);
  };

  const handleStatusFilterChange = (next: CourseStatusFilter) => {
    setStatusFilter(next);
    writeStoredValue(STATUS_FILTER_STORAGE_KEY, next);
  };

  // '수강 중' = 수강 기간이 만료되지 않은 강의
  const activeCourses = React.useMemo(() => myCourses.filter((c) => !isExpiredCourse(c)), [myCourses]);
  const filteredCourses = statusFilter === 'active' ? activeCourses : myCourses;
  const statusFilterOptions: { id: CourseStatusFilter; label: string; count: number }[] = [
    { id: 'all', label: '전체', count: myCourses.length },
    { id: 'active', label: '수강 중', count: activeCourses.length },
  ];

  // Controlled fields for settings form
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('male');
  const [birthdate, setBirthdate] = useState('');

  const isGoogleUser = provider === 'google';
  const isIncomplete = isProfileIncomplete(user, provider);

  // Withdrawal States
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawPassword, setWithdrawPassword] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const handleWithdrawal = async () => {
    if (!withdrawPassword.trim()) {
      toast.error('본인 확인을 위해 현재 비밀번호를 입력해 주세요.');
      return;
    }

    try {
      setWithdrawing(true);
      await authService.withdrawAccount(withdrawPassword.trim());
      setUser(null, null);
      setWithdrawModalOpen(false);
      setWithdrawPassword('');
      toast.success('회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.');
      navigate('/');
    } catch (error: any) {
      console.error('Withdrawal failed:', error);
      toast.error(error.message || '회원 탈퇴 처리에 실패했습니다. 비밀번호를 확인해 주세요.');
    } finally {
      setWithdrawing(false);
    }
  };

  // Auto populate on user load
  React.useEffect(() => {
    if (user) {
      setName(user.name || '');
      setNickname(user.nickname || '');
      setPhone(user.mobile_phone || user.phone || '');
      setGender(user.gender || 'male');
      setBirthdate(user.birthdate || '');
    }
  }, [user]);

  // If user metadata is incomplete, force them into the settings tab
  React.useEffect(() => {
    if (isIncomplete) {
      setActiveMenu('settings');
    }
  }, [isIncomplete]);

  // 헤더의 '내 강의실' 링크(?tab=classroom)로 들어오면 해당 탭을 열어준다.
  React.useEffect(() => {
    if (isIncomplete) return;
    const mapped = QUERY_TO_MENU[searchParams.get('tab') || ''];
    if (mapped) {
      setActiveMenu(mapped);
    }
  }, [searchParams, isIncomplete]);

  const handleMenuClick = (menuId: string) => {
    if (isIncomplete) {
      toast.error('필수 회원정보를 모두 입력하고 저장하셔야 다른 메뉴를 이용하실 수 있습니다.');
      return;
    }
    setActiveMenu(menuId);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', MENU_TO_QUERY[menuId] || menuId);
    setSearchParams(nextParams, { replace: true });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  // New Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Mileage and Points States
  const [myMileage, setMyMileage] = useState(0);
  const [myPayments, setMyPayments] = useState<any[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const fetchMileageAndPayments = async () => {
    if (!user) return;
    try {
      setPaymentLoading(true);
      // Fetch latest user profile to get fresh mileage from profiles table
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (!pErr && profile) {
        setMyMileage((profile as any).mileage || 0);
      }

      // Fetch payments history from orders table where status is PAID (or not PENDING)
      const { data: payData, error: payErr } = await supabase
        .from('orders')
        .select('*, courses(*)')
        .eq('user_id', user.id)
        .neq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (!payErr && payData) {
        setMyPayments(payData);
      }
    } catch (err) {
      console.error('[Points Fetch Error]:', err);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleOpenReview = (course: Course) => {
    setSelectedCourse(course);
    setReviewModalOpen(true);
    setReviewContent('');
    setReviewRating(5);
  };

  const handleSubmitReview = async () => {
    if (!selectedCourse || !user) return;
    if (reviewContent.trim().length < 5) {
      toast.error('후기 내용을 5자 이상 입력해주세요.');
      return;
    }

    try {
      setSubmittingReview(true);
      await reviewService.createReview({
        course_id: selectedCourse.id,
        course_title: selectedCourse.title,
        course_category: selectedCourse.category,
        user_id: user.id,
        user_name: user.nickname || user.name,
        user_avatar: user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.nickname || user.name}`,
        content: reviewContent,
        rating: reviewRating,
        is_best: false,
        is_deleted: false
      });
      toast.success('수강후기가 등록되었습니다! 소중한 의견 감사합니다.');
      setReviewModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('후기 등록에 실패했습니다.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const ROLE_RANK: Record<string, number> = {
    'user': 0,
    'regular_member': 1,
    'paid_member': 2,
    'beone_member': 3,
    'bione_member': 3,
    'admin': 100,
    'super_admin': 100
  };

  React.useEffect(() => {
    if (user) {
      fetchMyCourses();
      fetchMileageAndPayments();
    }
  }, [user]);

  const fetchMyCourses = async () => {
    try {
      setLoading(true);
      const data = await courseService.getMyCourses(user!.id);
      
      const rank = ROLE_RANK[user!.role || 'user'] || 0;
      const isBeOne = rank >= 3 || user!.role === 'admin' || user!.role === 'super_admin';
      
      // 비원커뮤니티 회원은 별도 수강신청 없이도 전용 강의를 이용할 수 있으므로
      // 수강 중인 강의 목록에 함께 합쳐서 하나의 목록으로 보여준다.
      let merged = [...data];
      if (isBeOne) {
        try {
          const allCourses = await courseService.getCourses();
          const beOneExclusives = allCourses.filter(isBeOneCourse);

          beOneExclusives.forEach(course => {
            if (!merged.some(mc => mc.id === course.id)) {
              merged.push(course);
            }
          });
        } catch (beOneErr) {
          console.error('[MyPage merge BeOne exclusive lectures error]:', beOneErr);
        }
      }

      setMyCourses(sortByNewest(merged));
    } catch (error) {
      console.error(error);
      toast.error('내 강의 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-5 sm:pt-10 pb-16 sm:pb-20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-5 sm:gap-8 lg:gap-12 items-start">
          
          {/* Sidebar */}
          <aside className="w-full lg:w-[320px] space-y-3 sm:space-y-5 shrink-0 lg:sticky lg:top-28">
             <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8 flex items-center lg:flex-col gap-4 lg:gap-5 text-left lg:text-center">
                <div className="relative inline-block shrink-0">
                  <Avatar className="w-14 h-14 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-xl sm:rounded-2xl border-2 sm:border-4 border-purple-50 shadow-inner">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`} />
                    <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 bg-purple-600 text-white w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                    <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                   <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-gray-900 truncate">{user?.nickname || user?.name || '수강생'} 님</h2>
                   <p className="text-gray-400 font-bold text-xs sm:text-sm truncate mt-0.5">{user?.email}</p>
                </div>
             </div>

             <nav className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-1.5 sm:p-2 lg:p-4 grid grid-cols-4 lg:flex lg:flex-col gap-1">
                {[
                  { id: 'dashboard', icon: <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5" />, label: '대시보드', shortLabel: '대시보드' },
                  { id: 'courses', icon: <BookOpen className="w-4 h-4 lg:w-5 lg:h-5" />, label: '내 강의실', shortLabel: '내 강의실' },
                  { id: 'payments', icon: <CreditCard className="w-4 h-4 lg:w-5 lg:h-5" />, label: '결제 및 포인트', shortLabel: '결제·포인트' },
                  { id: 'settings', icon: <Settings className="w-4 h-4 lg:w-5 lg:h-5" />, label: '계정 설정', shortLabel: '계정 설정' },
                ].map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => handleMenuClick(item.id)}
                    disabled={isIncomplete && item.id !== 'settings'}
                    className={`w-full flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-1 lg:gap-3 py-2.5 px-1.5 lg:p-4 rounded-lg lg:rounded-xl transition-all font-black text-[11px] sm:text-xs lg:text-base min-h-[52px] lg:min-h-0 ${activeMenu === item.id ? 'bg-purple-600 text-white shadow-md lg:shadow-xl shadow-purple-200' : (isIncomplete && item.id !== 'settings') ? 'text-gray-300 cursor-not-allowed opacity-40' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    <div className="flex flex-col lg:flex-row items-center gap-1 lg:gap-3">
                      {item.icon}
                      <span className="lg:hidden leading-tight whitespace-nowrap">{item.shortLabel}</span>
                      <span className="hidden lg:inline">{item.label}</span>
                    </div>
                    <ChevronRight className={`hidden lg:block w-4 h-4 transition-transform ${activeMenu === item.id ? 'rotate-90' : ''}`} />
                  </button>
                ))}
             </nav>
          </aside>

          {/* Main Content Area */}
          <main className="w-full min-w-0 flex-1 space-y-8 sm:space-y-10">
            {activeMenu === 'dashboard' && (
              <div className="space-y-8 sm:space-y-10">
                {/* 수강 중인 강의 리스트 */}
                <div className="space-y-5 sm:space-y-6">
                   <div className="flex items-center justify-between">
                     <h3 className="text-xl sm:text-2xl font-black tracking-tighter text-gray-900">수강 중인 강의</h3>
                     <Badge className="bg-purple-100 text-purple-600 border-none px-3.5 py-1 sm:px-4 sm:py-1.5 font-black text-xs font-sans">총 {myCourses.length}개</Badge>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
                     {loading ? (
                       <div className="col-span-full text-center py-16 sm:py-20 text-gray-400 font-bold font-sans">강의 정보를 불러오고 있습니다...</div>
                     ) : myCourses.length === 0 ? (
                       <div className="col-span-full bg-white p-10 sm:p-20 rounded-xl sm:rounded-2xl text-center border-2 border-dashed border-gray-100 space-y-5 sm:space-y-6">
                         <BookOpen className="w-12 h-12 sm:w-16 sm:h-16 text-gray-200 mx-auto" />
                         <div>
                           <p className="text-lg sm:text-xl font-black text-gray-900">아직 수강 중인 강의가 없습니다.</p>
                           <p className="text-sm text-gray-400 font-bold mt-1">비원아카데미의 프리미엄 강의들을 만나보세요!</p>
                         </div>
                         <Button 
                           className="bg-purple-600 hover:bg-purple-700 text-white font-black px-8 h-14 rounded-2xl font-sans"
                           onClick={() => navigate('/courses')}
                         >
                           강의 둘러보기
                         </Button>
                       </div>
                     ) : (
                       myCourses.map((course) => {
                         const isExpired = isExpiredCourse(course);
                         return (
                         <Card key={course.id} className="overflow-hidden border-none shadow-sm rounded-xl sm:rounded-2xl group hover:shadow-2xl transition-all bg-white flex flex-col justify-between">
                           <div>
                             <div className="aspect-[16/9] bg-gray-100 relative">
                                <img src={course.thumbnail || "https://images.unsplash.com/photo-1551288049-bbbda5012375?auto=format&fit=crop&q=80&w=800"} className="w-full h-full object-cover" alt="" />
                                 {isExpired && (
                                   <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-10">
                                     <span className="text-white font-black text-sm bg-red-600 px-3.5 py-1.5 rounded-full shadow-lg shadow-red-600/30">수강일 만료</span>
                                   </div>
                                 )}
                                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20">
                                  <Badge className={cn(
                                    "backdrop-blur-md border-none font-bold font-sans",
                                    isBeOneCourse(course)
                                      ? "bg-[#1C8436] text-white hover:bg-[#156329]"
                                      : "bg-white/80 text-gray-900"
                                  )}>
                                    {getCategoryLabel(course.category)}
                                  </Badge>
                                </div>
                             </div>
                             <div className="p-5 sm:p-8 space-y-4 sm:space-y-6">
                                <div className="space-y-1.5 sm:space-y-2">
                                   <h4 className="text-base sm:text-lg font-black text-gray-900 line-clamp-2 sm:line-clamp-1 leading-snug">{course.title}</h4>
                                   <p className="text-xs sm:text-sm font-bold text-gray-400">강사: {course.instructor}</p>
                                </div>
                                <div className="space-y-2 bg-slate-50 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100">
                                   <div className="flex items-start gap-2 text-xs font-bold text-slate-500 font-sans w-full">
                                      <Clock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                                      <div className="flex-1 min-w-0">{renderStudyPeriod(course)}</div>
                                   </div>
                                </div>
                             </div>
                           </div>
                           <div className="p-5 sm:p-8 pt-0 flex gap-2">
                             <Button 
                               size="lg" 
                               variant="outline" 
                               disabled={isExpired}
                               className={`flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl font-black text-sm font-sans transition-all ${isExpired ? '!bg-gray-200 !text-gray-400 !border-none cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white'} ${(course.category === 'special_offline' || course.category === 'beone_exclusive_offline') ? 'hidden' : ''}`}
                               onClick={() => navigate(`/course/${course.id}/learn`)}
                             >
                               {isExpired ? "수강일 만료" : "강의실 입장"}
                             </Button>
                             <Button
                               size="lg"
                               variant="outline"
                               className="flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl font-black text-sm border-gray-100 hover:bg-yellow-50 hover:text-yellow-600 hover:border-yellow-200 text-gray-700 font-sans transition-all"
                               onClick={() => handleOpenReview(course)}
                               title="수강후기 작성"
                             >
                               후기 작성하기
                             </Button>
                           </div>
                         </Card>
                          );
                        })
                     )}
                   </div>
                </div>
              </div>


            )
            }

            {activeMenu === 'courses' && (
              <div className="space-y-10">
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎓</span>
                      <h3 className="text-2xl font-black tracking-tighter text-gray-900">구독 중인 내 강의</h3>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className="bg-purple-100 text-purple-600 border-none px-4 py-1.5 font-black text-xs font-sans">총 {filteredCourses.length}개</Badge>
                      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleViewTypeChange('card')}
                          aria-pressed={viewType === 'card'}
                          aria-label="카드형 보기"
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            viewType === 'card'
                              ? "bg-white text-purple-600 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          )}
                          title="카드형 보기"
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleViewTypeChange('list')}
                          aria-pressed={viewType === 'list'}
                          aria-label="리스트형 보기"
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            viewType === 'list'
                              ? "bg-white text-purple-600 shadow-xs"
                              : "text-slate-500 hover:text-slate-800"
                          )}
                          title="리스트형 보기"
                        >
                          <List className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 수강 상태 불릿 필터 */}
                  <div
                    role="radiogroup"
                    aria-label="수강 상태 필터"
                    className="flex items-center gap-1 flex-wrap bg-white p-1.5 rounded-2xl border border-slate-100 shadow-xs w-fit"
                  >
                    {statusFilterOptions.map((option) => {
                      const isSelected = statusFilter === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => handleStatusFilterChange(option.id)}
                          className={cn(
                            "flex items-center gap-2 pl-3 pr-4 py-2 rounded-xl font-black text-sm font-sans transition-all",
                            isSelected
                              ? "bg-purple-50 text-purple-600"
                              : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <span
                            className={cn(
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                              isSelected ? "border-purple-600" : "border-slate-300"
                            )}
                          >
                            {isSelected && <span className="w-2 h-2 rounded-full bg-purple-600" />}
                          </span>
                          <span>{option.label}</span>
                          <span className={cn("text-xs", isSelected ? "text-purple-400" : "text-slate-300")}>
                            {option.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className={viewType === 'card' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8" : "flex flex-col gap-4 sm:gap-6"}>
                    {loading ? (
                      <div className="col-span-full text-center py-16 sm:py-20 text-gray-400 font-bold">강의 정보를 불러오고 있습니다...</div>
                    ) : filteredCourses.length === 0 ? (
                      <div className="col-span-full bg-white p-10 sm:p-20 rounded-xl sm:rounded-2xl text-center border-2 border-dashed border-gray-100 space-y-5 sm:space-y-6">
                        <BookOpen className="w-12 h-12 sm:w-16 sm:h-16 text-gray-200 mx-auto" />
                        {statusFilter === 'active' && myCourses.length > 0 ? (
                          <>
                            <div>
                              <p className="text-lg sm:text-xl font-black text-gray-900">현재 수강 중인 강의가 없습니다.</p>
                              <p className="text-sm text-gray-400 font-bold mt-1">수강 기간이 만료된 강의는 '전체'에서 확인하실 수 있습니다.</p>
                            </div>
                            <Button
                              variant="outline"
                              className="border-gray-100 text-gray-700 font-black px-8 h-12 sm:h-14 rounded-xl hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200"
                              onClick={() => handleStatusFilterChange('all')}
                            >
                              전체 강의 보기
                            </Button>
                          </>
                        ) : (
                          <>
                            <div>
                              <p className="text-lg sm:text-xl font-black text-gray-900">아직 수강 중인 강의가 없습니다.</p>
                              <p className="text-sm text-gray-400 font-bold mt-1">비원아카데미의 프리미엄 강의들을 만나보세요!</p>
                            </div>
                            <Button
                              className="bg-purple-600 hover:bg-purple-700 text-white font-black px-8 h-12 sm:h-14 rounded-xl"
                              onClick={() => navigate('/courses')}
                            >
                              강의 둘러보기
                            </Button>
                          </>
                        )}
                      </div>
                    ) : (
                      filteredCourses.map((course) => {
                        const isExpired = isExpiredCourse(course);
                        
                        if (viewType === 'list') {
                          return (
                            <Card key={course.id} className="overflow-hidden border-none shadow-xs rounded-xl sm:rounded-2xl group hover:shadow-xl transition-all bg-white flex flex-col md:flex-row items-stretch md:items-center justify-between p-4 sm:p-6 gap-4 sm:gap-6">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 flex-1 min-w-0">
                                {/* Thumbnail */}
                                <div className="w-full sm:w-44 aspect-[16/9] bg-gray-100 relative rounded-xl sm:rounded-2xl overflow-hidden shrink-0">
                                  <img src={course.thumbnail || "https://images.unsplash.com/photo-1551288049-bbbda5012375?auto=format&fit=crop&q=80&w=800"} className="w-full h-full object-cover" alt="" />
                                  {isExpired && (
                                    <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-10">
                                      <span className="text-white font-black text-[10px] bg-red-600 px-2.5 py-1 rounded-full shadow-lg">수강만료</span>
                                    </div>
                                  )}
                                  <div className="absolute top-2 left-2 z-20">
                                    <Badge className={cn(
                                      "backdrop-blur-md text-[10px] border-none font-bold py-0.5 px-2",
                                      isBeOneCourse(course)
                                        ? "bg-[#1C8436] text-white hover:bg-[#156329]"
                                        : "bg-white/90 text-gray-900"
                                    )}>
                                      {getCategoryLabel(course.category)}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Details */}
                                <div className="space-y-2.5 sm:space-y-3 flex-1 min-w-0 w-full">
                                  <div>
                                    <h4 className="text-base sm:text-lg font-black text-gray-900 line-clamp-2 sm:truncate leading-snug">{course.title}</h4>
                                    <p className="text-xs sm:text-sm font-bold text-gray-400 mt-0.5">강사: {course.instructor}</p>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 font-sans max-w-md bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                                    <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                    <div className="truncate">{renderStudyPeriod(course)}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex flex-row md:flex-col lg:flex-row items-center gap-2 shrink-0 w-full md:w-auto">
                                {!(course.category === 'special_offline' || course.category === 'beone_exclusive_offline') && (
                                  <Button 
                                    size="default" 
                                    disabled={isExpired}
                                    className={`flex-1 sm:w-auto md:w-full lg:w-auto h-11 px-4 sm:px-5 rounded-xl font-black text-sm font-sans transition-all ${isExpired ? 'bg-gray-200 text-gray-400 cursor-not-allowed border-none' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                                    onClick={() => navigate(`/course/${course.id}/learn`)}
                                  >
                                    {isExpired ? "수강일 만료" : "강의실 입장"}
                                  </Button>
                                )}
                                <Button
                                  size="default"
                                  variant="outline"
                                  className="flex-1 sm:w-auto md:w-full lg:w-auto h-11 px-4 sm:px-5 rounded-xl font-black text-sm border-gray-100 hover:bg-yellow-50 hover:text-yellow-600 hover:border-yellow-200 text-gray-700 font-sans transition-all"
                                  onClick={() => handleOpenReview(course)}
                                >
                                  후기 작성하기
                                </Button>
                              </div>
                            </Card>
                          );
                        }

                        // Default Card Layout
                        return (
                          <Card key={course.id} className="overflow-hidden border-none shadow-sm rounded-xl sm:rounded-2xl group hover:shadow-2xl transition-all bg-white flex flex-col justify-between">
                            <div>
                              <div className="aspect-[16/9] bg-gray-100 relative">
                                 <img src={course.thumbnail || "https://images.unsplash.com/photo-1551288049-bbbda5012375?auto=format&fit=crop&q=80&w=800"} className="w-full h-full object-cover" alt="" />
                                 {isExpired && (
                                   <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-10">
                                     <span className="text-white font-black text-sm bg-red-600 px-3.5 py-1.5 rounded-full shadow-lg shadow-red-600/30">수강일 만료</span>
                                   </div>
                                 )}
                                 <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20">
                                   <Badge className={cn(
                                     "backdrop-blur-md border-none font-bold",
                                     isBeOneCourse(course)
                                       ? "bg-[#1C8436] text-white hover:bg-[#156329]"
                                       : "bg-white/80 text-gray-900"
                                   )}>
                                     {getCategoryLabel(course.category)}
                                   </Badge>
                                 </div>
                              </div>
                              <div className="p-5 sm:p-8 pb-0 space-y-4 sm:space-y-6">
                                 <div className="space-y-1.5 sm:space-y-2">
                                    <h4 className="text-base sm:text-lg font-black text-gray-900 line-clamp-2 sm:line-clamp-1 leading-snug">{course.title}</h4>
                                    <p className="text-xs sm:text-sm font-bold text-gray-400">강사: {course.instructor}</p>
                                 </div>
                                 <div className="space-y-2 bg-slate-50 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100">
                                    <div className="flex items-start gap-2 text-xs font-bold text-slate-500 font-sans w-full">
                                       <Clock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                                       <div className="flex-1 min-w-0">{renderStudyPeriod(course)}</div>
                                    </div>
                                  </div>
                              </div>
                            </div>
                            <div className="p-5 sm:p-8 flex gap-2">
                              {!(course.category === 'special_offline' || course.category === 'beone_exclusive_offline') && (
                                <Button 
                                  size="lg" 
                                  disabled={isExpired}
                                  className={`flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl font-black text-sm font-sans transition-all ${isExpired ? 'bg-gray-200 text-gray-400 cursor-not-allowed border-none' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                                  onClick={() => navigate(`/course/${course.id}/learn`)}
                                >
                                  {isExpired ? "수강일 만료" : "강의실 입장"}
                                </Button>
                              )}
                              <Button
                                size="lg"
                                variant="outline"
                                className="flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl font-black text-sm border-gray-100 hover:bg-yellow-50 hover:text-yellow-600 hover:border-yellow-200 text-gray-700 font-sans"
                                onClick={() => handleOpenReview(course)}
                              >
                                후기 작성하기
                              </Button>
                            </div>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeMenu === 'settings' && user && (
              <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8 pb-10">
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 sm:p-10 border-b border-gray-50 bg-gray-50/50">
                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">계정 정보 설정</h3>
                    <p className="text-xs sm:text-base text-gray-400 font-bold mt-1.5 sm:mt-2">비원아카데미에서 사용하실 개인 정보를 관리하세요.</p>
                  </div>
                  
                  {isIncomplete && (
                    <div className="mx-5 sm:mx-10 mt-6 sm:mt-8 mb-2 p-5 sm:p-6 bg-purple-50 rounded-lg sm:rounded-xl border border-purple-100 space-y-2.5 sm:space-y-3">
                      <div className="flex items-center gap-2.5 sm:gap-3 text-purple-700">
                        <Star className="w-5 h-5 fill-purple-600 text-purple-600 shrink-0" />
                        <h4 className="text-sm sm:text-base font-black">구글 간편 회원 정보 등록 단계</h4>
                      </div>
                      <p className="text-xs leading-relaxed text-purple-600 font-bold break-keep">
                        안전한 수강생 신원 확인과 커뮤니티 활동 및 수강인증 관리를 위해 필수 추가 정보 등록이 필요합니다. 실명, 닉네임, 연락처, 성별, 생년월일을 모두 입력 및 저장하시면 회원가입이 완료되어 비원아카데미의 모든 프리미엄 기능과 대시보드를 정상적으로 이용하실 수 있습니다.
                      </p>
                    </div>
                  )}

                  <div className="p-6 sm:p-10 space-y-6 sm:space-y-8">
                    <div className="space-y-5 sm:space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                        <div className="space-y-3">
                          <Label className="text-xs font-black text-purple-600 uppercase tracking-widest ml-1 flex items-center gap-1.5">이름 (본명) <Badge className="bg-purple-100 text-purple-600 border-none text-[8px] h-4">필수</Badge></Label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                            <input 
                              type="text"
                              placeholder="본명을 입력해주세요"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="w-full h-14 pl-12 pr-4 bg-white border border-gray-100 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 rounded-2xl text-gray-900 font-black text-sm transition-all" 
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-xs font-black text-purple-600 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                            닉네임 <Badge className="bg-purple-100 text-purple-600 border-none text-[8px] h-4">필수</Badge>
                          </Label>
                          <div className="relative">
                            <Star className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-600" />
                            <input 
                              type="text"
                              placeholder="닉네임을 입력해주세요"
                              value={nickname}
                              onChange={(e) => setNickname(e.target.value)}
                              className="w-full h-14 pl-12 pr-4 bg-white border border-gray-105 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 rounded-2xl text-gray-900 font-black text-sm transition-all" 
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">이메일 주소</Label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                          <input 
                            type="email"
                            value={user.email}
                            disabled
                            className="w-full h-14 pl-12 pr-4 bg-gray-50 border-none rounded-2xl text-gray-400 font-bold text-sm cursor-not-allowed" 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label className="text-xs font-black text-purple-600 uppercase tracking-widest ml-1 flex items-center gap-1.5"> 휴대폰 번호 <Badge className="bg-purple-100 text-purple-600 border-none text-[8px] h-4">필수</Badge></Label>
                          <div className="relative">
                            <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                            <input 
                              type="tel"
                              placeholder="010-0000-0000"
                              value={phone}
                              onChange={handlePhoneChange}
                              maxLength={13}
                              className="w-full h-14 pl-12 pr-4 bg-white border border-gray-105 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 rounded-2xl text-gray-900 font-black text-sm transition-all" 
                            />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-xs font-black text-purple-600 uppercase tracking-widest ml-1 flex items-center gap-1.5">생년월일 <Badge className="bg-purple-100 text-purple-600 border-none text-[8px] h-4">필수</Badge></Label>
                          <input 
                            type="date"
                            value={birthdate}
                            onChange={(e) => setBirthdate(e.target.value)}
                            className="w-full h-14 px-5 bg-white border border-gray-105 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 rounded-2xl text-gray-900 font-black text-sm transition-all" 
                          />
                        </div>
                      </div>

                      {/* 성별 선택 추가 */}
                      <div className="space-y-3">
                        <Label className="text-xs font-black text-purple-600 uppercase tracking-widest ml-1 flex items-center gap-1.5">성별 <Badge className="bg-purple-100 text-purple-600 border-none text-[8px] h-4">필수</Badge></Label>
                        <div className="flex gap-4">
                          <button
                            type="button"
                            onClick={() => setGender('male')}
                            className={`flex-1 h-14 rounded-2xl font-black text-sm border transition-all ${
                              gender === 'male'
                                ? 'bg-purple-100 border-purple-600 text-purple-600 shadow-sm'
                                : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            남성
                          </button>
                          <button
                            type="button"
                            onClick={() => setGender('female')}
                            className={`flex-1 h-14 rounded-2xl font-black text-sm border transition-all ${
                              gender === 'female'
                                ? 'bg-purple-100 border-purple-600 text-purple-600 shadow-sm'
                                : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            여성
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-gray-50">
                      <Button 
                        className="w-full h-16 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl shadow-xl shadow-purple-100 transition-all active:scale-[0.98]"
                        onClick={async () => {
                          if (!name.trim()) {
                            toast.error('이름(실명)을 입력해주세요.');
                            return;
                          }
                          if (name.trim().length < 2) {
                            toast.error('이름(실명)은 최소 2글자 이상이어야 합니다.');
                            return;
                          }
                          if (!nickname.trim()) {
                            toast.error('닉네임을 입력해주세요.');
                            return;
                          }
                          if (nickname.trim().length < 2) {
                            toast.error('닉네임은 최소 2글자 이상이어야 합니다.');
                            return;
                          }
                          if (!phone.trim()) {
                            toast.error('휴대폰 번호를 입력해주세요.');
                            return;
                          }
                          if (!isValidMobilePhone(phone)) {
                            toast.error('올바른 휴대폰 번호 형식이 아닙니다.');
                            return;
                          }
                          if (!birthdate) {
                            toast.error('생년월일을 입력해주세요.');
                            return;
                          }
                          if (!gender) {
                            toast.error('성별을 선택해주세요.');
                            return;
                          }

                          const wasIncomplete = isIncomplete;

                          try {
                            setLoading(true);

                            // 휴대폰 번호가 회원 식별 Key이므로 다른 회원이 쓰고 있으면 저장할 수 없다.
                            if (await authService.isPhoneTaken(phone, user.id)) {
                              toast.error(DUPLICATE_PHONE_MESSAGE);
                              return;
                            }

                            const updatedProfile = await profileService.updateProfile(user.id, {
                              name: name.trim(),
                              nickname: nickname.trim(),
                              mobile_phone: phone.trim(),
                              birthdate,
                              gender
                            });

                            setUser(updatedProfile, provider);
                            // 구글 간편가입 회원은 이 저장으로 가입이 최종 완료된다.
                            if (wasIncomplete) {
                              toast.success('회원가입이 완료되었습니다! 이제 비원아카데미의 모든 기능을 이용하실 수 있습니다.');
                            } else {
                              toast.success('정보가 성공적으로 업데이트 되었습니다!');
                            }
                          } catch (error: any) {
                            console.error('Update failed:', error);
                            const msg = error.message || error.error_description || '정보 업데이트에 실패했습니다.';
                            toast.error(msg);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading}
                      >
                        {loading ? '저장 중...' : isIncomplete ? '기본정보 저장하고 가입 완료하기' : '변경 내용 저장하기'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 비밀번호 변경 영역 */}
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 sm:p-10 border-b border-gray-50 bg-gray-50/50">
                    <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">비밀번호 변경</h3>
                    <p className="text-xs sm:text-base text-gray-400 font-bold mt-1.5 sm:mt-2">새로운 비밀번호를 설정하여 계정을 안전하게 보호하세요.</p>
                  </div>
                  <div className="p-6 sm:p-10 space-y-6 sm:space-y-8">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                        <div className="space-y-3">
                          <Label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">새 비밀번호</Label>
                          <div className="relative">
                            <input 
                              type="password"
                              placeholder="새 비밀번호 입력 (6자 이상)"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full h-14 px-5 bg-white border border-gray-100 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 rounded-xl text-gray-900 font-black text-sm transition-all" 
                            />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">새 비밀번호 확인</Label>
                          <div className="relative">
                            <input 
                              type="password"
                              placeholder="새 비밀번호 다시 입력"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full h-14 px-5 bg-white border border-gray-100 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 rounded-xl text-gray-900 font-black text-sm transition-all" 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-gray-50">
                      <Button 
                        className="w-full h-16 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl shadow-xl shadow-purple-100 transition-all active:scale-[0.98]"
                        onClick={async () => {
                          if (!newPassword) {
                            toast.error('새 비밀번호를 입력해주세요.');
                            return;
                          }
                          if (newPassword.length < 6) {
                            toast.error('비밀번호는 최소 6자 이상이어야 합니다.');
                            return;
                          }
                          if (newPassword !== confirmPassword) {
                            toast.error('비밀번호가 서로 일치하지 않습니다.');
                            return;
                          }

                          try {
                            setPasswordLoading(true);
                            await authService.updatePassword(newPassword);
                            setNewPassword('');
                            setConfirmPassword('');
                            toast.success('비밀번호가 성공적으로 변경되었습니다!');
                          } catch (error: any) {
                            console.error('Password change failed:', error);
                            const msg = error.message || '비밀번호 변경에 실패했습니다.';
                            toast.error(msg);
                          } finally {
                            setPasswordLoading(false);
                          }
                        }}
                        disabled={passwordLoading}
                      >
                        {passwordLoading ? '변경 중...' : '비밀번호 변경하기'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50/50 rounded-xl sm:rounded-2xl p-5 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-red-100/60">
                  <div>
                    <h4 className="text-base font-black text-red-600">회원 탈퇴</h4>
                    <p className="text-xs sm:text-sm font-bold text-red-400 mt-1 break-keep">계정을 삭제하시면 수강 중인 강의 내역, 결제 내역, 마일리지 등 모든 정보가 삭제되며 복구할 수 없습니다.</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setWithdrawPassword('');
                      setWithdrawModalOpen(true);
                    }}
                    className="text-red-600 font-black hover:bg-red-100 hover:text-red-700 rounded-xl shrink-0 self-end sm:self-auto cursor-pointer border border-red-200/50"
                  >
                    탈퇴 신청
                  </Button>
                </div>
              </div>
            )}

            {activeMenu === 'payments' && (
              <div className="flex-1 space-y-6 sm:space-y-10 animate-in fade-in slide-in-from-bottom-3 duration-500">
                {/* 1. Mileage Points Balance Card */}
                <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-xl sm:rounded-2xl p-6 sm:p-10 text-white shadow-2xl relative overflow-hidden">
                  <div className="absolute right-0 bottom-0 opacity-10 translate-x-12 translate-y-12">
                     <CreditCard className="w-64 h-64 sm:w-96 sm:h-96" />
                  </div>
                  
                  <div className="relative z-10 space-y-5 sm:space-y-6">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-white/20 hover:bg-white/20 text-white border-none font-black px-3.5 py-1 sm:px-4 rounded-full text-[11px] sm:text-xs uppercase tracking-wider backdrop-blur-sm">
                        My Mileage Points
                      </Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-white/70 text-xs sm:text-sm font-bold">사용 가능한 마일리지</p>
                      <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight flex items-baseline gap-2">
                        {myMileage.toLocaleString()} <span className="text-xl sm:text-2xl font-bold opacity-80">P</span>
                      </h2>
                    </div>

                    <div className="pt-5 sm:pt-6 border-t border-white/10 grid grid-cols-2 sm:flex sm:flex-wrap gap-4 sm:gap-8 text-xs sm:text-sm">
                      <div>
                        <span className="opacity-60 block font-medium">적립 방식</span>
                        <span className="font-extrabold text-white">CMS 관리자 지정 포인트</span>
                      </div>
                      <div>
                        <span className="opacity-60 block font-medium">사용처</span>
                        <span className="font-extrabold text-white">수강 바구니 결제 할인</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Mileage Policy Guidelines Card */}
                <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-4 sm:space-y-6">
                  <h3 className="text-lg sm:text-xl font-black text-gray-900">마일리지 사용 안내</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="p-5 sm:p-6 bg-purple-50/50 rounded-lg sm:rounded-xl space-y-2.5 sm:space-y-3">
                      <h4 className="font-extrabold text-purple-800 flex items-center gap-2 text-sm sm:text-base">
                        <span className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs shrink-0">1</span>
                        결제 시 현금처럼 사용
                      </h4>
                      <p className="text-xs sm:text-sm font-bold text-gray-500 leading-relaxed md:pl-8 break-keep">
                        장바구니(수강 바구니) 페이지에서 결제 시 보유한 마일리지를 자유롭게 입력하여 수강료에서 할인받을 수 있습니다.
                      </p>
                    </div>
                    <div className="p-5 sm:p-6 bg-purple-50/50 rounded-lg sm:rounded-xl space-y-2.5 sm:space-y-3">
                      <h4 className="font-extrabold text-purple-800 flex items-center gap-2 text-sm sm:text-base">
                        <span className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs shrink-0">2</span>
                        포인트 적립 정책
                      </h4>
                      <p className="text-xs sm:text-sm font-bold text-gray-500 leading-relaxed md:pl-8 break-keep">
                        마일리지는 사이트 관리자가 회원의 활동 내역이나 구매 보상에 따라 CMS를 통해 직접 일대일 맞춤 지급해 드립니다.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Payment history board */}
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 sm:p-10 border-b border-gray-50 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                    <div>
                      <h3 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">결제 내역</h3>
                      <p className="text-xs sm:text-base text-gray-400 font-bold mt-1 sm:mt-2">고객님이 구매하신 온라인 강의 결제 내역서입니다.</p>
                    </div>
                    <Badge variant="outline" className="px-3.5 py-1 sm:px-4 sm:py-1.5 border-gray-200 text-gray-600 font-bold bg-white text-xs">
                      총 {myPayments.length}건
                    </Badge>
                  </div>

                  {paymentLoading ? (
                    <div className="p-16 sm:p-20 text-center text-gray-400 font-black">
                      결제 내역을 조회하는 중입니다...
                    </div>
                  ) : myPayments.length === 0 ? (
                    <div className="p-16 sm:p-20 text-center text-gray-400 font-bold space-y-2">
                      <CreditCard className="w-12 h-12 text-gray-200 mx-auto" />
                      <p>아직 구매하신 이력이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {myPayments.map((pay) => (
                        <div key={pay.id} className="p-5 sm:p-8 hover:bg-gray-50/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                          <div className="space-y-2 sm:space-y-3 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                              <Badge className={cn(
                                "font-black px-2.5 py-0.5 sm:px-3 sm:py-1 text-xs border-none",
                                (pay.status === 'completed' || pay.status === 'PAID') ? "bg-emerald-100 text-emerald-700" :
                                (pay.status === 'pending' || pay.status === 'PENDING') ? "bg-yellow-100 text-yellow-700" :
                                "bg-gray-100 text-gray-600"
                              )}>
                                {(pay.status === 'completed' || pay.status === 'PAID') ? '결제완료' : (pay.status === 'pending' || pay.status === 'PENDING') ? '대기중' : '결제취소'}
                              </Badge>
                              <span className="text-[11px] sm:text-xs font-mono text-gray-400">
                                {pay.created_at ? new Date(pay.created_at).toLocaleString('ko-KR') : '-'}
                              </span>
                            </div>

                            <h4 className="text-base sm:text-lg font-black text-gray-900 leading-snug break-keep">
                              {pay.courses?.title || '강좌 수강권'}
                            </h4>
                            <p className="text-[11px] sm:text-xs text-gray-400 font-bold break-all">
                              주문 고유번호: <span className="font-mono">{pay.id}</span>
                            </p>
                          </div>

                          <div className="flex items-center justify-between md:block pt-3 md:pt-0 border-t border-gray-100 md:border-none text-left md:text-right space-y-0 md:space-y-1">
                            <span className="text-xs text-gray-400 font-bold block">결제 금액</span>
                            <div>
                              <span className="text-lg sm:text-xl font-black text-purple-600">
                                {(pay.amount || 0).toLocaleString()}원
                              </span>
                              {pay.mileage_used > 0 && (
                                <p className="text-xs font-bold text-red-500">
                                  (마일리지 -{pay.mileage_used.toLocaleString()} P 사용)
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="rounded-xl sm:rounded-2xl border-none shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-2rem)] sm:max-w-[500px]">
          <DialogHeader className="p-6 sm:p-8 bg-purple-600 text-white">
            <DialogTitle className="text-xl sm:text-2xl font-black tracking-tighter">수강후기 작성</DialogTitle>
            <DialogDescription className="text-purple-100 font-bold text-xs sm:text-sm">
              강의에 대한 솔직한 후기를 남겨주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <Label className="text-sm font-black text-gray-400 uppercase tracking-widest">강의명</Label>
              <p className="font-bold text-gray-900">{selectedCourse?.title}</p>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-black text-gray-400 uppercase tracking-widest">별점</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewRating(star)}
                    className="transition-transform active:scale-95"
                  >
                    <Star 
                      className={`w-10 h-10 ${star <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} 
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-black text-gray-400 uppercase tracking-widest">후기 내용</Label>
              <Textarea 
                placeholder="강의를 통해 배운 점이나 좋았던 점을 적어주세요 (최소 5자)"
                className="min-h-[150px] rounded-xl border-gray-100 focus:ring-purple-600 focus:border-purple-600 p-4"
                value={reviewContent}
                onChange={(e) => setReviewContent(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="p-8 bg-gray-50 flex gap-3 sm:justify-between items-center">
            <Button 
              variant="ghost" 
              onClick={() => setReviewModalOpen(false)}
              className="rounded-xl font-bold"
            >
              취소
            </Button>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 text-white font-black px-8 h-12 rounded-xl"
              onClick={handleSubmitReview}
              disabled={submittingReview}
            >
              {submittingReview ? '등록 중...' : '후기 등록하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 회원 탈퇴 확인 및 비밀번호 입력 모달 */}
      <Dialog open={withdrawModalOpen} onOpenChange={(open) => {
        if (!withdrawing) {
          setWithdrawModalOpen(open);
          if (!open) setWithdrawPassword('');
        }
      }}>
        <DialogContent className="rounded-xl sm:rounded-2xl border border-red-100 shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-2rem)] sm:max-w-[480px]">
          <DialogHeader className="p-6 sm:p-8 bg-gradient-to-br from-red-600 to-rose-700 text-white text-left">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight">회원 탈퇴 안내 및 본인 확인</DialogTitle>
            <DialogDescription className="text-red-100 font-bold text-xs sm:text-sm mt-1">
              탈퇴 전 아래 유의사항을 반드시 확인해 주시기 바랍니다.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 sm:p-8 space-y-6">
            {/* 경고문 안내 박스 */}
            <div className="bg-red-50 border border-red-200/80 rounded-2xl p-4 sm:p-5 space-y-2.5 text-left">
              <div className="flex items-center gap-2 text-red-700 font-black text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>회원 탈퇴 시 모든 정보가 영구 삭제됩니다</span>
              </div>
              <ul className="text-xs text-red-600 space-y-1.5 list-disc list-inside font-semibold leading-relaxed">
                <li><strong className="font-black text-red-700">수강 중인 강의 내역 및 학습 진행도</strong>가 완전히 삭제되며 재수강이 불가합니다.</li>
                <li><strong className="font-black text-red-700">결제 내역 및 보유 마일리지 포인트</strong>가 영구 소멸되며 복구되지 않습니다.</li>
                <li>커뮤니티 및 채팅방 활동 기록 등 <strong className="font-black text-red-700">모든 회원 데이터가 데이터베이스에서 즉시 영구 삭제</strong>됩니다.</li>
                <li>탈퇴 후에는 동일한 계정 정보로 복구가 절대 불가능합니다.</li>
              </ul>
            </div>

            {/* 본인 확인 비밀번호 입력 */}
            <div className="space-y-2.5 text-left">
              <Label className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-red-600" />
                <span>본인 확인 비밀번호</span>
                <Badge className="bg-red-100 text-red-700 border-none text-[9px] px-1.5 py-0">필수</Badge>
              </Label>
              <input
                type="password"
                placeholder="현재 로그인 비밀번호를 입력하세요"
                value={withdrawPassword}
                onChange={(e) => setWithdrawPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !withdrawing) {
                    handleWithdrawal();
                  }
                }}
                disabled={withdrawing}
                className="w-full h-13 px-4 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-600 rounded-2xl text-gray-900 font-black text-sm transition-all"
              />
              <p className="text-[11px] text-gray-400 font-medium pl-1">
                안전한 계정 삭제를 위해 현재 로그인된 계정의 비밀번호를 확인합니다.
              </p>
            </div>
          </div>

          <DialogFooter className="p-6 bg-gray-50 flex gap-2.5 sm:justify-end items-center border-t border-gray-100">
            <Button 
              type="button"
              variant="outline" 
              onClick={() => {
                if (!withdrawing) {
                  setWithdrawModalOpen(false);
                  setWithdrawPassword('');
                }
              }}
              disabled={withdrawing}
              className="flex-1 sm:flex-none h-12 px-5 rounded-xl font-bold border-gray-200 text-gray-700 hover:bg-gray-100"
            >
              취소
            </Button>
            <Button 
              type="button"
              className="flex-1 sm:flex-none h-12 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black shadow-lg shadow-red-200 transition-all cursor-pointer"
              onClick={handleWithdrawal}
              disabled={withdrawing || !withdrawPassword.trim()}
            >
              {withdrawing ? '탈퇴 처리 중...' : '모든 정보 삭제 및 회원 탈퇴'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
