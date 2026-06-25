import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Eye,
  Filter,
  Users,
  Star,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { courseService } from '@/services/courseService';
import { supabase } from '@/lib/supabase';
import { reviewService } from '@/services/reviewService';
import { Course } from '@/types';
import { toast } from 'sonner';

export default function AdminCourseManagement() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<(Course & { enrolledCount?: number; averageRating?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const loadCourses = async () => {
    try {
      setLoading(true);
      const coursesData = await courseService.getAllCoursesAsAdmin();
      
      // Fetch enrollments to get exact counts
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('is_deleted', false);
        
      // Fetch reviews
      let reviewsData: any[] = [];
      try {
        reviewsData = await reviewService.getReviews();
      } catch (err) {
        console.error('Error fetching reviews:', err);
      }

      // Calculate statistics offline
      const enrollmentCounts: Record<string, number> = {};
      if (!enrollmentsError && enrollmentsData) {
        enrollmentsData.forEach((item: any) => {
          enrollmentCounts[item.course_id] = (enrollmentCounts[item.course_id] || 0) + 1;
        });
      }

      const reviewRatings: Record<string, number[]> = {};
      if (reviewsData) {
        reviewsData.forEach((item: any) => {
          if (item.course_id) {
            if (!reviewRatings[item.course_id]) {
              reviewRatings[item.course_id] = [];
            }
            reviewRatings[item.course_id].push(item.rating);
          }
        });
      }

      const enrichedCourses = coursesData.map(course => {
        const enrolledCount = enrollmentCounts[course.id] || 0;
        const ratings = reviewRatings[course.id];
        let averageRating = '0.0';
        if (ratings && ratings.length > 0) {
          const sum = ratings.reduce((acc, val) => acc + val, 0);
          averageRating = (sum / ratings.length).toFixed(1);
        }
        return {
          ...course,
          enrolledCount,
          averageRating
        };
      });

      setCourses(enrichedCourses);
    } catch (error) {
      console.error('Failed to load courses:', error);
      toast.error('강의 목록을 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  // Reset page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const [deleteDialogCourseId, setDeleteDialogCourseId] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleteDialogCourseId) return;
    const id = deleteDialogCourseId;
    setDeleteDialogCourseId(null);
    try {
      console.log('Attempting to delete course:', id);
      await courseService.softDeleteCourse(id);
      toast.success('강의가 성공적으로 삭제되었습니다.');
      loadCourses();
    } catch (error) {
      console.error('Failed to delete course:', error);
      toast.error('강의 삭제에 실패했습니다.');
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteDialogCourseId(id);
  };


  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.instructor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="p-8 text-center">강의 목록 로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="강의명, 강사명으로 검색..." 
            className="pl-10 bg-white border-none shadow-sm h-11"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button variant="outline" className="gap-2 bg-white border-none shadow-sm h-11">
            <Filter className="w-4 h-4" />
            필터
          </Button>
          <Button 
            className="gap-2 bg-purple-600 hover:bg-purple-700 h-11 flex-1 md:flex-none"
            onClick={() => navigate('/admin/courses/edit/new')}
          >
            <Plus className="w-4 h-4" />
            새 강의 등록
          </Button>
        </div>
      </div>

      {/* Course List */}
      <div className="grid grid-cols-1 gap-4">
        {(() => {
          const totalPages = Math.ceil(filteredCourses.length / ITEMS_PER_PAGE);
          const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
          const paginatedCourses = filteredCourses.slice(startIndex, startIndex + ITEMS_PER_PAGE);

          if (filteredCourses.length === 0) {
            return (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed">
                <p className="text-gray-400">데이터가 없습니다.</p>
              </div>
            );
          }

          return (
            <>
              {paginatedCourses.map((course) => (
                <Card key={course.id} className="border-none shadow-sm overflow-hidden hover:ring-2 hover:ring-purple-100 transition-all">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      <div className="w-full md:w-48 h-32 md:h-auto relative">
                          {course.thumbnail ? (
                            <img 
                              src={course.thumbnail} 
                              alt={course.title}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <BookOpen className="w-8 h-8 text-gray-300" />
                            </div>
                          )}
                        <div className="absolute top-2 left-2">
                          <Badge className={course.status === 'published' ? 'bg-green-500' : 'bg-gray-500'}>
                            {course.status === 'published' ? '공개 중' : '초안'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex-1 p-6 flex flex-col justify-between">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h3 className="font-bold text-gray-900 line-clamp-1">{course.title}</h3>
                            <p className="text-sm text-gray-500 mt-1">{course.instructor} 강사</p>
                          </div>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-5 h-5 text-gray-400" />
                          </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-6 mt-4">
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <Users className="w-4 h-4" />
                            {course.enrolledCount ?? 0}명 결제 완료
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            {course.averageRating ?? '4.9'}
                          </div>
                          <div className="text-sm font-bold text-gray-900">
                            ₩{(course.discount_price || course.price).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="p-6 border-t md:border-t-0 md:border-l flex md:flex-col justify-end gap-2 bg-gray-50/50">
                        <Link to={`/course/${course.id}`}>
                          <Button variant="outline" size="sm" className="gap-2 bg-white w-full">
                            <Eye className="w-4 h-4" />
                            미리보기
                          </Button>
                        </Link>
                        <Link to={`/admin/courses/edit/${course.id}`}>
                          <Button variant="outline" size="sm" className="gap-2 bg-white w-full">
                            <Edit2 className="w-4 h-4" />
                            편집하기
                          </Button>
                        </Link>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 bg-white"
                          onClick={() => handleDeleteClick(course.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                          삭제
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-6 py-4 bg-white rounded-xl border-gray-100 shadow-sm mt-4">
                  <div className="text-sm text-gray-500">
                    전체 <span className="font-bold text-purple-600">{filteredCourses.length}</span>개 강의 중{' '}
                    <span className="font-bold text-gray-700">{startIndex + 1}</span>-{Math.min(startIndex + ITEMS_PER_PAGE, filteredCourses.length)}개 표시
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      className="h-9 px-3 text-sm font-medium border-gray-100 text-gray-600 hover:bg-gray-50"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    >
                      이전
                    </Button>
                    
                    {(() => {
                      const maxButtons = 5;
                      let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
                      let endPage = startPage + maxButtons - 1;
                      
                      if (endPage > totalPages) {
                        endPage = totalPages;
                        startPage = Math.max(1, endPage - maxButtons + 1);
                      }
                      
                      const buttons = [];
                      for (let i = startPage; i <= endPage; i++) {
                        if (i >= 1 && i <= totalPages) {
                          buttons.push(i);
                        }
                      }
                      
                      return buttons.map((pageNum) => (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          className={currentPage === pageNum 
                            ? "bg-purple-600 hover:bg-purple-700 text-white font-bold h-9 w-9 shadow-sm" 
                            : "h-9 w-9 border-gray-100 text-gray-600 hover:bg-gray-50"
                          }
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      ));
                    })()}

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      className="h-9 px-3 text-sm font-medium border-gray-100 text-gray-600 hover:bg-gray-50"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    >
                      다음
                    </Button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteDialogCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-6 shadow-xl">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-900">강의 삭제</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                정말 이 강의를 삭제하시겠습니까?<br/>
                (실제 데이터베이스에서 삭제되지 않으며 상태만 삭제 상태로 변경됩니다.)
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button 
                variant="outline" 
                className="rounded-xl border-gray-200"
                onClick={() => setDeleteDialogCourseId(null)}
              >
                취소
              </Button>
              <Button 
                variant="destructive" 
                className="rounded-xl bg-red-600 hover:bg-red-700"
                onClick={confirmDelete}
              >
                삭제하기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
