import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Video, ChevronRight, Globe, School, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractVimeoId, getVimeoEmbedUrl } from '@/lib/vimeo';
import { courseService } from '@/services/courseService';
import { cmsService, Banner } from '@/services/cmsService';
import { Course } from '@/types';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function SpecialLectures() {
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

  // Handle boundary safety check on dynamic updates to avoid rendering blank blocks
  useEffect(() => {
    if (currentBannerIndex >= banners.length && banners.length > 0) {
      setCurrentBannerIndex(0);
    }
  }, [banners.length, currentBannerIndex]);

  const loadData = async () => {
    try {
      const [courseData, bannerData] = await Promise.all([
        courseService.getCourses(),
        cmsService.getBanners('special')
      ]);
      
      const filteredCourses = courseData.filter(c => c.category === 'special' || c.category === 'special_online' || c.category === 'special_offline');
      
      // Fetch enrollment counts for each course
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

  const onlineCourses = courses.filter(c => c.category === 'special_online' || (c.category === 'special' && (!c.location || c.location === '')));
  const offlineCourses = courses.filter(c => c.category === 'special_offline' || (c.category === 'special' && (c.location && c.location !== '')));

  return (
    <div className="min-h-screen bg-white pb-16 md:pb-28">
      <div className="container mx-auto px-4 space-y-14 sm:space-y-20 md:space-y-28 pt-6 sm:pt-10 md:pt-12">
        {/* Online Section */}
        <section className="space-y-6 sm:space-y-10">
          <div className="flex items-end justify-between border-b-2 border-purple-600 pb-4 sm:pb-5">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">온라인 특강</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 sm:gap-y-12">
            {onlineCourses.length > 0 ? onlineCourses.map((course) => (
              <CourseCard key={course.id} course={course} type="online" />
            )) : (
              <EmptyState icon={<Video className="w-10 h-10 text-slate-200" />} />
            )}
          </div>
        </section>

        {/* Offline Section */}
        <section className="space-y-6 sm:space-y-10">
          <div className="flex items-end justify-between border-b-2 border-slate-900 pb-4 sm:pb-5">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">오프라인 특강</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 sm:gap-y-12">
            {offlineCourses.length > 0 ? offlineCourses.map((course) => (
              <CourseCard key={course.id} course={course} type="offline" />
            )) : (
              <EmptyState icon={<MapPin className="w-10 h-10 text-slate-200" />} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function CourseCard({ course, type }: { course: Course, type: 'online' | 'offline' }) {
  const hasRegEnded = course.reg_end_date ? new Date() > new Date(course.reg_end_date) : false;
  const isSoldOut = course.is_force_closed || hasRegEnded || (course.max_capacity && (course.enrolled_count || 0) >= course.max_capacity);
  const dateLabel = course.start_date
    ? new Date(course.start_date).toLocaleDateString('ko-KR')
    : (type === 'online' ? '상시 진행' : '일정 예정');

  return (
    <Link to={`/course/${course.id}`} className="group flex flex-col gap-3 sm:gap-4">
      <div className="relative aspect-[16/10] bg-slate-100 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs group-hover:shadow-xl transition-all duration-300">
        {course.thumbnail ? (
          <img 
            src={course.thumbnail} 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
            alt={course.title} 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <School className="w-10 h-10 text-slate-300" />
          </div>
        )}
        
        <div className="absolute top-3 left-3">
          <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none font-bold text-[11px]">
            {type === 'online' ? '온라인' : '오프라인'}
          </Badge>
        </div>
        
        {type === 'offline' && (
          <div className={cn(
            "absolute top-3 right-3 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm flex items-center",
            isSoldOut ? "bg-slate-600" : "bg-red-600"
          )}>
            {isSoldOut ? (hasRegEnded ? "접수 마감" : "모집 마감") : course.max_capacity ? `모집 인원 ${course.max_capacity}명` : "신청 가능"}
          </div>
        )}
      </div>

      <div className="space-y-1.5 sm:space-y-2 px-0.5">
        <div className="flex items-center justify-between text-xs font-bold text-purple-600">
          <span>{course.instructor} 강사</span>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold tabular-nums">
            <Calendar className="w-3 h-3" />
            {dateLabel}
          </div>
        </div>
        
        <h3 className="font-extrabold text-base sm:text-lg text-slate-900 leading-snug group-hover:text-purple-600 transition-colors line-clamp-2 sm:min-h-[3rem] break-keep">
          {course.title}
        </h3>

        {type === 'offline' && course.location && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
            <MapPin className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="line-clamp-1">{course.location}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-0.5 tabular-nums">
          <p className="text-lg sm:text-xl font-black text-slate-900">
            {course.is_free ? '무료' : `${(course.discount_price || course.price || 0).toLocaleString()}원`}
          </p>
          <div className="p-1.5 bg-slate-50 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="col-span-full py-20 text-center space-y-4 border-2 border-dashed border-gray-50 rounded-[40px]">
      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
        {icon}
      </div>
      <p className="text-gray-500 font-bold">현재 진행 예정인 특강이 없습니다.</p>
    </div>
  );
}

function idxToFakeSeats(id: string) {
  // Just for demo UI consistency
  return (id.length % 5) + 2;
}
