import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Play, ChevronRight, Search, Filter, ArrowRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { courseService } from '@/services/courseService';
import { cmsService, Banner } from '@/services/cmsService';
import { Course } from '@/types';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthStore } from '@/store/useAuthStore';

export default function Courses() {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners]);

  // Handle boundary sanity checks statically to prevent blank renders if banners are updated or deleted
  useEffect(() => {
    if (currentBannerIndex >= banners.length && banners.length > 0) {
      setCurrentBannerIndex(0);
    }
  }, [banners.length, currentBannerIndex]);

  const loadData = async () => {
    try {
      const [courseData, bannerData] = await Promise.all([
        courseService.getCourses(),
        cmsService.getBanners('course')
      ]);
      setCourses(courseData.filter(c => c.category === 'regular' || !c.category));
      setBanners(bannerData);
    } catch (error) {
      toast.error('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 pt-24">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 md:p-12 rounded-2xl shadow-2xl text-center max-w-lg w-full space-y-8 border border-gray-100"
        >
          <div className="w-24 h-24 bg-purple-50 rounded-full flex items-center justify-center mx-auto ring-8 ring-purple-50/50">
            <Lock className="w-12 h-12 text-purple-600" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter">로그인이 필요합니다</h2>
            <p className="text-gray-500 font-bold leading-relaxed break-keep">
              전체 강의 목록과 상세 내용은 비원아카데미 회원만 확인할 수 있습니다.<br/>
              회원가입 후 모든 지식 테크트리를 확인해보세요!
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <Link to="/auth/login" className={cn(buttonVariants({ size: 'lg' }), "bg-purple-600 hover:bg-purple-700 h-14 rounded-2xl text-lg font-black shadow-lg shadow-purple-200")}>
              로그인하러 가기
            </Link>
            <Link to="/auth/register" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), "h-14 rounded-2xl text-lg font-black")}>
              무료 회원가입 하기
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Course Area */}
      <section className="pt-6 sm:pt-10 md:pt-12 pb-14 md:pb-20 bg-slate-50/50">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between gap-4 mb-6 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">전체 강의 목록</h2>
            <p className="text-xs sm:text-sm font-bold text-slate-500 shrink-0 tabular-nums">총 {courses.length}개 클래스</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 sm:gap-y-12">
            {courses.map((course, idx) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Link to={`/course/${course.id}`} className="group flex flex-col gap-3 sm:gap-4">
                  <div className="relative aspect-[16/10] bg-slate-100 rounded-xl sm:rounded-2xl overflow-hidden shadow-xs group-hover:shadow-xl transition-all duration-300">
                    <img 
                      src={course.thumbnail || 'https://images.unsplash.com/photo-1551288049-bbbda5012375?auto=format&fit=crop&q=80&w=800'} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      alt={course.title} 
                    />
                    <div className="hidden sm:flex absolute bottom-4 right-4 bg-white p-2.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all">
                      <Play className="w-4 h-4 text-purple-600 fill-current" />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 sm:space-y-2 px-0.5">
                    <div className="flex items-center text-xs font-bold text-purple-600 gap-1.5 flex-wrap">
                      <span>{course.instructor} 강사</span>
                      {course.instructor_tags && course.instructor_tags.slice(0, 2).map((tag, i) => (
                        <span key={i} className="text-[11px] text-slate-400 font-medium">
                          · #{tag.replace('#', '')}
                        </span>
                      ))}
                    </div>
                    <h3 className="font-extrabold text-base sm:text-lg text-slate-900 leading-snug group-hover:text-purple-600 transition-colors line-clamp-2 sm:min-h-[3rem] break-keep">
                      {course.title}
                    </h3>
                    <div className="flex items-baseline gap-2 pt-0.5 tabular-nums">
                      {course.is_free ? (
                        <span className="text-lg sm:text-xl font-black text-purple-600">무료</span>
                      ) : (
                        <>
                          <span className="text-lg sm:text-xl font-black text-slate-900">
                            {course.discount_price ? course.discount_price.toLocaleString() : (course.price || 0).toLocaleString()}원
                          </span>
                          {course.discount_price && course.discount_price < (course.price || 0) && (
                            <span className="text-xs sm:text-sm font-black text-red-500">
                              {Math.round((1 - (course.discount_price / (course.price || 1))) * 100)}%
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {!loading && courses.length === 0 && (
            <div className="py-40 text-center space-y-6">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-10 h-10 text-gray-200" />
              </div>
              <div className="space-y-2">
                <p className="text-gray-900 text-xl font-black">표시할 강의가 없습니다.</p>
                <p className="text-gray-500 font-bold">
                  CMS에서 강의 등록 시 상태를 <span className="text-purple-600">"공개(판매 중)"</span>으로 설정했는지 확인해주세요.
                </p>
              </div>
              <Link to="/admin/courses" className={cn(buttonVariants({ variant: 'outline' }), "rounded-full font-bold")}>
                관리자 페이지로 이동
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
