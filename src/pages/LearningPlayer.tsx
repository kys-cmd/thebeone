import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { 
  ChevronLeft, 
  Menu, 
  PlayCircle, 
  CheckCircle2, 
  MessageSquare,
  FileText,
  ChevronRight,
  User,
  Star,
  Send,
  Trash2,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { courseService } from '@/services/courseService';
import { reviewService, Review } from '@/services/reviewService';
import { accessService } from '@/services/accessService';
import { Course, CurriculumItem } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { getVimeoEmbedUrl } from '@/lib/vimeo';

export default function LearningPlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [activeItem, setActiveItem] = useState<CurriculumItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Lesson progress tracking states
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  // Review states
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Review edit states
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editReviewContent, setEditReviewContent] = useState('');
  const [editReviewRating, setEditReviewRating] = useState(5);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Vimeo tracking player refs
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const vimeoPlayerRef = useRef<any>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const activeItemRef = useRef<CurriculumItem | null>(null);

  const vimeoSrc = activeItem?.vimeo_id ? getVimeoEmbedUrl(activeItem.vimeo_id, { autoplay: 1 }) : null;

  useEffect(() => {
    activeItemRef.current = activeItem;
  }, [activeItem]);

  // Vimeo controller tracking hook
  useEffect(() => {
    if (!activeItem || loading || !course) return;

    let isMounted = true;
    let timerId: any = null;
    let isInitializing = false;

    // Load Vimeo player API script if not loaded
    let script = document.querySelector('script[src="https://player.vimeo.com/api/player.js"]');
    if (!script) {
      script = document.createElement('script');
      script.setAttribute('src', 'https://player.vimeo.com/api/player.js');
      document.head.appendChild(script);
    }

    const initVimeoPlayer = () => {
      if (!isMounted) return;
      if (isInitializing) return;

      if (!(window as any).Vimeo || !iframeRef.current || !(window as any).Vimeo.Player) {
        timerId = setTimeout(initVimeoPlayer, 200);
        return;
      }

      const currentIframe = iframeRef.current;
      if (!currentIframe) return;

      // iframe의 src가 유효하지 않거나 비메오 플레이어가 아닌 경우, SDK 연동을 생략합니다.
      if (!vimeoSrc || !vimeoSrc.includes("player.vimeo.com")) {
        console.warn("Iframe is not loading a valid Vimeo Player URL. Skipping SDK initialization.");
        return;
      }

      isInitializing = true;

      if (vimeoPlayerRef.current) {
        try {
          const oldPlayer = vimeoPlayerRef.current;
          oldPlayer.off('play');
          oldPlayer.off('timeupdate');
          oldPlayer.off('ended');
          oldPlayer.destroy()
            .catch((e: any) => console.warn('Vimeo destroy promise warning:', e));
        } catch (e) {
          console.warn('Vimeo cleanup warning:', e);
        }
        vimeoPlayerRef.current = null;
      }

      // 비동기 600ms 대기를 추가하여 브라우저가 iframe의 자원 로드를 시작할 타이밍을 벌어줍니다.
      // 이렇게 하면 iframe 생성 직후 SDK가 바인딩되어 메인 루프를 방해하거나 블랙 스크린이 발생하는 레이스 컨디션을 완벽히 해결합니다.
      timerId = setTimeout(() => {
        if (!isMounted) {
          isInitializing = false;
          return;
        }

        let player: any;
        try {
          player = new (window as any).Vimeo.Player(currentIframe);
          vimeoPlayerRef.current = player;
        } catch (err) {
          console.error('Failed to initialize Vimeo Player SDK:', err);
          isInitializing = false;
          return;
        }
        
        lastSavedTimeRef.current = 0;

        // Send start/progress/complete event to backend
        const reportProgress = async (evType: 'start' | 'progress' | 'complete', curTime: number) => {
          if (!isMounted) return;
          try {
            const currentItem = activeItemRef.current;
            if (!currentItem) return;
            const session = (await supabase.auth.getSession()).data.session;
            if (!session) return;

            const response = await fetch('/api/video/progress', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                courseId: id,
                lessonId: currentItem.id,
                event: evType,
                watchedTime: Math.floor(curTime)
              })
            });
            const result = await response.json();
            if (result.status === 'db_table_missing' && isMounted) {
              const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
              if (isAdmin) {
                toast.error(
                  <div className="space-y-2 text-left">
                    <p className="font-bold whitespace-pre-wrap">⚠️ 진도 테이블(lesson_progress)이 아직 생성되지 않았습니다.</p>
                    <p className="text-xs opacity-90 p-2 bg-red-50 text-red-700 rounded border border-red-200 leading-relaxed">
                      현재 학습 상태는 브라우저 로컬 저장소에 안전하게 자동 저장 중입니다. 전체 서버 저장을 완료하려면 다음 스텝을 실행해 주세요: <br/>
                      1. 루트의 <strong>"supabase_rls_fix.sql"</strong> 파일의 내용을 전체 복사하세요. <br/>
                      2. Supabase <strong>SQL Editor</strong>에 붙여넣고 <strong>Run</strong>을 클릭해 테이블과 RLS를 적용하세요.
                    </p>
                  </div>,
                  { duration: 15000, id: 'db-table-missing-alert' }
                );
              }
              // Still mark completed lessons locally so the UI updates
              if (evType === 'complete' && isMounted) {
                setCompletedLessons(prev => {
                  const updated = new Set(prev);
                  updated.add(currentItem.id);
                  return updated;
                });
                toast.info('학습 진도가 임시 완료(로컬 저장)로 기록되었습니다.');
              }
            } else if (evType === 'complete' && result.status === 'success' && isMounted) {
              setCompletedLessons(prev => {
                const updated = new Set(prev);
                updated.add(currentItem.id);
                return updated;
              });
              toast.success('학습 진도가 100% 완료로 기록되었습니다!');
            }
          } catch (error) {
            console.error(`Failed to report video ${evType} progress:`, error);
          }
        };

        player.ready().then(() => {
          if (!isMounted) {
            isInitializing = false;
            return;
          }
          
          // 1. Recover last position if exists
          const loadLastPosition = async () => {
            try {
              const currentItem = activeItemRef.current;
              if (!currentItem || !user || !isMounted) return;
              const progressList = await accessService.getCourseProgress(id!, user.id);
              const thisProgress = progressList.find(p => p.lesson_id === currentItem.id);
              
              if (thisProgress && thisProgress.watched_time > 3 && !thisProgress.is_completed && isMounted) {
                player.setCurrentTime(thisProgress.watched_time)
                  .then(() => {
                    if (isMounted) {
                      toast.info(`이전 학습 위치 (약 ${Math.floor(thisProgress.watched_time)}초)에서 수업을 재개합니다.`);
                    }
                  })
                  .catch((err: any) => {
                    console.warn('Vimeo seek error:', err);
                  });
              }
            } catch (e) {
              console.error('Error resuming position:', e);
            }
          };
          
          loadLastPosition();

          player.on('play', function() {
            player.getCurrentTime()
              .then((t: number) => {
                if (isMounted) reportProgress('start', t);
              })
              .catch((err: any) => {
                console.warn('Vimeo play event getCurrentTime error:', err);
              });
          });

          player.on('timeupdate', function(data: any) {
            if (!isMounted) return;
            const cur = data.seconds;
            if (Math.abs(cur - lastSavedTimeRef.current) > 10) {
              lastSavedTimeRef.current = cur;
              reportProgress('progress', cur);
            }
          });

          player.on('ended', function() {
            player.getCurrentTime()
              .then((t: number) => {
                if (isMounted) reportProgress('complete', t);
              })
              .catch((err: any) => {
                console.warn('Vimeo ended event getCurrentTime error:', err);
              });
          });
          
          isInitializing = false;
        }).catch((err: any) => {
          console.warn('Vimeo player is not ready or blocked:', err);
          isInitializing = false;
        });
      }, 600);
    };

    if ((window as any).Vimeo) {
      initVimeoPlayer();
    } else {
      script.addEventListener('load', initVimeoPlayer);
    }

    return () => {
      isMounted = false;
      if (timerId) {
        clearTimeout(timerId);
      }
      script?.removeEventListener('load', initVimeoPlayer);
      if (vimeoPlayerRef.current) {
        try {
          const oldPlayer = vimeoPlayerRef.current;
          oldPlayer.off('play');
          oldPlayer.off('timeupdate');
          oldPlayer.off('ended');
          oldPlayer.destroy()
            .catch((e: any) => {
              // Ignore player unmounted destroy errors safely
            });
        } catch (e) {}
        vimeoPlayerRef.current = null;
      }
    };
  }, [activeItem, loading, course, vimeoSrc]);

  const toggleLessonCompletion = async (lessonId: string) => {
    if (!id || !user || isSavingProgress) return;
    const isCompleted = completedLessons.has(lessonId);
    const newCompleted = !isCompleted;

    // Optimistically update UI
    setCompletedLessons(prev => {
      const updated = new Set(prev);
      if (newCompleted) {
        updated.add(lessonId);
      } else {
        updated.delete(lessonId);
      }
      return updated;
    });

    try {
      setIsSavingProgress(true);
      const success = await accessService.updateLessonProgress(id, lessonId, newCompleted, 0, user.id);
      if (success) {
        toast.success(newCompleted ? '진도율기록: 수강 완료!' : '수강 완료 취소 완료');
      } else {
        throw new Error('수강 완료 저장 실패');
      }
    } catch (err) {
      console.error(err);
      toast.error('수강 진도 업데이트에 실패했습니다.');
      // Revert optimistic UI
      setCompletedLessons(prev => {
        const reverted = new Set(prev);
        if (isCompleted) {
          reverted.add(lessonId);
        } else {
          reverted.delete(lessonId);
        }
        return reverted;
      });
    } finally {
      setIsSavingProgress(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchCourseData();
    fetchReviews();
  }, [id]);

  const fetchReviews = async () => {
    try {
      const data = await reviewService.getReviewsByCourseId(id!);
      setReviews(data);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!reviewContent.trim()) {
      toast.error('후기 내용을 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      await reviewService.createReview({
        course_id: id,
        course_title: course?.title,
        user_id: user.id,
        user_name: user.nickname || user.name,
        user_avatar: user.avatar_url || undefined,
        content: reviewContent,
        rating: rating,
        is_best: false,
        is_deleted: false
      });
      
      toast.success('수강후기가 등록되었습니다.');
      setReviewContent('');
      setRating(5);
      fetchReviews();
    } catch (error) {
       console.error('Review submission error:', error);
       toast.error('후기 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveReviewEdit = async (reviewId: string) => {
    if (!editReviewContent.trim()) {
      toast.error('후기 내용을 입력해주세요.');
      return;
    }
    try {
      setIsSubmittingEdit(true);
      await reviewService.updateReview(reviewId, {
        content: editReviewContent,
        rating: editReviewRating
      });
      toast.success('수강후기가 수정되었습니다.');
      setEditingReviewId(null);
      fetchReviews();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || '수강후기 수정에 실패했습니다.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('정말로 이 수강후기를 삭제하시겠습니까?')) {
      return;
    }
    try {
      await reviewService.deleteReview(reviewId);
      toast.success('수강후기가 삭제되었습니다.');
      fetchReviews();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || '수강후기 삭제에 실패했습니다.');
    }
  };

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      if (user) {
        const data = await courseService.getCourseById(id!);
        setCourse(data);

        const isAdmin = user.role === 'super_admin' || user.role === 'admin';
        if (!isAdmin) {
          const isBeOneCourse = data.category === 'beone_exclusive' || 
                                 data.category === 'beone_exclusive_online' || 
                                 data.category === 'beone_exclusive_offline' ||
                                 data.min_member_grade === 'beone_member' ||
                                 data.min_member_grade === 'bione_member';

          if (isBeOneCourse) {
            const ROLE_RANK: Record<string, number> = {
              'user': 0,
              'regular_member': 1,
              'paid_member': 2,
              'beone_member': 3,
              'bione_member': 3,
              'admin': 100,
              'super_admin': 100
            };
            const userRank = ROLE_RANK[user.role || 'user'] || 0;
            if (userRank < 3) {
              toast.error('비원아카데미 회원으로 가입하시면 이용하실 수 있습니다.');
              navigate(`/course/${id}`);
              return;
            }

            // check enrollment for BeOne exclusive courses, silently register if not enrolled
            const isEnrolled = await courseService.checkEnrollment(user.id, id!);
            if (!isEnrolled) {
              try {
                await courseService.enrollCourse(user.id, id!);
              } catch (err) {
                console.error('Silent enrollment for BeOne exclusive course failed:', err);
              }
            }
          } else {
            // Check general grade or enrollment restrictions
            const requiredGrade = data.min_member_grade;
            if (requiredGrade) {
              const ROLE_RANK: Record<string, number> = {
                'user': 0,
                'regular_member': 1,
                'paid_member': 2,
                'beone_member': 3,
                'bione_member': 3,
                'admin': 100,
                'super_admin': 100
              };
              const userRank = ROLE_RANK[user.role || 'user'] || 0;
              const requiredRank = ROLE_RANK[requiredGrade] || 0;
              if (userRank < requiredRank) {
                toast.error('해당 회원가입 등급을 획득하시면 수강이 가능한 강의입니다.');
                navigate(`/course/${id}`);
                return;
              }
            } else {
              const isEnrolled = await courseService.checkEnrollment(user.id, id!);
              if (!isEnrolled) {
                toast.error('수강 권한이 없습니다.');
                navigate(`/course/${id}`);
                return;
              }
            }
          }
        }
        
        // Load lesson progress
        const progressList = await accessService.getCourseProgress(id!, user.id);
        const completedSet = new Set(progressList.filter(p => p.is_completed).map(p => p.lesson_id));
        setCompletedLessons(completedSet);

        if (data.curriculum.length > 0 && data.curriculum[0].items.length > 0) {
          setActiveItem(data.curriculum[0].items[0]);
        }
      } else {
        navigate('/auth/login');
        return;
      }
    } catch (error) {
      console.error(error);
      toast.error('강의 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white font-black text-2xl animate-pulse">강의실 입장 중...</div>
      </div>
    );
  }

  if (!course) return null;

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 md:h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 md:px-6 shrink-0 z-50">
        <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
          <Link to="/mypage" className="text-gray-400 hover:text-white transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </Link>
          <div className="h-4 w-[1px] bg-gray-700 mx-1 md:mx-2 shrink-0" />
          <h1 className="text-white font-black text-xs md:text-base line-clamp-1">{course.title}</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-gray-400 hover:text-white h-8 w-8"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
        </div>
      </header>
 
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Player Area */}
        <main className="flex-1 overflow-y-auto bg-black flex flex-col scrollbar-hide">
          <div className="aspect-video w-full bg-black relative sticky top-0 z-20">
            {vimeoSrc ? (
              <iframe
                key={activeItem?.id}
                ref={iframeRef}
                src={vimeoSrc}
                className="absolute inset-0 w-full h-full"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                title={activeItem?.title}
              ></iframe>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-600 bg-gray-950">
                <div className="text-center space-y-4 p-4">
                  <PlayCircle className="w-12 h-12 md:w-20 md:h-20 mx-auto opacity-20" />
                  <p className="font-bold text-sm md:text-base">선택된 강의 영상이 없거나 준비 중입니다.</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6 md:space-y-10">
            <div className="space-y-2 md:space-y-4">
               <div className="flex items-center gap-2">
                  <Badge className="bg-purple-600 text-white border-none font-bold text-[10px]">COURSE</Badge>
                  <span className="text-gray-500 font-bold text-xs line-clamp-1">
                    Chapter. {activeItem ? course.curriculum.findIndex(s => s.items.some(i => i.id === activeItem.id)) + 1 : 1}
                  </span>
               </div>
               <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h2 className="text-xl md:text-3xl font-black text-white break-keep">{activeItem?.title || "강의를 선택해주세요."}</h2>
               </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:gap-8">
               <div className="space-y-6 md:space-y-8">
                  <section className="space-y-4">
                     <h3 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 md:w-5 md:h-5 text-purple-500" /> 강의 자료
                     </h3>
                     {course.materials && course.materials.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                           {course.materials.map((file) => (
                              <div 
                                key={file.id}
                                onClick={() => window.open(file.url, '_blank')}
                                className="bg-gray-900 border border-gray-800 rounded-2xl md:rounded-3xl p-4 md:p-6 flex items-center justify-between group cursor-pointer hover:border-purple-500 transition-all"
                              >
                                 <div className="flex items-center gap-3 md:gap-4 overflow-hidden text-left">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-800 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                                       <FileText className="w-5 h-5 md:w-6 md:h-6 text-gray-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                       <p className="text-white font-bold truncate text-sm md:text-base" title={file.name}>
                                          {file.name}
                                       </p>
                                       {file.size && (
                                          <p className="text-[10px] md:text-xs text-gray-500 font-medium">
                                             {(file.size / (1024 * 1024)).toFixed(2)} MB
                                          </p>
                                       )}
                                    </div>
                                 </div>
                                 <Button variant="ghost" size="sm" className="text-purple-400 font-black gap-1 shrink-0 text-xs">
                                    <span className="hidden sm:inline">다운로드</span> <ChevronRight className="w-4 h-4" />
                                 </Button>
                              </div>
                           ))}
                        </div>
                     ) : (
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl md:rounded-3xl p-8 md:p-12 text-center">
                           <FileText className="w-8 h-8 md:w-12 md:h-12 text-gray-800 mx-auto mb-4" />
                           <p className="text-gray-500 font-bold text-sm">등록된 강의 자료가 없습니다.</p>
                        </div>
                     )}
                  </section>

                  <section className="space-y-4 md:space-y-6">
                     <h3 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                        <Star className="w-4 h-4 md:w-5 md:h-5 text-yellow-500" /> 강의 후기
                     </h3>
                     
                     <div className="bg-gray-900 border border-gray-800 rounded-2xl md:rounded-3xl p-4 md:p-8 space-y-4 md:space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                           <p className="text-white font-bold text-sm text-left">강의는 어떠셨나요?</p>
                           <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((s) => (
                                 <Star 
                                   key={s} 
                                   onClick={() => setRating(s)}
                                   className={`w-5 h-5 md:w-6 md:h-6 cursor-pointer transition-all ${s <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-700'}`} 
                                 />
                              ))}
                           </div>
                        </div>
                        <div className="relative">
                           <textarea 
                             value={reviewContent}
                             onChange={(e) => setReviewContent(e.target.value)}
                             placeholder="강의에 대한 솔직한 후기를 남겨주세요."
                             className="w-full bg-gray-800 border border-gray-700 rounded-xl md:rounded-2xl p-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500 transition-all min-h-[100px] md:min-h-[120px] resize-none text-sm"
                           />
                           <div className="flex justify-end mt-2 md:absolute md:bottom-4 md:right-4">
                            <Button 
                              onClick={handleSubmitReview}
                              disabled={isSubmitting}
                              className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl gap-2 w-full md:w-auto h-10 md:h-11"
                            >
                              {isSubmitting ? "등록 중..." : "후기 등록"} <Send className="w-4 h-4" />
                            </Button>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-3 md:space-y-4">
                        {reviews.length > 0 ? (
                           reviews.map((review, idx) => {
                              const isOwner = user && user.id === review.user_id;
                              const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
                              const isEditing = editingReviewId === review.id;

                              return (
                                <motion.div 
                                  key={review.id || `review-${idx}`}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.05 }}
                                  className="relative bg-gray-900/50 border border-gray-800 p-4 md:p-6 rounded-2xl md:rounded-3xl space-y-3 md:space-y-4 text-left group"
                                >
                                   {isEditing ? (
                                      <div className="space-y-3 w-full">
                                         <div className="flex items-center gap-1 text-yellow-400">
                                            {[1, 2, 3, 4, 5].map((s) => (
                                               <Star 
                                                 key={s} 
                                                 onClick={() => setEditReviewRating(s)}
                                                 className={`w-5 h-5 cursor-pointer transition-all ${s <= editReviewRating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-700'}`} 
                                               />
                                            ))}
                                         </div>
                                         <textarea 
                                            value={editReviewContent}
                                            onChange={(e) => setEditReviewContent(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm min-h-[80px]"
                                         />
                                         <div className="flex justify-end gap-2">
                                            <Button 
                                              onClick={() => setEditingReviewId(null)} 
                                              variant="outline" 
                                              size="sm" 
                                              className="border-gray-700 hover:bg-gray-800 text-gray-300 rounded-xl text-xs font-bold h-8"
                                            >
                                               취소
                                            </Button>
                                            <Button 
                                              onClick={() => handleSaveReviewEdit(review.id)} 
                                              size="sm" 
                                              disabled={isSubmittingEdit}
                                              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold h-8"
                                            >
                                               {isSubmittingEdit ? '저장 중...' : '저장'}
                                            </Button>
                                         </div>
                                      </div>
                                   ) : (
                                      <>
                                         <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 md:gap-3">
                                               <img src={review.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.user_id}`} alt="" className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-800" />
                                               <div>
                                                  <div className="flex items-center gap-1.5">
                                                     <p className="text-white text-xs md:text-sm font-bold">{review.user_name}</p>
                                                     {isOwner && (
                                                        <span className="text-[10px] text-purple-400 bg-purple-950/40 border border-purple-900/50 px-1.5 py-0 rounded font-bold">내 후기</span>
                                                     )}
                                                  </div>
                                                  <p className="text-gray-500 text-[9px] md:text-[10px]">{review.created_at ? new Date(review.created_at).toLocaleDateString() : '방금 전'}</p>
                                               </div>
                                            </div>
                                            <div className="flex items-center gap-0.5">
                                               {[...Array(5)].map((_, i) => (
                                                  <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-800'}`} />
                                               ))}
                                            </div>
                                         </div>
                                         <p className="text-gray-300 text-xs md:text-sm leading-relaxed break-keep">
                                            {review.content}
                                         </p>

                                         {/* 별도 섹션: 수정 및 삭제 버튼 */}
                                         {(isOwner || isAdmin) && (
                                            <div className="flex items-center gap-2 pt-2 border-t border-dashed border-gray-800">
                                               {isOwner && (
                                                  <button 
                                                    onClick={() => {
                                                       setEditingReviewId(review.id);
                                                       setEditReviewContent(review.content);
                                                       setEditReviewRating(review.rating);
                                                    }}
                                                    className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-bold bg-purple-950/40 hover:bg-purple-900/50 px-2.5 py-1.5 rounded-xl transition-all shadow-sm"
                                                    title="수정"
                                                  >
                                                     <Edit2 className="w-3 h-3" />
                                                     수정
                                                  </button>
                                               )}
                                               {(isOwner || isAdmin) && (
                                                  <button 
                                                    onClick={() => handleDeleteReview(review.id)}
                                                    className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-bold bg-rose-950/40 hover:bg-rose-900/50 px-2.5 py-1.5 rounded-xl transition-all shadow-sm"
                                                    title="삭제"
                                                  >
                                                     <Trash2 className="w-3 h-3" />
                                                     삭제
                                                  </button>
                                               )}
                                            </div>
                                         )}
                                      </>
                                   )}
                                </motion.div>
                              );
                           })
                        ) : (
                           <div className="py-8 md:py-12 text-center bg-gray-900/30 rounded-2xl md:rounded-3xl border border-dashed border-gray-800">
                              <MessageSquare className="w-8 h-8 md:w-10 md:h-10 text-gray-800 mx-auto mb-3" />
                              <p className="text-gray-500 font-medium text-xs md:text-sm">아직 올라온 후기가 없습니다.<br/>첫 번째 후기의 주인공이 되어보세요!</p>
                           </div>
                        )}
                     </div>
                  </section>

                  <section className="bg-gray-900 border border-gray-800 rounded-2xl md:rounded-3xl p-6 md:p-8 space-y-4 md:space-y-6">
                     <h3 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                        <User className="w-4 h-4 md:w-5 md:h-5 text-purple-500" /> 강사 정보
                     </h3>
                     <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8">
                        <img 
                          src={course.instructor_image || "https://api.dicebear.com/7.x/avataaars/svg?seed=instructor"} 
                          className="w-24 h-24 md:w-32 md:h-32 rounded-2xl md:rounded-3xl object-cover bg-gray-800 border-2 border-gray-800 shadow-2xl" 
                          alt="" 
                        />
                        <div className="flex-1 space-y-2 md:space-y-4 text-center md:text-left">
                           <div>
                              <p className="text-xl md:text-2xl font-black text-white">{course.instructor}</p>
                              <p className="text-purple-400 font-bold text-sm md:text-base">{course.instructor_title}</p>
                           </div>
                           <p className="text-gray-400 leading-relaxed text-sm md:text-base max-w-2xl">
                              {course.instructor_bio}
                           </p>
                        </div>
                     </div>
                  </section>
               </div>
            </div>
          </div>
        </main>

        {/* Sidebar Curriculum Overlay for Mobile, Sidebar for Desktop */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              {/* Backdrop for mobile */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="absolute inset-0 bg-black/60 z-30 md:hidden"
              />
              <motion.aside 
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute right-0 top-0 bottom-0 w-[85%] md:w-[400px] md:relative bg-gray-900 border-l border-gray-800 flex flex-col shrink-0 z-40"
              >
                <div className="p-4 md:p-6 border-b border-gray-800 flex items-center justify-between">
                   <h3 className="text-white font-black flex items-center gap-2 text-sm md:text-base">
                     <Menu className="w-4 h-4 md:w-5 md:h-5 text-purple-500" /> 커리큘럼
                   </h3>
                   <span className="text-[9px] md:text-[10px] font-black text-gray-500 px-2 md:px-3 py-1 bg-gray-800 rounded-full">
                     총 {course.curriculum.reduce((acc, curr) => acc + curr.items.length, 0)}강
                   </span>
                </div>
                
                <ScrollArea className="flex-1">
                  <div className="p-3 md:p-4">
                  <Accordion multiple defaultValue={[course.curriculum[0]?.id]} className="space-y-2">
                    {course.curriculum.map((section, sIdx) => (
                      <AccordionItem key={section.id} value={section.id} className="border-none bg-gray-800/30 rounded-xl md:rounded-2xl overflow-hidden px-1 md:px-2">
                        <AccordionTrigger className="hover:no-underline py-3 md:py-4 px-2 md:px-4">
                          <div className="flex items-center gap-2 md:gap-3 text-left">
                             <span className="text-[9px] md:text-[10px] font-black text-purple-400 bg-purple-400/10 w-5 h-5 md:w-6 md:h-6 rounded-lg flex items-center justify-center shrink-0">{sIdx + 1}</span>
                             <span className="text-white font-black text-xs md:text-sm line-clamp-1">{section.title}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-3 md:pb-4 px-1 md:px-2 space-y-1">
                          {section.items.map((item) => (
                             <button
                               key={item.id}
                               onClick={() => {
                                 setActiveItem(item);
                                 if (window.innerWidth < 768) setIsSidebarOpen(false);
                               }}
                               className={`w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-lg md:rounded-xl transition-all group ${activeItem?.id === item.id ? 'bg-purple-600' : 'hover:bg-gray-800'}`}
                             >
                               <div className={`shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-colors ${activeItem?.id === item.id ? 'bg-white/20' : 'bg-gray-800 group-hover:bg-gray-700'}`}>
                                  <PlayCircle className={`w-3.5 h-3.5 md:w-4 md:h-4 ${activeItem?.id === item.id ? 'text-white' : 'text-gray-500'}`} />
                               </div>
                               <div className="flex-1 text-left">
                                  <p className={`text-[11px] md:text-xs font-black ${activeItem?.id === item.id ? 'text-white' : 'text-gray-400'} line-clamp-2 break-keep`}>
                                    {item.title}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                     <span className={`text-[9px] md:text-[10px] font-bold ${activeItem?.id === item.id ? 'text-white/60' : 'text-gray-600'}`}>{item.duration || "00:00"}</span>
                                  </div>
                               </div>
                               <CheckCircle2 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   toggleLessonCompletion(item.id);
                                 }}
                                 className={`w-4 h-4 md:w-5 md:h-5 transition-all cursor-pointer shrink-0 ${
                                   completedLessons.has(item.id) 
                                     ? 'text-green-400 fill-green-400/20' 
                                     : activeItem?.id === item.id ? 'text-white/40 hover:text-white' : 'text-gray-700 hover:text-gray-500'
                                 }`} 
                               />
                             </button>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                  </div>
                </ScrollArea>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}
