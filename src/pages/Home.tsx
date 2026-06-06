import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, Play, Calendar, MapPin, Star, ArrowRight, Layout, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { extractVimeoId, getVimeoEmbedUrl } from '@/lib/vimeo';
import { cmsService, Banner, SiteConfig } from '@/services/cmsService';
import { courseService } from '@/services/courseService';
import { reviewService, Review } from '@/services/reviewService';
import { Course } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Home() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [bestReviews, setBestReviews] = useState<Review[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [latestNotice, setLatestNotice] = useState<any>(null);
  const [isNoticeExpanded, setIsNoticeExpanded] = useState(false);

  const finalBanners = banners.length > 0 ? banners : [
    {
      title: "비원 아카데미에 오신 것을 환영합니다",
      subtitle: "기초부터 실무까지, 각 분야 전문가들의 프리미엄 노하우를 제공합니다.\n당신의 한계를 뛰어넘는 성장의 여정을 지금 시작해보세요.",
      image: "https://images.unsplash.com/photo-1551288049-bbbda5012375?auto=format&fit=crop&q=80&w=1200",
      link: "/courses",
      bg_color: "#6b21a8",
      video_url: null,
      html_content: null
    }
  ];

  const paginate = (newDirection: number) => {
    const len = finalBanners.length;
    if (len <= 1) return;
    setCurrentSlide((prev) => (prev + newDirection + len) % len);
  };

  // Ensure currentSlide is always within bounds when banner length changes dynamically
  useEffect(() => {
    if (currentSlide >= finalBanners.length) {
      setCurrentSlide(0);
    }
  }, [finalBanners.length, currentSlide]);

  useEffect(() => {
    const loadBanners = async () => {
      try {
        const bannersData = await cmsService.getBanners('main');
        setBanners(bannersData || []);
      } catch (err) {
        console.error("Failed to load banners", err);
      }
    };

    const loadData = async () => {
      try {
        setLoading(true);
        // Load each database table independently to prevent cascading failures 
        await Promise.all([
          cmsService.getBanners('main')
            .then(data => setBanners(data || []))
            .catch(err => console.error("Failed to load banners in loadData", err)),
          courseService.getCourses()
            .then(data => setCourses(data || []))
            .catch(err => console.error("Failed to load courses in loadData", err)),
          reviewService.getBestReviews()
            .then(data => setBestReviews(data || []))
            .catch(err => console.error("Failed to load reviews in loadData", err)),
          cmsService.getSiteConfig()
            .then(data => setSiteConfig(data))
            .catch(err => console.error("Failed to load site config in loadData", err)),
          cmsService.getSupportContent('notice')
            .then(data => {
              if (data && data.length > 0) {
                const activeOnes = data.filter(n => n.active);
                setLatestNotice(activeOnes.length > 0 ? activeOnes[0] : data[0]);
              } else {
                setLatestNotice(null);
              }
            })
            .catch(err => console.error("Failed to load notice in loadData", err))
        ]);
      } catch (error) {
        console.error("Failed to load home data", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();

    // Subscribe to banner changes
    const bannersSub = cmsService.subscribeToBanners(() => {
      loadBanners();
    });

    // Subscribe to site config changes
    const configSub = cmsService.subscribeToSiteConfig((newConfig) => {
      setSiteConfig(newConfig);
    });

    return () => {
      bannersSub.unsubscribe();
      configSub.unsubscribe();
    };
  }, []);

  // Filter courses by category
  const regularCourses = courses.filter(c => c.category === 'regular').map(c => ({
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    tags: c.instructor_tags || [],
    price: c.price || 0,
    discount_price: c.discount_price,
    is_free: c.is_free,
    discount: (c.price && c.discount_price) ? Math.round((1 - (c.discount_price / c.price)) * 100) : 0,
    thumbnail: c.thumbnail || "https://images.unsplash.com/photo-1551288049-bbbda5012375?auto=format&fit=crop&q=80&w=800",
  }));

  const onlineCourses = courses.filter(c => c.category === 'live' || c.category === 'special_online').map(c => ({
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    tags: c.instructor_tags || [],
    date: c.start_date ? new Date(c.start_date).toLocaleDateString('ko-KR') : '상시 진행',
    thumbnail: c.thumbnail || "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800",
    price: c.price || 0,
    discount_price: c.discount_price,
    is_free: c.is_free,
    discount: (c.price && c.discount_price) ? Math.round((1 - (c.discount_price / c.price)) * 100) : 0,
  }));

  const offlineCourses = courses.filter(c => c.category === 'special' || c.category === 'special_offline').map(c => ({
    id: c.id,
    title: c.title,
    location: c.location || '별도 안내',
    date: c.start_date ? new Date(c.start_date).toLocaleDateString('ko-KR') : '일정 예정',
    thumbnail: c.thumbnail || "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=800",
    seats: 20, // Default or from DB if applicable
    price: c.price || 0,
    discount_price: c.discount_price,
    is_free: c.is_free,
    discount: (c.price && c.discount_price) ? Math.round((1 - (c.discount_price / c.price)) * 100) : 0,
  }));

  useEffect(() => {
    if (finalBanners.length <= 1) return;
    const interval = siteConfig?.banner_interval || 5000;
    const timer = setInterval(() => {
      paginate(1);
    }, interval);
    return () => clearInterval(timer);
  }, [finalBanners.length, currentSlide, siteConfig?.banner_interval]);

  return (
    <div className="flex flex-col gap-20 pb-20">
      <section className="mt-6 mb-0 overflow-hidden">
        <div className="container mx-auto px-4 overflow-visible text-center">
          {!loading ? (
            <div className="relative h-[380px] md:h-[450px] w-full">
              <div 
                className="flex h-full transition-transform duration-500 ease-in-out"
                style={{ 
                  transform: `translateX(calc(-${currentSlide * 100}% - ${currentSlide * 30}px))`,
                  gap: '30px'
                }}
              >
                {finalBanners.map((banner, index) => {
                  const hasImg = !!banner.image;
                  const slideContent = (
                    <div className="w-full shrink-0 h-full relative z-20 rounded-2xl shadow-2xl overflow-hidden border border-white/10 text-left">
                      {/* Media content */}
                      <div className="absolute inset-0 w-full h-full animate-fade-in">
                        {hasImg ? (
                          <img 
                            src={banner.image} 
                            className="absolute inset-0 w-full h-full object-cover z-10"
                            alt={banner.title || "Banner Image"}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col justify-center items-center p-8 bg-purple-900 text-white select-none">
                            <h1 className="text-2xl md:text-4xl font-extrabold text-center tracking-tight">{banner.title}</h1>
                            {banner.subtitle && <p className="text-sm mt-2 opacity-80 text-center">{banner.subtitle}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  );

                  return banner.link ? (
                    <Link key={index} to={banner.link} className="w-full shrink-0 h-full block">
                      {slideContent}
                    </Link>
                  ) : (
                    <div key={index} className="w-full shrink-0 h-full">
                      {slideContent}
                    </div>
                  );
                })}
              </div>

              {/* BOTTOM LEFT: Index */}
              <div className="absolute bottom-6 left-8 lg:left-12 z-40 flex items-center gap-3 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/5">
                <div className="flex items-center gap-1.5 text-white/50 font-black text-[10px] tracking-widest">
                   <span className="text-white">{String(currentSlide + 1).padStart(2, '0')}</span>
                   <span className="opacity-20">/</span>
                   <span>{String(finalBanners.length).padStart(2, '0')}</span>
                </div>
              </div>

              {/* BOTTOM RIGHT: Controls */}
              <div className="absolute bottom-6 right-8 lg:right-12 z-40 flex items-center bg-black/60 backdrop-blur-md rounded-full border border-white/5 p-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-8 h-8 rounded-full text-white hover:bg-white/10"
                  onClick={() => paginate(-1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="w-px h-3 bg-white/10 mx-1" />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-8 h-8 rounded-full text-white hover:bg-white/10"
                  onClick={() => paginate(1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-[400px] w-full flex items-center justify-center bg-gray-50 rounded-2xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          )}
        </div>
      </section>

      {/* 최신 공지사항 게시글 형태 (배경이 100% 가득 차는 회색 최신글 슬롯 구조) */}
      <section className="w-full bg-slate-50 border-y border-slate-200/60 py-4.5 -mt-12 -mb-8">
        <div className="container mx-auto px-4">
          {latestNotice ? (
            <Link 
              to={`/support/notice?id=${latestNotice.id}`}
              className="block w-full hover:bg-slate-100/60 p-3 rounded-xl transition-all duration-200 text-left"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="bg-slate-200 text-slate-700 font-black text-[10.5px] px-2.5 py-1 rounded-md shrink-0 select-none">
                    최신공지
                  </span>
                  <h3 className="text-sm md:text-[14.5px] font-bold text-slate-800 truncate tracking-tight break-keep">
                    {latestNotice.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-bold font-mono shrink-0 select-none">
                  <span>{new Date(latestNotice.created_at).toLocaleDateString('ko-KR')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-405" />
                </div>
              </div>
            </Link>
          ) : (
            <div className="w-full text-slate-400 py-3.5 text-center text-xs font-black select-none">
              게시글이 없습니다
            </div>
          )}
        </div>
      </section>

      {/* Regular Courses Section */}
      <CourseSection 
        title="정규강의" 
        subtitle="기초부터 실전까지, 전문가의 체계적인 커리큘럼"
        items={regularCourses.length > 0 ? regularCourses : [
          {
            id: 1,
            title: "데이터 수집 부족, 표시할 정규 강의가 없습니다.",
            instructor: "비원아카데미",
            price: 0,
            discount: 0,
            thumbnail: "https://images.unsplash.com/photo-1551288049-bbbda5012375?auto=format&fit=crop&q=80&w=800",
          }
        ]}
      />

      {/* Online Special Section */}
      <CourseSection 
        title="온라인 특강" 
        subtitle="시간과 장소 제약 없이 만나는 트렌디한 지식"
        type="live"
        items={onlineCourses.length > 0 ? onlineCourses : [
          {
            id: 101,
            title: "현재 진행 예정인 온라인 특강이 없습니다.",
            instructor: "비원아카데미",
            date: "일정 예정",
            thumbnail: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800"
          }
        ]}
      />

      {/* Offline Special Section */}
      <CourseSection 
        title="오프라인 특강" 
        subtitle="현장의 에너지를 느끼며 직접 소통하는 오프라인 만남"
        type="special"
        items={offlineCourses.length > 0 ? offlineCourses : [
          {
            id: 201,
            title: "현재 진행 예정인 오프라인 특강이 없습니다.",
            location: "비원아카데미",
            date: "일정 예정",
            thumbnail: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=800",
            seats: 0
          }
        ]}
      />

      {/* Testimonials Section */}
      <section className="bg-gray-50 py-24">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-12">
            <div className="space-y-4">
              <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50 px-3 py-1 font-bold">REVIEWS</Badge>
              <h2 className="text-4xl font-black tracking-tighter text-gray-900">베스트 수강후기</h2>
            </div>
            <Link to="/reviews" className="flex items-center gap-2 text-gray-500 font-bold hover:text-purple-600 transition-colors">
              전체 후기 보기 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="flex gap-6 overflow-x-auto pb-8 no-scrollbar scroll-smooth snap-x">
            {bestReviews.length > 0 ? (
              bestReviews.map((review, idx) => (
                <motion.div 
                  key={review.id || idx}
                  whileHover={{ y: -10 }}
                  className="min-w-[320px] md:min-w-[400px] bg-white p-8 rounded-3xl shadow-sm border border-gray-100 snap-start flex flex-col"
                >
                  <div className="flex items-center gap-1 text-yellow-400 mb-6">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className={`w-5 h-5 ${j < review.rating ? 'fill-current' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <p className="text-lg font-bold leading-relaxed text-gray-800 flex-1 whitespace-pre-wrap">
                    "{review.content}"
                  </p>
                  <div className="flex items-center gap-4 border-t pt-6 mt-6">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                      <img src={review.user_avatar || `https://i.pravatar.cc/150?u=${review.user_id}`} alt="User" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{review.user_name || '익명 수강생'}</p>
                      <p className="text-xs text-purple-600 font-medium line-clamp-1">{review.course_title || '비원아카데미 강의 수강'}</p>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="w-full text-center py-12 bg-white rounded-3xl border border-gray-100 text-gray-500 font-bold">
                베스트 수강후기가 아직 없습니다.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function CourseSection({ title, subtitle, items, type = 'regular' }: any) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' 
        ? scrollLeft - clientWidth
        : scrollLeft + clientWidth;
      
      scrollRef.current.scrollTo({
        left: scrollTo,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="container mx-auto px-4 relative">
      <div className="flex items-end justify-between mb-10">
        <div className="space-y-3">
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-gray-900 break-keep">{title}</h2>
          <p className="text-gray-500 font-medium tracking-tight break-keep">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full border-gray-200 hover:border-purple-600 hover:text-purple-600 transition-colors"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full border-gray-200 hover:border-purple-600 hover:text-purple-600 transition-colors"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
          <div className="w-px h-6 bg-gray-200 mx-2" />
          <Link to={`/courses?category=${type}`} className="text-gray-400 p-2 hover:text-purple-600 transition-colors">
            <ArrowRight className="w-6 h-6" />
          </Link>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto pb-6 no-scrollbar scroll-smooth snap-x snap-mandatory"
      >
        {items.map((item: any, idx: number) => (
          <Link 
            key={`${item.id}-${idx}`} 
            to={`/course/${item.id}`}
            className="w-[85%] sm:w-[45%] lg:w-[calc(25%-18px)] shrink-0 group snap-start"
          >
            <div className="flex flex-col gap-4">
              <div className="relative aspect-[16/10] bg-gray-200 rounded-3xl overflow-hidden shadow-sm group-hover:shadow-xl transition-all duration-300">
                <img src={item.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={item.title} />
                {item.badge && (
                  <Badge className="absolute top-4 left-4 bg-purple-600 text-white font-black px-3 py-1 rounded-full shadow-lg">
                    {item.badge}
                  </Badge>
                )}
                {type === 'regular' && (
                  <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-5 h-5 text-purple-600 fill-current" />
                  </div>
                )}
                {item.seats && (
                  <Badge className="absolute bottom-4 left-4 bg-red-600 text-white font-bold px-3 py-1 rounded-full">
                    잔여 {item.seats}석
                  </Badge>
                )}
              </div>
              <div className="space-y-2 px-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-bold text-purple-600">{item.instructor || item.location}</p>
                  {item.tags && item.tags.slice(0, 2).map((tag: string, i: number) => (
                    <span key={i} className="text-[10px] bg-purple-50 text-purple-500 px-1.5 py-0.5 rounded font-medium">#{tag.replace('#', '')}</span>
                  ))}
                </div>
                <h3 className="font-extrabold text-lg text-gray-900 line-clamp-2 leading-tight group-hover:text-purple-600 transition-colors h-[3.5rem] break-keep">
                  {item.title}
                </h3>
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2">
                    {item.is_free ? (
                      <span className="text-xl font-black text-purple-600">무료</span>
                    ) : (
                      <>
                        <span className="text-xl font-black text-gray-900">{(item.discount_price || item.price || 0).toLocaleString()}원</span>
                        {item.discount > 0 && (
                          <>
                            <span className="text-sm text-gray-400 line-through">{(item.price || 0).toLocaleString()}원</span>
                            <span className="text-sm font-black text-red-500">{item.discount}%</span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  {type !== 'regular' && item.date && (
                    <div className="flex items-center gap-1.5 text-gray-400 font-bold text-xs">
                      <Calendar className="w-3.5 h-3.5" /> {item.date}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
