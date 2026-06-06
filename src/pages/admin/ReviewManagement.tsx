import React, { useState, useEffect } from 'react';
import { 
  Star,
  Trash2,
  Search,
  BookOpen,
  Filter
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { reviewService, Review } from '@/services/reviewService';

export default function ReviewManagement() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadReviews = async () => {
      try {
        const data = await reviewService.getReviews();
        setReviews(data);
      } catch (error) {
        toast.error('후기 데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    loadReviews();
  }, []);

  const [deleteDialogReviewId, setDeleteDialogReviewId] = useState<string | null>(null);

  const confirmDeleteReview = async () => {
    if (!deleteDialogReviewId) return;
    const id = deleteDialogReviewId;
    setDeleteDialogReviewId(null);
    try {
      await reviewService.deleteReview(id);
      setReviews(reviews.filter(r => r.id !== id));
      toast.info('수강후기가 삭제되었습니다.');
    } catch (error) {
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteReviewClick = (id: string) => {
    setDeleteDialogReviewId(id);
  };

  const handleToggleBestReview = async (id: string, currentBest: boolean) => {
    try {
      await reviewService.toggleBestReview(id, !currentBest);
      setReviews(reviews.map(r => r.id === id ? { ...r, is_best: !currentBest } : r));
      toast.success(currentBest ? '베스트 수강후기에서 제외되었습니다.' : '베스트 수강후기로 선정되었습니다.');
    } catch (error) {
      toast.error('설정 변경 중 오류가 발생했습니다.');
    }
  };

  const filteredReviews = reviews.filter(r => 
    r.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.course_title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-10 text-center font-bold text-gray-400">후기 데이터를 불러오는 중...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tighter">수강 후기 관리</h1>
          <p className="text-gray-500 font-bold mt-1">사용자들이 남긴 소중한 후기를 관리하고 베스트 후기를 선정하십시오.</p>
        </div>
        <Badge variant="outline" className="px-6 py-2 rounded-2xl text-sm bg-purple-50 text-purple-700 border-purple-200 font-black">
          총 {reviews.length}개의 후기
        </Badge>
      </div>

      <Card className="rounded-[40px] border-none shadow-sm overflow-hidden">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-600 transition-colors" />
              <Input 
                placeholder="내용, 작성자, 강의명으로 검색..." 
                className="pl-12 h-14 bg-gray-50 border-none rounded-2xl font-bold" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" className="h-14 px-6 rounded-2xl border-gray-100 font-black gap-2">
              <Filter className="w-5 h-5" /> 필터링
            </Button>
          </div>

          <div className="space-y-6">
            {filteredReviews.length === 0 ? (
              <div className="py-20 text-center text-gray-400 font-bold bg-gray-50 rounded-[40px] border-2 border-dashed border-gray-100">
                검색 결과가 없거나 등록된 후기가 없습니다.
              </div>
            ) : (
              filteredReviews.map((review) => (
                <div key={review.id} className="group bg-white p-8 rounded-[40px] border border-gray-50 hover:border-purple-100 hover:shadow-xl hover:shadow-purple-500/5 transition-all flex flex-col md:flex-row gap-8">
                  <div className="flex-shrink-0 flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-3xl overflow-hidden bg-gray-100 shadow-inner">
                      <img 
                        src={review.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.user_id}`} 
                        alt="User" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <Badge variant="secondary" className="font-bold text-[10px] px-2 py-0.5 rounded-full">
                      ID: {review.user_id?.substring(0, 8)}
                    </Badge>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-black text-gray-900">{review.user_name || '익명 수강생'}</span>
                          <span className="text-xs font-bold text-gray-400">{new Date(review.created_at || '').toLocaleString('ko-KR')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-100 text-purple-600 border-none font-black text-[10px] uppercase tracking-wider px-2">
                            {review.course_category || 'COURSE'}
                          </Badge>
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <BookOpen className="w-3 h-3" />
                            <span className="text-xs font-bold">{review.course_title}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-400 p-2 bg-yellow-50 rounded-2xl px-4 border border-yellow-100">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'text-gray-200'}`} />
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50/50 p-6 rounded-3xl relative">
                      <span className="absolute -top-3 -left-1 text-4xl text-purple-200 font-serif">"</span>
                      <p className="text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">{review.content}</p>
                      <span className="absolute -bottom-6 -right-1 text-4xl text-purple-200 font-serif">"</span>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
                          <Label className="text-xs font-black text-gray-500 uppercase tracking-widest cursor-pointer" htmlFor={`best-${review.id}`}>
                            메인 베스트 노출
                          </Label>
                          <Switch 
                            id={`best-${review.id}`}
                            checked={review.is_best} 
                            onCheckedChange={() => handleToggleBestReview(review.id, review.is_best)} 
                            className="data-[state=checked]:bg-purple-600"
                          />
                        </div>
                        {review.is_best && (
                          <Badge className="bg-yellow-400 text-white border-none font-black animate-pulse">BEST ACTIVE</Badge>
                        )}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-12 h-12 rounded-2xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                        onClick={() => handleDeleteReviewClick(review.id)}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      {deleteDialogReviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-6 shadow-xl">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-900">후기 삭제</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                정말로 이 후기를 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다.)
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button 
                variant="outline" 
                className="rounded-xl border-gray-200"
                onClick={() => setDeleteDialogReviewId(null)}
              >
                취소
              </Button>
              <Button 
                variant="destructive" 
                className="rounded-xl bg-red-600 hover:bg-red-700"
                onClick={confirmDeleteReview}
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
