import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Video, ChevronRight, School, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { courseService } from '@/services/courseService';
import { cmsService, Banner } from '@/services/cmsService';
import { Course } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

export default function BeOneExclusive() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners]);

  useEffect(() => {
    if (currentBannerIndex >= banners.length && banners.length > 0) {
      setCurrentBannerIndex(0);
    }
  }, [banners.length, currentBannerIndex]);

  const loadData = async () => {
    try {
      const [courseData, bannerData] = await Promise.all([
        courseService.getCourses(),
        cmsService.getBanners('beone_exclusive')
      ]);
      
      const filteredCourses = courseData.filter(c => c.category === 'beone_exclusive' || c.category === 'beone_exclusive_online');
      
      // Fetch enrollment counts
      const coursesWithCounts = await Promise.all(filteredCourses.map(async (course) => {
        try {
          const { count } = await courseService.getEnrollmentCount(course.id);
          return { ...course, enrolled_count: count || 0 };
        } catch (e) {
          console.error('Failed to fetch count for:', course.id, e);
          return { ...course, enrolled_count: 0 };
        }
      }));

      setCourses(coursesWithCounts);
      setBanners(bannerData);
    } catch (error) {
      toast.error('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
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
  const userRank = user ? (ROLE_RANK[user.role || 'user'] || 0) : 0;
  const isAuthorized = userRank >= 3 || (user && (user.role === 'admin' || user.role === 'super_admin'));

  if (authLoading || (loading && courses.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-[100px] pb-20 font-sans">
        <p className="text-gray-400 font-bold">인증 정보 및 강의 정보를 불러오고 있습니다...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-[100px] pb-20 px-4 font-sans">
        <div className="max-w-xl w-full bg-white rounded-[48px] shadow-2xl p-10 md:p-14 border border-emerald-50 text-center space-y-8">
          <div className="w-24 h-24 bg-emerald-50 rounded-[40px] flex items-center justify-center mx-auto text-[#1C8436] shadow-inner">
            <span className="text-4xl">🔐</span>
          </div>
          
          <div className="space-y-3">
            <Badge className="bg-[#1C8436] text-white border-none font-bold px-4 py-1.5 rounded-full">비원아카데미 회원 전용</Badge>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">회원 전용 교육 센터</h2>
            <p className="text-gray-500 font-medium leading-relaxed">
              본 강의실은 <strong className="text-[#1C8436] font-extrabold">‘비원아카데미 회원’</strong> 전용 특별 콘텐츠 제공 공간입니다.<br />
              비원아카데미 공식 멤버십 가입 후 무제한 수강 혜택을 누려보세요.
            </p>
          </div>

          <div className="pt-4 space-y-3">
            <Button 
              className="w-full h-14 bg-[#1C8436] hover:bg-[#156329] text-white font-black text-[16px] rounded-2xl transition-all shadow-lg shadow-emerald-200"
              onClick={() => {
                toast.info('비원아카데미 사무국 또는 마이페이지 계정 설정을 통해 멤버십으로 전환하실 수 있습니다.');
              }}
            >
              비원아카데미 가입 문의하기
            </Button>
            <Link 
              to="/courses" 
              className={cn(buttonVariants({ variant: 'outline' }), "w-full h-14 rounded-2xl font-black border-slate-100 hover:bg-slate-50 text-slate-700 text-[15px]")}
            >
              일반 공개강의 둘러보기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32 font-sans">
      <div className="container mx-auto px-4 space-y-32 pt-[50px] pb-12 md:pb-20">
        <section className="space-y-12">
          <div className="flex items-end justify-between border-b-4 border-[#1C8436] pb-6">
            <div className="space-y-2">
              <h2 className="text-4xl font-black text-gray-900 tracking-tighter">비원커뮤니티 회원 전용 강의</h2>
              <p className="text-sm font-bold text-gray-400">비원아카데미 정회원에게 무상 제공되는 프리미엄 고유 혜택 코스입니다.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {courses.length > 0 ? courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            )) : (
              <EmptyState />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  return (
    <Link to={`/course/${course.id}`} className="group flex flex-col gap-4">
      <div className="relative aspect-[16/10] bg-gray-100 rounded-3xl overflow-hidden shadow-sm group-hover:shadow-2xl transition-all duration-500">
        {course.thumbnail ? (
          <img 
            src={course.thumbnail} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
            alt={course.title} 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <School className="w-10 h-10 text-gray-200" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
        
        <div className="absolute top-4 left-4">
          <Badge className="bg-[#1C8436] text-white border-none font-bold">
            비원커뮤니티 회원 전용
          </Badge>
        </div>
      </div>

      <div className="space-y-2 px-1">
        <div className="flex items-center justify-between text-xs font-black text-[#1C8436]">
          <span>{course.instructor} 회원</span>
          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
            <Calendar className="w-3 h-3" />
            2026.05.20
          </div>
        </div>
        
        <h3 className="font-extrabold text-lg text-gray-900 leading-tight group-hover:text-[#1C8436] transition-colors line-clamp-2 min-h-[3rem]">
          {course.title}
        </h3>

        <div className="flex items-center justify-between pt-1">
          <p className="text-lg font-black text-[#1C8436]">🔑 혜택 강의</p>
          <div className="p-1.5 bg-gray-50 rounded-full group-hover:bg-[#1C8436] group-hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full py-20 text-center space-y-4 border-2 border-dashed border-gray-50 rounded-[40px]">
      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
        <Video className="w-10 h-10 text-gray-200" />
      </div>
      <p className="text-gray-500 font-bold">현재 진행 중인 비원커뮤니티회원전용 강의가 없습니다.</p>
    </div>
  );
}
