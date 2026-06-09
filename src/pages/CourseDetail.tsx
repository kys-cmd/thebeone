import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useScroll, useSpring, AnimatePresence } from 'motion/react';
import { 
  PlayCircle, 
  CheckCircle2, 
  Users, 
  Star, 
  Clock, 
  ChevronRight, 
  ArrowLeft,
  Calendar,
  FileText,
  MessageSquare,
  Trophy,
  Video,
  Lock
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Course } from '@/types';
import { cn } from '@/lib/utils';
import DynamicCourseRenderer from '@/components/course/DynamicCourseRenderer';
import { PaymentButton } from '@/components/PaymentButton';
import { courseService } from '@/services/courseService';
import { instructorService } from '@/services/instructorService';
import { reviewService, Review } from '@/services/reviewService';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { getVimeoEmbedUrl } from '@/lib/vimeo';
import { CurriculumItem } from '@/types';

function CourseReviews({ courseId }: { courseId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReviews() {
      try {
        const allReviews = await reviewService.getReviews();
        setReviews(allReviews.filter(r => r.course_id === courseId));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadReviews();
  }, [courseId]);

  if (loading) return <div className="py-10 text-center text-gray-400 font-bold">후기 데이터를 불러오는 중...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {reviews.length === 0 ? (
        <div className="col-span-full py-20 text-center bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-100">
           <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
           <p className="text-gray-400 font-bold">아직 작성된 후기가 없습니다.</p>
        </div>
      ) : (
        reviews.map(review => (
          <div key={review.id} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-1 text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'text-gray-200'}`} />
                ))}
              </div>
              <p className="text-gray-700 leading-relaxed font-medium break-keep">"{review.content}"</p>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
              <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                <img src={review.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.user_id}`} alt="" />
              </div>
              <div>
                <p className="text-sm font-black text-gray-900">{review.user_name || '익명 수강생'}</p>
                <p className="text-[10px] font-bold text-gray-400">
                  {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function CourseDetail() {
  const { user } = useAuthStore();
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [activeLesson, setActiveLesson] = useState<CurriculumItem | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [isTabsSticky, setIsTabsSticky] = useState(false);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80; // Only main header offset
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    async function loadCourse() {
      if (!id) return;
      try {
        const data = await courseService.getCourseById(id);
        
        // 만약 강사 태그가 없다면 강사 테이블에서 직접 가져와서 채워줌 (데이터 동기화 이전 데이터 대응용)
        if (data.instructor_id && (!data.instructor_tags || data.instructor_tags.length === 0)) {
          try {
            const instructor = await instructorService.getInstructor(data.instructor_id);
            if (instructor && instructor.tags && instructor.tags.length > 0) {
              data.instructor_tags = instructor.tags;
              // 조용히 데이터 업데이트를 시도하여 다음번엔 바로 나오게 함
              courseService.updateCourse(data.id, { instructor_tags: instructor.tags }).catch(e => console.warn('Silent sync failed:', e));
            }
          } catch (e) {
            console.warn('Fallback instructor fetch failed:', e);
          }
        }

        setCourse(data);
        
        // Fetch current enrollment count
        const { count } = await (courseService as any).getEnrollmentCount(id);
        setEnrolledCount(count || 0);
        
        if (user) {
          const isAdmin = user.role === 'super_admin' || user.role === 'admin';
          const enrolled = isAdmin ? true : await courseService.checkEnrollment(user.id, id);
          setIsEnrolled(enrolled);
        }
      } catch (error) {
        toast.error('강의 정보를 불러오는 데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    
    if (user) {
      loadCourse();
    }

    const handleScroll = () => {
      if (tabsRef.current) {
        const top = tabsRef.current.getBoundingClientRect().top;
        setIsTabsSticky(top <= 70); // Header height is roughly 70 + event banner
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [id, user]);

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
              강의 상세 정보와 커리큘럼은 비원아카데미 회원만 확인할 수 있습니다.<br/>
              회원가입 후 비원아카데미만의 특별한 인사이트를 만나보세요!
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <Link to="/auth/login" className={cn(buttonVariants({ size: 'lg' }), "bg-purple-600 hover:bg-purple-700 h-14 rounded-2xl text-lg font-black shadow-lg shadow-purple-200")}>
              로그인하러 가기
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div></div>;
  if (!course) return <div className="min-h-screen flex items-center justify-center font-bold">강의를 찾을 수 없습니다.</div>;

  const isSoldOut = course.is_force_closed || (
                     (course.category === 'special_offline' || course.category === 'beone_exclusive_offline') && 
                     course.max_capacity !== null && 
                     course.max_capacity !== undefined && 
                     enrolledCount >= course.max_capacity
                   );

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section (Urgency Marketing) */}
      <section 
        className="pt-20 md:pt-24 pb-20 md:pb-32 relative overflow-hidden transition-colors duration-500"
        style={{ 
          backgroundColor: course.hero_bg_color || '#0f172a',
          color: course.hero_text_color || '#ffffff'
        }}
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          {course.hero_image ? (
            <img src={course.hero_image} className="w-full h-full object-cover blur-sm" alt="" />
          ) : course.thumbnail ? (
            <div className="absolute top-0 right-0 w-1/2 h-full">
              <img src={course.thumbnail} className="w-full h-full object-cover blur-2xl" alt="" />
            </div>
          ) : (
            <div className="w-full h-full bg-gray-800 blur-2xl" />
          )}
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row gap-16 items-start">
            <div className="flex-1 space-y-8">
              <div className="flex items-center gap-3">
                {isSoldOut ? (
                  <Badge className="bg-gray-500 text-white font-black border-none px-4 py-1.5 text-sm">
                    모집 마감
                  </Badge>
                ) : (course.category === 'special_offline' || course.category === 'beone_exclusive_offline') && course.max_capacity ? (
                  <Badge className="bg-red-600 text-white font-black border-none px-4 py-1.5 text-sm animate-pulse">
                    선착순 {course.max_capacity - enrolledCount}석 남음
                  </Badge>
                ) : (
                  <Badge className="bg-red-600 text-white font-black border-none px-4 py-1.5 text-sm animate-bounce">
                    마감임박
                  </Badge>
                )}
              </div>

              <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[1.1] break-keep">
                {course.title}
              </h1>

              <p className="text-xl font-medium leading-relaxed max-w-2xl opacity-80 break-keep">
                {course.description}
              </p>

              <div className="flex flex-wrap gap-8 items-center pt-4">
                <div className="space-y-1">
                  <p className="opacity-50 text-xs font-bold uppercase tracking-widest">Instructor</p>
                  <p className="text-xl font-black">{course.instructor}</p>
                </div>
                <div className="space-y-1 border-l border-white/10 pl-8">
                  <p className="opacity-50 text-xs font-bold uppercase tracking-widest">Type</p>
                  <p className="text-xl font-black">
                    {course.category === 'regular' ? '정규강의' : 
                     course.category === 'special_online' ? '온라인 특강' :
                     course.category === 'special_offline' ? '오프라인 특강' :
                     course.category === 'special' ? '특강' : 
                     course.category === 'beone_exclusive_online' ? '온라인 비원커뮤니티회원전용' :
                     course.category === 'beone_exclusive_offline' ? '오프라인 비원커뮤니티회원전용' :
                     course.category === 'beone_exclusive' ? '비원커뮤니티회원전용' : '라이브'}
                  </p>
                </div>
                <div className="space-y-1 border-l border-white/10 pl-8">
                  <p className="opacity-50 text-xs font-bold uppercase tracking-widest">Duration</p>
                  <p className="text-xl font-black">
                    {course.is_duration_based ? (
                      `신청일로부터 ${course.duration_days}일`
                    ) : course.start_date && course.end_date ? (
                      `${new Date(course.start_date).toLocaleDateString()} ~ ${new Date(course.end_date).toLocaleDateString()}`
                    ) : (
                      '상시 수강'
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Purchase Card (Desktop) */}
            <div className="w-full lg:w-[420px] bg-white rounded-[40px] shadow-2xl p-8 sticky top-32 text-gray-900 border border-gray-100 hidden lg:block">
              <div className="aspect-video rounded-3xl overflow-hidden mb-8 relative border">
                {course.thumbnail ? (
                  <img src={course.thumbnail} className="w-full h-full object-cover" alt={course.title} />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <Video className="w-12 h-12 text-gray-300" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <PlayCircle className="w-16 h-16 text-white drop-shadow-2xl" />
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-bold">
                      {course.is_duration_based ? `수강 기간: ${course.duration_days}일` : '강의 기간: 상시/일정'}
                    </span>
                  </div>
                  {!(course.category === 'beone_exclusive_online' || course.category === 'beone_exclusive_offline') ? (
                    <div className="text-right">
                      <p className="text-gray-400 line-through text-sm font-bold">{(course.price || 0).toLocaleString()}원</p>
                      <p className="text-4xl font-black tracking-tighter">{(course.discount_price || course.price || 0).toLocaleString()}원</p>
                    </div>
                  ) : (
                    <div className="text-right">
                      <p className="text-2xl font-black text-purple-600 tracking-tighter">비원커뮤니티회원전용</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  {(() => {
                    const requiredGrade = course.min_member_grade || ((course.category === 'beone_exclusive_online' || course.category === 'beone_exclusive_offline') ? 'bione_member' : null);
                    
                    if (requiredGrade) {
                      const ROLE_RANK: Record<string, number> = {
                        'user': 0,
                        'regular_member': 1,
                        'paid_member': 2,
                        'bione_member': 3,
                        'admin': 100,
                        'super_admin': 100
                      };
                      const userRank = user ? (ROLE_RANK[user.role || 'user'] || 0) : 0;
                      const requiredRank = ROLE_RANK[requiredGrade] || 0;
                      const isGradeAuthorized = userRank >= requiredRank || (user && (user.role === 'admin' || user.role === 'super_admin'));

                      if (!isGradeAuthorized) {
                        return (
                          <div className="flex-1 p-5 bg-purple-50 text-purple-700 rounded-2xl border border-purple-200 text-center font-black text-[15px] leading-snug tracking-tight">
                            비원아카데미 회원으로 가입하시면 이용하실 수 있습니다.
                          </div>
                        );
                      } else {
                        return (
                          <Button 
                            size="lg" 
                            className="flex-1 h-16 bg-green-600 hover:bg-green-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-green-200"
                            onClick={() => navigate(`/course/${course.id}/learn`)}
                          >
                            강의 이어학습하기
                          </Button>
                        );
                      }
                    }

                    // Fallback to original flow for non-grade-restricted courses
                    if (isEnrolled) {
                      return (
                        <Button 
                          size="lg" 
                          className="flex-1 h-16 bg-green-600 hover:bg-green-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-green-200"
                          onClick={() => navigate(`/course/${course.id}/learn`)}
                        >
                          강의 이어학습하기
                        </Button>
                      );
                    } else if (isSoldOut) {
                      return (
                        <Button 
                          size="lg" 
                          disabled
                          className="flex-1 h-16 bg-gray-200 text-gray-500 font-black text-xl rounded-2xl cursor-not-allowed"
                        >
                          모집이 마감되었습니다
                        </Button>
                      );
                    } else if (course.is_free) {
                      return (
                        <Button 
                          size="lg" 
                          className="flex-1 h-16 bg-purple-600 hover:bg-purple-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-purple-200"
                          onClick={async () => {
                            if (!user) {
                              toast.error('로그인이 필요합니다.');
                              navigate('/auth/login');
                              return;
                            }
                            try {
                              await courseService.enrollCourse(user.id, course.id);
                              toast.success('수강 신청이 완료되었습니다. 내 강의실에서 확인하세요!');
                              setIsEnrolled(true);
                            } catch (err: any) {
                              console.error('Enrollment Error:', err);
                              toast.error(`수강 신청 실패: ${err.message || '알 수 없는 오류'}`);
                            }
                          }}
                        >
                          지금 바로 무료 수강하기
                        </Button>
                      );
                    } else {
                      return (
                        <PaymentButton 
                          lecture={{
                            id: course.id,
                            title: course.title,
                            price: course.discount_price || course.price || 0
                          }}
                          user={{
                            id: user?.id || '',
                            email: user?.email || '',
                            name: user?.name || user?.email?.split('@')[0] || '수강생'
                          }}
                        />
                      );
                    }
                  })()}
                </div>
                <p className="text-center text-xs text-gray-400 font-bold">
                  카드 결제, 계좌이체 가능 | 지금 바로 수강 시작
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Navigation Tabs (Non-sticky) */}
      <div 
        ref={tabsRef}
        className="bg-white border-b z-10 transition-shadow"
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-10 h-16 overflow-x-auto no-scrollbar">
            {[
              { name: '강의소개', id: 'intro' },
              { name: '커리큘럼', id: 'curriculum' },
              { name: '강사소개', id: 'instructor' },
              { name: '강의자료', id: 'materials' },
              { name: '수강후기', id: 'reviews' }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => scrollToSection(tab.id)}
                className="whitespace-nowrap font-black text-[15px] text-gray-400 hover:text-purple-600 transition-colors border-b-4 border-transparent py-4 h-full px-1 focus:text-purple-600 focus:border-purple-600"
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container mx-auto px-4 py-20 flex flex-col lg:flex-row gap-20">
        <div className="flex-1 space-y-32">
          
          {/* Dynamic Design from Admin CMS */}
          {course.layout && course.layout.blocks.length > 0 ? (
            <section id="intro" className="space-y-10">
              <DynamicCourseRenderer blocks={course.layout.blocks} />
            </section>
          ) : (
            <section id="intro" className="space-y-10">
              <div className="space-y-4">
                <Badge className="bg-purple-50 text-purple-600 border-none font-black px-4 py-1">INTRO</Badge>
                <h2 className="text-4xl font-black tracking-tighter text-gray-900">본 강의를 소개합니다</h2>
                {course.description && (
                  <p className="text-xl text-gray-600 leading-relaxed whitespace-pre-wrap pt-4">
                    {course.description}
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-10">
                {(course.outcomes && course.outcomes.length > 0 && course.outcomes[0] !== "") ? (
                  course.outcomes.map((text, i) => (
                    <div key={i} className="flex gap-4 p-8 bg-gray-50 rounded-[32px] items-start border border-gray-100/50">
                      <div className="w-10 h-10 bg-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="text-white w-5 h-5" />
                      </div>
                      <p className="text-lg font-extrabold text-gray-800 leading-tight pt-1">{text}</p>
                    </div>
                  ))
                ) : (
                  [
                    "체계적인 실무 프로세스 완벽 습득",
                    "현업 최고 수준의 결과물 포트폴리오 구축",
                    "평생 소장 가능한 실무 템플릿 제공",
                    "수강생 전용 프라이빗 커뮤니티 권한"
                  ].map((text, i) => (
                    <div key={i} className="flex gap-4 p-8 bg-gray-50 rounded-[32px] items-start border border-gray-100/50">
                      <div className="w-10 h-10 bg-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Trophy className="text-white w-5 h-5" />
                      </div>
                      <p className="text-lg font-extrabold text-gray-800 leading-tight pt-1">{text}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* Recommended Section (New Dynamic) */}
          {(course.recommended_for && course.recommended_for.length > 0 && course.recommended_for[0] !== "") && (
            <section id="recommended" className="space-y-10">
              <div className="space-y-4">
                <Badge className="bg-purple-50 text-purple-600 border-none font-black px-4 py-1">TARGET</Badge>
                <h2 className="text-4xl font-black tracking-tighter text-gray-900">이런 분들이 들으면{'\n'}인생이 바뀝니다</h2>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {course.recommended_for.map((text, i) => (
                  <div key={i} className="flex items-center gap-6 p-8 bg-white border-2 border-gray-50 rounded-[32px] hover:border-purple-100 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-black">
                      {i + 1}
                    </div>
                    <p className="text-xl font-bold text-gray-800">{text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section: Curriculum */}
          <section id="curriculum" className="space-y-10 scroll-mt-24">
            <div className="space-y-4">
              <Badge className="bg-purple-50 text-purple-600 border-none font-black px-4 py-1">CURRICULUM</Badge>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <h2 className="text-4xl font-black tracking-tighter text-gray-900">당신을 전문가로 만들어 줄{'\n'}압도적인 커리큘럼</h2>
                {activeLesson && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setActiveLesson(null)}
                    className="text-gray-400 hover:text-purple-600 font-bold"
                  >
                    플레이어 닫기
                  </Button>
                )}
              </div>
            </div>

            {/* Integrated Player (Playlist Style) */}
            <AnimatePresence>
              {activeLesson && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-6 mb-12">
                    <div className="aspect-video bg-black rounded-[32px] overflow-hidden shadow-2xl shadow-purple-500/10 relative border border-gray-100">
                      <iframe
                        key={activeLesson.id}
                        src={getVimeoEmbedUrl(activeLesson.vimeo_id || '', { autoplay: 1 })}
                        className="absolute inset-0 w-full h-full"
                        allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                        title={activeLesson.title}
                        onError={() => {
                          toast.error('동영상을 불러오는 중 오류가 발생했습니다. Vimeo 권한 설정을 확인해주세요.');
                        }}
                      />
                    </div>
                    <div className="px-4 py-6 bg-purple-50/50 rounded-[32px] border border-purple-100/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1 items-end h-3">
                            <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-purple-600 rounded-full" />
                            <motion.div animate={{ height: [12, 4, 12] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-purple-600 rounded-full" />
                            <motion.div animate={{ height: [8, 12, 8] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-1 bg-purple-600 rounded-full" />
                          </div>
                          <span className="text-purple-600 font-black text-sm uppercase tracking-tighter">실시간 수강 중</span>
                        </div>
                        <Badge variant="outline" className="border-purple-200 text-purple-600 font-bold">
                          {activeLesson.duration}
                        </Badge>
                      </div>
                      <h3 className="text-2xl font-black text-gray-900">{activeLesson.title}</h3>
                      <p className="text-sm text-gray-500 font-medium break-keep">
                        비메오 영상 플레이어에 문제가 있을 경우, 관리자 페이지에서 영상 ID(h 파라미터 포함)를 확인하시거나 브라우저 캐시를 삭제 후 다시 시도해주세요.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 gap-6">
              {course.curriculum?.map((section, idx) => (
                <div key={section.id} className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <p className="text-sm font-black text-purple-600 uppercase tracking-widest">CHAPTER 0{idx + 1}. {section.title}</p>
                    <Badge variant="outline" className="text-[10px] text-gray-400 font-bold border-gray-100">
                      {section.items.length} Lectures
                    </Badge>
                  </div>
                  <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                    {section.items.map((item, itemIdx) => {
                      const isActive = activeLesson?.id === item.id;
                      const isLocked = !isEnrolled && !item.is_free;
                      
                      return (
                        <button 
                          key={item.id} 
                          onClick={() => {
                            if (isLocked) {
                              toast.error('수강 신청 후 시청 가능합니다.');
                              return;
                            }
                            setActiveLesson(item);
                            scrollToSection('curriculum');
                          }}
                          className={cn(
                            "w-full p-5 flex items-center justify-between group transition-all text-left relative",
                            isActive ? "bg-purple-600 text-white" : isLocked ? "opacity-60 bg-gray-50/50" : "hover:bg-purple-50/50"
                          )}
                        >
                          {isActive && (
                            <motion.div 
                              layoutId="active-lesson-indicator"
                              className="absolute left-0 top-0 bottom-0 w-1.5 bg-white rounded-r-full"
                            />
                          )}
                          <div className="flex items-center gap-5">
                            <span className={cn(
                              "text-[10px] font-black w-5 shrink-0",
                              isActive ? "text-white/60" : "text-gray-300 group-hover:text-purple-300"
                            )}>
                              {String(itemIdx + 1).padStart(2, '0')}
                            </span>
                            <div className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                              isActive ? "bg-white/20 text-white" : isLocked ? "bg-gray-100 text-gray-400" : "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white"
                            )}>
                              {isLocked ? <Lock className="w-4 h-4" /> : <Video className="w-5 h-5" />}
                            </div>
                            <div className="space-y-0.5">
                              <p className={cn(
                                "font-black tracking-tight break-keep text-sm",
                                isActive ? "text-white" : "text-gray-800"
                              )}>
                                {item.title}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className={cn("text-[10px] font-bold", isActive ? "text-white/60" : "text-gray-400")}>
                                  {item.duration || "00:00"}
                                </span>
                                {item.is_free && !isActive && (
                                  <Badge className="h-4 px-1.5 text-[8px] bg-purple-100 text-purple-600 border-none font-black uppercase">Free</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            {isActive ? (
                              <div className="flex gap-0.5 items-end h-3">
                                <motion.div animate={{ height: [4, 12, 4] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-white rounded-full" />
                                <motion.div animate={{ height: [12, 4, 12] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-white rounded-full" />
                                <motion.div animate={{ height: [6, 12, 6] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-1 bg-white rounded-full" />
                              </div>
                            ) : (
                              <ChevronRight className={cn(
                                "w-4 h-4 transition-all opacity-0 group-hover:opacity-100 group-hover:translate-x-1",
                                isActive ? "text-white" : isLocked ? "text-gray-200" : "text-purple-300"
                              )} />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Instructor Extra */}
          <section id="instructor" className="bg-gray-900 text-white rounded-[48px] p-12 md:p-20 relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
              <div className="w-48 h-48 rounded-full border-8 border-white/10 overflow-hidden shrink-0">
                <img 
                  src={course.instructor_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${course.instructor}`} 
                  className="w-full h-full object-cover" 
                  alt="" 
                />
              </div>
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-purple-400 font-bold tracking-widest uppercase text-sm">{course.instructor_title || "비원아카데미 마스터"}</p>
                  <h3 className="text-4xl font-black">{course.instructor} 강사님</h3>
                </div>
                <p className="text-xl text-gray-300 font-medium leading-relaxed whitespace-pre-wrap">
                  {course.instructor_bio || `"본 강의는 단순한 지식 전달이 아니라, 제가 10년 넘게 현업에서 깨지며 얻은 생존 기술들을 담았습니다. 여러분의 시간이 헛되지 않게 가이드하겠습니다."`}
                </p>
                <div className="flex flex-wrap gap-3">
                  {course.instructor_tags && course.instructor_tags.length > 0 ? (
                    course.instructor_tags.map((tag, i) => (
                      <Badge key={i} className="bg-purple-500/20 text-purple-300 border-purple-500/30 px-4 py-1.5 font-black text-sm rounded-full">
                        #{tag.replace('#', '')}
                      </Badge>
                    ))
                  ) : (
                    <Badge className="bg-white/10 text-white border-white/20 px-4 py-1.5 font-bold rounded-full">누적 수강생 3.5만+</Badge>
                  )}
                </div>
              </div>
            </div>
            {/* BG Decor */}
            <div className="absolute left-0 bottom-0 w-64 h-64 bg-purple-600/20 blur-[100px]" />
          </section>

          {/* Reviews Section */}
          <section id="reviews" className="space-y-10">
            <div className="space-y-4">
              <Badge className="bg-yellow-50 text-yellow-600 border-none font-black px-4 py-1 uppercase">REVIEWS</Badge>
              <h2 className="text-4xl font-black tracking-tighter text-gray-900">먼저 앞서간{'\n'}수강생들의 솔직한 후기</h2>
            </div>
            
            <CourseReviews courseId={id || ''} />
          </section>

          {/* Placeholder sections for tabs */}
          <section id="materials" className="sr-only" />
        </div>
      </div>

      {/* Sticky Mobile Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex items-center justify-between z-50">
        <div>
          <p className="text-2xl font-black">{(course.discount_price || course.price || 0).toLocaleString()}원</p>
          <p className={cn("text-xs font-bold", isSoldOut ? "text-gray-400" : "text-red-500")}>
            {isSoldOut ? "모집 마감" : (course.category === 'special_offline' || course.category === 'beone_exclusive_offline') && course.max_capacity ? `선착순 ${course.max_capacity - enrolledCount}석 남음!` : "마감 임박!"}
          </p>
        </div>
        <div className="flex-1">
          {isEnrolled ? (
            <Button 
              size="lg" 
              className="w-full h-14 bg-green-600 text-white font-black rounded-2xl"
              onClick={() => navigate(`/course/${course.id}/learn`)}
            >
              이어학습
            </Button>
          ) : isSoldOut ? (
            <Button 
              size="lg" 
              disabled
              className="w-full h-14 bg-gray-200 text-gray-500 font-black rounded-2xl"
            >
              마감됨
            </Button>
          ) : !user ? (
            <Button 
              size="lg" 
              className="w-full h-14 bg-purple-600 text-white font-black rounded-2xl"
              onClick={() => navigate('/auth/login')}
            >
              로그인 후 신청
            </Button>
          ) : (
            <PaymentButton 
              lecture={{
                id: course.id,
                title: course.title,
                price: course.discount_price || course.price || 0
              }}
              user={{
                id: user.id,
                email: user.email || '',
                name: user.name || user.email?.split('@')[0] || '수강생'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
