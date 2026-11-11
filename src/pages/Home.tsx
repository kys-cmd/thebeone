import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, ChevronLeft, Play, Calendar, Star, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { cmsService, Banner, SiteConfig } from '@/services/cmsService';
import { courseService } from '@/services/courseService';
import { reviewService, Review } from '@/services/reviewService';
import { Course } from '@/types';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [bestReviews, setBestReviews] = useState<Review[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [latestNotice, setLatestNotice] = useState<any>(null);
  const touchStartXRef = useRef<number | null>(null);

  const finalBanners = banners.length > 0 ? banners : [
    {
      title: '비원 아카데미에 오신 것을 환영합니다',
      subtitle: '기초부터 실무까지, 각 분야 전문가들의 프리미엄 노하우를 제공합니다.\n당신의 한계를 뛰어넘는 성장의 여정을 지금 시작해보세요.',
      image: 'https://images.unsplash.com/photo-1551288049-bbbda5012375?auto=format&fit=crop&q=80&w=1200',
      link: '/courses',
      bg_color: '#6b21a8',
      video_url: null,
      html_content: null
    }
  ];

  const paginate = (newDirection: number) => {
    const len = finalBanners.length;
    if (len <= 1) return;
    setCurrentSlide((prev) => (prev + newDirection + len) % len);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const deltaX = touchStartXRef.current - endX;
    if (Math.abs(deltaX) > 40) {
      paginate(deltaX > 0 ? 1 : -1);
    }
    touchStartXRef.current = null;
  };

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
        console.error('Failed to load banners', err);
      }
    };

    const loadData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          cmsService.getBanners('main')
            .then(data => setBanners(data || []))
            .catch(err => console.error('Failed to load banners in loadData', err)),
          courseService.getCourses()
            .then(data => setCourses(data || []))
            .catch(err => console.error('Failed to load courses in loadData', err)),
          reviewService.getBestReviews()
            .then(async (data) => {
              if (data && data.length > 0) {
                const userIds = data.map(r => r.user_id).filter(id => !!id);
                if (userIds.length > 0) {
                  try {
                    const { data: profiles, error } = await supabase
                      .from('profiles')
                      .select('id, name, nickname, avatar_url')
                      .in('id', userIds);
                    if (profiles && !error) {
                      const updatedReviews = data.map(r => {
                        const prof = profiles.find(p => p.id === r.user_id);
                        if (prof) {
                          return {
                            ...r,
                            user_name: prof.nickname || prof.name || r.user_name || '익명 수강생',
                            user_avatar: prof.avatar_url || r.user_avatar
                          };
                        }
                        return r;
                      });
                      setBestReviews(updatedReviews);
                      return;
                    }
                  } catch (pErr) {
                    console.error('Failed to fetch profiles for reviews', pErr);
                  }
                }
              }
              setBestReviews(data || []);
            })
            .catch(err => console.error('Failed to load reviews in loadData', err)),
          cmsService.getSiteConfig()
            .then(data => setSiteConfig(data))
            .catch(err => console.error('Failed to load site config in loadData', err)),
          cmsService.getSupportContent('notice')
            .then(data => {
              if (data && data.length > 0) {
                const activeOnes = data.filter(n => n.active);
                setLatestNotice(activeOnes.length > 0 ? activeOnes[0] : data[0]);
              } else {
                setLatestNotice(null);
              }
            })
            .catch(err => console.error('Failed to load notice in loadData', err))
        ]);
      } catch (error) {
        console.error('Failed to load home data', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    const bannersSub = cmsService.subscribeToBanners(() => {
      loadBanners();
    });

    const configSub = cmsService.subscribeToSiteConfig((newConfig) => {
      setSiteConfig(newConfig);
    });

    return () => {
      bannersSub.unsubscribe();
      configSub.unsubscribe();
    };
  }, []);

  const regularCourses = courses.filter(c => c.category === 'regular').map(c => ({
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    price: c.price || 0,
    discount_price: c.discount_price,
    is_free: c.is_free,
    discount: (c.price && c.discount_price) ? Math.round((1 - (c.discount_price / c.price)) * 100) : 0,
    thumbnail: c.thumbnail || 'https://images.unsplash.com/photo-1551288049-bbbda5012375?auto=format&fit=crop&q=80&w=800',
  }));

  const onlineCourses = courses.filter(c => c.category === 'live' || c.category === 'special_online').map(c => ({
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    date: c.start_date ? new Date(c.start_date).toLocaleDateString('ko-KR') : '상시 진행',
    thumbnail: c.thumbnail || 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800',
    price: c.price || 0,
    discount_price: c.discount_price,
    is_free: c.is_free,
    discount: (c.price && c.discount_price) ? Math.round((1 - (c.discount_price / c.price)) * 100) : 0,
  }));

  const offlineCourses = courses.filter(c => c.category === 'special' || c.category === 'special_offline').map(c => ({
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    location: c.location || '별도 안내',
    date: c.start_date ? new Date(c.start_date).toLocaleDateString('ko-KR') : '일정 예정',
    thumbnail: c.thumbnail || 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=800',
    seats: c.max_capacity || 0,
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
    <div className="flex flex-col gap-8 sm:gap-14 md:gap-20 pb-14 md:pb-20 pt-3 sm:pt-5 md:pt-0">
      {/* Hero Banner Carousel (Responsive for Mobile + Desktop with Touch Swipe) */}
      <section className="mt-0 md:mt-6 overflow-hidden">
        <div className="container mx-auto px-4">
          {!loading ? (
            <div
              className="relative w-full aspect-[16/8.5] sm:aspect-[21/8] md:aspect-[1920/450] rounded-2xl overflow-hidden shadow-md sm:shadow-xl"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className="flex h-full transition-transform duration-500 ease-out"
                style={{
                  transform: `translateX(-${currentSlide * 100}%)`,
                }}
              >
                {finalBanners.map((banner, index) => {
                  const hasImg = !!banner.image;
                  const slideContent = (
                    <div className="w-full shrink-0 h-full relative text-left">
                      {hasImg ? (
                        <img
                          src={banner.image}
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover"
                          alt={banner.title || '배너 이미지'}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col justify-center items-center p-5 sm:p-8 bg-purple-900 text-white select-none">
                          <h1 className="text-base sm:text-2xl md:text-4xl font-extrabold text-center tracking-tight break-keep">
                            {banner.title}
                          </h1>
                          {banner.subtitle && (
                            <p className="text-xs sm:text-sm mt-2 opacity-85 text-center line-clamp-2 max-w-xl break-keep">
                              {banner.subtitle}
                            </p>
                          )}
                        </div>
                      )}
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

              {/* Slide Counter */}
              <div className="absolute bottom-2.5 left-3 sm:bottom-5 sm:left-6 z-20 flex items-center bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
                <div className="flex items-center gap-1 text-white/70 font-bold text-[10px] sm:text-xs tabular-nums">
                  <span className="text-white">{String(currentSlide + 1).padStart(2, '0')}</span>
                  <span className="opacity-40">/</span>
                  <span>{String(finalBanners.length).padStart(2, '0')}</span>
                </div>
              </div>

              {/* Desktop & Tablet Controls */}
              {finalBanners.length > 1 && (
                <div className="hidden sm:flex absolute bottom-5 right-6 z-20 items-center bg-black/55 backdrop-blur-md rounded-full p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 rounded-full text-white hover:bg-white/15 border-none"
                    onClick={() => paginate(-1)}
                    aria-label="이전 배너"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="w-px h-3 bg-white/20 mx-0.5" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 rounded-full text-white hover:bg-white/15 border-none"
                    onClick={() => paginate(1)}
                    aria-label="다음 배너"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-[16/8.5] sm:aspect-[21/8] md:aspect-[1920/450] w-full flex items-center justify-center bg-slate-100 rounded-2xl">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-purple-600" />
            </div>
          )}
        </div>
      </section>

      {/* Latest Notice Bar */}
      <section className="w-full bg-slate-50 border-y border-slate-200/60 py-2.5 sm:py-3.5 -mt-3 sm:-mt-6 md:-mt-8">
        <div className="container mx-auto px-4">
          {latestNotice ? (
            <Link
              to={`/support/notice?id=${latestNotice.id}`}
              className="block w-full hover:bg-slate-100/70 active:bg-slate-100 px-2 py-2 sm:p-2.5 rounded-xl transition-colors text-left"
            >
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="bg-slate-200/90 text-slate-700 font-extrabold text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md shrink-0 select-none">
                    공지
                  </span>
                  <h3 className="text-xs sm:text-sm md:text-[14.5px] font-bold text-slate-800 truncate tracking-tight">
                    {latestNotice.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold font-mono tabular-nums shrink-0 select-none">
                  <span className="hidden sm:inline">{new Date(latestNotice.created_at).toLocaleDateString('ko-KR')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            </Link>
          ) : (
            <div className="w-full text-slate-400 py-2.5 text-center text-xs font-bold select-none">
              등록된 공지사항이 없습니다.
            </div>
          )}
        </div>
      </section>

      {/* Regular Courses Section */}
      <CourseSection
        title="정규강의"
        subtitle="기초부터 실전까지, 전문가의 체계적인 커리큘럼"
        moreLink="/courses"
        items={regularCourses.length > 0 ? regularCourses : [
          {
            id: 1,
            title: '현재 표시할 정규 강의가 없습니다.',
            instructor: '비원아카데미',
            price: 0,
            discount: 0,
            thumbnail: 'https://images.unsplash.com/photo-1551288049-bbbda5012375?auto=format&fit=crop&q=80&w=800',
          }
        ]}
      />

      {/* Online Special Section */}
      <CourseSection
        title="온라인 특강"
        subtitle="시간과 장소 제약 없이 만나는 트렌디한 지식"
        type="live"
        moreLink="/special"
        items={onlineCourses.length > 0 ? onlineCourses : [
          {
            id: 101,
            title: '현재 진행 예정인 온라인 특강이 없습니다.',
            instructor: '비원아카데미',
            date: '일정 예정',
            thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800'
          }
        ]}
      />

      {/* Offline Special Section */}
      <CourseSection
        title="오프라인 특강"
        subtitle="현장의 에너지를 느끼며 직접 소통하는 오프라인 만남"
        type="special"
        moreLink="/special"
        items={offlineCourses.length > 0 ? offlineCourses : [
          {
            id: 201,
            title: '현재 진행 예정인 오프라인 특강이 없습니다.',
            instructor: '비원아카데미',
            location: '비원아카데미',
            date: '일정 예정',
            thumbnail: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=800',
            seats: 0
          }
        ]}
      />

      {/* Testimonials Section */}
      <section className="bg-slate-50 py-10 sm:py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-6 sm:mb-10">
            <div className="space-y-1.5 sm:space-y-2">
              <p className="text-purple-600 font-extrabold text-xs tracking-wide">베스트 후기</p>
              <h2 className="text-xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900">
                수강생 생생 후기
              </h2>
            </div>
          </div>

          {bestReviews.length > 0 ? (
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 no-scrollbar">
              {bestReviews.map((review, idx) => (
                <motion.div
                  key={review.id || idx}
                  whileHover={{ y: -4 }}
                  className="w-[82vw] max-w-[320px] sm:w-auto sm:max-w-none shrink-0 snap-start bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl shadow-xs border border-slate-100 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1 text-amber-400 mb-3.5 sm:mb-5">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className={`w-4 h-4 ${j < review.rating ? 'fill-current' : 'text-slate-200'}`} />
                      ))}
                    </div>
                    <p className="text-sm sm:text-[15px] font-semibold leading-relaxed text-slate-800 line-clamp-4 whitespace-pre-wrap mb-5">
                      "{review.content}"
                    </p>
                  </div>
                  <div className="flex items-center gap-3 border-t border-slate-100 pt-4 mt-auto">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full overflow-hidden bg-slate-100 shrink-0">
                      <img
                        src={review.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.user_id}`}
                        referrerPolicy="no-referrer"
                        alt={review.user_name || '수강생'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                        {review.user_name || '익명 수강생'}
                      </p>
                      <p className="text-[11px] sm:text-xs text-purple-600 font-medium truncate">
                        {review.course_title || '비원아카데미 수강생'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="w-full text-center py-12 bg-white rounded-2xl sm:rounded-3xl border border-slate-100 text-slate-500 font-bold text-sm">
              베스트 수강후기가 아직 없습니다.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CourseSection({ title, subtitle, items, type = 'regular', moreLink = '/courses' }: any) {
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
      <div className="flex items-end justify-between gap-4 mb-4 sm:mb-8">
        <div className="space-y-1 sm:space-y-1.5 min-w-0">
          <h2 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 break-keep">{title}</h2>
          <p className="text-slate-500 font-medium tracking-tight break-keep text-xs sm:text-sm line-clamp-1">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-slate-200 hover:border-purple-600 hover:text-purple-600 transition-colors h-9 w-9"
              onClick={() => scroll('left')}
              aria-label="이전 강의"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-slate-200 hover:border-purple-600 hover:text-purple-600 transition-colors h-9 w-9"
              onClick={() => scroll('right')}
              aria-label="다음 강의"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <div className="w-px h-5 bg-slate-200 mx-1" />
          </div>
          <Link
            to={moreLink}
            className="min-h-[40px] px-1 flex items-center gap-1 text-xs sm:text-sm font-bold text-slate-500 hover:text-purple-600 transition-colors whitespace-nowrap"
          >
            <span>전체보기</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 sm:gap-6 overflow-x-auto pb-3 sm:pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar scroll-smooth snap-x snap-mandatory"
      >
        {items.map((item: any, idx: number) => (
          <Link
            key={`${item.id}-${idx}`}
            to={`/course/${item.id}`}
            className="w-[78vw] max-w-[300px] sm:w-[46%] sm:max-w-none lg:w-[calc(25%-18px)] shrink-0 group snap-start"
          >
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="relative aspect-[16/10] bg-slate-100 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs group-hover:shadow-lg transition-all duration-300">
                <img
                  src={item.thumbnail}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  alt={item.title}
                />
                {item.badge && (
                  <Badge className="absolute top-3 left-3 bg-purple-600 text-white font-bold px-2.5 py-0.5 rounded-full shadow-sm text-[11px]">
                    {item.badge}
                  </Badge>
                )}
                {type === 'regular' && (
                  <div className="hidden sm:flex absolute bottom-3.5 right-3.5 bg-white/90 backdrop-blur-sm p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-4 h-4 text-purple-600 fill-current" />
                  </div>
                )}
                {item.seats && item.seats > 0 ? (
                  <Badge className="absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur-xs text-white font-bold px-2.5 py-0.5 rounded-full border-none text-[11px]">
                    모집 인원 {item.seats}명
                  </Badge>
                ) : null}
              </div>
              <div className="space-y-1.5 px-0.5">
                <p className="text-xs font-bold text-purple-600 truncate">
                  {item.instructor || item.location}
                </p>
                <h3 className="font-extrabold text-[15px] sm:text-lg text-slate-900 line-clamp-2 leading-snug group-hover:text-purple-600 transition-colors min-h-[2.6rem] sm:h-[3.25rem] break-keep">
                  {item.title}
                </h3>
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-baseline gap-1.5 flex-wrap tabular-nums">
                    {item.is_free ? (
                      <span className="text-base sm:text-xl font-black text-purple-600">무료</span>
                    ) : (
                      <>
                        <span className="text-base sm:text-xl font-black text-slate-900">
                          {(item.discount_price || item.price || 0).toLocaleString()}원
                        </span>
                        {item.discount > 0 && (
                          <>
                            <span className="text-xs sm:text-sm text-slate-400 line-through">
                              {(item.price || 0).toLocaleString()}원
                            </span>
                            <span className="text-xs sm:text-sm font-black text-red-500">
                              {item.discount}%
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  {type !== 'regular' && item.date && (
                    <div className="flex items-center gap-1.5 text-slate-400 font-semibold text-xs tabular-nums">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.date}</span>
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
