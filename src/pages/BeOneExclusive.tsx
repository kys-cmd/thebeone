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

export default function BeOneExclusive() {
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
        cmsService.getBanners('beone_exclusive')
      ]);
      
      const filteredCourses = courseData.filter(c => c.category === 'beone_exclusive' || c.category === 'beone_exclusive_online' || c.category === 'beone_exclusive_offline');
      
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

  const onlineCourses = courses.filter(c => c.category === 'beone_exclusive_online' || (c.category === 'beone_exclusive' && (!c.location || c.location === '')));
  const offlineCourses = courses.filter(c => c.category === 'beone_exclusive_offline' || (c.category === 'beone_exclusive' && (c.location && c.location !== '')));

  return (
    <div className="min-h-screen bg-white pb-32">
      <div className="container mx-auto px-4 space-y-32 py-12 md:py-20">
        {/* Online Section */}
        <section className="space-y-12">
          <div className="flex items-end justify-between border-b-4 border-purple-600 pb-6">
            <div className="space-y-2">
              <h2 className="text-4xl font-black text-gray-900 tracking-tighter">온라인 비원커뮤니티회원전용 강의</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {onlineCourses.length > 0 ? onlineCourses.map((course) => (
              <CourseCard key={course.id} course={course} type="online" />
            )) : (
              <EmptyState icon={<Video className="w-10 h-10 text-gray-200" />} />
            )}
          </div>
        </section>

        {/* Offline Section */}
        <section className="space-y-12">
          <div className="flex items-end justify-between border-b-4 border-gray-900 pb-6">
            <div className="space-y-2">
              <h2 className="text-4xl font-black text-gray-900 tracking-tighter">오프라인 비원커뮤니티회원전용 강의</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {offlineCourses.length > 0 ? offlineCourses.map((course) => (
              <CourseCard key={course.id} course={course} type="offline" />
            )) : (
              <EmptyState icon={<MapPin className="w-10 h-10 text-gray-200" />} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function CourseCard({ course, type }: { course: Course, type: 'online' | 'offline' }) {
  const isSoldOut = course.is_force_closed || (course.max_capacity && (course.enrolled_count || 0) >= course.max_capacity);

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
          <Badge className="bg-white/80 backdrop-blur-md text-gray-900 border-none font-bold">
            {type === 'online' ? 'Online' : 'OFFLINE'}
          </Badge>
        </div>
        
        {type === 'offline' && (
          <div className={cn(
            "absolute top-4 right-4 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-lg flex items-center",
            isSoldOut ? "bg-gray-500" : "bg-red-600"
          )}>
            {isSoldOut ? "모집 마감" : course.max_capacity ? `잔여 ${course.max_capacity - (course.enrolled_count || 0)}석` : "신청 가능"}
          </div>
        )}
      </div>

      <div className="space-y-2 px-1">
        <div className="flex items-center justify-between text-xs font-black text-purple-600">
          <span>{course.instructor} 강사</span>
          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
            <Calendar className="w-3 h-3" />
            2026.05.20
          </div>
        </div>
        
        <h3 className="font-extrabold text-lg text-gray-900 leading-tight group-hover:text-purple-600 transition-colors line-clamp-2 min-h-[3rem]">
          {course.title}
        </h3>

        {type === 'offline' && course.location && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-bold bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
            <MapPin className="w-3.5 h-3.5 text-purple-600" />
            <span className="line-clamp-1">{course.location}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-lg font-black text-purple-600">비원커뮤니티회원전용</p>
          <div className="p-1.5 bg-gray-50 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-colors">
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
      <p className="text-gray-500 font-bold">현재 진행 예정인 비원커뮤니티회원전용 강의가 없습니다.</p>
    </div>
  );
}

function idxToFakeSeats(id: string) {
  // Just for demo UI consistency
  return (id.length % 5) + 2;
}
