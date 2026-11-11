import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PlayCircle,
  CheckCircle2,
  Star,
  Clock,
  Calendar,
  MessageSquare,
  Trophy,
  Video,
  Trash2,
  Edit2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

function CourseReviews({ courseId }: { courseId: string }) {
  const { user } = useAuthStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editRating, setEditRating] = useState(5);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const loadReviews = async () => {
    try {
      const allReviews = await reviewService.getReviews();
      setReviews(allReviews.filter(r => r.course_id === courseId));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [courseId]);

  const handleSaveEdit = async (reviewId: string) => {
    if (!editContent.trim()) {
      toast.error('후기 내용을 입력해주세요.');
      return;
    }
    try {
      setIsSubmittingEdit(true);
      await reviewService.updateReview(reviewId, {
        content: editContent,
        rating: editRating
      });
      toast.success('수강후기가 수정되었습니다.');
      setEditingId(null);
      loadReviews();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || '수강후기 수정에 실패했습니다.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!window.confirm('정말로 이 수강후기를 삭제하시겠습니까?')) {
      return;
    }
    try {
      await reviewService.deleteReview(reviewId);
      toast.success('수강후기가 삭제되었습니다.');
      loadReviews();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || '수강후기 삭제에 실패했습니다.');
    }
  };

  if (loading) return <div className="py-10 text-center text-slate-400 font-bold text-sm">후기 데이터를 불러오는 중...</div>;

  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
      {reviews.length === 0 ? (
        <div className="col-span-full py-14 sm:py-20 text-center bg-slate-50 rounded-2xl sm:rounded-[32px] border border-dashed border-slate-200">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 font-bold text-sm">아직 작성된 후기가 없습니다.</p>
        </div>
      ) : (
        reviews.map(review => {
          const isOwner = user && user.id === review.user_id;
          const isEditing = editingId === review.id;

          return (
            <div key={review.id} className="relative bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border border-slate-100 shadow-xs space-y-4 flex flex-col justify-between group">
              {isEditing ? (
                <div className="space-y-4 w-full text-left">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        onClick={() => setEditRating(s)}
                        className={`w-5 h-5 cursor-pointer transition-all ${s <= editRating ? 'fill-current text-amber-500' : 'text-slate-200'}`}
                      />
                    ))}
                  </div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-800 focus:outline-none focus:border-purple-500 transition-all text-sm min-h-[100px] resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => setEditingId(null)}
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs font-bold h-9"
                    >
                      취소
                    </Button>
                    <Button
                      onClick={() => handleSaveEdit(review.id)}
                      size="sm"
                      disabled={isSubmittingEdit}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold h-9"
                    >
                      {isSubmittingEdit ? '저장 중...' : '저장'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 text-left">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'text-slate-200'}`} />
                    ))}
                  </div>
                  <p className="text-slate-700 text-sm sm:text-base leading-relaxed font-medium break-keep">
                    "{review.content}"
                  </p>

                  {(isOwner || isAdmin) && (
                    <div className="flex items-center gap-2 pt-3 border-t border-dashed border-slate-100">
                      {isOwner && (
                        <button
                          onClick={() => {
                            setEditingId(review.id);
                            setEditContent(review.content);
                            setEditRating(review.rating);
                          }}
                          className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-bold bg-purple-50 hover:bg-purple-100/80 px-3 py-1.5 rounded-xl transition-all"
                          title="수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          수정
                        </button>
                      )}
                      {(isOwner || isAdmin) && (
                        <button
                          onClick={() => handleDelete(review.id)}
                          className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-bold bg-rose-50 hover:bg-rose-100/80 px-3 py-1.5 rounded-xl transition-all"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          삭제
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100 text-left">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 overflow-hidden shrink-0">
                  <img
                    src={review.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.user_id}`}
                    referrerPolicy="no-referrer"
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                      {review.user_name || '익명 수강생'}
                    </p>
                    {isOwner && (
                      <Badge className="bg-purple-50 text-purple-600 border border-purple-100 text-[9px] font-black rounded-md px-1.5 py-0">
                        내 후기
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-slate-400 tabular-nums">
                    {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
                  </p>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

const ROLE_RANK: Record<string, number> = {
  user: 0,
  regular_member: 1,
  paid_member: 2,
  beone_member: 3,
  bione_member: 3,
  admin: 100,
  super_admin: 100,
};

export default function CourseDetail() {
  const { user } = useAuthStore();
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 120;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    async function loadCourse() {
      if (!id) return;
      try {
        const data = await courseService.getCourseById(id);

        if (data.instructor_id && (!data.instructor_tags || data.instructor_tags.length === 0)) {
          try {
            const instructor = await instructorService.getInstructor(data.instructor_id);
            if (instructor && instructor.tags && instructor.tags.length > 0) {
              data.instructor_tags = instructor.tags;
              courseService.updateCourse(data.id, { instructor_tags: instructor.tags }).catch(e => console.warn('Silent sync failed:', e));
            }
          } catch (e) {
            console.warn('Fallback instructor fetch failed:', e);
          }
        }

        setCourse(data);

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

    loadCourse();
  }, [id, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }
  if (!course) {
    return <div className="min-h-screen flex items-center justify-center font-bold">강의를 찾을 수 없습니다.</div>;
  }

  const isOffline =
    course.category === 'special_offline' ||
    course.category === 'beone_exclusive_offline' ||
    course.category === 'offline' ||
    Boolean(course.category && course.category.includes('offline'));
  const hasRegEnded = course.reg_end_date ? new Date() > new Date(course.reg_end_date) : false;
  const isSoldOut = course.is_force_closed || hasRegEnded || (
    isOffline &&
    course.max_capacity !== null &&
    course.max_capacity !== undefined &&
    enrolledCount >= course.max_capacity
  );

  const isBeOneCourse =
    course.category === 'beone_exclusive' ||
    course.category === 'beone_exclusive_online' ||
    course.category === 'beone_exclusive_offline' ||
    course.min_member_grade === 'beone_member' ||
    course.min_member_grade === 'bione_member';

  const userRank = user ? (ROLE_RANK[user.role || 'user'] || 0) : 0;
  const isAdminUser = Boolean(user && (user.role === 'admin' || user.role === 'super_admin'));

  const handleDirectFreeEnroll = async () => {
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
  };

  const renderPrimaryAction = (compact: boolean) => {
    const btnHeight = compact ? 'h-12 text-sm sm:text-base rounded-xl' : 'h-16 text-lg sm:text-xl rounded-2xl';

    if (isBeOneCourse) {
      const isGradeAuthorized = userRank >= 3 || isAdminUser;
      if (!isGradeAuthorized) {
        return (
          <div className={cn(
            'flex-1 bg-purple-50 text-purple-700 border border-purple-200 text-center font-extrabold leading-snug tracking-tight flex items-center justify-center',
            compact ? 'px-3 py-2.5 rounded-xl text-xs' : 'p-5 rounded-2xl text-[15px]'
          )}>
            {compact ? '비원 멤버십 전용 강의' : '비원아카데미 회원으로 가입하시면 이용하실 수 있습니다.'}
          </div>
        );
      }
      if (isOffline) {
        return (
          <div className={cn(
            'flex-1 bg-green-50 text-green-700 border border-green-200 text-center font-extrabold flex items-center justify-center',
            compact ? 'h-12 px-3 rounded-xl text-xs' : 'p-5 rounded-2xl text-[15px]'
          )}>
            현장 강좌 신청완료
          </div>
        );
      }
      return (
        <Button
          size="lg"
          className={cn('w-full flex-1 bg-purple-600 hover:bg-purple-700 text-white font-black shadow-lg shadow-purple-200/70', btnHeight)}
          onClick={() => navigate(`/course/${course.id}/learn`)}
        >
          강의실 입장하기
        </Button>
      );
    }

    if (course.min_member_grade) {
      const requiredRank = ROLE_RANK[course.min_member_grade] || 0;
      const isGradeAuthorized = userRank >= requiredRank || isAdminUser;
      if (!isGradeAuthorized) {
        return (
          <div className={cn(
            'flex-1 bg-purple-50 text-purple-700 border border-purple-200 text-center font-extrabold leading-snug tracking-tight flex items-center justify-center',
            compact ? 'px-3 py-2.5 rounded-xl text-xs' : 'p-5 rounded-2xl text-[15px]'
          )}>
            {compact ? '회원 등급 전용 강의' : '비원아카데미 회원으로 가입하시면 이용하실 수 있습니다.'}
          </div>
        );
      }
      if (isEnrolled) {
        if (isOffline) {
          return (
            <div className={cn(
              'flex-1 bg-green-50 text-green-700 border border-green-200 text-center font-extrabold flex items-center justify-center',
              compact ? 'h-12 px-3 rounded-xl text-xs' : 'p-5 rounded-2xl text-[15px]'
            )}>
              현장 강좌 신청완료
            </div>
          );
        }
        return (
          <Button
            size="lg"
            className={cn('w-full flex-1 bg-green-600 hover:bg-green-700 text-white font-black shadow-lg shadow-green-200/70', btnHeight)}
            onClick={() => navigate(`/course/${course.id}/learn`)}
          >
            강의 이어학습하기
          </Button>
        );
      }
      return (
        <Button
          size="lg"
          className={cn('w-full flex-1 bg-purple-600 hover:bg-purple-700 text-white font-black shadow-lg shadow-purple-200/70', btnHeight)}
          onClick={handleDirectFreeEnroll}
        >
          내강의실에 등록하기
        </Button>
      );
    }

    if (isEnrolled) {
      if (isOffline) {
        return (
          <div className={cn(
            'flex-1 bg-green-50 text-green-700 border border-green-200 text-center font-extrabold flex items-center justify-center',
            compact ? 'h-12 px-3 rounded-xl text-xs' : 'p-5 rounded-2xl text-[15px]'
          )}>
            현장 강좌 신청완료
          </div>
        );
      }
      return (
        <Button
          size="lg"
          className={cn('w-full flex-1 bg-green-600 hover:bg-green-700 text-white font-black shadow-lg shadow-green-200/70', btnHeight)}
          onClick={() => navigate(`/course/${course.id}/learn`)}
        >
          강의 이어학습하기
        </Button>
      );
    }

    if (isSoldOut) {
      return (
        <Button
          size="lg"
          disabled
          className={cn('w-full flex-1 bg-slate-200 text-slate-500 font-black cursor-not-allowed', btnHeight)}
        >
          {hasRegEnded ? '접수 마감' : '모집 마감'}
        </Button>
      );
    }

    if (course.is_free) {
      return (
        <Button
          size="lg"
          className={cn('w-full flex-1 bg-purple-600 hover:bg-purple-700 text-white font-black shadow-lg shadow-purple-200/70', btnHeight)}
          onClick={handleDirectFreeEnroll}
        >
          {compact ? '무료 수강하기' : '지금 바로 무료 수강하기'}
        </Button>
      );
    }

    return (
      <PaymentButton
        compact={compact}
        lecture={{
          id: course.id,
          title: course.title,
          price: course.discount_price || course.price || 0
        }}
        user={user ? {
          id: user.id,
          email: user.email || '',
          name: user.name || user.email?.split('@')[0] || '수강생'
        } : null}
      />
    );
  };

  const categoryLabel =
    course.category === 'regular' ? '정규강의' :
    course.category === 'special_online' ? '온라인 특강' :
    course.category === 'special_offline' ? '오프라인 특강' :
    course.category === 'special' ? '특강' :
    course.category === 'beone_exclusive_online' ? '온라인 전용' :
    course.category === 'beone_exclusive_offline' ? '오프라인 전용' :
    course.category === 'beone_exclusive' ? '비원 전용' : '라이브';

  const durationLabel = course.is_duration_based
    ? (course.start_date && new Date() < new Date(course.start_date)
        ? `개시일(${new Date(course.start_date).toLocaleDateString()})로부터 ${course.duration_days}일`
        : `결제일로부터 ${course.duration_days}일`)
    : course.start_date && course.end_date
      ? `${new Date(course.start_date).toLocaleDateString()} ~ ${new Date(course.end_date).toLocaleDateString()}`
      : '상시 수강';

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-0">
      {/* Hero Section */}
      <section
        className="pt-8 pb-10 sm:pt-14 sm:pb-16 md:pt-20 md:pb-28 relative overflow-hidden transition-colors duration-500"
        style={{
          backgroundColor: course.hero_bg_color || '#0f172a',
          color: course.hero_text_color || '#ffffff'
        }}
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          {course.hero_image ? (
            <img src={course.hero_image} referrerPolicy="no-referrer" className="w-full h-full object-cover blur-sm" alt="" />
          ) : course.thumbnail ? (
            <div className="absolute top-0 right-0 w-full lg:w-1/2 h-full">
              <img src={course.thumbnail} referrerPolicy="no-referrer" className="w-full h-full object-cover blur-2xl" alt="" />
            </div>
          ) : (
            <div className="w-full h-full bg-slate-800 blur-2xl" />
          )}
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-start">
            <div className="flex-1 space-y-5 sm:space-y-7 w-full">
              {/* Mobile Thumbnail Preview */}
              {course.thumbnail && (
                <div className="lg:hidden aspect-video w-full rounded-2xl overflow-hidden border border-white/15 shadow-xl mb-2">
                  <img
                    src={course.thumbnail}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    alt={course.title}
                  />
                </div>
              )}

              <div className="flex items-center gap-2.5 flex-wrap">
                {isSoldOut ? (
                  <Badge className="bg-slate-600 text-white font-extrabold border-none px-3 py-1 text-xs">
                    {hasRegEnded ? '접수 마감' : '모집 마감'}
                  </Badge>
                ) : (course.category === 'special_offline' || course.category === 'beone_exclusive_offline') && course.max_capacity ? (
                  <Badge className="bg-red-600 text-white font-extrabold border-none px-3 py-1 text-xs">
                    모집 인원 {course.max_capacity}명
                  </Badge>
                ) : (
                  <Badge className="bg-red-600 text-white font-extrabold border-none px-3 py-1 text-xs">
                    마감임박
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.2] lg:leading-[1.12] break-keep">
                {course.title}
              </h1>

              {course.description && (
                <p className="text-sm sm:text-lg md:text-xl font-medium leading-relaxed max-w-2xl opacity-85 break-keep">
                  {course.description}
                </p>
              )}

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-y-4 gap-x-6 sm:gap-8 items-start pt-4 border-t border-white/10">
                <div className="space-y-0.5">
                  <p className="opacity-55 text-[11px] font-bold uppercase tracking-wider">강사</p>
                  <p className="text-base sm:text-xl font-black">{course.instructor}</p>
                </div>
                <div className="space-y-0.5 sm:border-l sm:border-white/15 sm:pl-8">
                  <p className="opacity-55 text-[11px] font-bold uppercase tracking-wider">구분</p>
                  <p className="text-base sm:text-xl font-black">{categoryLabel}</p>
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-0.5 sm:border-l sm:border-white/15 sm:pl-8">
                  <p className="opacity-55 text-[11px] font-bold uppercase tracking-wider">수강 기간</p>
                  <p className="text-sm sm:text-xl font-black break-keep">{durationLabel}</p>
                </div>
              </div>
            </div>

            {/* Quick Purchase Card (Desktop) */}
            <div className="w-full lg:w-[420px] bg-white rounded-[40px] shadow-2xl p-8 sticky top-28 text-slate-900 border border-slate-100 hidden lg:block">
              <div className="aspect-video rounded-3xl overflow-hidden mb-8 relative border border-slate-100">
                {course.thumbnail ? (
                  <img src={course.thumbnail} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt={course.title} />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    {isOffline ? (
                      <Calendar className="w-12 h-12 text-slate-300" />
                    ) : (
                      <Video className="w-12 h-12 text-slate-300" />
                    )}
                  </div>
                )}
                {!isOffline && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <PlayCircle className="w-16 h-16 text-white drop-shadow-2xl" />
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold break-keep">{durationLabel}</span>
                  </div>
                  {!(course.category === 'beone_exclusive_online' || course.category === 'beone_exclusive_offline') ? (
                    <div className="text-right shrink-0 tabular-nums">
                      {course.discount_price && course.discount_price < (course.price || 0) && (
                        <p className="text-slate-400 line-through text-sm font-bold">{(course.price || 0).toLocaleString()}원</p>
                      )}
                      <p className="text-3xl font-black tracking-tight">
                        {course.is_free ? '무료' : `${(course.discount_price || course.price || 0).toLocaleString()}원`}
                      </p>
                    </div>
                  ) : (
                    <div className="text-right shrink-0">
                      <p className="text-xl font-black text-purple-600 tracking-tight">비원 멤버십 전용</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  {renderPrimaryAction(false)}
                </div>
                <p className="text-center text-xs text-slate-400 font-bold">
                  카드 결제, 계좌이체 가능 · 지금 바로 수강 시작
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Section Tabs */}
      <div
        ref={tabsRef}
        className="sticky top-14 sm:top-16 lg:top-20 bg-white/95 backdrop-blur-md border-b border-slate-100 z-30"
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-6 sm:gap-10 h-12 sm:h-14 overflow-x-auto no-scrollbar">
            {[
              { name: '강의소개', id: 'intro' },
              { name: '커리큘럼', id: 'curriculum' },
              { name: '강사소개', id: 'instructor' },
              { name: '수강후기', id: 'reviews' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => scrollToSection(tab.id)}
                className="whitespace-nowrap font-extrabold text-sm sm:text-[15px] text-slate-500 hover:text-purple-600 transition-colors border-b-2 border-transparent h-full px-1 focus:text-purple-600 focus:border-purple-600 cursor-pointer"
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container mx-auto px-4 py-10 sm:py-16 md:py-20 flex flex-col lg:flex-row gap-12 lg:gap-20">
        <div className="flex-1 space-y-14 sm:space-y-20 md:space-y-28 min-w-0">
          {/* Dynamic Design from Admin CMS */}
          {course.layout && course.layout.blocks.length > 0 ? (
            <section id="intro" className="space-y-6 sm:space-y-10 max-w-[1000px] w-full mx-auto md:px-4 px-0">
              <DynamicCourseRenderer blocks={course.layout.blocks} />
            </section>
          ) : (
            <section id="intro" className="space-y-6 sm:space-y-10">
              <div className="space-y-3">
                <p className="text-purple-600 font-extrabold text-xs tracking-wide uppercase">INTRO</p>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900">
                  본 강의를 소개합니다
                </h2>
                {course.description && (
                  <p className="text-sm sm:text-lg text-slate-600 leading-relaxed whitespace-pre-wrap pt-2 break-keep">
                    {course.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 pt-4 sm:pt-8">
                {(course.outcomes && course.outcomes.length > 0 && course.outcomes[0] !== '') ? (
                  course.outcomes.map((text, i) => (
                    <div key={i} className="flex gap-3.5 p-5 sm:p-7 bg-slate-50 rounded-2xl sm:rounded-[28px] items-start border border-slate-100">
                      <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center shrink-0">
                        <CheckCircle2 className="text-white w-4.5 h-4.5" />
                      </div>
                      <p className="text-sm sm:text-lg font-extrabold text-slate-800 leading-snug pt-1 break-keep">{text}</p>
                    </div>
                  ))
                ) : (
                  [
                    '체계적인 실무 프로세스 완벽 습득',
                    '현업 최고 수준의 결과물 포트폴리오 구축',
                    '평생 소장 가능한 실무 템플릿 제공',
                    '수강생 전용 프라이빗 커뮤니티 권한'
                  ].map((text, i) => (
                    <div key={i} className="flex gap-3.5 p-5 sm:p-7 bg-slate-50 rounded-2xl sm:rounded-[28px] items-start border border-slate-100">
                      <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center shrink-0">
                        <Trophy className="text-white w-4.5 h-4.5" />
                      </div>
                      <p className="text-sm sm:text-lg font-extrabold text-slate-800 leading-snug pt-1 break-keep">{text}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* Recommended Section */}
          {(course.recommended_for && course.recommended_for.length > 0 && course.recommended_for[0] !== '') && (
            <section id="recommended" className="space-y-6 sm:space-y-10">
              <div className="space-y-2.5">
                <p className="text-purple-600 font-extrabold text-xs tracking-wide uppercase">TARGET</p>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 whitespace-pre-line break-keep">
                  {'이런 분들이 들으면\n인생이 바뀝니다'}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                {course.recommended_for.map((text, i) => (
                  <div key={i} className="flex items-center gap-4 sm:gap-6 p-5 sm:p-7 bg-white border border-slate-100 rounded-2xl sm:rounded-[28px] hover:border-purple-200 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-black text-sm shrink-0 tabular-nums">
                      {i + 1}
                    </div>
                    <p className="text-sm sm:text-lg md:text-xl font-bold text-slate-800 break-keep">{text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section: Curriculum */}
          <section id="curriculum" className="space-y-6 sm:space-y-10 scroll-mt-28">
            <div className="space-y-2.5">
              <p className="text-purple-600 font-extrabold text-xs tracking-wide uppercase">CURRICULUM</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 whitespace-pre-line break-keep">
                {'당신을 전문가로 만들어 줄\n압도적인 커리큘럼'}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:gap-6">
              {course.curriculum?.map((section) => (
                <div key={section.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <p className="text-sm sm:text-base font-black text-purple-600 tracking-tight break-keep">
                      {section.title}
                    </p>
                    <span className="text-xs text-slate-400 font-bold shrink-0 tabular-nums">
                      {isOffline ? `${section.items.length}개 세션` : `${section.items.length}강`}
                    </span>
                  </div>
                  <div className="bg-white rounded-2xl sm:rounded-[28px] border border-slate-100 shadow-xs overflow-hidden divide-y divide-slate-100">
                    {section.items.map((item, itemIdx) => {
                      if (isOffline) {
                        return (
                          <div
                            key={item.id}
                            className="w-full px-4 sm:px-7 py-4 sm:py-5 flex items-start gap-3 sm:gap-4 text-left hover:bg-slate-50/60 transition-colors"
                          >
                            <span className="text-xs sm:text-sm font-black text-purple-600 shrink-0 pt-0.5 select-none font-mono tabular-nums">
                              {String(itemIdx + 1).padStart(2, '0')}.
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold sm:font-extrabold tracking-tight break-keep text-sm sm:text-base text-slate-800 leading-relaxed">
                                {item.title}
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={item.id}
                          className="w-full p-4 sm:p-5 flex items-center justify-between text-left relative hover:bg-slate-50/60 transition-colors"
                        >
                          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                            <span className="text-xs font-black w-5 shrink-0 text-slate-400 font-mono tabular-nums">
                              {String(itemIdx + 1).padStart(2, '0')}
                            </span>
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 bg-purple-50 text-purple-600">
                              <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <p className="font-bold sm:font-extrabold tracking-tight break-keep text-sm sm:text-base text-slate-800">
                                {item.title}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-400 tabular-nums">
                                  {item.duration || '00:00'}
                                </span>
                                {item.is_free && (
                                  <Badge className="h-4 px-1.5 text-[9px] bg-purple-100 text-purple-600 border-none font-black uppercase">
                                    Free
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Instructor Section */}
          <section id="instructor" className="bg-slate-900 text-white rounded-3xl md:rounded-[44px] p-6 sm:p-10 md:p-16 relative overflow-hidden scroll-mt-28">
            <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-10 md:gap-12 text-center md:text-left">
              <div className="w-24 h-24 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-full border-4 sm:border-8 border-white/10 overflow-hidden shrink-0">
                <img
                  src={course.instructor_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${course.instructor}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  alt={course.instructor}
                />
              </div>
              <div className="space-y-4 sm:space-y-6">
                <div className="space-y-1">
                  <p className="text-purple-400 font-bold tracking-wide text-xs sm:text-sm">
                    {course.instructor_title || '비원아카데미 마스터'}
                  </p>
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-black">{course.instructor} 강사님</h3>
                </div>
                <p className="text-sm sm:text-lg md:text-xl text-slate-300 font-medium leading-relaxed whitespace-pre-wrap break-keep">
                  {course.instructor_bio || `"본 강의는 단순한 지식 전달이 아니라, 현업에서 직접 검증한 실전 노하우를 담았습니다. 여러분의 시간이 헛되지 않게 가이드하겠습니다."`}
                </p>
                <div className="flex flex-wrap justify-center md:justify-start gap-2">
                  {course.instructor_tags && course.instructor_tags.length > 0 ? (
                    course.instructor_tags.map((tag, i) => (
                      <span key={i} className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 font-bold text-xs sm:text-sm rounded-full">
                        #{tag.replace('#', '')}
                      </span>
                    ))
                  ) : null}
                </div>
              </div>
            </div>
            <div className="absolute left-0 bottom-0 w-64 h-64 bg-purple-600/20 blur-[100px] pointer-events-none" />
          </section>

          {/* Reviews Section */}
          <section id="reviews" className="space-y-6 sm:space-y-10 scroll-mt-28">
            <div className="space-y-2.5">
              <p className="text-amber-600 font-extrabold text-xs tracking-wide uppercase">REVIEWS</p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 whitespace-pre-line break-keep">
                {'먼저 앞서간\n수강생들의 솔직한 후기'}
              </h2>
            </div>

            <CourseReviews courseId={id || ''} />
          </section>
        </div>
      </div>

      {/* Sticky Mobile Bottom Purchase Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-40 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-4 max-w-2xl mx-auto">
          <div className="shrink-0 tabular-nums">
            {!(course.category === 'beone_exclusive_online' || course.category === 'beone_exclusive_offline') ? (
              <>
                <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                  {course.is_free ? '무료' : `${(course.discount_price || course.price || 0).toLocaleString()}원`}
                </p>
                <p className={cn('text-[11px] font-bold mt-0.5', isSoldOut ? 'text-slate-400' : 'text-purple-600')}>
                  {isSoldOut
                    ? (hasRegEnded ? '접수 마감' : '모집 마감')
                    : isOffline && course.max_capacity
                      ? `모집 인원 ${course.max_capacity}명`
                      : '지금 바로 신청 가능'}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-black text-purple-600">비원 전용</p>
                <p className="text-[11px] text-slate-500 font-semibold">멤버십 강의</p>
              </>
            )}
          </div>
          <div className="flex-1 max-w-[240px]">
            {renderPrimaryAction(true)}
          </div>
        </div>
      </div>
    </div>
  );
}
