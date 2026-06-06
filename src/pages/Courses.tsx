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
          className="bg-white p-8 md:p-12 rounded-[40px] shadow-2xl text-center max-w-lg w-full space-y-8 border border-gray-100"
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
      {/* Hero Section (Customizable via CMS HTML) */}
      {!loading && banners.length > 0 ? (
        <section className="relative w-full bg-[#0a0a0a]">
          <div className="w-full">
            {banners[currentBannerIndex].html_content ? (
              <div 
                className="w-full min-h-[400px]"
                dangerouslySetInnerHTML={{ __html: banners[currentBannerIndex].html_content }} 
              />
            ) : (
              <div className="relative h-[400px] lg:h-[500px] overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-10" />
                {banners[currentBannerIndex].image ? (
                  <img 
                    src={banners[currentBannerIndex].image} 
                    className="w-full h-full object-cover"
                    alt={banners[currentBannerIndex].title}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-900" />
                )}
                
                <div className="container mx-auto px-4 h-full flex flex-col justify-center relative z-20">
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="max-w-2xl space-y-6"
                  >
                    <div className="bg-purple-600 text-white border-none py-1.5 px-4 text-xs font-black rounded-full w-fit">
                      RECOMMENDED COURSE
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tighter">
                      {banners[currentBannerIndex].title}
                    </h1>
                    {banners[currentBannerIndex].subtitle && (
                      <p className="text-lg text-white/70 font-medium whitespace-pre-line leading-relaxed max-w-xl">
                        {banners[currentBannerIndex].subtitle}
                      </p>
                    )}
                    <div className="flex gap-4 pt-4">
                      <Link 
                        to={banners[currentBannerIndex].link}
                        className={cn(buttonVariants({ variant: 'default', size: 'lg' }), "bg-white text-black hover:bg-gray-100 font-black h-14 px-10 rounded-full shadow-2xl transition-all active:scale-95")}
                      >
                        지금 바로 수강하기
                      </Link>
                    </div>
                  </motion.div>
                </div>

                {/* Optional navigation if multiple course banners exist */}
                {banners.length > 1 && (
                  <div className="absolute bottom-10 right-10 z-30 flex items-center gap-2">
                    {banners.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentBannerIndex(idx)}
                        className={cn(
                          "h-1.5 transition-all duration-300 rounded-full",
                          currentBannerIndex === idx ? "w-8 bg-white" : "w-1.5 bg-white/30 hover:bg-white/50"
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="bg-[#0a0a0a] py-20">
           <div className="container mx-auto px-4 text-center">
              <h1 className="text-4xl font-black text-white">전체 강의 목록</h1>
              <p className="text-gray-400 mt-2 font-medium">비원아카데미의 검증된 실전 클래스</p>
           </div>
        </section>
      )}

      {/* Course Area (Directly below HERO) */}
      <section className="py-20 bg-gray-50/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter">전체 강의 목록</h2>
            <p className="font-bold text-gray-500">총 {courses.length}개의 정규 클래스</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {courses.map((course, idx) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Link to={`/course/${course.id}`} className="group flex flex-col gap-4">
                  <div className="relative aspect-[16/10] bg-gray-100 rounded-3xl overflow-hidden shadow-sm group-hover:shadow-2xl transition-all duration-500">
                    <img 
                      src={course.thumbnail || 'https://picsum.photos/seed/course/800/500'} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                      alt={course.title} 
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500" />
                    <div className="absolute bottom-4 right-4 bg-white p-2.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all">
                      <Play className="w-5 h-5 text-purple-600 fill-current" />
                    </div>
                  </div>
                  
                  <div className="space-y-3 px-1">
                    <div className="flex items-center justify-between text-xs font-black text-purple-600 gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span>{course.instructor} 강사</span>
                        {course.instructor_tags && course.instructor_tags.slice(0, 2).map((tag, i) => (
                          <span key={i} className="text-[10px] bg-purple-50 text-purple-500 px-1.5 py-0.5 rounded font-medium uppercase">
                            #{tag.replace('#', '')}
                          </span>
                        ))}
                      </div>
                    </div>
                    <h3 className="font-extrabold text-lg text-gray-900 leading-tight group-hover:text-purple-600 transition-colors line-clamp-2 min-h-[3rem]">
                      {course.title}
                    </h3>
                    <div className="flex items-center gap-2 pt-1">
                      {course.is_free ? (
                        <span className="text-xl font-black text-purple-600">무료</span>
                      ) : (
                        <>
                          <span className="text-xl font-black text-gray-900">{course.discount_price ? course.discount_price.toLocaleString() : (course.price || 0).toLocaleString()}원</span>
                          {course.discount_price && course.discount_price < (course.price || 0) && (
                            <span className="text-sm font-black text-red-500">
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
