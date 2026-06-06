import { supabase } from '@/lib/supabase';

export interface Review {
  id: string;
  course_id?: string;
  course_title?: string;
  course_category?: string;
  user_id?: string;
  user_name?: string;
  user_avatar?: string;
  content: string;
  rating: number;
  is_best: boolean;
  is_deleted: boolean;
  created_at?: string;
}

export const reviewService = {
  async getReviewsByCourseId(courseId: string): Promise<Review[]> {
    const { data: remoteData, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('course_id', courseId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews by course:', error);
    }
    
    const localData = JSON.parse(localStorage.getItem('offline_reviews') || '[]');
    const localCourseReviews = localData.filter((r: Review) => r.course_id === courseId);
    const remote = remoteData || [];
    
    const combined = [...localCourseReviews, ...remote].sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    
    return combined;
  },

  async getReviews(): Promise<Review[]> {
    const { data: remoteData, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
    }
    
    // Always merge with local storage for demo resilience
    const localData = JSON.parse(localStorage.getItem('offline_reviews') || '[]');
    const remote = remoteData || [];
    
    // Combine and sort by date
    const combined = [...localData, ...remote].sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    
    return combined;
  },

  async getBestReviews(): Promise<Review[]> {
    const { data: remoteData, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('is_deleted', false)
      .eq('is_best', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching best reviews:', error);
    }

    const localData = JSON.parse(localStorage.getItem('offline_reviews') || '[]');
    const localBest = localData.filter((r: Review) => r.is_best);
    const remote = remoteData || [];

    const combined = [...localBest, ...remote].sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    return combined;
  },

  async toggleBestReview(id: string, isBest: boolean): Promise<void> {
    // Try local storage first if it's a local review
    const localData = JSON.parse(localStorage.getItem('offline_reviews') || '[]');
    const localIndex = localData.findIndex((r: Review) => r.id === id);
    
    if (localIndex !== -1) {
      localData[localIndex].is_best = isBest;
      localStorage.setItem('offline_reviews', JSON.stringify(localData));
      // Even if local, we also try remote just in case (though unlikely to find it)
    }

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (session) {
        const response = await fetch('/api/core-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'admin-toggle-best-review',
            reviewId: id,
            isBest: isBest
          })
        });
        const result = await response.json();
        if (response.ok && result.status === 'success') {
          return;
        } else if (result.message) {
          throw new Error(result.message);
        }
      }
    } catch (e: any) {
      console.warn('Error toggling best review through server API, trying direct client call:', e);
      if (localIndex === -1 && !e.message?.includes('network')) {
        throw e;
      }
    }

    const { error } = await supabase
      .from('reviews')
      .update({ is_best: isBest })
      .eq('id', id);

    if (error && localIndex === -1) {
      console.error('Error toggling best review:', error);
      throw new Error('베스트 설정 변경에 실패했습니다.');
    }
  },

  async deleteReview(id: string): Promise<void> {
    // 1. 로컬 스토리지 데이터 처리 (폴백 데이터 삭제)
    const localData = JSON.parse(localStorage.getItem('offline_reviews') || '[]');
    const localIndex = localData.findIndex((r: Review) => r.id === id);
    
    if (localIndex !== -1) {
      const updatedLocalData = localData.filter((r: Review) => r.id !== id);
      localStorage.setItem('offline_reviews', JSON.stringify(updatedLocalData));
    }

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (session) {
        const response = await fetch('/api/core-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'admin-delete-review',
            reviewId: id
          })
        });
        const result = await response.json();
        if (response.ok && result.status === 'success') {
          return;
        } else if (result.message) {
          throw new Error(result.message);
        }
      }
    } catch (e: any) {
      console.warn('Error deleting review through server API, trying direct client call:', e);
      if (localIndex === -1 && !e.message?.includes('network')) {
        throw e;
      }
    }

    // 2. 원격 DB 데이터 처리 (is_deleted 필드 업데이트)
    const { error } = await supabase
      .from('reviews')
      .update({ is_deleted: true })
      .eq('id', id);

    // 로컬에서도 없고 DB에서도 에러가 나면 예외 처리
    if (error && localIndex === -1) {
      console.error('Error deleting review:', error);
      throw new Error('수강후기 삭제에 실패했습니다.');
    }
  },

  async createReview(review: Partial<Review>): Promise<Review> {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .insert([{
          ...review,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase Review Insert Error:', error);
        
        // Fallback for demo/preview purposes if table doesn't exist
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('row-level security')) {
          console.warn('Falling back to localStorage for review storage...');
          const offlineReview = {
            id: crypto.randomUUID(),
            ...review,
            created_at: new Date().toISOString(),
          } as Review;
          
          const existing = JSON.parse(localStorage.getItem('offline_reviews') || '[]');
          localStorage.setItem('offline_reviews', JSON.stringify([offlineReview, ...existing]));
          return offlineReview;
        }
        
        throw error;
      }
      return data;
    } catch (err) {
      console.error('Final Review Error:', err);
      // Even if everything fails, try to save locally for the user's immediate feedback
      const offlineReview = {
        id: crypto.randomUUID(),
        ...review,
        created_at: new Date().toISOString(),
      } as Review;
      const existing = JSON.parse(localStorage.getItem('offline_reviews') || '[]');
      localStorage.setItem('offline_reviews', JSON.stringify([offlineReview, ...existing]));
      return offlineReview;
    }
  }
};
